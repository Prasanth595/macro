import { ListSkeleton } from '@app/components/view-shell/ListSkeleton';
import CheckIcon from '@phosphor/check.svg';
import EyeIcon from '@phosphor/eye.svg';
import FileTextIcon from '@phosphor/file-text.svg';
import LinkIcon from '@phosphor/link.svg';
import MagnifyingGlassIcon from '@phosphor/magnifying-glass.svg';
import UsersIcon from '@phosphor/users.svg';
import XIcon from '@phosphor/x.svg';
import { Button, Checkbox, Dialog, InputGroup, Tooltip } from '@ui';
import { For, Show } from 'solid-js';
import type {
  NoteDocument,
  NotePicker,
  NoteRead,
  NoteTeam,
} from '../core/types';

export function NoteDialog(props: {
  kind: 'link' | 'sharing' | 'unlink';
  eventTitle: string;
  recurring: boolean;
  guestListHidden?: boolean;
  picker: NoteRead<NotePicker>;
  query: string;
  onQuery: (query: string) => void;
  selected?: NoteDocument;
  onSelect: (document: NoteDocument) => void;
  linkedIds: string[];
  teamId?: string;
  currentTeam?: NoteTeam;
  onTeam: (id: string | undefined) => void;
  saving: boolean;
  error?: string;
  onSave: () => void;
  onClose: () => void;
}) {
  const title = () =>
    props.kind === 'unlink'
      ? 'Unlink meeting notes?'
      : props.kind === 'sharing'
        ? 'Note access'
        : 'Link meeting notes';
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      position="center"
      class="w-[480px]"
      animate
    >
      <div class="relative flex max-h-[85dvh] flex-col p-5 sm:p-6">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="mb-3 flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <FileTextIcon class="size-5" />
            </div>
            <Dialog.Title class="text-lg font-semibold text-ink">
              {title()}
            </Dialog.Title>
          </div>
        </div>
        <div class="min-h-0 overflow-y-auto">
          <Dialog.Description class="mt-1 text-sm leading-relaxed text-ink-muted">
            <Show
              when={props.kind !== 'unlink'}
              fallback="The document stays in your files. Access granted by this meeting link will be removed; other sharing stays the same."
            >
              <Tooltip label={props.eventTitle} as="span" class="block min-w-0">
                <span class="block truncate">{props.eventTitle}</span>
              </Tooltip>
              <Show when={props.recurring}>
                <span class="mt-1 block text-xs text-ink-extra-muted">
                  This occurrence only
                </span>
              </Show>
            </Show>
          </Dialog.Description>

          <Show when={props.kind === 'link'}>
            <div class="mt-5">
              <InputGroup size="lg">
                <InputGroup.Addon>
                  <MagnifyingGlassIcon class="size-4 text-ink-muted" />
                </InputGroup.Addon>
                <InputGroup.Input
                  aria-label="Find a markdown document"
                  placeholder="Find a note…"
                  value={props.query}
                  onInput={(event) => props.onQuery(event.currentTarget.value)}
                  disabled={props.saving}
                />
              </InputGroup>
            </div>
            <div
              class="mt-3 flex max-h-52 flex-col gap-1 overflow-y-auto"
              aria-label="Your markdown documents"
              aria-busy={props.picker.pending}
            >
              <Show when={props.picker.pending && !props.picker.data}>
                <For each={[0, 1, 2]}>
                  {() => <ListSkeleton.Bar class="my-2 h-5 w-3/4" />}
                </For>
              </Show>
              <Show when={props.picker.error}>
                <p role="alert" class="py-4 text-sm text-failure">
                  {props.picker.error}
                </p>
              </Show>
              <For each={props.picker.data?.documents}>
                {(document) => {
                  const linked = () =>
                    props.linkedIds.includes(document.documentId);
                  return (
                    <Button
                      variant="ghost"
                      size="lg"
                      fullWidth
                      label={document.name}
                      aria-pressed={
                        props.selected?.documentId === document.documentId
                      }
                      disabled={linked() || props.saving}
                      onClick={() => props.onSelect(document)}
                    >
                      <FileTextIcon class="size-4 text-ink-extra-muted" />
                      <span class="min-w-0 flex-1 truncate text-left">
                        {document.name}
                      </span>
                      <Show when={linked()}>
                        <span class="text-xs text-ink-extra-muted">Linked</span>
                      </Show>
                      <Show
                        when={
                          props.selected?.documentId === document.documentId
                        }
                      >
                        <CheckIcon class="size-4" />
                      </Show>
                    </Button>
                  );
                }}
              </For>
              <Show
                when={
                  props.picker.data?.documents.length === 0 &&
                  !props.picker.pending
                }
              >
                <p class="px-3 py-5 text-center text-sm text-ink-muted">
                  {props.query
                    ? 'No notes match this name.'
                    : 'No markdown documents yet.'}
                  <span class="mt-1 block text-xs text-ink-extra-muted">
                    Only notes you own can be shared with a meeting.
                  </span>
                </p>
              </Show>
            </div>
          </Show>

          <Show when={props.kind !== 'link' && props.selected}>
            {(document) => (
              <div class="mt-4 flex items-center gap-2 rounded-lg bg-ink/4 p-3 text-sm text-ink">
                <FileTextIcon class="size-4 text-accent" />
                <Tooltip label={document().name}>
                  <span class="block truncate">{document().name}</span>
                </Tooltip>
              </div>
            )}
          </Show>

          <Show when={props.kind !== 'unlink'}>
            <div class="mt-5 border-t border-edge-muted pt-4">
              <h4 class="mb-3 text-xs font-medium text-ink-muted">
                Access added by this link
              </h4>
              <div class="flex items-center gap-3">
                <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink-muted">
                  <UsersIcon class="size-4" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-ink">Meeting viewers</p>
                  <p class="mt-0.5 text-xs leading-relaxed text-ink-extra-muted">
                    Anyone who can see this meeting’s details
                  </p>
                </div>
                <span class="flex items-center gap-1 text-xs text-ink-muted">
                  <EyeIcon class="size-3.5" />
                  Can view
                </span>
              </div>
              <Show when={props.picker.data?.teams.length}>
                <div class="mt-3 flex flex-col gap-2 rounded-lg border border-edge-muted p-3">
                  <span class="text-xs text-ink-extra-muted">
                    Also share with a team · Optional
                  </span>
                  <For each={props.picker.data?.teams}>
                    {(team) => (
                      <Checkbox
                        checked={props.teamId === team.id}
                        onChange={(checked) =>
                          props.onTeam(checked ? team.id : undefined)
                        }
                        disabled={props.saving}
                        class="min-h-9 justify-between gap-3"
                      >
                        <Checkbox.Label class="flex-1 text-sm text-ink">
                          {team.name}
                        </Checkbox.Label>
                        <span class="text-xs text-ink-extra-muted">
                          Can view
                        </span>
                        <Checkbox.Control />
                      </Checkbox>
                    )}
                  </For>
                </div>
              </Show>
              <Show
                when={
                  props.currentTeam &&
                  props.teamId === props.currentTeam.id &&
                  props.picker.data &&
                  !props.picker.data.teams.some(
                    (team) => team.id === props.teamId
                  )
                }
              >
                <div class="mt-3 rounded-lg border border-edge-muted p-3 text-xs text-ink-muted">
                  <p>
                    {props.currentTeam?.name} still has view access. You no
                    longer belong to this team.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="mt-2"
                    disabled={props.saving}
                    onClick={() => props.onTeam(undefined)}
                  >
                    Remove team access
                  </Button>
                </div>
              </Show>
              <p class="mt-3 text-xs leading-relaxed text-ink-extra-muted">
                Editing and other document sharing stay the same. Linking won’t
                make notes public.
              </p>
              <Show when={props.guestListHidden}>
                <p class="mt-2 text-xs leading-relaxed text-ink-extra-muted">
                  This meeting hides its guest list. Some guests may need a
                  direct document share.
                </p>
              </Show>
            </div>
          </Show>

          <Show when={props.error}>
            <p role="alert" class="mt-4 text-sm text-failure">
              {props.error}
            </p>
          </Show>
        </div>
        <div class="mt-5 flex shrink-0 justify-end gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={props.onClose}
            disabled={props.saving}
          >
            Cancel
          </Button>
          <Button
            variant={props.kind === 'unlink' ? 'danger' : 'cta'}
            size="md"
            onClick={props.onSave}
            disabled={!props.selected || props.saving}
          >
            <Show when={props.kind === 'link'}>
              <LinkIcon />
            </Show>
            {props.saving
              ? 'Saving…'
              : props.kind === 'unlink'
                ? 'Unlink note'
                : props.kind === 'sharing'
                  ? 'Save access'
                  : 'Link note'}
          </Button>
        </div>
        <Dialog.CloseButton
          as={Button}
          variant="ghost"
          size="icon-sm"
          label="Close"
          disabled={props.saving}
          class="absolute right-5 top-5"
        >
          <XIcon />
        </Dialog.CloseButton>
      </div>
    </Dialog>
  );
}
