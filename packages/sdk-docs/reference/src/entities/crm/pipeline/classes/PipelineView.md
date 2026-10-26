# Class: PipelineView

A view owned and authorized by its CRM pipeline.

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="property-id"></a> `id` | `readonly` | `string` | View identity within the pipeline. |
| <a id="property-table"></a> `table` | `readonly` | [`PipelineTable`](PipelineTable.md) | The pipeline table this view shows. |

## Methods

### detail()

> **detail**(): `Promise`\<[`DatabaseView`](../../../../../generated/storage/types.gen/type-aliases/DatabaseView.md)\>

The current view definition from the pipeline's shared schema cache.

#### Returns

`Promise`\<[`DatabaseView`](../../../../../generated/storage/types.gen/type-aliases/DatabaseView.md)\>

***

### positions()

> **positions**(): `Promise`\<[`CardPosition`](../../../../../generated/storage/types.gen/type-aliases/CardPosition.md)[]\>

Saved card lanes and positions; unplaced cards follow in row order.

#### Returns

`Promise`\<[`CardPosition`](../../../../../generated/storage/types.gen/type-aliases/CardPosition.md)[]\>

***

### toJSON()

> **toJSON**(): \{ `id`: `string`; `pipelineId`: `string`; `tableId`: `string`; \}

Serialize identity without an authenticated client.

#### Returns

\{ `id`: `string`; `pipelineId`: `string`; `tableId`: `string`; \}

| Name | Type |
| ------ | ------ |
| `id` | `string` |
| `pipelineId` | `string` |
| `tableId` | `string` |

***

### byId()

> `static` **byId**(`table`, `id`): `PipelineView`

A handle to a stored view within a pipeline table.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `table` | [`PipelineTable`](PipelineTable.md) |
| `id` | `string` |

#### Returns

`PipelineView`
