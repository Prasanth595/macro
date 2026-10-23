//! Who pays for a turn: the owner's Macro allowance, their own provider API
//! key, or their team's.
//!
//! A session starts on Macro usage. When the owner's allowance is spent and
//! they have a key for the selected model's provider (their own first, then
//! their team's), a conversation that has not started yet moves to the key on
//! its own; one already under way stops and asks, since the person may not
//! want their key or their team billed. Agreeing (or choosing a key in the
//! composer) sets the session's [`Funding`] to that key, and every later turn
//! runs on it without admission, so it never counts against the owner's
//! allowance.

use ai_billing::domain::{AiAdmissionError, AiAdmissionService};
use model_owner::Owner;
use model_provider_keys::domain::{
    AvailableKeys, KeySource, ModelKeys, ModelProvider, UsableProviderKey,
};

#[cfg(test)]
mod test;

/// ACP config option id for the session's [`Funding`].
pub const FUNDING_CONFIG_ID: &str = "funding";

/// What a session's turns run on.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum Funding {
    /// The owner's Macro AI allowance.
    #[default]
    Macro,
    /// The owner's own provider API key.
    PersonalApiKey,
    /// The owner's team's own provider API key.
    TeamApiKey,
}

impl Funding {
    /// Every funding, in the order the composer offers them.
    pub const ALL: [Self; 3] = [Self::Macro, Self::PersonalApiKey, Self::TeamApiKey];

    /// The config option value.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Macro => "macro",
            Self::PersonalApiKey => "personal_api_key",
            Self::TeamApiKey => "team_api_key",
        }
    }

    /// The funding a config option value names.
    #[must_use]
    pub fn parse(value: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|funding| funding.as_str() == value)
    }

    /// The key this funding runs on, if any.
    #[must_use]
    pub const fn key_source(self) -> Option<KeySource> {
        match self {
            Self::Macro => None,
            Self::PersonalApiKey => Some(KeySource::Personal),
            Self::TeamApiKey => Some(KeySource::Team),
        }
    }

    /// What the composer offers when the session is on `current` and the
    /// owner has `keys`: Macro usage, each source they have a key from, and
    /// `current` even if its key is gone, so the selection stays visible.
    /// Empty when only Macro usage is on offer.
    #[must_use]
    pub fn offered(current: Self, keys: &AvailableKeys) -> Vec<Self> {
        let offered: Vec<_> = Self::ALL
            .into_iter()
            .filter(|funding| {
                *funding == current || funding.key_source().is_none_or(|source| keys.has(source))
            })
            .collect();
        if offered == [Self::Macro] {
            Vec::new()
        } else {
            offered
        }
    }

    /// The funding that runs on `source`'s key.
    #[must_use]
    pub const fn on_key(source: KeySource) -> Self {
        match source {
            KeySource::Personal => Self::PersonalApiKey,
            KeySource::Team => Self::TeamApiKey,
        }
    }
}

/// How one turn is paid for.
#[derive(Debug)]
pub enum TurnFunding {
    /// Admitted against the owner's allowance.
    Macro,
    /// On a key the owner may use for the turn's model, decrypted for this
    /// turn only.
    Key(UsableProviderKey),
}

/// Why a turn cannot run.
#[derive(Debug, PartialEq, Eq)]
pub enum FundingRefusal {
    /// Macro admission refused or failed, and no key can take over.
    Admission(AiAdmissionError),
    /// The allowance is spent mid-conversation and the owner's key from this
    /// source could carry on; the person decides.
    ContinueOnKey(KeySource),
    /// The session runs on this source's key, but none the owner may use
    /// serves the turn's model.
    KeyUnavailable(KeySource),
}

/// Decide how a turn on `model` is paid for under the session's `funding`.
///
/// `conversation_started` is whether earlier turns ran: an allowance spent
/// before the first turn moves to a key without asking, one spent during a
/// conversation does not.
pub async fn fund_turn(
    admission: &dyn AiAdmissionService,
    keys: &dyn ModelKeys,
    owner: &Owner,
    model: &str,
    funding: Funding,
    conversation_started: bool,
) -> Result<TurnFunding, FundingRefusal> {
    let user = owner
        .as_user()
        .ok_or(FundingRefusal::Admission(AiAdmissionError::Unavailable))?;
    let provider = ModelProvider::of_model(model);
    if let Some(source) = funding.key_source() {
        let provider = provider.ok_or(FundingRefusal::KeyUnavailable(source))?;
        return match keys.usable_key(user, provider, source).await {
            Ok(Some(key)) => Ok(TurnFunding::Key(key)),
            Ok(None) => Err(FundingRefusal::KeyUnavailable(source)),
            Err(error) => {
                tracing::error!(error = ?error, "could not read the provider key");
                Err(FundingRefusal::Admission(AiAdmissionError::Unavailable))
            }
        };
    }
    let denial = match super::admission::admit_turn(admission, owner).await {
        Ok(()) => return Ok(TurnFunding::Macro),
        Err(denial @ AiAdmissionError::Denied(_)) => denial,
        Err(error) => return Err(FundingRefusal::Admission(error)),
    };
    let Some(provider) = provider else {
        return Err(FundingRefusal::Admission(denial));
    };
    // The owner's own key comes before their team's: it is the one they set
    // up for themselves. A failed lookup leaves the denial standing: it is
    // the answer the owner would have had without keys.
    for source in [KeySource::Personal, KeySource::Team] {
        let key = keys
            .usable_key(user, provider, source)
            .await
            .inspect_err(|error| tracing::error!(error = ?error, "could not read the provider key"))
            .ok()
            .flatten();
        match key {
            None => {}
            Some(key) if !conversation_started => return Ok(TurnFunding::Key(key)),
            Some(_) => return Err(FundingRefusal::ContinueOnKey(source)),
        }
    }
    Err(FundingRefusal::Admission(denial))
}
