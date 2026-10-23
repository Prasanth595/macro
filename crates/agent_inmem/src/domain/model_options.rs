//! ACP session configuration advertised by the in-memory agent.

use agent::{ModelSpeed, ReasoningEffort};
use agent_client_protocol::schema::v1::{
    SessionConfigOption, SessionConfigOptionCategory, SessionConfigSelectOption,
    SessionConfigValueId,
};
use agent_runtime_protocol::domain::action::MODEL_CONFIG_ID;

use super::funding::{FUNDING_CONFIG_ID, Funding};

/// Build session configuration from the actual turn engine catalog and state.
///
/// `funding` lists the usage sources on offer (see [`Funding::offered`]); an
/// empty list leaves the option out.
#[must_use]
pub fn session_config_options(
    current_model: &str,
    models: &[&str],
    current_effort: ReasoningEffort,
    current_speed: ModelSpeed,
    funding: &[Funding],
    current_funding: Funding,
) -> Vec<SessionConfigOption> {
    let options: Vec<_> = models
        .iter()
        .map(|model| {
            SessionConfigSelectOption::new(
                SessionConfigValueId::new((*model).to_owned()),
                super::models::display_name(model),
            )
            .meta(super::models::supports_images(model).map(|supported| {
                serde_json::Map::from_iter([(
                    "macro.supportsImages".to_owned(),
                    serde_json::Value::Bool(supported),
                )])
            }))
            .description(
                (super::models::supports_images(model) == Some(false))
                    .then(|| "Text only — image attachments are not supported".to_owned()),
            )
        })
        .collect();
    let mut config = vec![
        SessionConfigOption::select(
            MODEL_CONFIG_ID,
            "Model",
            SessionConfigValueId::new(current_model.to_owned()),
            options,
        )
        .category(SessionConfigOptionCategory::Model),
    ];
    if !ReasoningEffort::supported(current_model).is_empty() {
        config.push(reasoning_effort_config_option(
            current_model,
            current_effort,
        ));
    }
    if let Some(speed) = speed_config_option(current_model, current_speed) {
        config.push(speed);
    }
    if !funding.is_empty() {
        config.push(funding_config_option(current_funding, funding));
    }
    config
}

/// ACP option for what the session's turns run on, offering `offered`. Only
/// in-memory AI chat offers it: the keys are the owner's or their team's own,
/// and nothing else routes through them.
#[must_use]
pub fn funding_config_option(current: Funding, offered: &[Funding]) -> SessionConfigOption {
    SessionConfigOption::select(
        FUNDING_CONFIG_ID,
        "Usage",
        SessionConfigValueId::new(current.as_str()),
        offered
            .iter()
            .map(|funding| match funding {
                Funding::Macro => SessionConfigSelectOption::new(funding.as_str(), "Macro usage"),
                Funding::PersonalApiKey => SessionConfigSelectOption::new(funding.as_str(), "Your API key")
                    .description("Billed to your own Anthropic or OpenAI key; not counted against your Macro usage".to_owned()),
                Funding::TeamApiKey => SessionConfigSelectOption::new(funding.as_str(), "Team API key")
                    .description("Billed to your team's own Anthropic or OpenAI key; not counted against your Macro usage".to_owned()),
            })
            .collect::<Vec<_>>(),
    )
}

/// ACP option for inference speed, available only for supported native models.
pub fn speed_config_option(model: &str, current: ModelSpeed) -> Option<SessionConfigOption> {
    let accelerated = [ModelSpeed::Fast, ModelSpeed::Ultrafast]
        .into_iter()
        .find(|speed| speed.supported(model))?;
    Some(SessionConfigOption::select(
        "speed",
        "Speed",
        SessionConfigValueId::new(current.as_str()),
        vec![
            SessionConfigSelectOption::new("standard", "Standard"),
            SessionConfigSelectOption::new(
                accelerated.as_str(),
                if accelerated == ModelSpeed::Fast {
                    "Fast · 2× usage"
                } else {
                    "Ultrafast · 6× usage"
                },
            ),
        ],
    ))
}

/// ACP id for Macro's portable reasoning-effort selector.
pub const REASONING_EFFORT_CONFIG_ID: &str = "reasoning_effort";

/// Build the effort option at its current value.
#[must_use]
pub fn reasoning_effort_config_option(
    model: &str,
    current: ReasoningEffort,
) -> SessionConfigOption {
    SessionConfigOption::select(
        REASONING_EFFORT_CONFIG_ID,
        "Reasoning effort",
        SessionConfigValueId::new(current.to_string()),
        ReasoningEffort::supported(model)
            .iter()
            .map(|effort| {
                SessionConfigSelectOption::new(
                    SessionConfigValueId::new(effort.to_string()),
                    effort.display_name(),
                )
            })
            .collect::<Vec<_>>(),
    )
    .category(SessionConfigOptionCategory::ThoughtLevel)
}

/// Model discovery uses the same default session configuration as session/new.
#[must_use]
pub fn model_config_options(current: &str, models: &[&str]) -> Vec<SessionConfigOption> {
    session_config_options(
        current,
        models,
        ReasoningEffort::default(),
        ModelSpeed::Standard,
        &[],
        Funding::Macro,
    )
}

#[cfg(test)]
mod test;
