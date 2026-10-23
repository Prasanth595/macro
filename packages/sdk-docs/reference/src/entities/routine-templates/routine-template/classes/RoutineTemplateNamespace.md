# Class: RoutineTemplateNamespace

Templates made from routines.

## Constructors

### Constructor

> **new RoutineTemplateNamespace**(`client`): `RoutineTemplateNamespace`

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `MacroClient` |

#### Returns

`RoutineTemplateNamespace`

## Methods

### byId()

> **byId**(`id`): [`RoutineTemplate`](RoutineTemplate.md)

Construct a lazy template handle.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `string` |

#### Returns

[`RoutineTemplate`](RoutineTemplate.md)

***

### create()

> **create**(`routine`, `draft`): `Promise`\<[`RoutineTemplate`](RoutineTemplate.md)\>

Save a draft as a template of `routine`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `routine` | [`Routine`](../../../routines/routine/classes/Routine.md) |
| `draft` | [`TemplateDraft`](../../../../../generated/scheduled-action/types.gen/type-aliases/TemplateDraft.md) |

#### Returns

`Promise`\<[`RoutineTemplate`](RoutineTemplate.md)\>

***

### extract()

> **extract**(`routine`): `Promise`\<[`ExtractedTemplate`](../../../../../generated/scheduled-action/types.gen/type-aliases/ExtractedTemplate.md)\>

Draft a template from a routine the caller owns, with the caller's own
values for each variable. Nothing is saved.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `routine` | [`Routine`](../../../routines/routine/classes/Routine.md) |

#### Returns

`Promise`\<[`ExtractedTemplate`](../../../../../generated/scheduled-action/types.gen/type-aliases/ExtractedTemplate.md)\>
