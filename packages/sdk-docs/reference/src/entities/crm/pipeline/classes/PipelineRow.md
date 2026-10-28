# Class: PipelineRow

One pipeline row.

## Extends

- [`MacroEntity`](../../../entity/classes/MacroEntity.md)\<[`StorageRow`](../../../../../generated/storage/types.gen/type-aliases/StorageRow.md)\>

## Properties

| Property | Modifier | Type | Description | Inherited from |
| ------ | ------ | ------ | ------ | ------ |
| <a id="property-cells"></a> `cells` | `readonly` | () => `Promise`\<\{\[`key`: `string`\]: [`PropertyValue`](../../../../../generated/storage/types.gen/type-aliases/PropertyValue.md); \}\> | Values keyed by property definition. | - |
| <a id="property-id"></a> `id` | `public readonly` | `string` | - | [`MacroEntity`](../../../entity/classes/MacroEntity.md).[`id`](../../../entity/classes/MacroEntity.md#property-id) |
| <a id="property-pipeline"></a> `pipeline` | `readonly` | [`CrmPipeline`](CrmPipeline.md) | Parent pipeline. | - |

## Methods

### linkedRows()

> **linkedRows**(): `Promise`\<[`LinkedDatabaseRow`](../../linked-row/interfaces/LinkedDatabaseRow.md)[]\>

Current readable source rows linked to this particular entry.

#### Returns

`Promise`\<[`LinkedDatabaseRow`](../../linked-row/interfaces/LinkedDatabaseRow.md)[]\>

***

### linkRow()

> **linkRow**(`row`): `Promise`\<`void`\>

Link a readable source without changing its cells or permissions.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `row` | [`DatabaseRow`](../../../databases/row/classes/DatabaseRow.md) |

#### Returns

`Promise`\<`void`\>

***

### refresh()

> **refresh**(): `Promise`\<`void`\>

Reload this row after an operation batch.

#### Returns

`Promise`\<`void`\>

***

### toJSON()

> **toJSON**(): \{ `detail?`: [`StorageRow`](../../../../../generated/storage/types.gen/type-aliases/StorageRow.md); `id`: `string`; `pipelineId`: `string`; \}

Serialize identity within its pipeline.

#### Returns

\{ `detail?`: [`StorageRow`](../../../../../generated/storage/types.gen/type-aliases/StorageRow.md); `id`: `string`; `pipelineId`: `string`; \}

| Name | Type |
| ------ | ------ |
| `detail?` | [`StorageRow`](../../../../../generated/storage/types.gen/type-aliases/StorageRow.md) |
| `id` | `string` |
| `pipelineId` | `string` |

#### Overrides

[`MacroEntity`](../../../entity/classes/MacroEntity.md).[`toJSON`](../../../entity/classes/MacroEntity.md#tojson)

***

### unlinkRow()

> **unlinkRow**(`row`): `Promise`\<`void`\>

Remove only this entry's link, retaining the source and other targets.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `row` | [`DatabaseRow`](../../../databases/row/classes/DatabaseRow.md) |

#### Returns

`Promise`\<`void`\>

***

### byId()

> `static` **byId**(`client`, `pipeline`, `id`): `PipelineRow`

Construct a scoped row handle.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `MacroClient` |
| `pipeline` | [`CrmPipeline`](CrmPipeline.md) |
| `id` | `string` |

#### Returns

`PipelineRow`

***

### from()

> `static` **from**(`client`, `pipeline`, `record`): `PipelineRow`

Seed a listed row.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `MacroClient` |
| `pipeline` | [`CrmPipeline`](CrmPipeline.md) |
| `record` | [`StorageRow`](../../../../../generated/storage/types.gen/type-aliases/StorageRow.md) |

#### Returns

`PipelineRow`
