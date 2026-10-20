# Interface: QueryResultSet

SQL returns dynamically shaped, discriminated cells and optional source row handles.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="property-columns"></a> `columns` | [`QueryColumn`](../type-aliases/QueryColumn.md)[] |
| <a id="property-rowhandles"></a> `rowHandles` | [`DatabaseRow`](../../row/classes/DatabaseRow.md)[] |
| <a id="property-rows"></a> `rows` | ([`SqlCell`](../../../../../generated/storage/types.gen/type-aliases/SqlCell.md) \| `null`)[][] |
| <a id="property-sourcetable"></a> `sourceTable?` | [`DatabaseTable`](../../table/classes/DatabaseTable.md) |
