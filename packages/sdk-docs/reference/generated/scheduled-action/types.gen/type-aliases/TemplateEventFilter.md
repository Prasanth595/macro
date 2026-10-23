# Type Alias: TemplateEventFilter

> **TemplateEventFilter** = \{ `condition?`: `string` \| `null`; `events`: [`EventName`](EventName.md)[]; `ids?`: [`VariableRef`](VariableRef.md)[] \| `null`; \}

An event filter whose ids may be variables. Filters without ids are
already relative to whoever owns the routine.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="property-condition"></a> `condition?` | `string` \| `null` |
| <a id="property-events"></a> `events` | [`EventName`](EventName.md)[] |
| <a id="property-ids"></a> `ids?` | [`VariableRef`](VariableRef.md)[] \| `null` |
