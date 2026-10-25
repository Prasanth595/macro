import type { Accessor } from 'solid-js';
import type { SavedView } from '../core/saved-view';

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
};
