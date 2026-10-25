import { fireAndForget } from '@core/util/fireAndForget';
import {
  ConfirmDialog,
  type ManagedDialogProps,
  useImperativeDialog,
} from '@ui';
import { type JSX, Show } from 'solid-js';
import {
  SavedViewDialog,
  type SavedViewDialogProps,
} from '../components/saved-view-dialog';
import type { SavedView } from '../core/saved-view';

function SavedViewDeleteDialog(
  props: ManagedDialogProps & {
    pending: boolean;
    error?: string;
    onDelete: () => Promise<boolean>;
  }
) {
  return (
    <ConfirmDialog
      open={props.open}
      onOpenChange={(open) => {
        if (!props.pending) props.onOpenChange(open);
      }}
      title="Delete saved view?"
      body={
        <>
          <p>
            This removes the view for you and anyone it is shared with. Items
            are not deleted.
          </p>
          <Show when={props.error}>
            <p role="alert">{props.error}</p>
          </Show>
        </>
      }
      confirmLabel="Delete view"
      tone="danger"
      pending={props.pending}
      onConfirm={() => {
        fireAndForget(
          (async () => {
            if (await props.onDelete()) props.onOpenChange(false);
          })(),
          'saved-views'
        );
      }}
    />
  );
}

/** Dialog lifecycle stays with the invoking view; writes stay with its controller. */
export function useSavedViewDialogs<
  T extends {
    mode: SavedViewDialogProps['mode'];
    name: string;
    sharedTeamId: string | null;
  },
>(options: {
  team: () => SavedViewDialogProps['team'];
  pending: () => boolean;
  error: () => string | undefined;
  summary: (form: T) => JSX.Element;
  save: (form: T, name: string, team: string | null) => Promise<boolean>;
  remove: (record: SavedView) => Promise<boolean>;
  holdEditing: () => () => void;
}) {
  const formDialog = useImperativeDialog(SavedViewDialog);
  const deleteDialog = useImperativeDialog(SavedViewDeleteDialog);
  const track = (handle: ReturnType<typeof formDialog.open>) => {
    const release = options.holdEditing();
    fireAndForget(
      (async () => {
        await handle.closed;
        release();
      })(),
      'saved-views'
    );
  };
  return {
    close: () => {
      formDialog.close();
      deleteDialog.close();
    },
    form: (form: T) => {
      track(
        formDialog.open(() => ({
          mode: form.mode,
          name: form.name,
          sharedTeamId: form.sharedTeamId,
          team: options.team(),
          pending: options.pending(),
          error: options.error(),
          summary: options.summary(form),
          onSave: (name: string, team: string | null) => {
            fireAndForget(
              (async () => {
                if (await options.save(form, name, team)) formDialog.close();
              })(),
              'saved-views'
            );
          },
        }))
      );
    },
    delete: (record: SavedView) => {
      track(
        deleteDialog.open(() => ({
          pending: options.pending(),
          error: options.error(),
          onDelete: () => options.remove(record),
        }))
      );
    },
  };
}
