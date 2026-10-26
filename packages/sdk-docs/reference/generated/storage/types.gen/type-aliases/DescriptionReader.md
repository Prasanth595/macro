# Type Alias: DescriptionReader

> **DescriptionReader** = \{ `state`: `"empty"`; \} \| \{ `state`: `"live"`; `token`: `string`; \}

How a reader connects to a project description without changing it.

## Union Members

### Type Literal

\{ `state`: `"empty"`; \}

***

### Type Literal

\{ `state`: `"live"`; `token`: `string`; \}

| Name | Type | Description |
| ------ | ------ | ------ |
| `state` | `"live"` | - |
| `token` | `string` | Sync-service connection token. |
