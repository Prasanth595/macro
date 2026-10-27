//! Compile-time field definitions for typed extraction adapters.
use super::InputIntent;

impl InputIntent {
    /// The meaning of one extracted field; adapters choose its wire representation.
    pub fn typed_field_guidance(self, field: &str) -> Option<&'static str> {
        match (self, field) {
            (Self::Search, "query") => Some(include_str!("extract_search_query_prompt.txt")),
            (Self::Search, "search_scope") => Some(
                "The exact noun phrase naming the requested content category: messages, channels, DMs, documents, files, notes, tasks, emails, calls, folders, agents, AI chats, calendar events or events. Null when no category is specified. Category words inside the search topic are not a scope. Return a span from the draft, not a canonical category name.",
            ),
            (Self::Search, "search_from") => Some(
                "Names or supplied addresses explicitly requested as message senders, call speakers, or task creators. Keep a single named person together even if their name contains a comma or and. Exclude negated people. For other content categories return an empty list and retain unsupported filter wording in query.",
            ),
            (Self::Search, "search_in") => Some(
                "Names of channels explicitly requested as the scope of a message or call search. Keep each channel name intact, including commas and and. A year or a preposition inside the topic is not a channel filter. For other content categories return an empty list and retain unsupported filter wording in query.",
            ),
            (Self::Email, "cc") => Some(
                "Names or supplied email addresses explicitly requested as carbon-copy recipients. Do not include To or Bcc recipients here.",
            ),
            (Self::Email, "bcc") => Some(
                "Names or supplied email addresses explicitly requested as blind-carbon-copy recipients. Do not include To or Cc recipients here.",
            ),
            (Self::Email, "subject") => Some(
                "A short phrase from the outgoing message suitable for its subject. It need not be labeled Subject; use the message's main topic or requested action.",
            ),
            (Self::Email, "body") => Some(
                "The entire outgoing email message, including every sentence and line. Exclude addressing instructions and separately labeled To, Cc and Bcc routing metadata. Preserve the author's words.",
            ),
            (Self::Email, "recipients") => Some(
                "Names or email addresses explicitly addressed after email or email to at the beginning of the draft. Exclude explicit Cc and Bcc recipients, and people mentioned only in the message body.",
            ),
            (Self::Note, "title") => {
                Some("The document heading or a short title phrase from the note.")
            }
            (Self::Task, "title") => Some(
                "The task name or action, excluding a leading creation instruction, deadline, and property metadata.",
            ),
            (Self::Task, "body") => Some(
                "The complete task description after its title. Include all description sentences and Markdown in input order. Exclude the title and separately stated priority, status, assignee, project or due-date metadata. Null when there is no description.",
            ),
            (Self::Task, "properties") => Some(
                "Only explicitly stated values for this task property. Empty when this property was not supplied; do not infer defaults or return other task prose.",
            ),
            (Self::Calendar, "title") => Some(
                "The event name, excluding its date, time and location or an instruction to create an event.",
            ),
            (Self::Calendar, "body") => Some(
                "Additional event description beyond its name, date, time and location. Null if no additional description was provided.",
            ),
            (Self::Calendar, "location") => Some(
                "Physical venue, street address or video meeting platform explicitly named for the event. Null if no location was supplied.",
            ),
            (Self::Calendar, "guests") => Some(
                "Only positively requested invitee names or supplied email addresses. Exclude people who must not be invited. A person mentioned as the activity companion, a discussion topic such as guest access, or a negated invitation is not a request to invite them. Return an empty list when no invitation was requested.",
            ),
            (Self::Message, "body") => Some(
                "The entire outgoing chat message, excluding only the leading recipient or channel instruction.",
            ),
            (Self::Message, "recipients") => Some(
                "Names of people or channels explicitly addressed by the leading DM or chat instruction.",
            ),
            _ => None,
        }
    }
}
