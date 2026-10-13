import { ConfirmDialog, Dialog } from '@ui';
import { createSignal, onCleanup } from 'solid-js';
import { SinglePageEventEditor as SinglePageEventEditorForm } from '../components/single-page-event-editor';
import { createEventEditor } from '../primitives/create-event-editor';
import type { EventEditorViewProps } from './event-editor-view';

/** Separate, taller dialog for comparing the progressive single-page editor. */
export function SinglePageEventEditorView(props: EventEditorViewProps) {
  const editor = createEventEditor({
    event: props.event,
    events: () => props.events,
    hasSchedule: (id) => props.schedules.some((schedule) => schedule.id === id),
    createActive: () => props.createActive ?? false,
    defaultHosts: () => props.defaultHosts ?? props.event.hosts.slice(0, 1),
    defaultMode: () => (props.team ? 'collective' : 'individual'),
    missingHosts: (event) =>
      props.team
        ? event.hosts.filter(
            (id) => !props.members.some((member) => member.id === id)
          )
        : [],
    onChange: props.onChange,
    onSave: props.onSave,
  });
  const [confirmingDiscard, setConfirmingDiscard] = createSignal(false);
  let returnFocus: HTMLElement | undefined;
  let discarding = false;
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  const requestClose = () => {
    if (props.saving || confirmingDiscard() || discarding) return;
    if (editor.hasChanges()) {
      returnFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : undefined;
      setConfirmingDiscard(true);
    } else props.onCancel();
  };
  const discard = () => {
    if (props.saving) return;
    discarding = true;
    setConfirmingDiscard(false);
  };
  const savedEvent = () =>
    props.events.find((event) => event.id === props.event.id);
  const copySavedLink = async () => {
    const event = savedEvent();
    if (!event?.slug || !props.onCopyLink || props.saving) return;
    await props.onCopyLink(event.slug);
  };
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => !open && requestClose()}
        position="center"
        animate
        class="max-h-[calc(100dvh-1rem)] w-full max-w-[min(44rem,calc(100vw-16px))] overflow-hidden"
      >
        <Dialog.Title class="sr-only">
          {props.dialogTitle ??
            (editor.isNew() ? 'New booking link' : 'Edit booking link')}
        </Dialog.Title>
        <SinglePageEventEditorForm
          draft={editor.draft()}
          schedules={props.schedules}
          members={props.members}
          team={props.team}
          saving={props.saving}
          isNew={editor.isNew()}
          createActive={props.createActive ?? false}
          details={editor.details()}
          issues={editor.issues()}
          validationAttempt={editor.validationAttempt()}
          submitError={editor.submitError()}
          availability={props.availability}
          submitLabel={props.submitLabel}
          link={props.link?.(editor.slug()) ?? `/${editor.slug()}`}
          onCopyLink={
            props.onCopyLink && savedEvent()?.slug ? copySavedLink : undefined
          }
          onTitle={editor.setTitle}
          onUpdate={editor.update}
          onBuffers={editor.updateBuffers}
          onDailyLimitEnabled={editor.setDailyLimitEnabled}
          onAddDetail={editor.addDetail}
          onRemoveDetail={editor.removeDetail}
          onSave={editor.saveSinglePage}
          onCancel={requestClose}
        />
      </Dialog>
      <ConfirmDialog
        open={confirmingDiscard()}
        onOpenChange={setConfirmingDiscard}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (discarding) {
            discarding = false;
            returnFocus = undefined;
            queueMicrotask(() => {
              if (!disposed && !props.saving) props.onCancel();
            });
          } else if (returnFocus?.isConnected) {
            returnFocus.focus({ preventScroll: true });
          }
        }}
        title="Discard changes?"
        body="Your changes to this booking link have not been saved."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="danger"
        pending={props.saving}
        onConfirm={discard}
      />
    </>
  );
}
