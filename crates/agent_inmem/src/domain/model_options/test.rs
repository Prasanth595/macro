use super::model_config_options;
use agent_fold::domain::model_selection::model_selection;

#[test]
fn routed_options_use_house_names() {
    let options = model_config_options(
        "fireworks/kimi-k3",
        &["fireworks/kimi-k3", "anthropic/claude-sonnet-5-5"],
    );
    let selection = model_selection(&options).expect("a model select");
    assert_eq!(selection.current, "fireworks/kimi-k3");
    assert_eq!(
        selection
            .options
            .iter()
            .map(|model| (model.id.as_str(), model.name.as_str()))
            .collect::<Vec<_>>(),
        vec![
            ("fireworks/kimi-k3", "Kimi K3"),
            ("anthropic/claude-sonnet-5-5", "anthropic/claude-sonnet-5-5"),
        ]
    );
}

#[test]
fn model_image_capability_survives_acp_projection() {
    let options = model_config_options(
        "fireworks/glm-5p3",
        &[
            "fireworks/glm-5p3",
            "fireworks/kimi-k3",
            "cerebras/gpt-oss-120b",
            "custom/model",
        ],
    );
    let models = model_selection(&options).unwrap().options;
    assert_eq!(
        models
            .iter()
            .map(|model| model.supports_images)
            .collect::<Vec<_>>(),
        vec![Some(false), Some(true), Some(false), None]
    );
    assert!(
        models[0]
            .description
            .as_deref()
            .unwrap()
            .contains("Text only")
    );
}

#[test]
fn speed_is_advertised_only_for_supported_models_with_current_value() {
    use agent::{ModelSpeed, ReasoningEffort};
    use agent_client_protocol::schema::v1::SessionConfigKind;
    for (model, speed) in [
        ("openai/gpt-6-astra", ModelSpeed::Ultrafast),
        ("openai/gpt-6.1-sol", ModelSpeed::Ultrafast),
        ("anthropic/claude-opus-5-5", ModelSpeed::Fast),
    ] {
        let options =
            super::session_config_options(model, &[model], ReasoningEffort::Default, speed);
        let option = options
            .iter()
            .find(|option| option.id.to_string() == "speed")
            .unwrap();
        let SessionConfigKind::Select(select) = &option.kind else {
            panic!("speed must be selectable")
        };
        assert_eq!(select.current_value.to_string(), speed.as_str());
    }
    assert!(
        super::speed_config_option("anthropic/claude-sonnet-5-5", ModelSpeed::Standard).is_none()
    );
}

#[test]
fn workspace_labels_and_image_capabilities_survive_acp_projection() {
    let model = super::super::engine::EngineModel {
        id: "workspace-00000000-0000-0000-0000-000000000001/llama".to_owned(),
        name: "Local Llama · Ollama".to_owned(),
        supports_images: Some(false),
    };
    let options = super::catalog_config_options(
        &model.id,
        std::slice::from_ref(&model),
        agent::ReasoningEffort::Default,
        agent::ModelSpeed::Standard,
    );
    let selected = model_selection(&options).unwrap();
    assert_eq!(selected.current, model.id);
    assert_eq!(selected.options[0].name, model.name);
    assert_eq!(selected.options[0].supports_images, Some(false));
}
