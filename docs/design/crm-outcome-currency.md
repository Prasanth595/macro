# Pipeline outcomes and currencies

Deals remain database rows in a CRM pipeline, identified by `(pipeline_id,
row_id)`. This implementation starts from supported main and does not reuse the
external deal proposal. It creates no project or separate deal entity.

## Outcome

Every company and contact pipeline has a protected single-select Outcome field:
Open, Won, Lost. It uses the ordinary table, board, record and Add deal editors,
filters, grouping, CSV and agent field APIs. Outcome is independent of Stage;
changing it does not move a row. Stage-specific requirements continue to apply
to stage transitions through the same pipeline operation boundary. No additional
closing requirements are introduced here.

Existing rows start Open, except exact case-insensitive `Closed won` and
`Closed lost` stage labels seed Won and Lost once. Stage names, option IDs and
values remain intact. `closed_stage_ids` cannot distinguish a win from a loss
and does not define Outcome. Existing user fields with reserved names are kept
under an unambiguous legacy name.

## Currency

Each existing numeric Amount or Revenue field gets a paired currency select,
initially named `<amount name> currency`. A new pipeline starts with Revenue
and Revenue currency. Stable column IDs associate the two; renaming an amount
does not change its currency association. Other numeric fields remain numbers.
Each row chooses its own currency for each amount. Currency options are fixed
supported three-letter codes; USD is the documented default for existing values
and new rows. This is a denomination assumption, never an exchange conversion.

Display uses the currency code with locale number formatting. CSV stores the
numeric amount and its currency in separate columns, and agents read/write the
same fields. Imports without currency use USD; invalid currencies must fail
the row rather than silently losing the supplied denomination. Totals group by
currency and never convert or combine different denominations.

## Storage and rollout

CRM owns the stable Outcome and amount/currency column identities; the shared
database engine owns their columns, options and cells. Pipeline authorization
and operation validation remain the common boundary for app and agent writes.
The migration is additive and preserves amounts and row identities. Compatibility
defaults cover old writers during a rolling deployment: the pipeline insert
trigger upgrades metadata omitted by old creators, and the row insert trigger
fills Open/USD before explicit cell upserts. Current services provision the
schema and include defaults in their ordinary operation batches. Neither
trigger changes a supplied amount or converts its denomination. Mobile uses the existing
responsive field editors and Add deal form.

This feature is part of the existing CRM rollout. Stage requirements and linked
rows remain separate changes; no additional milestone or feature flag is needed.
