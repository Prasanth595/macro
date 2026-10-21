use super::PROMPT;

#[test]
fn created_items_are_offered_to_the_channel_and_meetings_get_a_macro_call() {
    let instructions = PROMPT.instructions.as_ref();
    assert!(instructions.contains("Do you want me to share this with the members of the channel?"));
    assert!(instructions.contains("whenever you create an item"));
    assert!(instructions.contains("`ShareWithChannel`"));
    assert!(instructions.contains("reply with only \"Okay.\""));
    assert!(instructions.contains("macro.meetings.create"));
    assert!(instructions.contains("leaving `addMacroCall` off"));
}
