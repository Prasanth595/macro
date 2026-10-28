# Class: TaskNamespace

## Constructors

### Constructor

> **new TaskNamespace**(`client`): `TaskNamespace`

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `MacroClient` |

#### Returns

`TaskNamespace`

## Methods

### byId()

> **byId**(`id`): [`Task`](../../task/classes/Task.md)

A handle to a task by document id. Details load on first access.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `string` |

#### Returns

[`Task`](../../task/classes/Task.md)

***

### create()

> **create**(`opts`): `Promise`\<[`CreatedTask`](../../task/classes/CreatedTask.md)\>

Create a task. The result's `similarOpenTasks` lists existing open tasks
with nearly the same name; check them so the task is not a duplicate.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `opts` | \{ `markdown?`: `string`; `name`: `string`; `project?`: [`Project`](../../../projects/project/classes/Project.md); `shareWithTeam?`: `boolean`; `team?`: [`Team`](../../../teams/team/classes/Team.md); \} |
| `opts.markdown?` | `string` |
| `opts.name` | `string` |
| `opts.project?` | [`Project`](../../../projects/project/classes/Project.md) |
| `opts.shareWithTeam?` | `boolean` |
| `opts.team?` | [`Team`](../../../teams/team/classes/Team.md) |

#### Returns

`Promise`\<[`CreatedTask`](../../task/classes/CreatedTask.md)\>

***

### forPullRequest()

> **forPullRequest**(`url`): `Promise`\<[`Task`](../../task/classes/Task.md)[]\>

The tasks the GitHub pull request at `url` references, oldest link first.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `url` | `string` |

#### Returns

`Promise`\<[`Task`](../../task/classes/Task.md)[]\>

***

### search()

> **search**(`query`, `opts?`): `AsyncGenerator`\<[`Task`](../../task/classes/Task.md)\>

Search tasks by name and content, most relevant first, auto-paginated.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `query` | `string` |
| `opts?` | [`SearchOpts`](../../../search/interfaces/SearchOpts.md) |

#### Returns

`AsyncGenerator`\<[`Task`](../../task/classes/Task.md)\>
