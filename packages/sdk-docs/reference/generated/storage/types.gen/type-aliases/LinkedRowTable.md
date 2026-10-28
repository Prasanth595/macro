# Type Alias: LinkedRowTable

> **LinkedRowTable** = \{ `databaseName`: `string`; `rows`: [`StorageRow`](StorageRow.md)[]; `table`: [`TableDetail`](TableDetail.md); \}

Live source metadata and cells, emitted only after source authorization.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-databasename"></a> `databaseName` | `string` | Current database name. |
| <a id="property-rows"></a> `rows` | [`StorageRow`](StorageRow.md)[] | Only linked rows the viewer can currently read. |
| <a id="property-table"></a> `table` | [`TableDetail`](TableDetail.md) | Current table name and field definitions, including select labels. |
