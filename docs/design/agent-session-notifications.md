# Agent session notifications

System events must be durable without impersonating the session owner. The
`agent_session` domain owns `agent_session_notification`; review adapters write
through its transaction-aware producer port in the state-change transaction.

## Contract

A notification has a UUIDv7 id, session, typed event (`review.decided`,
`review.settled`, `app.connected`), subject, payload, dedupe key, wake policy,
creation time and producer trace context. Dedupe is scoped to a session; absent
an explicit key it is kind plus subject. Review decisions include a revision in
their key because a stack can be decided in several batches. Payloads reference
review and item ids; final drafts remain available through GetReview.

The harness serializes delivery with all other session commands. It claims a
bounded batch under a lease using SKIP LOCKED. Waking events start an idle turn;
events arriving during a turn wait until its end and coalesce. Quiet events
join the next real prompt. A successful wire delivery acknowledges the batch;
failed delivery retains it for retry after the lease expires. The stable action
id prevents a retry from repeating an accepted action. Every worker is tracked
and cancellable. Producer trace context travels with the row and links delivery.

## Identity and transcript

Notification turns record System as their prompter and have no acting user.
Owner-only actions remain denied until a subsequent owner prompt. External ACP
runtimes receive an XML block via session/prompt; notification metadata is
server-authored and cannot be accepted through public control. The durable log
uses notification frames, which open turns without creating user messages.
Notifications project separately from messages: cards refresh their subject;
other events appear as quiet timeline markers. A pending review response shows
responding until agent output begins, on desktop and mobile.

Only notification turns may suppress an exact `<noop/>` response, and only if
no tool with potential side effects ran. Noop turns generate no assistant
message, unread, push or activity bump; their outbox outcome records noop.
Ordinary user turns preserve the same literal text. Tool-bearing turns preserve
it as well, since suppressing evidence of work is unsafe.

## Compatibility and scope

Schema additions precede service rollout and use a local lock timeout. Legacy
review notification fields are ignored on reads after migration; removing JSON
fields does not require destructive SQL. Notification rows are visible to all
session viewers. The app-connected context-prompt caller referenced in the
original goals does not exist in this checkout; the typed event remains part
of the producer API for the next integration branch.
