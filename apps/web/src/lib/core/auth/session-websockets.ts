import { useIsAuthenticated, useUserId } from '@core/context/user';
import { ws } from '@service-connection/websocket';
import { storageWS } from '@service-storage/websocket';
import { createEffect, on, onCleanup } from 'solid-js';

/** Account sockets stay closed on public pages and belong to one signed-in session. */
export function useSessionWebsockets() {
  const authenticated = useIsAuthenticated();
  const userId = useUserId();
  createEffect(
    on(
      () => (authenticated() === true ? userId() : undefined),
      (id) => {
        if (!id) return;
        ws.reconnect();
        storageWS.reconnect();
        onCleanup(() => {
          ws.close();
          storageWS.close();
          // Never send a previous account's queued presence after another login.
          while (ws.buffer?.read() !== undefined) {}
        });
      }
    )
  );
}
