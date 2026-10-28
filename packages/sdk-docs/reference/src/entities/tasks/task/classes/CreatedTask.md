# Class: CreatedTask

A task just created by [Task.create](Task.md#create), with the open tasks of the
creator or their team whose names closely match it. Creation never merges
or changes those tasks; if one already covers the work, tell the user
rather than keeping both silently.

## Extends

- [`Task`](Task.md)

## Constructors

### Constructor

> **new CreatedTask**(`client`, `id`, `similarOpenTasks`): `CreatedTask`

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `client` | `MacroClient` | - |
| `id` | `string` | - |
| `similarOpenTasks` | readonly [`SimilarOpenTask`](../interfaces/SimilarOpenTask.md)[] | Likely duplicates, most similar first; empty when none match. |

#### Returns

`CreatedTask`

#### Overrides

`Task.constructor`

## Properties

| Property | Modifier | Type | Default value | Description | Inherited from |
| ------ | ------ | ------ | ------ | ------ | ------ |
| <a id="property-access"></a> `access` | `readonly` | [`EntityAccess`](../../../sharing/access/classes/EntityAccess.md) | `...` | Access requests and direct user grants. | [`Task`](Task.md).[`access`](Task.md#property-access) |
| <a id="property-branchedfrom"></a> `branchedFrom` | `readonly` | () => `Promise`\<[`Document`](../../../documents/document/classes/Document.md) \| `undefined`\> | `...` | The document this one was branched from, if any. | [`Task`](Task.md).[`branchedFrom`](Task.md#property-branchedfrom) |
| <a id="property-createdat"></a> `createdAt` | `readonly` | () => `Promise`\<`string` \| `undefined`\> | `...` | When the document was created. | [`Task`](Task.md).[`createdAt`](Task.md#property-createdat) |
| <a id="property-deletedat"></a> `deletedAt` | `readonly` | () => `Promise`\<`string` \| `undefined`\> | `...` | When the document was deleted, if it has been. | [`Task`](Task.md).[`deletedAt`](Task.md#property-deletedat) |
| <a id="property-entitytype"></a> `entityType` | `readonly` | `"document"` | `'document'` | Favorites identify documents as `document`. | [`Task`](Task.md).[`entityType`](Task.md#property-entitytype) |
| <a id="property-filetype"></a> `fileType` | `readonly` | () => `Promise`\<`string` \| `undefined`\> | `...` | The document's file type (e.g. `md`, `pdf`, `docx`). | [`Task`](Task.md).[`fileType`](Task.md#property-filetype) |
| <a id="property-id"></a> `id` | `public readonly` | `string` | `undefined` | - | [`Task`](Task.md).[`id`](Task.md#property-id) |
| <a id="property-name"></a> `name` | `readonly` | () => `Promise`\<`string`\> | `...` | The document's display name. | [`Task`](Task.md).[`name`](Task.md#property-name) |
| <a id="property-owner"></a> `owner` | `readonly` | () => `Promise`\<[`User`](../../../users/user/classes/User.md)\> | `...` | The user who owns the document. | [`Task`](Task.md).[`owner`](Task.md#property-owner) |
| <a id="property-project"></a> `project` | `readonly` | () => `Promise`\<[`Project`](../../../projects/project/classes/Project.md) \| `undefined`\> | `...` | The project this document belongs to, if any. | [`Task`](Task.md).[`project`](Task.md#property-project) |
| <a id="property-similaropentasks"></a> `similarOpenTasks` | `readonly` | readonly [`SimilarOpenTask`](../interfaces/SimilarOpenTask.md)[] | `undefined` | Likely duplicates, most similar first; empty when none match. | - |
| <a id="property-updatedat"></a> `updatedAt` | `readonly` | () => `Promise`\<`string` \| `undefined`\> | `...` | When the document was last updated. | [`Task`](Task.md).[`updatedAt`](Task.md#property-updatedat) |
| <a id="property-search"></a> `search` | `static` | (`client`, `query`, `searchOpts?`) => `AsyncGenerator`\<[`Task`](Task.md)\> | `...` | Search tasks by name and content, most relevant first, auto-paginated. | [`Task`](Task.md).[`search`](Task.md#property-search) |

## Methods

### anchors()

> **anchors**(): `Promise`\<[`DocumentAnchor`](../../../documents/anchor/classes/DocumentAnchor.md)[]\>

PDF annotations in this document.

#### Returns

`Promise`\<[`DocumentAnchor`](../../../documents/anchor/classes/DocumentAnchor.md)[]\>

#### Inherited from

[`Task`](Task.md).[`anchors`](Task.md#anchors)

***

### branchName()

> **branchName**(): `Promise`\<`string`\>

The git branch name derived for the document (task documents).

#### Returns

`Promise`\<`string`\>

#### Inherited from

[`Task`](Task.md).[`branchName`](Task.md#branchname)

***

### comment()

> **comment**(`body`, `opts?`): `Promise`\<[`Comment`](../../../documents/comment/classes/Comment.md)\>

Add a comment. Starts a new unanchored thread, or replies to an existing
one when `threadId` (the thread's root comment id) is given.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `body` | `string` \| [`RichMessage`](../../../../mentions/interfaces/RichMessage.md) | Plain text, or a rich body composed with msg. |
| `opts?` | \{ `threadId?`: `string`; \} | - |
| `opts.threadId?` | `string` | - |

#### Returns

`Promise`\<[`Comment`](../../../documents/comment/classes/Comment.md)\>

The created comment.

#### Inherited from

[`Task`](Task.md).[`comment`](Task.md#comment)

***

### comments()

> **comments**(): `Promise`\<[`CommentThread`](../../../documents/document/interfaces/CommentThread.md)[]\>

The document's live comment threads, each with its comments, newest thread first.

#### Returns

`Promise`\<[`CommentThread`](../../../documents/document/interfaces/CommentThread.md)[]\>

#### Inherited from

[`Task`](Task.md).[`comments`](Task.md#comments)

***

### completed()

> **completed**(): `Promise`\<`boolean` \| `undefined`\>

Whether the task is completed (its Status property is "Completed");
`undefined` if the document is not a task.

#### Returns

`Promise`\<`boolean` \| `undefined`\>

#### Inherited from

[`Task`](Task.md).[`completed`](Task.md#completed)

***

### content()

> **content**(): `Promise`\<`string`\>

Current Markdown for native documents, extracted text for PDF/Word,
or raw file content for other formats. Native reads include live edits.

#### Returns

`Promise`\<`string`\>

#### Inherited from

[`Task`](Task.md).[`content`](Task.md#content)

***

### copy()

> **copy**(`opts`): `Promise`\<[`Document`](../../../documents/document/classes/Document.md)\>

Copy the document under a new name, optionally from a specific version.
Returns a handle to the new document.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `opts` | \{ `name`: `string`; `versionId?`: `number`; \} |
| `opts.name` | `string` |
| `opts.versionId?` | `number` |

#### Returns

`Promise`\<[`Document`](../../../documents/document/classes/Document.md)\>

#### Inherited from

[`Task`](Task.md).[`copy`](Task.md#copy)

***

### createHighlight()

> **createHighlight**(`options`): `Promise`\<[`DocumentAnchor`](../../../documents/anchor/classes/DocumentAnchor.md)\>

Create a standalone PDF highlight.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options` | `Omit`\<[`PdfHighlightAnchorRequest`](../../../../../generated/storage/types.gen/type-aliases/PdfHighlightAnchorRequest.md), `"uuid"`\> |

#### Returns

`Promise`\<[`DocumentAnchor`](../../../documents/anchor/classes/DocumentAnchor.md)\>

#### Inherited from

[`Task`](Task.md).[`createHighlight`](Task.md#createhighlight)

***

### delete()

> **delete**(`opts?`): `Promise`\<`void`\>

Delete the document. Soft by default (reversible with [restore](../../../documents/document/classes/Document.md#restore));
pass `permanent: true` to delete irreversibly.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `opts?` | \{ `permanent?`: `boolean`; \} |
| `opts.permanent?` | `boolean` |

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`Task`](Task.md).[`delete`](Task.md#delete)

***

### deleteProperty()

> **deleteProperty**(`assignment`): `Promise`\<`void`\>

Remove a property from this entity, given its [properties](#properties) entry.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `assignment` | [`EntityPropertyWithDefinition`](../../../../../generated/properties/types.gen/type-aliases/EntityPropertyWithDefinition.md) |

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`Task`](Task.md).[`deleteProperty`](Task.md#deleteproperty)

***

### favorite()

> **favorite**(): `Promise`\<`CreatedTask`\>

Add this entity to the user's favorites. Returns this handle for chaining.
Plain unwrap: favoriting alters the user's favorites collection, not this
entity's own detail, so there's nothing cached to invalidate.

#### Returns

`Promise`\<`CreatedTask`\>

#### Inherited from

[`Task`](Task.md).[`favorite`](Task.md#favorite)

***

### githubPullRequests()

> **githubPullRequests**(): `Promise`\<[`GithubPullRequest`](../../../../../generated/storage/types.gen/type-aliases/GithubPullRequest.md)[]\>

GitHub pull requests associated with the document.

#### Returns

`Promise`\<[`GithubPullRequest`](../../../../../generated/storage/types.gen/type-aliases/GithubPullRequest.md)[]\>

#### Inherited from

[`Task`](Task.md).[`githubPullRequests`](Task.md#githubpullrequests)

***

### meetingNotes()

> **meetingNotes**(): `Promise`\<\{ `eventTitle`: `string`; `note`: [`CalendarNote`](../../../calendar/note/classes/CalendarNote.md); \}[]\>

Meeting links visible to the reader. Owners also receive unavailable grants and may unlink them to revoke meeting/team access.

#### Returns

`Promise`\<\{ `eventTitle`: `string`; `note`: [`CalendarNote`](../../../calendar/note/classes/CalendarNote.md); \}[]\>

#### Inherited from

[`Task`](Task.md).[`meetingNotes`](Task.md#meetingnotes)

***

### messageThreadById()

> **messageThreadById**(`id`): [`MessageThread`](../../../messages/thread/classes/MessageThread.md)

A shared message thread scoped to this resource.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `string` |

#### Returns

[`MessageThread`](../../../messages/thread/classes/MessageThread.md)

#### Inherited from

[`Task`](Task.md).[`messageThreadById`](Task.md#messagethreadbyid)

***

### move()

> **move**(`project`): `Promise`\<`void`\>

Move the document into a project (or out of one, with `null`).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `project` | [`Project`](../../../projects/project/classes/Project.md) \| `null` |

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`Task`](Task.md).[`move`](Task.md#move)

***

### permission()

> **permission**(): `Promise`\<\{ `permission`: [`EntityPermission`](../../../../../generated/storage/types.gen/type-aliases/EntityPermission.md); `status`: `"access"`; \} \| \{ `status`: `"no_access"`; \}\>

Read the caller's effective permission on this entity.

#### Returns

`Promise`\<\{ `permission`: [`EntityPermission`](../../../../../generated/storage/types.gen/type-aliases/EntityPermission.md); `status`: `"access"`; \} \| \{ `status`: `"no_access"`; \}\>

#### Inherited from

[`Task`](Task.md).[`permission`](Task.md#permission)

***

### permissionsToken()

> **permissionsToken**(): `Promise`\<`string`\>

Mint a scoped permissions token.

#### Returns

`Promise`\<`string`\>

#### Inherited from

[`Task`](Task.md).[`permissionsToken`](Task.md#permissionstoken)

***

### prepareSave()

> **prepareSave**(`parts`): `Promise`\<[`PreSaveDocumentResponseData`](../../../../../generated/storage/types.gen/type-aliases/PreSaveDocumentResponseData.md)\>

Prepare multipart content saving and return the service's upload instructions.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `parts` | [`SaveBomPart`](../../../../../generated/storage/types.gen/type-aliases/SaveBomPart.md)[] |

#### Returns

`Promise`\<[`PreSaveDocumentResponseData`](../../../../../generated/storage/types.gen/type-aliases/PreSaveDocumentResponseData.md)\>

#### Inherited from

[`Task`](Task.md).[`prepareSave`](Task.md#preparesave)

***

### properties()

> **properties**(`opts?`): `Promise`\<[`EntityPropertyWithDefinition`](../../../../../generated/properties/types.gen/type-aliases/EntityPropertyWithDefinition.md)[]\>

The properties set on this entity, each with its definition, value, and options.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `opts?` | \{ `includeMetadata?`: `boolean`; \} |
| `opts.includeMetadata?` | `boolean` |

#### Returns

`Promise`\<[`EntityPropertyWithDefinition`](../../../../../generated/properties/types.gen/type-aliases/EntityPropertyWithDefinition.md)[]\>

#### Inherited from

[`Task`](Task.md).[`properties`](Task.md#properties)

***

### propertyReference()

> **propertyReference**(): [`PropertyTargetReference`](../../../../../generated/properties/types.gen/type-aliases/PropertyTargetReference.md)

This entity's reference for bulk property operations.

#### Returns

[`PropertyTargetReference`](../../../../../generated/properties/types.gen/type-aliases/PropertyTargetReference.md)

#### Inherited from

[`Task`](Task.md).[`propertyReference`](Task.md#propertyreference)

***

### rename()

> **rename**(`name`): `Promise`\<`void`\>

Rename the document.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `name` | `string` |

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`Task`](Task.md).[`rename`](Task.md#rename)

***

### restore()

> **restore**(): `Promise`\<`void`\>

Restore a soft-deleted document.

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`Task`](Task.md).[`restore`](Task.md#restore)

***

### save()

> **save**(`options`): `Promise`\<[`SaveDocumentResponseData`](../../../../../generated/storage/types.gen/type-aliases/SaveDocumentResponseData.md)\>

Commit uploaded content. Does not retry uncertain writes.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options` | [`SaveDocumentRequest`](../../../../../generated/storage/types.gen/type-aliases/SaveDocumentRequest.md) |

#### Returns

`Promise`\<[`SaveDocumentResponseData`](../../../../../generated/storage/types.gen/type-aliases/SaveDocumentResponseData.md)\>

#### Inherited from

[`Task`](Task.md).[`save`](Task.md#save)

***

### setProperty()

> **setProperty**(`property`, `value?`): `Promise`\<`void`\>

Set a property value on this entity, or attach the property without a
value when `value` is omitted.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `property` | [`PropertyDefinition`](../../../properties/property-definition/classes/PropertyDefinition.md) |
| `value?` | [`SetPropertyValue`](../../../../../generated/properties/types.gen/type-aliases/SetPropertyValue.md) |

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`Task`](Task.md).[`setProperty`](Task.md#setproperty)

***

### setTeamShare()

> **setTeamShare**(`shared`): `Promise`\<`void`\>

Share the document with the owner's team, or unshare it.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `shared` | `boolean` |

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`Task`](Task.md).[`setTeamShare`](Task.md#setteamshare)

***

### sharePermissions()

> **sharePermissions**(): `Promise`\<[`SharePermissionV2`](../../../../../generated/storage/types.gen/type-aliases/SharePermissionV2.md)\>

Sharing configuration.

#### Returns

`Promise`\<[`SharePermissionV2`](../../../../../generated/storage/types.gen/type-aliases/SharePermissionV2.md)\>

#### Inherited from

[`Task`](Task.md).[`sharePermissions`](Task.md#sharepermissions)

***

### shortId()

> **shortId**(): `Promise`\<`string`\>

The document's short id (used in compact links and branch names).

#### Returns

`Promise`\<`string`\>

#### Inherited from

[`Task`](Task.md).[`shortId`](Task.md#shortid)

***

### simpleSave()

> **simpleSave**(): `Promise`\<[`SaveDocumentResponseData`](../../../../../generated/storage/types.gen/type-aliases/SaveDocumentResponseData.md)\>

Commit a simple document save.

#### Returns

`Promise`\<[`SaveDocumentResponseData`](../../../../../generated/storage/types.gen/type-aliases/SaveDocumentResponseData.md)\>

#### Inherited from

[`Task`](Task.md).[`simpleSave`](Task.md#simplesave)

***

### teamShare()

> **teamShare**(): `Promise`\<[`DocumentTeamShareResponse`](../../../../../generated/storage/types.gen/type-aliases/DocumentTeamShareResponse.md)\>

Whether the document is shared with the owner's team, and which team.

#### Returns

`Promise`\<[`DocumentTeamShareResponse`](../../../../../generated/storage/types.gen/type-aliases/DocumentTeamShareResponse.md)\>

#### Inherited from

[`Task`](Task.md).[`teamShare`](Task.md#teamshare)

***

### timelinePage()

> **timelinePage**(`selection?`): `Promise`\<\{ `entries`: (\{ `activity`: \{ `action`: `string`; `actor`: [`User`](../../../users/user/classes/User.md); `actor_id`: `string`; `id`: `string`; `occurred_at`: `string`; `payload?`: `unknown`; \}; `message?`: `undefined`; `type`: `"activity"`; \} \| \{ `activity?`: `undefined`; `message`: [`Comment`](../../../documents/comment/classes/Comment.md); `type`: `"message"`; \})[]; `nextCursor`: [`MessageCursor`](../../../../../generated/storage/types.gen/type-aliases/MessageCursor.md) \| `undefined`; `previousCursor`: [`MessageCursor`](../../../../../generated/storage/types.gen/type-aliases/MessageCursor.md) \| `undefined`; \}\>

A mixed message and activity timeline page.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `selection?` | [`TimelineOptions`](../../../messages/thread/interfaces/TimelineOptions.md)\<[`Comment`](../../../documents/comment/classes/Comment.md)\> |

#### Returns

`Promise`\<\{ `entries`: (\{ `activity`: \{ `action`: `string`; `actor`: [`User`](../../../users/user/classes/User.md); `actor_id`: `string`; `id`: `string`; `occurred_at`: `string`; `payload?`: `unknown`; \}; `message?`: `undefined`; `type`: `"activity"`; \} \| \{ `activity?`: `undefined`; `message`: [`Comment`](../../../documents/comment/classes/Comment.md); `type`: `"message"`; \})[]; `nextCursor`: [`MessageCursor`](../../../../../generated/storage/types.gen/type-aliases/MessageCursor.md) \| `undefined`; `previousCursor`: [`MessageCursor`](../../../../../generated/storage/types.gen/type-aliases/MessageCursor.md) \| `undefined`; \}\>

#### Inherited from

[`Task`](Task.md).[`timelinePage`](Task.md#timelinepage)

***

### toJSON()

> **toJSON**(): \{ `detail?`: [`DocumentMetadataWithContent`](../../../../../generated/storage/types.gen/type-aliases/DocumentMetadataWithContent.md); `id`: `string`; \}

#### Returns

\{ `detail?`: [`DocumentMetadataWithContent`](../../../../../generated/storage/types.gen/type-aliases/DocumentMetadataWithContent.md); `id`: `string`; \}

| Name | Type |
| ------ | ------ |
| `detail?` | [`DocumentMetadataWithContent`](../../../../../generated/storage/types.gen/type-aliases/DocumentMetadataWithContent.md) |
| `id` | `string` |

#### Inherited from

[`Task`](Task.md).[`toJSON`](Task.md#tojson)

***

### toMention()

> **toMention**(): [`MentionPart`](../../../../mentions/interfaces/MentionPart.md)

#### Returns

[`MentionPart`](../../../../mentions/interfaces/MentionPart.md)

#### Inherited from

[`Task`](Task.md).[`toMention`](Task.md#tomention)

***

### unfavorite()

> **unfavorite**(): `Promise`\<`CreatedTask`\>

Remove this entity from the user's favorites. Returns this handle for chaining.

#### Returns

`Promise`\<`CreatedTask`\>

#### Inherited from

[`Task`](Task.md).[`unfavorite`](Task.md#unfavorite)

***

### updatePropertyOptions()

> **updatePropertyOptions**(`changes`): `Promise`\<[`BulkUpdateEntityPropertyOptionsResponse`](../../../../../generated/properties/types.gen/type-aliases/BulkUpdateEntityPropertyOptionsResponse.md)\>

Apply multi-select option deltas atomically across this entity's properties.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `changes` | [`PropertyOptionDelta`](../../../entity/interfaces/PropertyOptionDelta.md)[] |

#### Returns

`Promise`\<[`BulkUpdateEntityPropertyOptionsResponse`](../../../../../generated/properties/types.gen/type-aliases/BulkUpdateEntityPropertyOptionsResponse.md)\>

#### Inherited from

[`Task`](Task.md).[`updatePropertyOptions`](Task.md#updatepropertyoptions)

***

### version()

> **version**(`version`): [`DocumentVersion`](../../../documents/version/classes/DocumentVersion.md)

A handle to an immutable version.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `version` | `number` |

#### Returns

[`DocumentVersion`](../../../documents/version/classes/DocumentVersion.md)

#### Inherited from

[`Task`](Task.md).[`version`](Task.md#version)

***

### webUrl()

> **webUrl**(): `string`

The task's URL in the Macro web app.

#### Returns

`string`

#### Inherited from

[`Task`](Task.md).[`webUrl`](Task.md#weburl)

***

### byId()

> `static` **byId**(`client`, `id`): [`Task`](Task.md)

A handle to a task by document id. Details load on first access.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `MacroClient` |
| `id` | `string` |

#### Returns

[`Task`](Task.md)

#### Inherited from

[`Task`](Task.md).[`byId`](Task.md#byid)

***

### create()

> `static` **create**(`client`, `opts`): `Promise`\<`CreatedTask`\>

Create a task. `team` scopes the team task number and may be omitted
when the creator belongs to exactly one team; `shareWithTeam` defaults
to true. The result lists [CreatedTask.similarOpenTasks](#property-similaropentasks): check
them before assuming the new task is the only one for this work.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `MacroClient` |
| `opts` | \{ `markdown?`: `string`; `name`: `string`; `project?`: [`Project`](../../../projects/project/classes/Project.md); `shareWithTeam?`: `boolean`; `team?`: [`Team`](../../../teams/team/classes/Team.md); \} |
| `opts.markdown?` | `string` |
| `opts.name` | `string` |
| `opts.project?` | [`Project`](../../../projects/project/classes/Project.md) |
| `opts.shareWithTeam?` | `boolean` |
| `opts.team?` | [`Team`](../../../teams/team/classes/Team.md) |

#### Returns

`Promise`\<`CreatedTask`\>

#### Inherited from

[`Task`](Task.md).[`create`](Task.md#create)

***

### createSkill()

> `static` **createSkill**(`client`, `opts`): `Promise`\<[`Document`](../../../documents/document/classes/Document.md)\>

Create a skill: a markdown document containing instructions that AI reads
and follows when the skill is referenced in an AI input.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `MacroClient` |
| `opts` | \{ `markdown?`: `string`; `name`: `string`; `project?`: [`Project`](../../../projects/project/classes/Project.md); \} |
| `opts.markdown?` | `string` |
| `opts.name` | `string` |
| `opts.project?` | [`Project`](../../../projects/project/classes/Project.md) |

#### Returns

`Promise`\<[`Document`](../../../documents/document/classes/Document.md)\>

#### Inherited from

[`Task`](Task.md).[`createSkill`](Task.md#createskill)

***

### createSnippet()

> `static` **createSnippet**(`client`, `opts`): `Promise`\<[`Document`](../../../documents/document/classes/Document.md)\>

Create a snippet: a reusable markdown document that can be inserted into
any markdown area.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `MacroClient` |
| `opts` | \{ `markdown?`: `string`; `name`: `string`; `project?`: [`Project`](../../../projects/project/classes/Project.md); \} |
| `opts.markdown?` | `string` |
| `opts.name` | `string` |
| `opts.project?` | [`Project`](../../../projects/project/classes/Project.md) |

#### Returns

`Promise`\<[`Document`](../../../documents/document/classes/Document.md)\>

#### Inherited from

[`Task`](Task.md).[`createSnippet`](Task.md#createsnippet)

***

### forPullRequest()

> `static` **forPullRequest**(`client`, `url`): `Promise`\<[`Task`](Task.md)[]\>

The tasks the GitHub pull request at `url` references (as `MACRO-<id>` in
its text, branch, or comments), oldest link first. Empty when the caller
cannot see the pull request; tasks the caller cannot open still appear.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `MacroClient` |
| `url` | `string` |

#### Returns

`Promise`\<[`Task`](Task.md)[]\>

#### Inherited from

[`Task`](Task.md).[`forPullRequest`](Task.md#forpullrequest)

***

### recent()

> `static` **recent**(`client`, `opts?`): `AsyncGenerator`\<[`Document`](../../../documents/document/classes/Document.md)\>

The user's recent documents, most recent first, auto-paginated.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `MacroClient` |
| `opts?` | \{ `fileType?`: `string`; `pageSize?`: `number`; \} |
| `opts.fileType?` | `string` |
| `opts.pageSize?` | `number` |

#### Returns

`AsyncGenerator`\<[`Document`](../../../documents/document/classes/Document.md)\>

#### Inherited from

[`Task`](Task.md).[`recent`](Task.md#recent)

***

### recentlyDeleted()

> `static` **recentlyDeleted**(`client`): `Promise`\<[`Document`](../../../documents/document/classes/Document.md)[]\>

The user's recently soft-deleted documents. The underlying endpoint also
returns deleted chats and projects; those are filtered out here.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `MacroClient` |

#### Returns

`Promise`\<[`Document`](../../../documents/document/classes/Document.md)[]\>

#### Inherited from

[`Task`](Task.md).[`recentlyDeleted`](Task.md#recentlydeleted)
