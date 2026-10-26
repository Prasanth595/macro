# Interface: LinkedDatabaseRow

A readable source row linked to a CRM record, with its current preview.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-databasename"></a> `databaseName` | `string` | Current source database name. |
| <a id="property-fields"></a> `fields` | \{ `column`: [`DatabaseColumn`](../../../databases/column/classes/DatabaseColumn.md); `value`: [`PropertyValue`](../../../../../generated/storage/types.gen/type-aliases/PropertyValue.md) \| `undefined`; \}[] | Fields in source order; absent values are empty cells. |
| <a id="property-row"></a> `row` | [`DatabaseRow`](../../../databases/row/classes/DatabaseRow.md) | The original row, with the database's own permissions. |
| <a id="property-tablename"></a> `tableName` | `string` | Current source table name. |
