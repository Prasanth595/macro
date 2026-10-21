# Agent code mode

## Scope

Execution credentials carry the authenticated session bot for SDK message
attribution while retaining the owner's API permissions.

Owns session-authorized code executions, SDK documentation selection, saved
execution records, and durable review stacks. Process isolation belongs to
`crates/code_execution`; session presentation belongs to `crates/agent_session`.

## Start here

- `SKILL.md`: the agent-facing JavaScript contract and examples.
- `src/domain/service.rs`: execution admission, identity and persistence.
- `src/domain/reviews.rs`: review validation, revisions, claims and outcomes.
  `settle` reports, once (`settled_at`), that background work an approved
  action started has ended; other services reach it through the internal
  `POST /internal/agent-reviews/{id}/settled` route
  (`outbound::review_settlements_client`).
  `approve_for_session` (the `ApproveReview` tool, `inbound/reviews.rs`) is the
  agent approving on its owner's word in chat: it runs the card's Submit on the
  saved draft, only in a turn the owner prompted (`ReviewSession::turn_prompter`),
  only once the action is `approvable`, and records `approved_by_agent`.
- `src/domain/documentation.rs`: bounded selection of generated SDK docs.

## Boundaries

Inbound adapters authenticate and delegate to domain services. Outbound adapters
implement persistence; the harness composition root wires native actions and
session presentation. Never replay an uncertain submitted action.

## Tool contracts

- Keep native `NameSearch` and `ListEntities` available for session-aware discovery; agent SDK documentation excludes legacy chats and workspace feeds.

## Checks

- `cargo test -p agent_code_mode --lib` from the repository root, with live local
  database configuration and `SQLX_OFFLINE` unset.
- Keep generated discovery topics within the classifier's 32-question limit.
- Regenerate SDK documentation through `packages/code-mode-sdk`; never edit
  `src/domain/documentation.json` by hand.
