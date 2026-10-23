# Type Alias: RoutineProvenance

> **RoutineProvenance** = \{ `bindings`: \{\[`key`: `string`\]: [`BoundValue`](BoundValue.md); \}; `rebindable`: `boolean`; `template?`: `null` \| [`ProvenanceTemplate`](ProvenanceTemplate.md); `template_id`: `string`; `variables`: [`TemplateVariable`](TemplateVariable.md)[]; \}

The template a routine was activated from, for the routine's owner.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-bindings"></a> `bindings` | \{\[`key`: `string`\]: [`BoundValue`](BoundValue.md); \} | - |
| <a id="property-rebindable"></a> `rebindable` | `boolean` | Whether the routine still reads exactly as the template rendered it, so a single binding can be changed. |
| <a id="property-template"></a> `template?` | `null` \| [`ProvenanceTemplate`](ProvenanceTemplate.md) | - |
| <a id="property-template_id"></a> `template_id` | `string` | - |
| <a id="property-variables"></a> `variables` | [`TemplateVariable`](TemplateVariable.md)[] | The template's variables, for labelling the bindings. |
