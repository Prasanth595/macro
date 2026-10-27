import type { Favorite } from '@service-storage/generated/schemas/favorite';
import { type Accessor, createMemo } from 'solid-js';
import type { ChannelsDataSource, ChannelsSources } from '../../../queries';

/**
 * Narrow the rail's lists to conversations with unread activity while the
 * Unread filter is on. The open conversation stays listed, so reading it does
 * not pull it out from under the pointer. Search results are never filtered.
 *
 * Unread state comes from the rows the rail has loaded, the same evidence as
 * the unread dots and section counts.
 */
export function useChannelRailUnreadFilter(options: {
  sources: ChannelsSources;
  favorites: Accessor<readonly Favorite[]>;
  unreadOnly: Accessor<boolean>;
  unreadChannelIds: Accessor<ReadonlySet<string>>;
  isSelected: (channelId: string) => boolean;
}) {
  const isChannelVisible = (channelId: string) =>
    !options.unreadOnly() ||
    options.unreadChannelIds().has(channelId) ||
    options.isSelected(channelId);

  const filterSource = (source: ChannelsDataSource): ChannelsDataSource => {
    const items = createMemo(() =>
      options.unreadOnly()
        ? source.items().filter((channel) => isChannelVisible(channel.id))
        : source.items()
    );
    return { ...source, items };
  };

  const favorites = createMemo(() =>
    options.unreadOnly()
      ? options
          .favorites()
          .filter(
            (favorite) =>
              favorite.entityType === 'channel' &&
              isChannelVisible(favorite.entityId)
          )
      : options.favorites()
  );

  const sources: ChannelsSources = {
    channels: filterSource(options.sources.channels),
    direct_messages: filterSource(options.sources.direct_messages),
    recents: filterSource(options.sources.recents),
    threads: filterSource(options.sources.threads),
    search: options.sources.search,
  };

  return { sources, favorites, isChannelVisible };
}
