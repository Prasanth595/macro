# Type Alias: StageRequirement

> **StageRequirement** = \{ `requiredColumnIds`: `string`[]; `stageColumnId`: `string`; `stageId`: `string`; \}

Fields required when a deal enters a particular option of a stage column.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-requiredcolumnids"></a> `requiredColumnIds` | `string`[] | Fields that must be present. Empty removes the rule for this stage. |
| <a id="property-stagecolumnid"></a> `stageColumnId` | `string` | Single-select column identifying the stage, independent of its name. |
| <a id="property-stageid"></a> `stageId` | `string` | Stable option identity; renaming the stage preserves the rule. |
