# Type Alias: TemplateTask

> **TemplateTask** = \{ `prompt?`: `string`; `target`: [`VariableRef`](VariableRef.md); `user_prompt`: `string`; \}

The routine's task with its target replaced by the agent variable.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-prompt"></a> `prompt?` | `string` | - |
| <a id="property-target"></a> `target` | [`VariableRef`](VariableRef.md) | - |
| <a id="property-user_prompt"></a> `user_prompt` | `string` | Markdown instructions with `<m-template-variable>` nodes in place of person-specific values. |
