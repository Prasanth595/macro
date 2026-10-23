import { ListSkeleton } from '@app/components/view-shell/ListSkeleton';
import ArrowUpRightIcon from '@phosphor/arrow-up-right.svg';
import FileTextIcon from '@phosphor/file-text.svg';
import LinkIcon from '@phosphor/link.svg';
import LinkBreakIcon from '@phosphor/link-break.svg';
import UsersIcon from '@phosphor/users.svg';
import { Button } from '@ui';
import { For, Show } from 'solid-js';
import type { MeetingNote, NoteRead } from '../core/types';

export function NotesSection(props: {
  state: NoteRead<MeetingNote[]>;
  recurring: boolean;
  onLink: () => void;
  onOpen: (note: MeetingNote) => void;
  onSharing: (note: MeetingNote) => void;
  onUnlink: (note: MeetingNote) => void;
  onRetry: () => void;
}) {
  return (
    <section
      aria-label="Meeting notes"
      class="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 border-t border-edge-muted px-4 py-3 text-sm text-ink-muted sm:grid-cols-[1rem_minmax(0,1fr)] sm:gap-x-3 sm:text-xs"
    >
      <FileTextIcon class="mt-1 size-5 text-ink-extra-muted sm:size-4" />
      <div class="min-w-0">
        <div class="mb-1 flex min-h-7 items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2">
            <h3 class="font-medium text-ink">Meeting notes</h3>
            <Show when={props.state.data?.length}>
              <span class="text-xs text-ink-extra-muted">
                {props.state.data?.length}
              </span>
            </Show>
          </div>
          <Show when={props.state.data?.length}>
            <Button
              variant="ghost"
              size="icon-sm"
              depth={3}
              label="Link another note"
              onClick={props.onLink}
            >
              <LinkIcon />
            </Button>
          </Show>
        </div>
        <Show when={props.recurring}>
          <p class="mb-2 text-xs text-ink-extra-muted sm:text-xxs">
            For this occurrence
          </p>
        </Show>
        <Show when={props.state.pending && !props.state.data}>
          <div
            role="status"
            aria-label="Loading meeting notes"
            class="flex flex-col gap-2 py-2"
          >
            <ListSkeleton.Bar class="h-4 w-3/4" />
            <ListSkeleton.Bar class="h-3 w-1/2" />
          </div>
        </Show>
        <Show when={props.state.error}>
          <div
            role="alert"
            class="flex items-center justify-between gap-2 py-2 text-xs text-ink-muted"
          >
            <span>{props.state.error}</span>
            <Button size="sm" variant="outline" onClick={props.onRetry}>
              Retry
            </Button>
          </div>
        </Show>
        <Show when={props.state.data?.length === 0}>
          <Button variant="ghost" size="sm" depth={3} onClick={props.onLink}>
            <LinkIcon />
            Link a note
          </Button>
          <p class="mt-1 text-xs text-ink-extra-muted sm:text-xxs">
            Meeting viewers can read linked notes.
          </p>
        </Show>
        <div class="flex flex-col gap-2">
          <For each={props.state.data}>
            {(note) => (
              <div class="min-w-0">
                <Button
                  variant="ghost"
                  size="sm"
                  depth={3}
                  fullWidth
                  label={note.name}
                  onClick={() => props.onOpen(note)}
                >
                  <span class="min-w-0 flex-1 truncate text-left">
                    {note.name}
                  </span>
                  <ArrowUpRightIcon class="size-3 text-ink-extra-muted" />
                </Button>
                <div class="flex min-w-0 items-center justify-between gap-1">
                  <Show
                    when={note.canManage}
                    fallback={
                      <span class="text-xxs text-ink-extra-muted">
                        Meeting viewers{note.team ? ` + ${note.team.name}` : ''}{' '}
                        · Can view
                      </span>
                    }
                  >
                    <Button
                      variant="ghost"
                      size="xs"
                      label="Manage note access"
                      onClick={() => props.onSharing(note)}
                    >
                      <UsersIcon />
                      <span class="min-w-0 truncate">
                        Meeting viewers{note.team ? ` + ${note.team.name}` : ''}
                      </span>
                      <span class="text-ink-extra-muted">· View</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      label={`Unlink ${note.name}`}
                      onClick={() => props.onUnlink(note)}
                    >
                      <LinkBreakIcon />
                    </Button>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}
