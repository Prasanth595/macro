import { createUserScopedStorage } from '@core/util/userScopedStorage';
import { type Accessor, createMemo, createSignal } from 'solid-js';

const storage = createUserScopedStorage('macro:experimental:god-mode');
const [overrides, setOverrides] = createSignal<ReadonlyMap<string, boolean>>(
  new Map()
);

/** All mounted consumers share edits immediately; preferences stay scoped to the account. */
export function createExperimentalPreferences(
  userId: Accessor<string | undefined>
) {
  const godMode = createMemo(() => {
    const id = userId();
    return !!id && (overrides().get(id) ?? storage.read(id) !== 'false');
  });
  return {
    godMode,
    setGodMode(enabled: boolean) {
      const id = userId();
      if (!id) return;
      storage.write(id, String(enabled));
      setOverrides((values) => new Map(values).set(id, enabled));
    },
  };
}
