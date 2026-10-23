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
      class="mx-3 my-3 rounded-xl border border-edge-muted p-3 sm:p-3"
    >
      <div class="mb-2 flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2 text-ink">
          <FileTextIcon class="size-4 text-ink-muted" />
          <h3 class="text-sm font-medium">Meeting notes</h3>
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
            label="Link another note"
            onClick={props.onLink}
          >
            <LinkIcon />
          </Button>
        </Show>
      </div>
      <Show when={props.recurring}>
        <p class="mb-3 text-xs text-ink-extra-muted">For this occurrence</p>
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
        <p class="mb-3 max-w-72 text-xs leading-relaxed text-ink-muted">
          Keep the agenda, decisions, and next steps with the meeting.
        </p>
        <Button variant="outline" size="sm" onClick={props.onLink}>
          <LinkIcon />
          Link a note
        </Button>
        <p class="mt-3 flex items-center gap-1.5 text-xxs text-ink-extra-muted">
          <UsersIcon class="size-3" />
          Meeting viewers can read linked notes
        </p>
      </Show>
      <div class="flex flex-col gap-2">
        <For each={props.state.data}>
          {(note) => (
            <div class="min-w-0 rounded-lg bg-ink/3 p-2">
              <Button
                variant="ghost"
                size="md"
                fullWidth
                label={note.name}
                onClick={() => props.onOpen(note)}
              >
                <FileTextIcon class="size-4 text-accent" />
                <span class="min-w-0 flex-1 truncate text-left text-sm">
                  {note.name}
                </span>
                <ArrowUpRightIcon class="size-3 text-ink-extra-muted" />
              </Button>
              <div class="mt-1 flex items-center justify-between gap-1 pl-3">
                <Show
                  when={note.canManage}
                  fallback={
                    <span class="text-xxs text-ink-extra-muted">
                      Meeting viewers{note.team ? ` + ${note.team.name}` : ''} ·
                      Can view
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
    </section>
  );
}
