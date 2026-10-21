# Type Alias: AgentApproval

> **AgentApproval** = \{ `at`: `number`; `requestedBy`: [`MacroUserIdStr`](MacroUserIdStr.md); \}

The agent approved a review on its owner's word in chat.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-at"></a> `at` | `number` | Milliseconds since epoch. |
| <a id="property-requestedby"></a> `requestedBy` | [`MacroUserIdStr`](MacroUserIdStr.md) | The owner who prompted the turn the agent approved it in. |
