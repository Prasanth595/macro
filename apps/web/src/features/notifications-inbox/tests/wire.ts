import type {
  NotificationInboxEntryFieldsFragment,
  NotificationInboxPatchFieldsFragment,
  WorkFeedRowType,
} from '@service-storage/graphql/generated/graphql';

type RowFixture = {
  id: string;
  rowType?: WorkFeedRowType;
  latestAt: string;
  revision?: string;
  unseen?: boolean;
  notificationIds?: string[];
};

/** A document comment notification as the GraphQL fragments select it. */
export function commentNotification(
  docId: string,
  id: string,
  createdAt: string
) {
  return {
    id,
    eventType: 'commented_on_document',
    entityType: 'DOCUMENT',
    entityId: docId,
    sent: true,
    state: 'UNSEEN',
    createdAt,
    viewedAt: null,
    updatedAt: createdAt,
    senderId: 'macro|colleague@example.com',
    metadata: {
      __typename: 'GraphqlCommentedOnDocumentMetadata',
      commentedOnDocumentDocumentName: 'Plan',
      commentedOnDocumentOwner: 'macro|viewer@example.com',
      commentedOnDocumentFileType: 'md',
      commentedOnDocumentSubType: null,
      commentedOnDocumentCommentId: id,
      commentedOnDocumentThreadId: id,
      commentedOnDocumentText: 'looks good',
      commentedOnDocumentSenderProfilePictureUrl: null,
    },
  };
}

/** A document entry of an attention feed, with the given rows. */
export function inboxEntry(fixture: {
  docId: string;
  sortAt: string;
  rows: RowFixture[];
}): NotificationInboxEntryFieldsFragment {
  return {
    sortAt: fixture.sortAt,
    item: {
      id: `document:${fixture.docId}`,
      entity: {
        __typename: 'GraphqlSoupDocument',
        id: fixture.docId,
        entityType: 'DOCUMENT',
        displayName: 'Plan',
        documentName: 'Plan',
        ownerId: 'macro|viewer@example.com',
        fileType: 'md',
        projectId: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        viewedAt: null,
        deletedAt: null,
        subType: null,
        isFavorited: false,
        frecencyScore: null,
        cacheProjection: null,
        properties: [],
      },
    },
    rows: fixture.rows.map((row) => ({
      id: row.id,
      rowType: row.rowType ?? 'DISCUSSION_MESSAGES',
      revision: row.revision ?? `rev-${row.id}`,
      latestAt: row.latestAt,
      unseen: row.unseen ?? true,
      count: (row.notificationIds ?? [`n-${row.id}`]).length,
      notifications: (row.notificationIds ?? [`n-${row.id}`]).map((id) =>
        commentNotification(fixture.docId, id, row.latestAt)
      ),
    })),
  } as unknown as NotificationInboxEntryFieldsFragment;
}

export function upsertedPatch(
  entry: NotificationInboxEntryFieldsFragment
): NotificationInboxPatchFieldsFragment {
  return { __typename: 'WorkFeedEntryUpserted', entry };
}

export function removedPatch(
  itemId: string
): NotificationInboxPatchFieldsFragment {
  return { __typename: 'WorkFeedEntryRemoved', itemId };
}

export function inboxPage(
  entries: NotificationInboxEntryFieldsFragment[],
  nextCursor: string | null = null
) {
  return {
    user: { id: 'macro|viewer@example.com', workFeed: { entries, nextCursor } },
  };
}
