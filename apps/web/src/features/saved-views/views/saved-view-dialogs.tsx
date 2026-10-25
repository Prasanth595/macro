import { fireAndForget } from '@core/util/fireAndForget';
import { Dialog, type ManagedDialogProps } from '@ui';
import { type Accessor, createEffect, type JSX, on, onCleanup } from 'solid-js';
import {
  CreateSavedViewForm,
  DeleteSavedViewConfirmation,
  RenameSavedViewForm,
  ShareSavedViewForm,
} from '../components/saved-view-dialog';
import type { SavedView } from '../core/saved-view';
import {
  savedViewErrorMessage,
  useCreateSavedView,
  useDeleteSavedView,
  useUpdateSavedView,
} from '../queries/saved-view-actions';
import { toSavedView } from '../queries/saved-views';

type Scope = ManagedDialogProps & {
  refresh: () => Promise<unknown>;
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
  const mutation = useCreateSavedView({ refresh: props.refresh });
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
    <Dialog
      open={props.open}
      position="center"
      class="w-110"
      onOpenChange={(open) => {
        if (!mutation.isPending) props.onOpenChange(open);
      }}
    >
      <CreateSavedViewForm
        {...props}
        pending={mutation.isPending}
        error={savedViewErrorMessage(mutation.error)}
        onSave={(name, team) => fireAndForget(save(name, team), 'saved-views')}
      />
    </Dialog>
  );
}

export function RenameSavedViewDialog(
  props: Scope & {
    record: SavedView;
    onUpdated: (record: SavedView) => unknown;
  }
) {
  const lifetime = createDialogLifetime(props, props.record.ownerId);
  const mutation = useUpdateSavedView({ refresh: props.refresh });
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
    <Dialog
      open={props.open}
      position="center"
      class="w-110"
      onOpenChange={(open) => {
        if (!mutation.isPending) props.onOpenChange(open);
      }}
    >
      <RenameSavedViewForm
        {...props}
        name={props.record.name}
        pending={mutation.isPending}
        error={savedViewErrorMessage(mutation.error)}
        onSave={(name) => fireAndForget(save(name), 'saved-views')}
      />
    </Dialog>
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
  const mutation = useUpdateSavedView({ refresh: props.refresh });
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
    <Dialog
      open={props.open}
      position="center"
      class="w-110"
      onOpenChange={(open) => {
        if (!mutation.isPending) props.onOpenChange(open);
      }}
    >
      <ShareSavedViewForm
        {...props}
        sharedTeamId={props.record.sharedTeamId}
        pending={mutation.isPending}
        error={savedViewErrorMessage(mutation.error)}
        onSave={(team) => fireAndForget(save(team), 'saved-views')}
      />
    </Dialog>
  );
}

export function DeleteSavedViewDialog(
  props: Scope & {
    record: SavedView;
    onDeleted: (record: SavedView, viewer: string) => void;
  }
) {
  const lifetime = createDialogLifetime(props, props.record.ownerId);
  const mutation = useDeleteSavedView({ refresh: props.refresh });
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
    <DeleteSavedViewConfirmation
      {...props}
      pending={mutation.isPending}
      error={savedViewErrorMessage(mutation.error)}
      onDelete={() => fireAndForget(remove(), 'saved-views')}
    />
  );
}
