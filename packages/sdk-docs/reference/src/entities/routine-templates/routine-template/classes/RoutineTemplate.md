# Class: RoutineTemplate

A shareable snapshot of a routine with its person-specific values pulled
out into variables. Activating one creates the caller's own routine.

## Extends

- [`MacroEntity`](../../../entity/classes/MacroEntity.md)\<[`TemplateView`](../../../../../generated/scheduled-action/types.gen/type-aliases/TemplateView.md)\>

## Properties

| Property | Modifier | Type | Description | Inherited from |
| ------ | ------ | ------ | ------ | ------ |
| <a id="property-activationcount"></a> `activationCount` | `readonly` | () => `Promise`\<`number`\> | How many routines were activated from this template. | - |
| <a id="property-description"></a> `description` | `readonly` | () => `Promise`\<`string` \| `undefined`\> | What the template does, for the person activating it. | - |
| <a id="property-id"></a> `id` | `public readonly` | `string` | - | [`MacroEntity`](../../../entity/classes/MacroEntity.md).[`id`](../../../entity/classes/MacroEntity.md#property-id) |
| <a id="property-name"></a> `name` | `readonly` | () => `Promise`\<`string`\> | Template name. | - |
| <a id="property-owner"></a> `owner` | `readonly` | () => `Promise`\<[`User`](../../../users/user/classes/User.md)\> | The person who shared the template. | - |
| <a id="property-variables"></a> `variables` | `readonly` | () => `Promise`\<[`TemplateVariable`](../../../../../generated/scheduled-action/types.gen/type-aliases/TemplateVariable.md)[]\> | Named slots each activator fills in, or fixed for everyone. | - |
| <a id="property-youractivations"></a> `yourActivations` | `readonly` | () => `Promise`\<[`Routine`](../../../routines/routine/classes/Routine.md)[]\> | Routines the caller activated from this template. | - |

## Methods

### activate()

> **activate**(`options`): `Promise`\<[`Routine`](../../../routines/routine/classes/Routine.md)\>

Create the caller's own routine from this template.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options` | \{ `bindings`: [`TemplateBindings`](../type-aliases/TemplateBindings.md); `name?`: `string`; \} |
| `options.bindings` | [`TemplateBindings`](../type-aliases/TemplateBindings.md) |
| `options.name?` | `string` |

#### Returns

`Promise`\<[`Routine`](../../../routines/routine/classes/Routine.md)\>

***

### delete()

> **delete**(): `Promise`\<`void`\>

Delete the template. Routines activated from it are unaffected.

#### Returns

`Promise`\<`void`\>

***

### fill()

> **fill**(`options?`): `Promise`\<[`FillTemplateResponse`](../../../../../generated/scheduled-action/types.gen/type-aliases/FillTemplateResponse.md)\>

Propose values from the caller's own workspace, validated against their
access. Nothing is saved.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options?` | \{ `current?`: [`TemplateBindings`](../type-aliases/TemplateBindings.md); `instruction?`: `string`; \} |
| `options.current?` | [`TemplateBindings`](../type-aliases/TemplateBindings.md) |
| `options.instruction?` | `string` |

#### Returns

`Promise`\<[`FillTemplateResponse`](../../../../../generated/scheduled-action/types.gen/type-aliases/FillTemplateResponse.md)\>

***

### sharePermissions()

> **sharePermissions**(): `Promise`\<[`SharePermissionV2`](../../../../../generated/scheduled-action/types.gen/type-aliases/SharePermissionV2.md)\>

Read the template's channel grants. Requires ownership.

#### Returns

`Promise`\<[`SharePermissionV2`](../../../../../generated/scheduled-action/types.gen/type-aliases/SharePermissionV2.md)\>

***

### toJSON()

> **toJSON**(): \{ `detail?`: [`TemplateView`](../../../../../generated/scheduled-action/types.gen/type-aliases/TemplateView.md); `id`: `string`; \}

#### Returns

\{ `detail?`: [`TemplateView`](../../../../../generated/scheduled-action/types.gen/type-aliases/TemplateView.md); `id`: `string`; \}

| Name | Type |
| ------ | ------ |
| `detail?` | [`TemplateView`](../../../../../generated/scheduled-action/types.gen/type-aliases/TemplateView.md) |
| `id` | `string` |

#### Inherited from

[`MacroEntity`](../../../entity/classes/MacroEntity.md).[`toJSON`](../../../entity/classes/MacroEntity.md#tojson)

***

### update()

> **update**(`draft`): `Promise`\<`void`\>

Overwrite the snapshot. Requires ownership.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `draft` | [`TemplateDraft`](../../../../../generated/scheduled-action/types.gen/type-aliases/TemplateDraft.md) |

#### Returns

`Promise`\<`void`\>

***

### updateSharePermissions()

> **updateSharePermissions**(`request`): `Promise`\<[`SharePermissionV2`](../../../../../generated/scheduled-action/types.gen/type-aliases/SharePermissionV2.md)\>

Share with channels for viewing. Requires ownership.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `request` | [`UpdateSharePermissionRequestV2`](../../../../../generated/scheduled-action/types.gen/type-aliases/UpdateSharePermissionRequestV2.md) |

#### Returns

`Promise`\<[`SharePermissionV2`](../../../../../generated/scheduled-action/types.gen/type-aliases/SharePermissionV2.md)\>

***

### byId()

> `static` **byId**(`client`, `id`): `RoutineTemplate`

Construct a lazy template handle.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `MacroClient` |
| `id` | `string` |

#### Returns

`RoutineTemplate`
