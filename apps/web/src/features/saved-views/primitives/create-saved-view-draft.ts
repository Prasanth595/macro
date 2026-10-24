import { type Accessor, createSignal } from 'solid-js';
import type { SavedView } from '../core/saved-view';

/** Keeps the last confirmed definition separate from temporary consumer edits. */
export function createSavedViewDraft<T>(options: {
  current: Accessor<T | undefined>;
  equal: (left: T, right: T) => boolean;
}) {
  const [record, setRecord] = createSignal<SavedView>();
  const [baseline, setBaseline] = createSignal<T>();
  const dirty = () => {
    const saved = baseline();
    const current = options.current();
    return (
      saved !== undefined &&
      (current === undefined || !options.equal(saved, current))
    );
  };
  return {
    record,
    baseline,
    dirty,
    install(record: SavedView | undefined, definition: T | undefined) {
      setRecord(record);
      setBaseline(() => definition);
    },
  };
}
