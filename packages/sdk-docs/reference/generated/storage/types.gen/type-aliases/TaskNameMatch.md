# Type Alias: TaskNameMatch

> **TaskNameMatch** = \{ `nameSimilarity`: `number`; `taskId`: `string`; `taskName`: `string`; \}

An open task whose name closely matches the name of a task being created.
A hint for the creator to review, never acted on automatically.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-namesimilarity"></a> `nameSimilarity` | `number` | Trigram similarity of the two names, from 0 to 1. |
| <a id="property-taskid"></a> `taskId` | `string` | The matching existing task. |
| <a id="property-taskname"></a> `taskName` | `string` | The matching task's display name. |
