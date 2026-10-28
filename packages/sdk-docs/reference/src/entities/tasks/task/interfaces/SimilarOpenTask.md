# Interface: SimilarOpenTask

An existing open task whose name closely matches a newly created one.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-name"></a> `name` | `string` | The existing task's name. |
| <a id="property-namesimilarity"></a> `nameSimilarity` | `number` | Trigram similarity of the two names, from 0 to 1. |
| <a id="property-task"></a> `task` | [`Task`](../classes/Task.md) | The existing task. |
