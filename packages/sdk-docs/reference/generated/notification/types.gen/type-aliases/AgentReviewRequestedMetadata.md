# Type Alias: AgentReviewRequestedMetadata

> **AgentReviewRequestedMetadata** = [`AgentSessionNotificationRef`](AgentSessionNotificationRef.md) & \{ `draftCount`: `number`; `preview?`: `string` \| `null`; `replies`: `boolean`; `reviewId`: `string`; `reviewKind`: [`AgentReviewKind`](AgentReviewKind.md); `title`: `string`; \}

An agent presented drafts that wait for the recipient to submit or dismiss
them. Sent to the account the drafts would act as; withdrawn once nothing
in the review waits for a decision.

## Type Declaration

| Name | Type | Description |
| ------ | ------ | ------ |
| `draftCount` | `number` | How many drafts wait for a decision. |
| `preview?` | `string` \| `null` | The first draft's subject or event title, when it has one. |
| `replies` | `boolean` | Every drafted email replies to an existing message. |
| `reviewId` | `string` | The review awaiting a decision, within the session. |
| `reviewKind` | [`AgentReviewKind`](AgentReviewKind.md) | What submitting the review does. |
| `title` | `string` | The review's label, as the agent wrote it. |
