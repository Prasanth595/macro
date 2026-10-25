import { type Accessor, createSignal, onCleanup } from 'solid-js';
import type { SavedViewsSource } from '../context/saved-views-source';
import type {
  CreateSavedView,
  SavedView,
  UpdateSavedView,
} from '../core/saved-view';

type Write =
  | { mode: 'create'; input: CreateSavedView }
  | { mode: 'update'; input: UpdateSavedView; record: SavedView };

/** Owns write state and guards completions against account and selection changes. */
export function createSavedViewCrud(options: {
  source: SavedViewsSource;
  viewerId: Accessor<string | undefined>;
  selectedId: Accessor<string | undefined>;
  scope: () => string;
  onSaved: (record: SavedView, mode: Write['mode']) => boolean;
  onDeleted: () => void;
}) {
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  const [saving, setSaving] = createSignal(false);
  const [editingCount, setEditingCount] = createSignal(0);
  const editing = () => editingCount() > 0;
  const hold = () => {
    setEditingCount((count) => count + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setEditingCount((count) => count - 1);
    };
  };
  const [error, setError] = createSignal<string>();
  const [conflict, setConflict] = createSignal(false);
  const clear = () => {
    setError(undefined);
    setConflict(false);
  };
  const fail = (message: string) => setError(message);
  const save = async (write: Write): Promise<boolean> => {
    const viewer = options.viewerId();
    if (
      disposed ||
      saving() ||
      !viewer ||
      (write.mode === 'update' && write.record.ownerId !== viewer)
    )
      return false;
    const scope = options.scope();
    setSaving(true);
    clear();
    const result =
      write.mode === 'create'
        ? await options.source.create(write.input)
        : await options.source.update(write.input);
    setSaving(false);
    if (disposed) return false;
    if (options.scope() !== scope) {
      if (
        result.isOk() &&
        options.viewerId() === viewer &&
        options.selectedId() === write.input.id
      )
        await options.source.refreshDetail();
      return false;
    }
    if (result.isErr()) {
      setConflict(result.error.code === 'CONFLICT');
      fail(result.error.message);
      return false;
    }
    if (!options.onSaved(result.value, write.mode)) return false;
    setConflict(false);
    return true;
  };
  const remove = async (record: SavedView): Promise<boolean> => {
    const viewer = options.viewerId();
    if (disposed || saving() || !viewer || record.ownerId !== viewer)
      return false;
    const scope = options.scope();
    setSaving(true);
    clear();
    const result = await options.source.delete({
      id: record.id,
      expectedRevision: record.revision,
    });
    setSaving(false);
    if (disposed) return false;
    if (
      result.isOk() &&
      options.viewerId() === viewer &&
      options.selectedId() === record.id
    ) {
      options.onDeleted();
      return true;
    }
    if (options.scope() !== scope) return false;
    if (result.isErr()) {
      setConflict(result.error.code === 'CONFLICT');
      fail(result.error.message);
      return false;
    }
    return true;
  };
  return { saving, editing, hold, error, conflict, clear, fail, save, remove };
}
