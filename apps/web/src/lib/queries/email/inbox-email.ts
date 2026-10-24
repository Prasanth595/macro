import type { Accessor } from 'solid-js';
import { queryReadyGate } from '../gate';
import { useEmailLinksQuery } from './link';

/**
 * The address "me" means in an inbox's mail: the inbox's own, which may not be
 * the Macro login. `undefined` until the owning inbox and its address are
 * known, including while inboxes load, offline, or after the list failed.
 */
export function useInboxEmail(
  linkId: Accessor<string | undefined>
): Accessor<string | undefined> {
  const links = useEmailLinksQuery();
  return () => {
    const id = linkId();
    if (!id || !queryReadyGate(links)) return undefined;
    return links.data.links.find((link) => link.id === id)?.email_address;
  };
}
