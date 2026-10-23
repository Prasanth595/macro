use std::sync::Mutex;

use ai_billing::domain::DenyReason;
use macro_user_id::user_id::MacroUserIdStr;
use model_provider_keys::domain::{AvailableKeys, ProviderApiKey, ProviderKeyError};

use super::*;
use crate::testing::TestAdmission;

const ANTHROPIC_MODEL: &str = "anthropic/claude-sonnet-5-5";
const SPENT: Result<(), AiAdmissionError> =
    Err(AiAdmissionError::Denied(DenyReason::AllowanceExhausted));

fn owner() -> Owner {
    Owner::User(MacroUserIdStr::try_from_email("owner@macro.com").expect("valid email"))
}

/// Anthropic keys the owner has, by source; records what was asked for.
#[derive(Default)]
struct Keys {
    personal: bool,
    team: bool,
    asked: Mutex<Vec<(ModelProvider, KeySource)>>,
}

#[async_trait::async_trait]
impl ModelKeys for Keys {
    async fn usable_key(
        &self,
        _user: &MacroUserIdStr<'_>,
        provider: ModelProvider,
        source: KeySource,
    ) -> Result<Option<UsableProviderKey>, ProviderKeyError> {
        self.asked.lock().expect("lock").push((provider, source));
        let has = match source {
            KeySource::Personal => self.personal,
            KeySource::Team => self.team,
        };
        Ok(
            (has && provider == ModelProvider::Anthropic).then(|| UsableProviderKey {
                id: macro_uuid::generate_uuid_v7(),
                source,
                key: ProviderApiKey::parse(provider, "sk-ant-api03-abc").expect("valid key"),
            }),
        )
    }

    async fn available(
        &self,
        _user: &MacroUserIdStr<'_>,
    ) -> Result<AvailableKeys, ProviderKeyError> {
        let anthropic = |has: bool| {
            has.then_some(ModelProvider::Anthropic)
                .into_iter()
                .collect()
        };
        Ok(AvailableKeys {
            personal: anthropic(self.personal),
            team: anthropic(self.team),
        })
    }
}

fn team_key() -> Keys {
    Keys {
        team: true,
        ..Keys::default()
    }
}

fn both_keys() -> Keys {
    Keys {
        personal: true,
        team: true,
        ..Keys::default()
    }
}

fn source_of(funding: &Result<TurnFunding, FundingRefusal>) -> Option<KeySource> {
    match funding {
        Ok(TurnFunding::Key(key)) => Some(key.source),
        _ => None,
    }
}

#[tokio::test]
async fn an_admitted_turn_runs_on_macro_without_touching_keys() {
    let keys = both_keys();
    let funding = fund_turn(
        &TestAdmission::new(Ok(())),
        &keys,
        &owner(),
        ANTHROPIC_MODEL,
        Funding::Macro,
        true,
    )
    .await;
    assert!(matches!(funding, Ok(TurnFunding::Macro)));
    assert!(keys.asked.lock().expect("lock").is_empty());
}

#[tokio::test]
async fn a_spent_allowance_moves_a_new_conversation_to_the_team_key() {
    let funding = fund_turn(
        &TestAdmission::new(SPENT),
        &team_key(),
        &owner(),
        ANTHROPIC_MODEL,
        Funding::Macro,
        false,
    )
    .await;
    assert_eq!(source_of(&funding), Some(KeySource::Team));
}

#[tokio::test]
async fn a_spent_allowance_prefers_the_owners_own_key_to_the_teams() {
    let funding = fund_turn(
        &TestAdmission::new(SPENT),
        &both_keys(),
        &owner(),
        ANTHROPIC_MODEL,
        Funding::Macro,
        false,
    )
    .await;
    assert_eq!(source_of(&funding), Some(KeySource::Personal));

    let funding = fund_turn(
        &TestAdmission::new(SPENT),
        &both_keys(),
        &owner(),
        ANTHROPIC_MODEL,
        Funding::Macro,
        true,
    )
    .await;
    assert!(matches!(
        funding,
        Err(FundingRefusal::ContinueOnKey(KeySource::Personal))
    ));
}

#[tokio::test]
async fn a_spent_allowance_mid_conversation_asks_before_using_the_team_key() {
    let funding = fund_turn(
        &TestAdmission::new(SPENT),
        &team_key(),
        &owner(),
        ANTHROPIC_MODEL,
        Funding::Macro,
        true,
    )
    .await;
    assert!(matches!(
        funding,
        Err(FundingRefusal::ContinueOnKey(KeySource::Team))
    ));
}

#[tokio::test]
async fn without_a_key_for_the_model_the_denial_stands() {
    for (keys, model) in [
        (Keys::default(), ANTHROPIC_MODEL),
        (both_keys(), "openai/gpt-6-astra"),
        (both_keys(), "google/gemini-3.8-flash"),
    ] {
        let funding = fund_turn(
            &TestAdmission::new(SPENT),
            &keys,
            &owner(),
            model,
            Funding::Macro,
            false,
        )
        .await;
        assert!(
            matches!(funding, Err(FundingRefusal::Admission(denial)) if Err(denial) == SPENT),
            "{model} should keep the denial"
        );
    }
}

#[tokio::test]
async fn a_session_on_a_key_skips_admission_and_uses_only_that_source() {
    for (funding, source) in [
        (Funding::PersonalApiKey, KeySource::Personal),
        (Funding::TeamApiKey, KeySource::Team),
    ] {
        let admission = TestAdmission::new(SPENT);
        let keys = both_keys();
        let turn = fund_turn(&admission, &keys, &owner(), ANTHROPIC_MODEL, funding, true).await;
        assert_eq!(source_of(&turn), Some(source));
        assert!(admission.calls.lock().expect("lock").is_empty());
        assert_eq!(
            *keys.asked.lock().expect("lock"),
            vec![(ModelProvider::Anthropic, source)]
        );
    }
}

#[tokio::test]
async fn a_session_on_a_key_refuses_a_model_no_key_serves() {
    for (keys, model, funding, source) in [
        (
            Keys::default(),
            ANTHROPIC_MODEL,
            Funding::TeamApiKey,
            KeySource::Team,
        ),
        (
            team_key(),
            ANTHROPIC_MODEL,
            Funding::PersonalApiKey,
            KeySource::Personal,
        ),
        (
            both_keys(),
            "google/gemini-3.8-flash",
            Funding::TeamApiKey,
            KeySource::Team,
        ),
    ] {
        let turn = fund_turn(
            &TestAdmission::new(Ok(())),
            &keys,
            &owner(),
            model,
            funding,
            true,
        )
        .await;
        assert_eq!(turn.err(), Some(FundingRefusal::KeyUnavailable(source)));
    }
}

#[tokio::test]
async fn non_user_owners_never_reach_a_key() {
    let keys = both_keys();
    let funding = fund_turn(
        &TestAdmission::new(Ok(())),
        &keys,
        &Owner::Team(macro_uuid::generate_uuid_v7()),
        ANTHROPIC_MODEL,
        Funding::TeamApiKey,
        true,
    )
    .await;
    assert!(matches!(
        funding,
        Err(FundingRefusal::Admission(AiAdmissionError::Unavailable))
    ));
    assert!(keys.asked.lock().expect("lock").is_empty());
}

#[test]
fn the_composer_offers_each_source_the_owner_has_a_key_from() {
    let keys = |personal: bool, team: bool| AvailableKeys {
        personal: personal
            .then_some(ModelProvider::Anthropic)
            .into_iter()
            .collect(),
        team: team.then_some(ModelProvider::OpenAi).into_iter().collect(),
    };
    assert!(Funding::offered(Funding::Macro, &keys(false, false)).is_empty());
    assert_eq!(
        Funding::offered(Funding::Macro, &keys(true, false)),
        vec![Funding::Macro, Funding::PersonalApiKey]
    );
    assert_eq!(
        Funding::offered(Funding::Macro, &keys(true, true)),
        Funding::ALL.to_vec()
    );
    assert_eq!(
        Funding::offered(Funding::TeamApiKey, &keys(false, false)),
        vec![Funding::Macro, Funding::TeamApiKey],
        "a session on a key that is gone still shows it"
    );
}
