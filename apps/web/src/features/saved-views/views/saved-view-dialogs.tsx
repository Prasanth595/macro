import { fireAndForget } from '@core/util/fireAndForget';
import type { ManagedDialogProps } from '@ui';
import { type Accessor, createEffect, type JSX, on, onCleanup } from 'solid-js';
import {
  SavedViewCreateDialog,
  SavedViewDeleteDialog,
  SavedViewRenameDialog,
  SavedViewShareDialog,
} from '../components/saved-view-dialog';
import type { SavedViewsSource } from '../context/saved-views-source';
import type { SavedView } from '../core/saved-view';
import {
  savedViewErrorMessage,
  useCreateSavedView,
  useDeleteSavedView,
  useUpdateSavedView,
} from '../queries/saved-view-actions';
import { toSavedView } from '../queries/saved-views';

type Scope = ManagedDialogProps & {
  source: SavedViewsSource;
  viewerId: Accessor<string | undefined>;
  isCurrent: () => boolean;
};

// Closing a dialog cancels its UI completion, not a server write already sent.
function createDialogLifetime(props: Scope, ownerId?: string) {
  const viewer = props.viewerId();
  let alive = true;
  const sameAccount = () => Boolean(viewer) && props.viewerId() === viewer;
  const current = () =>
    alive &&
    sameAccount() &&
    (!ownerId || ownerId === viewer) &&
    props.isCurrent();
  createEffect(
    on(current, (valid) => {
      if (!valid) props.onOpenChange(false);
    })
  );
  onCleanup(() => {
    alive = false;
  });
  return { current, sameAccount, viewer };
}

export function CreateSavedViewDialog(
  props: Scope & {
    id: string;
    name: string;
    config: unknown;
    summary: JSX.Element;
    team?: { id: string; name: string };
    title?: string;
    submitLabel?: string;
    onCreated: (record: SavedView) => void;
  }
) {
  const lifetime = createDialogLifetime(props);
  const mutation = useCreateSavedView({ refresh: props.source.refresh });
  const save = async (name: string, sharedTeamId: string | null) => {
    if (!lifetime.current() || mutation.isPending) return;
    const result = await mutation.mutateAsync({
      id: props.id,
      name,
      config: props.config,
      sharedTeamId,
    });
    if (!result.error && result.data?.createSavedView && lifetime.current()) {
      props.onCreated(toSavedView(result.data.createSavedView));
      props.onOpenChange(false);
    }
  };
  return (
    <SavedViewCreateDialog
      {...props}
      pending={mutation.isPending}
      error={savedViewErrorMessage(mutation.error)}
      onSave={(name, team) => fireAndForget(save(name, team), 'saved-views')}
    />
  );
}

export function RenameSavedViewDialog(
  props: Scope & {
    record: SavedView;
    onUpdated: (record: SavedView) => unknown;
  }
) {
  const lifetime = createDialogLifetime(props, props.record.ownerId);
  const mutation = useUpdateSavedView({ refresh: props.source.refresh });
  const save = async (name: string) => {
    if (!lifetime.current() || mutation.isPending) return;
    const result = await mutation.mutateAsync({
      id: props.record.id,
      name,
      config: props.record.config,
      expectedRevision: props.record.revision,
    });
    if (!result.error && result.data?.updateSavedView && lifetime.current()) {
      props.onUpdated(toSavedView(result.data.updateSavedView));
      props.onOpenChange(false);
    }
  };
  return (
    <SavedViewRenameDialog
      {...props}
      name={props.record.name}
      pending={mutation.isPending}
      error={savedViewErrorMessage(mutation.error)}
      onSave={(name) => fireAndForget(save(name), 'saved-views')}
    />
  );
}

export function ShareSavedViewDialog(
  props: Scope & {
    record: SavedView;
    team?: { id: string; name: string };
    onUpdated: (record: SavedView) => unknown;
  }
) {
  const lifetime = createDialogLifetime(props, props.record.ownerId);
  const mutation = useUpdateSavedView({ refresh: props.source.refresh });
  const save = async (sharedTeamId: string | null) => {
    if (!lifetime.current() || mutation.isPending) return;
    const result = await mutation.mutateAsync({
      id: props.record.id,
      name: props.record.name,
      config: props.record.config,
      expectedRevision: props.record.revision,
      sharedTeamId,
    });
    if (!result.error && result.data?.updateSavedView && lifetime.current()) {
      props.onUpdated(toSavedView(result.data.updateSavedView));
      props.onOpenChange(false);
    }
  };
  return (
    <SavedViewShareDialog
      {...props}
      sharedTeamId={props.record.sharedTeamId}
      pending={mutation.isPending}
      error={savedViewErrorMessage(mutation.error)}
      onSave={(team) => fireAndForget(save(team), 'saved-views')}
    />
  );
}

export function DeleteSavedViewDialog(
  props: Scope & {
    record: SavedView;
    onDeleted: (record: SavedView, viewer: string) => void;
  }
) {
  const lifetime = createDialogLifetime(props, props.record.ownerId);
  const mutation = useDeleteSavedView({ refresh: props.source.refresh });
  const remove = async () => {
    if (!lifetime.current() || mutation.isPending) return;
    const result = await mutation.mutateAsync({
      id: props.record.id,
      expectedRevision: props.record.revision,
    });
    if (
      !result.error &&
      result.data &&
      lifetime.sameAccount() &&
      lifetime.viewer
    ) {
      // A confirmed delete also applies when navigation selected this record while pending.
      props.onDeleted(props.record, lifetime.viewer);
      props.onOpenChange(false);
    }
  };
  return (
    <SavedViewDeleteDialog
      {...props}
      pending={mutation.isPending}
      error={savedViewErrorMessage(mutation.error)}
      onDelete={() => fireAndForget(remove(), 'saved-views')}
    />
  );
}
