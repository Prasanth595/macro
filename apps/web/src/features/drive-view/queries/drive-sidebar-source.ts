import { useFeatureFlag } from '@app/lib/analytics/posthog';
import {
  enableForms,
  enableGraphqlSoup,
  isFeatureEnabled,
} from '@core/constant/featureFlags';
import { useUserId } from '@core/context/user';
import { useFavoritesData } from '@queries/favorites/favorites';
import { useDatabasesQuery } from '@queries/storage/databases';
import { useFormsQuery } from '@queries/storage/forms';
import { createGraphqlFoldersQuery } from '@queries/storage/graphql-folders';
import { useProjectsQuery } from '@queries/storage/projects';
import { createMemo } from 'solid-js';
import type { DriveSidebarSource } from '../context/drive-source';
import { selectSidebarDatabases } from './drive-databases';
import { hiddenFormDatabases } from './drive-forms';

export function createDriveSidebarSource(): DriveSidebarSource {
  if (isFeatureEnabled(enableGraphqlSoup)) {
    return createGraphqlDriveSidebarSource();
  }

  return createRestDriveSidebarSource();
}

function createSidebarFavorites() {
  const favoritesData = useFavoritesData();
  return createMemo(() =>
    (favoritesData()?.favorites ?? [])
      .filter(
        (favorite) =>
          favorite.entityType === 'project' ||
          (favorite.entityType === 'document' &&
            favorite.documentSubType !== 'task')
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)
  );
}

function createSidebarDatabases() {
  const userId = useUserId();
  const databases = useDatabasesQuery();
  const forms = useFormsQuery();
  const formsFlag = useFeatureFlag(enableForms);
  // Wait for the forms list, which names the databases made for polls.
  return createMemo(() =>
    databases.isSuccess && !(formsFlag().enabled && forms.isPending)
      ? selectSidebarDatabases(
          databases.data,
          userId(),
          hiddenFormDatabases(forms.data ?? [])
        )
      : []
  );
}

function createGraphqlDriveSidebarSource(): DriveSidebarSource {
  const folders = createGraphqlFoldersQuery();

  return {
    folders: () => folders.data ?? [],
    foldersLoading: () => folders.isPending && !folders.data,
    foldersError: () => folders.isError && !folders.data,
    retryFolders: async () => {
      await folders.refetch({ requestPolicy: 'network-only' });
    },
    favorites: createSidebarFavorites(),
    databases: createSidebarDatabases(),
  };
}

function createRestDriveSidebarSource(): DriveSidebarSource {
  const projects = useProjectsQuery();

  return {
    folders: () =>
      projects.isSuccess
        ? projects.data.filter((folder) => !folder.deletedAt)
        : [],

    foldersLoading: () => projects.isPending,

    foldersError: () => projects.isError,

    retryFolders: async () => {
      await projects.refetch();
    },

    favorites: createSidebarFavorites(),
    databases: createSidebarDatabases(),
  };
}
