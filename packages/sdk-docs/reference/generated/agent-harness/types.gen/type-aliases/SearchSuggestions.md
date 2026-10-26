# Type Alias: SearchSuggestions

> **SearchSuggestions** = \{ `query?`: `string` \| `null`; `search_from?`: `string`[]; `search_in?`: `string`[]; `search_scope?`: `string` \| `null`; \}

Editable fields for search inference, before submission and identity resolution.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-query"></a> `query?` | `string` \| `null` | Terms to find existing Macro content. |
| <a id="property-search_from"></a> `search_from?` | `string`[] | Explicit sender, speaker, or task-creator names for the client to resolve. |
| <a id="property-search_in"></a> `search_in?` | `string`[] | Explicit channel names for the client to resolve. |
| <a id="property-search_scope"></a> `search_scope?` | `string` \| `null` | Verbatim noun naming the requested search category, such as messages or tasks. |
