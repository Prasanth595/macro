//! OpenAI-compatible discovery and routing with approved, pinned DNS addresses.
use crate::domain::{models::*, ports::ProviderEndpoint, service::validate_url};
use async_trait::async_trait;
use serde::Deserialize;
use std::{
    net::{IpAddr, Ipv4Addr, SocketAddr},
    sync::Arc,
    time::Duration,
};

/// Endpoint adapter; private addresses are permitted only by local deployments.
pub struct OpenAiEndpoint {
    allow_local: bool,
}
impl OpenAiEndpoint {
    /// Select the deployment's network boundary once at startup.
    pub fn new(allow_local: bool) -> Self {
        Self { allow_local }
    }
    async fn client(&self, provider: &Provider) -> Result<reqwest::Client, ProviderError> {
        let base = validate_url(&provider.base_url, self.allow_local)?;
        let url = url::Url::parse(&base).map_err(|_| ProviderError::Endpoint)?;
        let host = url
            .host_str()
            .ok_or(ProviderError::Endpoint)?
            .trim_matches(['[', ']']);
        let port = url.port_or_known_default().ok_or(ProviderError::Endpoint)?;
        let addresses: Vec<SocketAddr> = tokio::time::timeout(
            Duration::from_secs(5),
            tokio::net::lookup_host((host, port)),
        )
        .await
        .map_err(|_| ProviderError::Endpoint)?
        .map_err(|_| ProviderError::Endpoint)?
        .collect();
        if addresses.is_empty()
            || addresses
                .iter()
                .any(|address| !approved_ip(address.ip(), self.allow_local))
        {
            return Err(ProviderError::Invalid(
                "This endpoint address is not allowed by this deployment".to_owned(),
            ));
        }
        reqwest::Client::builder()
            .resolve_to_addrs(host, &addresses)
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .retry(reqwest::retry::never())
            .connect_timeout(Duration::from_secs(10))
            .build()
            .map_err(|_| ProviderError::Endpoint)
    }
}
/// Reject metadata/link-local/unspecified addresses even on a local deployment.
pub(crate) fn approved_ip(ip: IpAddr, allow_local: bool) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            !ip.is_unspecified()
                && !ip.is_link_local()
                && !ip.is_multicast()
                && !ip.is_broadcast()
                && ip.octets()[0] != 0
                && ip.octets()[0] < 240
                && !(ip.octets()[0] == 100 && (64..128).contains(&ip.octets()[1]))
                && (allow_local || (!ip.is_private() && !ip.is_loopback()))
        }
        IpAddr::V6(ip) => {
            let segments = ip.segments();
            // NAT64 and 6to4 can route to IPv4 destinations; apply the same
            // boundary to those destinations as to mapped/compatible addresses.
            let embedded = if segments[..6] == [0x64, 0xff9b, 0, 0, 0, 0] {
                Some(Ipv4Addr::from(
                    (u32::from(segments[6]) << 16) | u32::from(segments[7]),
                ))
            } else if segments[0] == 0x2002 {
                Some(Ipv4Addr::from(
                    (u32::from(segments[1]) << 16) | u32::from(segments[2]),
                ))
            } else if !ip.is_loopback() {
                ip.to_ipv4()
            } else {
                None
            };
            match embedded {
                Some(ip) => approved_ip(IpAddr::V4(ip), allow_local),
                None => {
                    !ip.is_unspecified()
                        && !ip.is_unicast_link_local()
                        && (segments[0] & 0xffc0) != 0xfec0
                        && !ip.is_multicast()
                        && (allow_local || (!ip.is_loopback() && !ip.is_unique_local()))
                }
            }
        }
    }
}
#[async_trait]
impl ProviderEndpoint for OpenAiEndpoint {
    async fn discover(&self, provider: &Provider) -> Result<Vec<ProviderModel>, ProviderError> {
        let client = self.client(provider).await?;
        let mut request = client
            .get(format!("{}/models", provider.base_url))
            .timeout(Duration::from_secs(15));
        if let Some(key) = &provider.api_key {
            request = request.bearer_auth(&key.0);
        }
        let mut response = request.send().await.map_err(|_| ProviderError::Endpoint)?;
        if !response.status().is_success() {
            return Err(ProviderError::Endpoint);
        }
        let mut body = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| ProviderError::Endpoint)?
        {
            if body.len() + chunk.len() > 1_048_576 {
                return Err(ProviderError::Endpoint);
            }
            body.extend_from_slice(&chunk);
        }
        #[derive(Deserialize)]
        struct Model {
            id: String,
        }
        #[derive(Deserialize)]
        struct Models {
            data: Vec<Model>,
        }
        let mut models: Vec<_> = serde_json::from_slice::<Models>(&body)
            .map_err(|_| ProviderError::Endpoint)?
            .data
            .into_iter()
            .filter(|model| {
                !model.id.is_empty()
                    && model.id.len() <= 256
                    && !model
                        .id
                        .chars()
                        .any(|character| character.is_whitespace() || character.is_control())
            })
            .map(|model| ProviderModel {
                name: model
                    .id
                    .char_indices()
                    .take_while(|(index, character)| index + character.len_utf8() <= 100)
                    .map(|(_, character)| character)
                    .collect(),
                id: model.id,
                supports_images: false,
            })
            .collect();
        models.sort_by(|a, b| a.id.cmp(&b.id));
        models.dedup_by(|a, b| a.id == b.id);
        models.truncate(100);
        Ok(models)
    }
    async fn router(
        &self,
        provider: &Provider,
    ) -> Result<Arc<agent::ModelRouter<agent::MeteredHttpClient>>, ProviderError> {
        let http = self.client(provider).await?;
        let router = agent::ModelRouter::openai_compatible(
            &provider.id.segment(),
            &provider.base_url,
            provider.api_key.as_ref().map_or("", |key| &key.0),
            http,
        )
        .map_err(|_| ProviderError::Endpoint)?;
        Ok(Arc::new(router))
    }
}
#[cfg(test)]
mod test;
