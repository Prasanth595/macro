# Type Alias: GetItemsSoupData

> **GetItemsSoupData** = \{ `body?`: `never`; `path?`: `never`; `query?`: \{ `cursor?`: `string`; `expand?`: `boolean`; `limit?`: `number`; `sort_direction?`: [`SoupApiSortDirection`](SoupApiSortDirection.md); `sort_method?`: [`SoupApiSort`](SoupApiSort.md); `sort_property_definition_id?`: `string`; \}; `url`: `"/items/soup"`; \}

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-body"></a> `body?` | `never` | - |
| <a id="property-path"></a> `path?` | `never` | - |
| <a id="property-query"></a> `query?` | \{ `cursor?`: `string`; `expand?`: `boolean`; `limit?`: `number`; `sort_direction?`: [`SoupApiSortDirection`](SoupApiSortDirection.md); `sort_method?`: [`SoupApiSort`](SoupApiSort.md); `sort_property_definition_id?`: `string`; \} | - |
| `query.cursor?` | `string` | Base64 encoded cursor value. |
| `query.expand?` | `boolean` | Whether to expand projects. Defaults to true. |
| `query.limit?` | `number` | Limit the number of items returned. Defaults to 20. Max 500. |
| `query.sort_direction?` | [`SoupApiSortDirection`](SoupApiSortDirection.md) | Sort direction. Options are asc, desc. Defaults to desc. Re-send this with every page: it is not carried in the cursor. Applies to the timestamp sort methods only. `asc` combined with `frecency` is rejected rather than ignored: frecency pages are ordered by relevance score and the cursor comparison assumes descending, so there is no ascending frecency order to give. |
| `query.sort_method?` | [`SoupApiSort`](SoupApiSort.md) | Sort method. Includes timestamp sorts, relevance sorts, and property_date_earliest/property_date_latest with a selected DATE definition. Defaults to viewed_at. |
| `query.sort_property_definition_id?` | `string` | DATE property definition selected for property-date sorting. |
| <a id="property-url"></a> `url` | `"/items/soup"` | - |
