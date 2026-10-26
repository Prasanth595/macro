# Generic date-property queries

Status: Accepted. Implementation updates the task due-date work in PR #8494.

## Implementation status

REST and GraphQL route selected-property date sorting and date-range grouping
through shared source candidate selection and frozen continuation context.
The candidate source covers Soup-owned documents/tasks, chats, projects,
calendar events, initiatives, and database rows. Property-date sorting and date-range
grouping omit email threads, channels, calls, companies, and propertyless agent
sessions. Their adapters are archived at `rahul/property-candidates-sources`
(`4292a28f33`) for a separate change. Ordinary timestamp queries are unchanged.
Tasks sends the Due Date definition ID through the generic REST and GraphQL contracts.

## Decision

Use the existing property model for date filtering, sorting, and grouping across
property-bearing entity types. A caller selects a property definition and uses
its ordinary entity filters. Do not introduce a task-only query restriction or
another storage model. Tasks selects the existing Due Date property; another
view can select a custom Review Date property on documents.

Date filters remain range/presence predicates. Date sorting selects a property
and direction, keeps missing values last in either direction, and orders ties
by bytewise ascending ID, then canonical property entity type. Text search retains
its existing ordering. Each group retains its total and has-more state.

## Grouping input

Extend property grouping with optional date-range bucketing. The caller sends
explicit ranges instead of a backend-owned relative-date preset:

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

Bounds are UTC RFC 3339 timestamp strings. Starts are inclusive, ends exclusive,
and null means unbounded. Ranges must be ordered, non-overlapping, contiguous,
and cover all dates. Keys must be unique, including `missingValueBucketKey`.
Limit the number of ranges and key lengths before compiling SQL.

`missingValueBucketKey` is configurable. It identifies the bucket containing
entities with no value for the selected property, including cleared values.
It is not the label, a stored entity field, or a missing bucket definition.

The frontend owns labels and calendar presets. Tasks uses its frozen
viewer-local calendar to produce Overdue, Today, Tomorrow, Next 7 days
(D+2 through D+7), Later, and No due date. Other views can supply month,
quarter, or custom ranges without changing the backend contract. Recompute
relative ranges at local midnight, timezone changes, and app resume, rather
than adding fixed 24-hour durations across daylight-saving transitions.

## Backend and pagination

Validate that the selected definition is date-valued. Resolve values using the
property-definition ID and each result's property entity type. Retain every
entity family's normal authorization, lifecycle, and query-filter rules.
Compute membership, counts, and ordering before applying page limits. Bind
client-supplied keys and bounds; never interpolate them as SQL fragments.

Each source returns the entity families present in its full, filtered candidate
set, not just the returned page. Reject overlapping family summaries before
adding source counts, including exhausted sources. This relies on one source
per entity family; disjoint subsets of one family need a different merge
contract. Per-group totals count memberships, not globally distinct entities.

Keep the existing grouped response shapes. GraphQL bins contain `key`,
`totalCount`, `items`, and `nextCursor`; REST uses its normalized item pool
and group metadata. Item-pool keys and membership IDs use raw entity UUIDs;
typed identities remain internal to candidate selection and merging. Group keys
and range order come from the request. Display labels
and drag-to-reschedule behavior belong to the consuming feature.

Version 1 continuation context records the source set (`["soup"]`), selected sort
property, direction, complete grouping configuration, group key, and filters.
Reject unknown versions, missing source sets, and conflicting continuation inputs.
Source additions never expand an existing page sequence. Do not recompute relative
ranges while continuing a page. Preserve unrelated deployed timestamp cursors.
Grouped continuations must name one group. Never advance a single cursor over
concatenated, independently limited groups; that can skip unread members.

Date edits and assignment deletion must refresh property-dependent lists and
search membership, including empty results and unloaded group counts. A local
update to one entity is not evidence of complete group membership.

## Query composition boundary

Soup's outbound candidate repository builds one query over its authorized,
fully filtered source rows. It owns property lookup, grouping, counts, keysets,
execution, and bounded hydration. No cross-domain `properties::query_support`
adapter or callback column contract remains.

Authorize selected definitions through the properties service before querying.
`AuthorizedPropertyQuery` binds the immutable query to its viewer. Check visibility
before revealing a definition's type, require scalar DATE definitions, and return
NotFound for inaccessible definitions. Mint a fresh capability for each request.
Entity access policy remains in the existing source gates.

Candidate identities use the PostgreSQL property entity enum end to end.
One exhaustive Rust mapping supplies hydration entity types and SQL group keys.
The shared `item_filters::sql::date_value` expression guards the JSON variant before
casting; readers keep parsing at query time and bind date bounds.
Shared candidate DTOs remain in `models_grouping`, with no SQL.

## Per-page cost

The candidate query computes exact statistics over the complete filtered set
on each page. A local isolated account with 100,000 accessible documents/tasks,
chats, and projects took approximately 1.2 seconds for an unfiltered initial,
continuation, or grouped page (PostgreSQL 18, production planner settings).
Property-date reads therefore require at least one Soup-owned item or property
filter. Email-only or other excluded-source filters do not satisfy that gate.
The gate does not promise a fixed latency; callers must still choose useful scope.

Run the ignored `property_date_query_explain_local` test with `--ignored --nocapture`
to reproduce the synthetic account probe without accessing hosted data.

## Rejected alternatives

- Task-specific deadline grouping: duplicates generic property selection and
  prevents reuse for other date properties and entity types.
- Named boundaries such as `today` and `dayEight` in the backend contract:
  couples the API to one feature's buckets.
- A backend preset registry: adds a separate configuration system where
  explicit validated ranges suffice.
- Client-only grouping of paginated results: produces incomplete groups,
  incorrect counts, and unstable pagination.

No database migration, indexing field, or new property definition is required.
