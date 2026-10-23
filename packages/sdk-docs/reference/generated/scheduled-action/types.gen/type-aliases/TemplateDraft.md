# Type Alias: TemplateDraft

> **TemplateDraft** = \{ `description?`: `string`; `name`: `string`; `task`: [`TemplateTask`](TemplateTask.md); `trigger`: [`TemplateTrigger`](TemplateTrigger.md); `variables`: [`TemplateVariable`](TemplateVariable.md)[]; \}

Everything a template holds except identity and bookkeeping. This is what
extraction proposes, the creator edits, and activation renders.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="property-description"></a> `description?` | `string` |
| <a id="property-name"></a> `name` | `string` |
| <a id="property-task"></a> `task` | [`TemplateTask`](TemplateTask.md) |
| <a id="property-trigger"></a> `trigger` | [`TemplateTrigger`](TemplateTrigger.md) |
| <a id="property-variables"></a> `variables` | [`TemplateVariable`](TemplateVariable.md)[] |
