import {
  enableGraphqlSoup,
  isFeatureEnabled,
} from '@core/constant/featureFlags';
import { useFavoritesData } from '@queries/favorites/favorites';
import { useDatabasesQuery } from '@queries/storage/databases';
import { useFormsQuery } from '@queries/storage/forms';
import { createGraphqlFoldersQuery } from '@queries/storage/graphql-folders';
import { useProjectsQuery } from '@queries/storage/projects';
import { type Accessor, createMemo } from 'solid-js';
import type { DriveSidebarSource } from '../context/drive-source';
import { selectSidebarDatabases } from './drive-databases';
import { hiddenFormDatabases } from './drive-forms';

type DriveSidebarOptions = {
  userId: Accessor<string | undefined>;
  formsEnabled: Accessor<boolean>;
};

export function createDriveSidebarSource(
  options: DriveSidebarOptions
): DriveSidebarSource {
  if (isFeatureEnabled(enableGraphqlSoup)) {
    return createGraphqlDriveSidebarSource(options);
  }

  return createRestDriveSidebarSource(options);
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

function createSidebarDatabases(options: DriveSidebarOptions) {
  const databases = useDatabasesQuery();
  const forms = useFormsQuery();
  // Wait for the forms list, which names the databases made for polls.
  return createMemo(() => {
    if (!databases.isSuccess) return [];
    if (options.formsEnabled() && forms.isPending) return [];
    return selectSidebarDatabases(
      databases.data,
      options.userId(),
      forms.isSuccess ? hiddenFormDatabases(forms.data) : new Set()
    );
  });
}

function createGraphqlDriveSidebarSource(
  options: DriveSidebarOptions
): DriveSidebarSource {
  const folders = createGraphqlFoldersQuery();

  return {
    folders: () => folders.data ?? [],
    foldersLoading: () => folders.isPending && !folders.data,
    foldersError: () => folders.isError && !folders.data,
    retryFolders: async () => {
      await folders.refetch({ requestPolicy: 'network-only' });
    },
    favorites: createSidebarFavorites(),
    databases: createSidebarDatabases(options),
  };
}

function createRestDriveSidebarSource(
  options: DriveSidebarOptions
): DriveSidebarSource {
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
    databases: createSidebarDatabases(options),
  };
}
