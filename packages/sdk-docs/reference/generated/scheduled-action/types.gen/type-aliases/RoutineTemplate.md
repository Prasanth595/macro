# Type Alias: RoutineTemplate

> **RoutineTemplate** = [`TemplateDraft`](TemplateDraft.md) & \{ `created_at`: `string`; `id`: `string`; `owner`: `string`; `source_action_id?`: `string` \| `null`; `updated_at`: `string`; \}

A stored template.

## Type Declaration

| Name | Type | Description |
| ------ | ------ | ------ |
| `created_at` | `string` | - |
| `id` | `string` | - |
| `owner` | `string` | - |
| `source_action_id?` | `string` \| `null` | The routine it was made from. Absent once that routine is deleted. |
| `updated_at` | `string` | - |
