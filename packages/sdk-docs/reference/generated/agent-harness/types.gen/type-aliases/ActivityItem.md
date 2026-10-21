# Type Alias: ActivityItem

> **ActivityItem** = \{ `action`: [`ActivityItemAction`](ActivityItemAction.md); `id`: `string`; `title?`: `string` \| `null`; `type`: [`ActivityItemType`](ActivityItemType.md); \}

A workspace item a completed SDK operation created or changed, as the
program's SDK reported it. Advisory like the activity it came with: the
conversation shows it as a card, and readers open the item with their own
access.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-action"></a> `action` | [`ActivityItemAction`](ActivityItemAction.md) | What the operation did to it. |
| <a id="property-id"></a> `id` | `string` | The item's id. |
| <a id="property-title"></a> `title?` | `string` \| `null` | The item's name, when the operation carried one. |
| <a id="property-type"></a> `type` | [`ActivityItemType`](ActivityItemType.md) | What kind of item it is. |
