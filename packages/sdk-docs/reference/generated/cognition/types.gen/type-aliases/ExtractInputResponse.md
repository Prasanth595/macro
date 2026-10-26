# Type Alias: ExtractInputResponse

> **ExtractInputResponse** = \{ `intent`: [`InputIntent`](InputIntent.md); `revision`: `number`; `suggestions`: [`InputSuggestions`](InputSuggestions.md); \}

Validated field suggestions for a particular destination and draft revision.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-intent"></a> `intent` | [`InputIntent`](InputIntent.md) | Destination echoed from the extraction request. |
| <a id="property-revision"></a> `revision` | `number` | Revision echoed from the extraction request. |
| <a id="property-suggestions"></a> `suggestions` | [`InputSuggestions`](InputSuggestions.md) | Editable fields after domain normalization and source-preservation rules. |
