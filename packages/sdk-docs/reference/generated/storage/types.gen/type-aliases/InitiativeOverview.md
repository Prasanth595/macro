# Type Alias: InitiativeOverview

> **InitiativeOverview** = \{ `description`: [`DescriptionReader`](DescriptionReader.md); `ownerId`: [`MacroUserIdStr`](MacroUserIdStr.md); `people`: [`ProfileName`](ProfileName.md)[]; `summary`: [`InitiativePageRow`](InitiativePageRow.md); `tasks`: [`TaskOverview`](TaskOverview.md)[]; \}

What a project page shows a reader who may not change it.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-description"></a> `description` | [`DescriptionReader`](DescriptionReader.md) | How to read the description. |
| <a id="property-ownerid"></a> `ownerId` | [`MacroUserIdStr`](MacroUserIdStr.md) | Owner of the initiative. |
| <a id="property-people"></a> `people` | [`ProfileName`](ProfileName.md)[] | Profile names of the owner and of every assignee shown. |
| <a id="property-summary"></a> `summary` | [`InitiativePageRow`](InitiativePageRow.md) | Identity, canonical properties and visible task progress. |
| <a id="property-tasks"></a> `tasks` | [`TaskOverview`](TaskOverview.md)[] | Visible tasks in id order. |
