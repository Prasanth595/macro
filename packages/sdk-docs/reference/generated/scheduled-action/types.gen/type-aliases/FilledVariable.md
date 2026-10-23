# Type Alias: FilledVariable

> **FilledVariable** = \{ `confidence?`: `null` \| [`Confidence`](Confidence.md); `key`: [`VariableKey`](VariableKey.md); `problem?`: `string` \| `null`; `reason?`: `string` \| `null`; `value?`: `null` \| [`BoundValue`](BoundValue.md); \}

One variable after fill and validation. `value` is absent when nothing
usable was found; `problem` then says why.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="property-confidence"></a> `confidence?` | `null` \| [`Confidence`](Confidence.md) |
| <a id="property-key"></a> `key` | [`VariableKey`](VariableKey.md) |
| <a id="property-problem"></a> `problem?` | `string` \| `null` |
| <a id="property-reason"></a> `reason?` | `string` \| `null` |
| <a id="property-value"></a> `value?` | `null` \| [`BoundValue`](BoundValue.md) |
