import { createUserScopedStorage } from '@core/util/userScopedStorage';
import { createSignal } from 'solid-js';

// Keep mounted sidebars in sync, including when local storage is unavailable.
const [hiddenUsers, setHiddenUsers] = createSignal<ReadonlySet<string>>(
  new Set()
);

const storage = createUserScopedStorage('notion-import-promotion:v1');

export function isNotionImportPromotionHidden(
  userId: string | undefined
): boolean {
  if (!userId) return false;
  return hiddenUsers().has(userId) || storage.read(userId) === 'hidden';
}

export function hideNotionImportPromotion(userId: string | undefined): void {
  if (!userId || isNotionImportPromotionHidden(userId)) return;
  storage.write(userId, 'hidden');
  setHiddenUsers((previous) => new Set(previous).add(userId));
}
