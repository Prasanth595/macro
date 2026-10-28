//! Rendering tests for the composed prompts exported from the crate root.

use prompt::{BASE_PROMPT, TOOL_USE_PROMPT};

const BASE_TITLES: [&str; 6] = [
    "# Tone and Style",
    "# Math Rendering Rules",
    "# Citation Rules",
    "# Mentioning documents, people, dates, agent sessions, and other chips",
    "# Do Not Rules",
    "# Terms",
];

#[test]
fn base_prompt_renders_all_sections_in_order() {
    let rendered = BASE_PROMPT.to_string();
    let mut last = 0;
    for title in BASE_TITLES {
        let position = rendered[last..]
            .find(title)
            .unwrap_or_else(|| panic!("missing or out-of-order section: {title}"));
        last += position + title.len();
    }
    assert!(!rendered.contains("# Tool Use"));
}

#[test]
fn base_prompt_includes_channel_message_mention_format() {
    let rendered = BASE_PROMPT.to_string();
    assert!(
        rendered.contains(
            r#""blockName":"channel","blockParams":{"channel_message_id":"{message_id}"}"#
        )
    );
    assert!(
        rendered.contains(
            "Do not link only the channel unless you are referring to the whole channel."
        )
    );
}

#[test]
fn in_app_prompts_include_external_link_rules_once() {
    for prompt in [
        &BASE_PROMPT,
        &TOOL_USE_PROMPT,
        &prompt::DIRECT_TOOL_USE_PROMPT,
        &prompt::SESSION_TOOL_USE_PROMPT,
        &prompt::CODE_MODE_SESSION_TOOL_USE_PROMPT,
        &prompt::DATABASE_TOOL_USE_PROMPT,
        &prompt::DATABASE_READ_ONLY_TOOL_USE_PROMPT,
    ] {
        let rendered = prompt.to_string();
        assert_eq!(
            rendered
                .matches("### External links and code references")
                .count(),
            1
        );
        assert!(rendered.contains("`[label](https://…)`"));
        assert!(rendered.contains("including DMs"));
        assert!(rendered.contains("email bodies"));
        assert!(rendered.contains("<sha-or-branch>/<path>#L<start>-L<end>"));

        // The session host prepends its preamble to the shared tool prompt.
        let session = format!("{}\n{rendered}", prompt::agent_session::PROMPT);
        assert_eq!(session.matches("Write every external URL").count(), 1);
        for chip in [
            "m-document-mention",
            "m-user-mention",
            "m-pr-mention",
            "m-booking-link-mention",
        ] {
            assert!(session.contains(chip), "missing mention chip: {chip}");
        }
    }
}

#[test]
fn tool_use_prompt_appends_tool_section_to_base() {
    let rendered = TOOL_USE_PROMPT.to_string();
    assert!(rendered.starts_with(&BASE_PROMPT.to_string()));
    assert!(rendered.contains("# Tool Use"));
    assert!(rendered.contains("read the appropriate resource using the read tool."));
    assert!(
        rendered.contains("Only fall back to searching by name if you cannot resolve an address.")
    );
}

#[test]
fn tool_use_prompt_appends_email_section_after_tool_use() {
    let rendered = TOOL_USE_PROMPT.to_string();
    assert!(rendered.contains("# Email Inboxes"));
    assert!(
        rendered
            .trim_end()
            .ends_with("or omit both for the primary inbox.")
    );
    let tool_use_idx = rendered.find("# Tool Use").expect("tool use section");
    let email_idx = rendered.find("# Email Inboxes").expect("email section");
    assert!(tool_use_idx < email_idx, "email section must come last");
}
