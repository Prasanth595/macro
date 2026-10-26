# Type Alias: InitiativePropertySnapshot

> **InitiativePropertySnapshot** = \{ `assignees`: `string`[]; `completed`: `boolean`; `dueDate?`: `string` \| `null`; `priority?`: `string` \| `null`; `status?`: `string` \| `null`; \}

Snapshot of canonical property values, never a second writable store.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-assignees"></a> `assignees` | `string`[] | Assigned user ids, independent of sharing membership. |
| <a id="property-completed"></a> `completed` | `boolean` | Whether the canonical task status represents completion. |
| <a id="property-duedate"></a> `dueDate?` | `string` \| `null` | Due timestamp, or unset. |
| <a id="property-priority"></a> `priority?` | `string` \| `null` | Priority option id, or unset. |
| <a id="property-status"></a> `status?` | `string` \| `null` | Status option id, or unset. |
