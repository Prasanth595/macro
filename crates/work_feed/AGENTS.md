# work_feed

## What it is

Part of Home — the combined work feed: one paginated, stacked, live-updating
list of things that need the viewer's attention plus work they recently did.
Its attention mode (outstanding attention only) backs the notifications
inbox: each entry also carries the item's inbox rows.

## Start here

- `src/domain/service.rs`: page, recompute, done/undo use cases, including
  row-scoped done.
- `src/domain/policy.rs`: item membership policy — what belongs in the feed.
- `src/domain/stacking.rs`: how related notifications collapse into one entry.
- `src/domain/inbox.rs`: inbox rows — each notification's home row, one row
  per message (mention over reply over message over document mention), and
  noise hidden in its natural row.
- `src/domain/realtime.rs`: live-update signals.
- `src/outbound/source.rs`: adapters over Soup, notifications, email, and
  activity that supply the underlying items.

## Scope

- Owns: feed membership, stacking, inbox rows, seen/done state, and
  pagination.
- Not here: the underlying item data itself (notifications, soup rows,
  activity) → `crates/notification`, `crates/soup`, `crates/activity`.

## Boundaries

- Depends on: `entity_access`, `filter_ast`, `item_filters`, `notification`,
  `model_notifications`; optional `activity`, `email`, `soup`, `soup_realtime`,
  `models_soup` (feature `outbound`).
- Used by: `services/document_storage_service`, `crates/graphql_work_feed`,
  `crates/complete_graph`.

## Recipes

- Add a new feed item source: implement a port in `src/domain/ports.rs` → new
  adapter in `src/outbound/` → wire into `src/domain/policy.rs`.
- Place a new notification kind in the inbox: `place_event` in
  `src/domain/inbox.rs` matches every `NotifEvent`, so the compiler asks.

## Checks

- `cargo test -p work_feed` (`SQLX_OFFLINE` unset).

## Gotchas

- An item is shared by every feed (the web cache keys it by id), so attention
  mode must not change an item's stacks, state or times; inbox rows live on
  the entry only.
- A channel item and its thread items read the same channel notifications;
  `inbox::rows` partitions them so each notification has one home. Keep the
  Soup candidate keying (`soup` `work_feed/query.sql`) in step with it.

## Related

- Rules: `.agents/rules/rust/architecture.md`
