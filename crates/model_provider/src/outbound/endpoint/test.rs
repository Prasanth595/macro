use super::*;

#[test]
fn network_boundary_rejects_metadata_and_private_cloud_addresses() {
    for ip in [
        "127.0.0.1",
        "10.0.0.1",
        "192.168.0.1",
        "172.16.0.1",
        "::1",
        "fd00::1",
        "::ffff:127.0.0.1",
    ] {
        assert!(!approved_ip(ip.parse().unwrap(), false), "{ip}");
        assert!(approved_ip(ip.parse().unwrap(), true), "{ip}");
    }
    for ip in ["169.254.169.254", "0.0.0.0", "::", "fe80::1", "224.0.0.1"] {
        assert!(!approved_ip(ip.parse().unwrap(), false), "{ip}");
        assert!(!approved_ip(ip.parse().unwrap(), true), "{ip}");
    }
    assert!(approved_ip("8.8.8.8".parse().unwrap(), false));
}

#[tokio::test]
async fn discovers_models_from_a_local_compatible_endpoint() {
    use wiremock::{
        Mock, MockServer, ResponseTemplate,
        matchers::{header, method, path},
    };
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/v1/models"))
        .and(header("authorization", "Bearer test-key"))
        .respond_with(ResponseTemplate::new(200).set_body_json(
            serde_json::json!({"data": [{"id":"llama3.2"},{"id":"llama3.2"},{"id":"qwen"}]}),
        ))
        .expect(1)
        .mount(&server)
        .await;
    let provider = Provider {
        id: ProviderId(uuid::Uuid::now_v7()),
        name: "Local".into(),
        base_url: format!("{}/v1", server.uri()),
        api_key: Some(ApiKey("test-key".into())),
        enabled: true,
        models: vec![],
    };
    let models = OpenAiEndpoint::new(true).discover(&provider).await.unwrap();
    assert_eq!(models.len(), 2);
    assert_eq!(models[0].id, "llama3.2");
    assert!(OpenAiEndpoint::new(true).router(&provider).await.is_ok());
    assert!(
        OpenAiEndpoint::new(false)
            .discover(&provider)
            .await
            .is_err()
    );
}
