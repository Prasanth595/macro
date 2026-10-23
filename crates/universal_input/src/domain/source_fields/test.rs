use super::*;

fn input(intent: InputIntent, text: &str) -> ExtractInputRequest {
    ExtractInputRequest {
        text: text.to_owned(),
        intent,
        revision: 1,
        reference_time: "2026-10-23T18:00:00Z".parse().unwrap(),
        time_zone: "America/New_York".into(),
        property_definitions: vec![],
    }
}

#[test]
fn notes_preserve_the_complete_source_even_when_inference_returns_only_a_heading() {
    let text = "# Whale research\n\nWhales breathe through blowholes.\n🐋";
    let mut fields = InputSuggestions {
        body: Some("Whale research".into()),
        ..Default::default()
    };
    preserve(&input(InputIntent::Note, text), &mut fields);
    assert_eq!(fields.body.as_deref(), Some(text));
}

#[test]
fn explicit_addressing_preserves_every_body_sentence_and_line() {
    for (intent, text, expected) in [
        (
            InputIntent::Email,
            "email julia\ncan we reschedule the thing tomorrow? let the investors know\n\nThanks!",
            "can we reschedule the thing tomorrow? let the investors know\n\nThanks!",
        ),
        (
            InputIntent::Email,
            "Send an email to Julia that I will be late\nPlease start without me.",
            "I will be late\nPlease start without me.",
        ),
        (
            InputIntent::Message,
            "DM Julia saying Hello there\nHow are you?",
            "Hello there\nHow are you?",
        ),
    ] {
        let mut fields = InputSuggestions {
            body: Some("a truncated span".into()),
            ..Default::default()
        };
        preserve(&input(intent, text), &mut fields);
        assert_eq!(fields.body.as_deref(), Some(expected));
    }
}

#[test]
fn ambiguous_inline_addressing_is_left_for_inference() {
    assert!(
        input(InputIntent::Email, "email Julia about the launch")
            .literal_body()
            .is_none()
    );
    assert!(
        input(InputIntent::Task, "email Julia\nTomorrow")
            .literal_body()
            .is_none()
    );
}

#[test]
fn a_missing_subject_uses_a_bounded_source_excerpt_but_never_overwrites_a_suggestion() {
    let mut fields = InputSuggestions::default();
    preserve(
        &input(
            InputIntent::Email,
            "email julia\nCan we reschedule? Let the investors know.",
        ),
        &mut fields,
    );
    assert_eq!(
        fields.subject.as_deref(),
        Some("Can we reschedule? Let the investors know.")
    );
    fields.subject = Some("Reschedule".into());
    preserve(
        &input(InputIntent::Email, "email julia\nAnother body"),
        &mut fields,
    );
    assert_eq!(fields.subject.as_deref(), Some("Reschedule"));
}

#[test]
fn a_person_in_an_event_title_is_not_an_invitation() {
    let mut fields = InputSuggestions {
        guests: vec!["Julia".into()],
        ..Default::default()
    };
    preserve(
        &input(InputIntent::Calendar, "Call Julia tomorrow at 7"),
        &mut fields,
    );
    assert!(fields.guests.is_empty());
    fields.guests.push("Julia".into());
    preserve(
        &input(InputIntent::Calendar, "Call tomorrow at 7; invite Julia"),
        &mut fields,
    );
    assert_eq!(fields.guests, ["Julia"]);
    preserve(
        &input(
            InputIntent::Calendar,
            "Call Julia tomorrow; don't invite anyone",
        ),
        &mut fields,
    );
    assert!(fields.guests.is_empty());
}

#[test]
fn every_extracted_field_has_a_typed_definition() {
    for intent in [
        InputIntent::Email,
        InputIntent::Note,
        InputIntent::Task,
        InputIntent::Calendar,
        InputIntent::Message,
        InputIntent::Search,
    ] {
        for field in intent.extraction_fields() {
            assert!(
                intent.typed_field_guidance(field).is_some(),
                "{intent:?}.{field}"
            );
        }
    }
}

#[test]
fn a_bare_clock_uses_the_editable_default_even_if_the_provider_picks_the_other_half_day() {
    for (draft, original, expected) in [
        (
            "Call Julia tomorrow at 7",
            "2026-10-24T07:00",
            "2026-10-24T19:00",
        ),
        (
            "Breakfast tomorrow at 9",
            "2026-10-24T21:00",
            "2026-10-24T09:00",
        ),
        (
            "Lunch tomorrow at 12",
            "2026-10-24T00:00",
            "2026-10-24T12:00",
        ),
        (
            "Call Julia tomorrow at 7am",
            "2026-10-24T07:00",
            "2026-10-24T07:00",
        ),
        (
            "Call Julia tomorrow at 07:00",
            "2026-10-24T07:00",
            "2026-10-24T07:00",
        ),
        (
            "Call Julia tomorrow morning at 7",
            "2026-10-24T07:00",
            "2026-10-24T07:00",
        ),
    ] {
        let mut fields = InputSuggestions {
            start: Some(original.into()),
            ..Default::default()
        };
        assume_clock(&input(InputIntent::Calendar, draft), &mut fields);
        assert_eq!(fields.start.as_deref(), Some(expected), "{draft}");
    }
}

#[test]
fn clock_assumptions_preserve_an_explicit_twenty_four_hour_end() {
    for (original_end, expected_end) in [
        ("2026-10-24T08:00", "2026-10-24T20:00"),
        ("2026-10-24T20:00", "2026-10-24T20:00"),
    ] {
        let mut fields = InputSuggestions {
            start: Some("2026-10-24T07:00".into()),
            end: Some(original_end.into()),
            ..Default::default()
        };
        assume_clock(
            &input(
                InputIntent::Calendar,
                "Call Julia tomorrow at 7 until 20:00",
            ),
            &mut fields,
        );
        assert_eq!(fields.end.as_deref(), Some(expected_end));
    }
}
