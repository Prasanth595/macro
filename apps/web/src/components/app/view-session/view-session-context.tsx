import type { SplitRouter } from '@app/lib/split-router';
import { useIsAuthenticated, useUserId } from '@core/context/user';
import { createContext, type ParentProps, useContext } from 'solid-js';
import type { SplitManager } from '../split-layout/layoutManager';
import { createViewSession } from './create-view-session';

const ViewSessionContext =
  createContext<ReturnType<typeof createViewSession>>();

export function ViewSessionProvider(
  props: ParentProps<{
    router: SplitRouter;
    manager: SplitManager;
  }>
) {
  const userId = useUserId();
  const authenticated = useIsAuthenticated();
  const session = createViewSession({
    router: props.router,
    manager: props.manager,
    accountId: () => (authenticated() === false ? undefined : userId()),
  });
  return (
    <ViewSessionContext.Provider value={session}>
      {props.children}
    </ViewSessionContext.Provider>
  );
}

export function useViewSession() {
  const session = useContext(ViewSessionContext);
  if (!session) throw new Error('View navigation requires ViewSessionProvider');
  return session;
}
