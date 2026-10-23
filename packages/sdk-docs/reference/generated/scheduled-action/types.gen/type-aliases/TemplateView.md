# Type Alias: TemplateView

> **TemplateView** = [`RoutineTemplate`](RoutineTemplate.md) & \{ `activation_count`: `number`; `your_activations`: `string`[]; \}

A template as a viewer sees it. Never holds the creator's values for
variable slots, because the template never stores them.

## Type Declaration

| Name | Type | Description |
| ------ | ------ | ------ |
| `activation_count` | `number` | - |
| `your_activations` | `string`[] | Routines the viewer activated from this template. |
