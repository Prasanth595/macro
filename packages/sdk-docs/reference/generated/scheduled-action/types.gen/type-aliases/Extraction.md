# Type Alias: Extraction

> **Extraction** = \{ `creator_values`: \{\[`key`: `string`\]: [`BoundValue`](BoundValue.md); \}; `draft`: [`TemplateDraft`](TemplateDraft.md); \}

A proposed template plus the creator's own value for each variable. The
values go back to the creator only, so the share dialog can switch a
variable to fixed; they are never stored for variable slots.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="property-creator_values"></a> `creator_values` | \{\[`key`: `string`\]: [`BoundValue`](BoundValue.md); \} |
| <a id="property-draft"></a> `draft` | [`TemplateDraft`](TemplateDraft.md) |
