# Type Alias: GithubTaskStatusPolicy

> **GithubTaskStatusPolicy** = \{ `completeOnMerge`: `boolean`; `resetOnClose`: `boolean`; `reviewOnOpen`: `boolean`; \}

Whether GitHub pull request events may move a team's tasks.

A team with no saved row uses [`GithubTaskStatusPolicy::default`], which
keeps every automatic move on. Linking a pull request does not consult
this policy.

## Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-completeonmerge"></a> `completeOnMerge` | `boolean` | Move linked tasks to "Completed" when a pull request merges. |
| <a id="property-resetonclose"></a> `resetOnClose` | `boolean` | Move linked tasks to "Not Started" when a pull request closes unmerged. |
| <a id="property-reviewonopen"></a> `reviewOnOpen` | `boolean` | Move a newly linked task to "In Review" when its pull request is open. |
