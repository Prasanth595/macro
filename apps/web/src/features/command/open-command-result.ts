import { openChatWithMessage } from '@app/features/chat/ChatWithAgentButton';
import { getViewPreset } from '@app/features/next-soup/sidebar/soup-filter-presets';
import { getSearchSplit } from '@app/features/next-soup/soup-view/search-controllers';
import { useFeatureFlag } from '@app/lib/analytics/posthog';
import { globalSplitManager } from '@app/signal/splitLayout';
import { useSplitLayout } from '@components/app/split-layout/layout';
import type { ReferredFrom } from '@components/app/split-layout/layoutManager';
import { toast } from '@core/component/Toast/Toast';
import { itemToBlockName } from '@core/constant/allBlocks';
import {
  enableProjects,
  USE_MACRO_PR_SUMMARY_BLOCK,
} from '@core/constant/featureFlags';
import { openExternalUrl } from '@core/util/url';
import { isGithubPrEntity } from '@entity';
import { useGetOrCreateDirectMessageMutation } from '@queries/channel/get-or-create-dm';
import { projectRouteId } from '../projects/core/route';
import { getCategorySearchFilters } from './category-search-filters';
import {
  type CommandMenuItem,
  isAskAiItem,
  isEntityItem,
  isSearchItem,
  isUserItem,
} from './useCommandItems';

/** Shared result routing. Hosts own their query, selection, and dismissal lifecycle. */
export function createCommandResultOpener(
  referredFrom: ReferredFrom = 'kommand-menu'
) {
  const { openWithSplit } = useSplitLayout();
  const projectsFlag = useFeatureFlag(enableProjects);
  const getOrCreateDirectMessage = useGetOrCreateDirectMessageMutation();
  // A person without a conversation yet: open one, as the user card does.
  const openDirectMessage = async (
    recipientId: string,
    openInNewSplit: boolean
  ) => {
    try {
      const { channel_id } = await getOrCreateDirectMessage.mutateAsync({
        recipient_id: recipientId,
      });
      openWithSplit(
        { type: 'channel', id: channel_id },
        {
          referredFrom,
          preferNewSplit: openInNewSplit,
          reopen: 'latest',
        }
      );
    } catch {
      toast.failure('Unable to open conversation. Please try again.');
    }
  };

  const openEntity = (
    item: Extract<CommandMenuItem, { kind: 'entity' }>,
    openInNewSplit: boolean
  ) => {
    if (isGithubPrEntity(item.data)) {
      if (USE_MACRO_PR_SUMMARY_BLOCK) {
        const result = openWithSplit(
          { type: 'pr', id: item.data.id },
          {
            referredFrom,
            preferNewSplit: openInNewSplit,
          }
        );
        if (result.status === 'reused' && result.owner !== result.sourceOwner) {
          toast.alert('Content already open');
        }
      } else {
        openExternalUrl(item.data.metadata.url);
      }
      return true;
    }

    if (item.data.type !== 'foreign') {
      const blockName = itemToBlockName(item.data);
      if (blockName) {
        const result = openWithSplit(
          { type: blockName, id: item.id },
          {
            referredFrom,
            preferNewSplit: openInNewSplit,
            reopen: blockName === 'channel' ? 'latest' : undefined,
          }
        );
        if (result.status === 'reused' && result.owner !== result.sourceOwner) {
          toast.alert('Content already open');
        }
      }
    }
    return true;
  };

  const openSearch = (
    item: Extract<CommandMenuItem, { kind: 'search' }>,
    openInNewSplit: boolean
  ) => {
    // Fall back to the search preset (not `{}`) so uncategorized searches
    // keep the search view's baseline exclusions (foreign entities, CRM).
    const preset = getViewPreset('search');
    const overrides = getCategorySearchFilters(item.category);
    const filters = overrides?.filters ?? preset?.filters ?? {};
    const clientFilters =
      overrides?.clientFilters ?? preset?.clientFilters ?? {};
    const splitManager = globalSplitManager();
    const active = splitManager?.activeSplit();
    const activeContent = active?.content();
    const activeIsSearch =
      activeContent?.type === 'component' && activeContent.id === 'search';

    if (!openInNewSplit && activeIsSearch && active) {
      const controller = getSearchSplit(active.id);
      if (controller) {
        controller.applyOverrides({
          query: item.query,
          filters,
          clientFilters,
        });
        active.activate();
        return true;
      }
    }

    openWithSplit(
      {
        type: 'component',
        id: 'search',
        // Opening search into an existing split otherwise drops these params
        // and the field mounts empty. Entry state still wins on back/forward.
        preserveParams: true,
        params: {
          initialQuery: item.query,
          initialFilters: filters,
          initialClientFilters: clientFilters,
        },
      },
      {
        referredFrom,
        preferNewSplit: openInNewSplit,
        allowDuplicate: true,
      }
    );
    return true;
  };

  return (item: CommandMenuItem, openInNewSplit = false): boolean => {
    if (item.kind === 'initiative' && !projectsFlag().enabled) return false;
    if (item.kind === 'initiative') {
      openWithSplit(
        {
          type: 'component',
          id: projectRouteId({ id: item.id, section: 'overview' }),
        },
        { preferNewSplit: openInNewSplit }
      );
      return true;
    }

    if (isEntityItem(item)) return openEntity(item, openInNewSplit);

    if (isUserItem(item)) {
      void openDirectMessage(item.id, openInNewSplit);
      return true;
    }

    if (isSearchItem(item)) return openSearch(item, openInNewSplit);

    if (isAskAiItem(item)) {
      void openChatWithMessage(item.query);
      return true;
    }

    return false;
  };
}
