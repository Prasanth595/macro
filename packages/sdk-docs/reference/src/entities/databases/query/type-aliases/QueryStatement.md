# Type Alias: QueryStatement

> **QueryStatement** = `Extract`\<[`SqlStatement`](../../../../../generated/storage/types.gen/type-aliases/SqlStatement.md), \{ `kind`: `"select"`; \}\> \| \{ `database`: [`Database`](../../database/classes/Database.md); `kind`: `"schema"`; `summary`: `string`; \} \| \{ `kind`: `"insert"` \| `"update"` \| `"delete"`; `table`: [`DatabaseTable`](../../table/classes/DatabaseTable.md); `tableName`: `string`; \} \| \{ `column`: [`DatabaseColumn`](../../column/classes/DatabaseColumn.md); `columnName`: `string`; `kind`: `"alterColumnType"`; `table`: [`DatabaseTable`](../../table/classes/DatabaseTable.md); `tableName`: `string`; `to`: `string`; \}

What ran, with typed handles for resources written by the statement.
