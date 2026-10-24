import type { Result } from 'neverthrow';
import type { Accessor } from 'solid-js';
import type {
  CreateSavedView,
  SavedView,
  SavedViewError,
  UpdateSavedView,
} from '../core/saved-view';

/** Undefined data means loading; a null detail means the view is unavailable. */
export type SavedViewsSource = {
  items: Accessor<readonly SavedView[] | undefined>;
  error: Accessor<unknown>;
  loading: Accessor<boolean>;
  hasMore: Accessor<boolean>;
  loadingMore: Accessor<boolean>;
  loadMore: () => Promise<unknown>;
  refresh: () => Promise<unknown>;
  detail: Accessor<SavedView | null | undefined>;
  /** Viewer identity returned with the current detail, not the requested identity. */
  detailViewerId: Accessor<string | undefined>;
  detailError: Accessor<unknown>;
  detailLoading: Accessor<boolean>;
  refreshDetail: () => Promise<unknown>;
  create: (
    input: CreateSavedView
  ) => Promise<Result<SavedView, SavedViewError>>;
  update: (
    input: UpdateSavedView
  ) => Promise<Result<SavedView, SavedViewError>>;
  delete: (input: {
    id: string;
    expectedRevision: number;
  }) => Promise<Result<void, SavedViewError>>;
};
