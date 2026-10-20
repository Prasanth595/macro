# Interface: DatabaseQueryResult

The committed outcome of one statement; write calls are never automatically retried.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="property-changesapplied"></a> `changesApplied` | `number` |
| <a id="property-insertedrows"></a> `insertedRows` | [`DatabaseRow`](../../row/classes/DatabaseRow.md)[] |
| <a id="property-newversions"></a> `newVersions` | [`QueryTableVersion`](QueryTableVersion.md)[] |
| <a id="property-readversions"></a> `readVersions` | [`QueryTableVersion`](QueryTableVersion.md)[] |
| <a id="property-result"></a> `result?` | [`QueryResultSet`](QueryResultSet.md) |
| <a id="property-statement"></a> `statement` | [`QueryStatement`](../type-aliases/QueryStatement.md) |
| <a id="property-truncatedtables"></a> `truncatedTables` | `string`[] |
