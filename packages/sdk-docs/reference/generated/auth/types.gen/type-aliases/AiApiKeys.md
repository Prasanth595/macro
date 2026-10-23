# Type Alias: AiApiKeys

> **AiApiKeys** = \{ `keys`: [`AiApiKey`](AiApiKey.md)[]; `usable`: `boolean`; \}

The providers there is a key for.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-keys"></a> `keys` | [`AiApiKey`](AiApiKey.md)[] | One entry per provider with a key. |
| <a id="property-usable"></a> `usable` | `boolean` | Whether the caller's plan lets them save keys and run AI chat on them. Keys saved before a downgrade are still listed when it doesn't. |
