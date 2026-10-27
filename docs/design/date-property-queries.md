# Property sorting and date-range grouping

Status: Accepted for PR #8494.

## Decision

Extend Soup's existing dynamic query and position cursor. Do not keep a separate
candidate query, cross-source merger, hydration pass, or versioned query context.
The single Soup source does not justify that extra pipeline. The previous
external-source experiment remains archived on `rahul/property-candidates-sources`
at `4292a28f33`; it is not a contract for future expansion.

Property sorting and date-range grouping cover Soup-owned documents/tasks,
chats, projects, calendar events, initiatives, and database rows. They omit
email threads, channels, calls, companies, and propertyless agent sessions.
Ordinary timestamp queries retain their existing sources and behavior.

Date range/presence filters remain shared by Soup, call, email, frecency, and
OpenSearch. Tasks text search keeps search-result ordering.

## Sort API

REST uses `sort_method=property`, `sort_property_definition_id=<definition UUID>`,
and `sort_direction=asc|desc`. GraphQL uses `PROPERTY`,
`sortPropertyDefinitionId`, and `sortDirection: ASC|DESC`.

The selected ID is a property **definition**, not an entity's assignment ID.
The properties service checks definition visibility before exposing type errors.
The Soup domain then rejects types that have no supported numeric sort key.
Date-range grouping additionally requires a scalar DATE definition.

The older `property_date_earliest` / `property_date_latest` names and GraphQL
variants are removed before release. Existing timestamp `sort_direction` support
is retained because that API already exists on main.

| Property type | Ascending key |
| --- | --- |
| DATE | UTC epoch microseconds |
| NUMBER | Numeric value |
| BOOLEAN | False = 0, true = 1 |
| SELECT_STRING / SELECT_NUMBER | Selected option's stored `display_order` |
| Multi-select / TAG | Lowest `display_order` among selected options |
| STRING / ENTITY / LINK | Unsupported; reject the request |

A missing value, empty selection, or mismatched JSON variant has no key. Option
labels and numeric option values do not control ordering. Clients choose default
direction: Status is ascending; Priority is descending (urgent first).

SQL uses a double-precision key, negated for ascending and unchanged for
descending, with missing keys coalesced to negative infinity. Every query orders
by `(sort_key DESC, sort_ts DESC, id DESC)`. Property-sort ties use newest update,
then descending ID. Timestamp sorts use zero for `sort_key` and keep their
existing timestamp selection.

## Grouping input

Property grouping accepts optional date-range bucketing:

```ts
{
  type: 'property',
  propertyDefinitionId: reviewDatePropertyId,
  bucketing: {
    type: 'date_ranges',
    ranges: [
      { key: 'before_period', start: null, end: periodStart },
      { key: 'in_period', start: periodStart, end: periodEnd },
      { key: 'after_period', start: periodEnd, end: null },
    ],
    missingValueBucketKey: 'no_review_date',
  },
}
```

Bounds are UTC RFC3339 strings. Starts are inclusive; ends are exclusive. Null
means unbounded. Ranges must be ordered, contiguous, non-overlapping, cover all
dates, and have unique keys distinct from `missingValueBucketKey`. Validate range
counts and key lengths before executing SQL.

The grouping SQL returns a range index, which Rust maps to the caller's key.
Bind bounds rather than interpolating values; caller keys never become SQL.
Missing or cleared dates use the configured missing-value bucket. Keep the
existing count and row-number windows, per-group limits, and single-group
load-more behavior. REST keeps raw UUID pool keys; GraphQL keeps typed entities.

## Pagination and authorization

Use the existing position cursor, extended with the numeric property key.
Serialize a missing key as null because JSON cannot encode negative infinity;
coalesce that bound back to negative infinity in SQL. The keyset comparison is
`(sort_key, sort_ts, id) < (cursor_key, cursor_ts, cursor_id)`.

Do not add a frozen source list, context version, unused email view, or link IDs.
The client sends grouping configuration again on continuation requests. Its
query key includes property, direction, filters, and ranges; a changed query key
starts fresh pages. Keep deployed timestamp cursor decoding compatible.

Definition visibility/type validation belongs in the Soup domain through the
properties service. Entity access, lifecycle gates, and complete filters stay in
the existing source clauses. Preserve projection-backed document facts and
property enrichment without a second fetch-by-ID pass.

## Client behavior

The view owns labels and calendar presets. Tasks builds Overdue, Today,
Tomorrow, Next 7 days (D+2 through D+7), Later, and No due date from viewer-local
calendar boundaries. Recompute at midnight, timezone changes, and resume;
do not add fixed 24-hour durations across daylight-saving transitions.

Loaded items move immediately between date buckets using the same half-open
range rule in TypeScript. Revalidation corrects unloaded rows and authoritative
counts. Refresh a query when the edited definition is its sort property, its
group property, or appears in a date predicate. Match those request fields,
not serialized-key substrings. Assignment deletion without a definition ID
refreshes all property-dependent queries.

Tasks uses cached property definitions/options for its local numeric comparator,
with missing values last and the same update/ID tie-breakers as SQL. Status and
Priority are explicit sort choices. Do not add property sorting or date predicates
to the WASM reconciliation engine: its baseline is an integer timestamp, and
property-sorted pages remain server-backed.

## Alternatives rejected

- A candidate pipeline for one source: duplicates the existing UNION and adds
  a merger, separate hydration, authorization capability, and cursor context.
- Task-only deadline handling or backend-relative presets: couples shared APIs
  to one feature instead of the selected property and caller-provided ranges.
- String/entity sorting through the numeric key: needs text collation or display
  names that this query does not provide.
- Client-only grouping of all results: cannot establish complete counts or
  membership from a bounded page. Local movement is optimism, not authority.

No database migration, new property definition, or WASM change is required.
