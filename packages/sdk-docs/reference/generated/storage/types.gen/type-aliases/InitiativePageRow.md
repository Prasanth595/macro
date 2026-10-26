# Type Alias: InitiativePageRow

> **InitiativePageRow** = [`InitiativeSummary`](InitiativeSummary.md) & \{ `completedTaskCount`: `number`; `properties`: [`InitiativePropertySnapshot`](InitiativePropertySnapshot.md); `taskCount`: `number`; `userAccessLevel`: [`AccessLevel`](AccessLevel.md); \}

A project row with caller-specific permissions, properties and visible task progress.

## Type Declaration

| Name | Type | Description |
| ------ | ------ | ------ |
| `completedTaskCount` | `number` | Number of visible tasks whose status is completed. |
| `properties` | [`InitiativePropertySnapshot`](InitiativePropertySnapshot.md) | Canonical property values. |
| `taskCount` | `number` | Number of associated tasks the caller may view. |
| `userAccessLevel` | [`AccessLevel`](AccessLevel.md) | Verified effective access for the caller. |
