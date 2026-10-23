# Command K input inference

The web client exposes this composer only through Command K. God Mode defaults on
when `enable-universal-input` is enabled and can be turned off in Settings > Experimental Features. The page requires the
`enable-experimental-features` PostHog flag and a `@macro.com` account; the
composer also requires `enable-universal-input`. Home always uses its normal
composer. Menu drafts are transient and are discarded when the menu closes.

Command K classifies draft snapshots with the same Jev classifier used by
Routines. When configured, Cloudflare Clairic extracts editable fields through
Workers AI. Clairic uses typed text, list, date and datetime fields for the selected
intent. Task properties are separate lists keyed back to the supplied catalog;
property names and entity IDs are never invented by the model. Domain-owned
typed field definitions are specific to the intent and avoid chat/JSON instructions. Inference is read-only;
submission uses the existing destination services and their permission
checks. The domain service validates input and checks AI admission before calling
either provider. Usage is recorded through the shared recorder.

The document-cognition service hosts authenticated `POST /universal-input/classify`
and `POST /universal-input/extract` endpoints. Configure its existing
`TYPESAFE_API_KEY` through the document-cognition Doppler configuration to enable
automatic classification. To try Clairic, set `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` together in the document-cognition configuration (and in
the local stack's `local/lcl_personal` configuration or its integration env file).
The token needs Workers AI access for that account. These stay on the backend.
An incomplete pair fails at startup; absent/blank pairs retain Nemotron.

The domain's fallback extractor calls Nemotron Lightning 3.5 through Fireworks
when Clairic is unconfigured, fails, times out after five seconds, or returns
malformed/truncated answers. Nemotron still requires `FIREWORK_API_KEY` from
the existing shared-AI configuration, with reasoning disabled and native
JSON-schema enforcement. Rate limits fall back immediately instead of retrying
the preview endpoint. Usage is recorded separately for each provider that reports
tokens, including unusable Clairic answers. The pricing seed is $0.10 per million
Clairic input tokens and zero output cost, as documented by Cloudflare.

Clairic text is extractive: titles and subjects select an existing phrase instead
of rewriting it. The domain copies complete notes and explicitly addressed email/chat
bodies directly from the source. An absent email subject uses a bounded source
excerpt. The domain also enforces bare-hour AM/PM defaults and clears calendar
guests unless an invitation was explicitly requested. Text/list answers must occur
in the draft; nulls and low-confidence answers remain unset, never replaced with
the provider's `guess`. This is not a generative subject-writing model. Dates
receive the user's local reference date, time and timezone. The existing domain
normalization, duration rules, metadata cleanup, manual edit precedence and
submission behavior apply to both providers.
Without Jev configuration, the composer supports manual type selection. Running
only the frontend against a backend without these routes also requires manual
field entry.

The client throttles inference at 200 ms intervals while typing and coalesces
classification and extraction independently, with one request in flight per
queue. Each queue coalesces changes to the newest text, so slow field extraction
does not block type prediction. Obvious email/message addressing populates
recipient suggestions and body immediately; inference refines unedited fields. The strongest candidate immediately starts
a draft even when scores are close. Completed predictions may reveal a shape
while typing continues; manual choices and edits invalidate older predictions.
Cmd/Ctrl+Shift+Right cycles ranked types, and Left cycles backward. Submission
waits for the current draft to finish updating. Unit tests and the browser fixture use controlled provider
responses; they do not establish live model accuracy or latency.

Before evaluating a configured stack, try these drafts without submitting them:

| Draft | Expected shape |
| --- | --- |
| Explain how database indexes work | AI |
| Find the email from Alice about the launch | Search |
| Email john@example.com that I'll be late | Email, with visible outgoing body |
| email julia followed by can we reschedule the thing tomorrow? let the investors know | Email to Julia; requests and dates remain in the outgoing body |
| Remind me to email Julia tomorrow about rescheduling | Task, despite mentioning email |
| # Research notes followed by observations | Markdown note |
| Finish the launch report by Friday | Task with a due date |
| Call John at 3pm tomorrow | Event at local 3 PM, one hour, no guests |
| Call with Julia tomorrow at 7 | Event at local 7 PM, one hour, editable AM/PM cue |
| Notification click not going to target followed by priority urgent | Task with Urgent priority, metadata removed from description |
| DM John that I'm running five minutes late | Message with recipient resolution |
| John | Start the strongest candidate; alternatives remain available |

Also test partially typed drafts, changing intent, duplicate names, explicit guest
invitations, timezone boundaries, and provider failure. A manually edited field
locks the type and survives subsequent inference. Use Auto to resume detection.

Extraction receives the available task property names and options. Suggested
property display values resolve only against actual options and visible entities;
model output never grants access or invents entity IDs. Unknown or ambiguous
values require a manual choice. Domain guidance resolves relative dates in the
user's timezone. Event timestamp normalization accepts seconds and RFC3339
offsets, while rejecting nonexistent or ambiguous local DST times. The domain
computes a default one-hour end or an explicitly supplied numeric duration,
and removes exact extracted task metadata lines from the description.
