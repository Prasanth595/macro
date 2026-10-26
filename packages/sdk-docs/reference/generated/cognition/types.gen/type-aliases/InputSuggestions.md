# Type Alias: InputSuggestions

> **InputSuggestions** = \{ `body?`: `string` \| `null`; `due_date?`: `string` \| `null`; `end?`: `string` \| `null`; `guests?`: `string`[]; `location?`: `string` \| `null`; `properties?`: [`InputPropertySuggestion`](InputPropertySuggestion.md)[]; `query?`: `string` \| `null`; `recipients?`: `string`[]; `start?`: `string` \| `null`; `subject?`: `string` \| `null`; `title?`: `string` \| `null`; \}

Suggestions are text, never authorized recipient, channel or calendar IDs.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-body"></a> `body?` | `string` \| `null` | Suggested Markdown content or outgoing message body. |
| <a id="property-due_date"></a> `due_date?` | `string` \| `null` | Task deadline as a local ISO date. |
| <a id="property-end"></a> `end?` | `string` \| `null` | Event end as a local wall-clock value in the request's timezone. |
| <a id="property-guests"></a> `guests?` | `string`[] | Only populated when an invitation was explicitly requested. |
| <a id="property-location"></a> `location?` | `string` \| `null` | Human-readable event venue or meeting URL. |
| <a id="property-properties"></a> `properties?` | [`InputPropertySuggestion`](InputPropertySuggestion.md)[] | Display names/values that the client resolves against available task fields. |
| <a id="property-query"></a> `query?` | `string` \| `null` | Terms to find existing Macro content. |
| <a id="property-recipients"></a> `recipients?` | `string`[] | Person or channel names for the client to resolve. |
| <a id="property-start"></a> `start?` | `string` \| `null` | Local wall-clock values, interpreted in the request's IANA timezone. |
| <a id="property-subject"></a> `subject?` | `string` \| `null` | Suggested outgoing email subject. |
| <a id="property-title"></a> `title?` | `string` \| `null` | Suggested note, task, or event title. |
