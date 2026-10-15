import { useIsAuthenticated } from '@core/auth';
import { useAccessRequestState } from '@queries/access-requests/requests';
import { type Accessor, createEffect, on } from 'solid-js';
import type { AccessLevel, ShareEntity } from '../core/types';

/** Bridges refreshed server access to a host's existing permission adapter. */
export function useSharedAccessUpdates(
  entity: Accessor<ShareEntity | undefined>,
  apply: (level: AccessLevel) => void
) {
  const authenticated = useIsAuthenticated();
  const state = useAccessRequestState(entity, () => !!authenticated());
  createEffect(
    on(
      () =>
        state.isSuccess && state.isFetchedAfterMount
          ? (state.data.accessLevel ?? undefined)
          : undefined,
      (level) => {
        if (level) apply(level);
      }
    )
  );
  return () =>
    state.isSuccess && state.isFetchedAfterMount
      ? (state.data.accessLevel ?? undefined)
      : undefined;
}
