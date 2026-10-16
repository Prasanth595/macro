import { makePersisted } from '@solid-primitives/storage';
import { type Accessor, createMemo, createSignal } from 'solid-js';

export const HOME_COMPOSER_MODE_KEY = 'home-composer-mode-persist-v0';

/** A remembered preference never grants access to the experimental composer. */
export function createHomeComposerMode(
  available: Accessor<boolean>,
  userId: Accessor<string | undefined>
) {
  const preference = createMemo(() => {
    const identity = userId();
    const state = createSignal(false);
    return available() && identity
      ? makePersisted(state, {
          name: `${HOME_COMPOSER_MODE_KEY}:${encodeURIComponent(identity)}`,
          deserialize: (value) => value === 'true',
        })
      : state;
  });
  return {
    universal: () => available() && preference()[0](),
    setUniversal: (enabled: boolean) => {
      if (available()) preference()[1](enabled);
    },
  };
}
