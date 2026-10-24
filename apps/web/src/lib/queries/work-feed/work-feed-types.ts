/**
 * The parts of a work feed entry the shared feed machinery reads. Each feed
 * selects its own fragment; Home's and the notification inbox's both fit.
 */
export type WorkFeedEntryShape = {
  sortAt: string;
  item: { id: string };
};

/** One change to a feed, as every work feed patch fragment selects it. */
export type WorkFeedPatchShape<Entry> =
  | { __typename: 'WorkFeedEntryUpserted'; entry: Entry }
  | { __typename: 'WorkFeedEntryRemoved'; itemId: string }
  | { __typename: 'WorkFeedInvalidated'; refresh: boolean };

/** One feed page, as every work feed page query selects it. */
export type WorkFeedPageData<Entry> = {
  user: {
    workFeed: { entries: Entry[]; nextCursor?: string | null };
  };
};
