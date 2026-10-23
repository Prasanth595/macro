# Type Alias: FillTemplateRequest

> **FillTemplateRequest** = \{ `current?`: \{\[`key`: `string`\]: [`BoundValue`](BoundValue.md); \}; `instruction?`: `string` \| `null`; \}

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-current"></a> `current?` | \{\[`key`: `string`\]: [`BoundValue`](BoundValue.md); \} | The viewer's current choices, so related variables change together. |
| <a id="property-instruction"></a> `instruction?` | `string` \| `null` | "Do this for Initech instead": re-fill with this instruction. |
