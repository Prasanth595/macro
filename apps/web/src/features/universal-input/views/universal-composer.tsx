import { IS_MAC } from '@core/constant/isMac';
import { registerHotkey, useHotkeyDOMScope } from '@core/hotkey/hotkeys';
import CaretDown from '@phosphor/caret-down.svg';
import { Button, ComposerSurface } from '@ui';
import { createUniqueId, For, type JSX, Show, Suspense } from 'solid-js';
import { FieldInput } from '../components/fields';
import { TypeIcon } from '../components/type-icon';
import type { InputDisplay } from '../context/capabilities';
import { AiDraft } from './ai-draft';
import { CalendarDraft } from './calendar-draft';
import { EmailDraft } from './email-draft';
import { MessageDraft } from './message-draft';
import { type DocumentTags, NoteDraft } from './note-draft';
import { TaskDraft } from './task-draft';
import '../universal-input.css';
import {
  actionLabels,
  type Field,
  intentLabels,
  intentSchema,
  intents,
  rankIntents,
} from '../core/input';
import type { UniversalInputController } from '../primitives/universal-input';

function ComposerFooter(props: {
  state: UniversalInputController;
  statusId: string;
}) {
  const s = props.state;
  const action = () => {
    if (s.sending() && !s.savingEmailDraft()) return 'Working…';
    const intent = s.draft().intent;
    return intent ? actionLabels[intent] : 'Continue';
  };
  return (
    <div class="flex flex-wrap items-center justify-between gap-3">
      <span id={props.statusId} class="text-xs text-ink-muted">
        {s.validation()}
      </span>
      <div class="flex flex-wrap items-center gap-2">
        <Show when={s.draft().intent === 'email'}>
          <Button
            variant="outline"
            size="lg"
            disabled={s.sending() || s.pending() || !!s.emailDraftValidation()}
            onClick={() => void s.saveEmailDraft()}
          >
            {s.savingEmailDraft() ? 'Saving…' : 'Save as draft'}
          </Button>
        </Show>
        <Button
          variant="cta"
          aria-label={action()}
          aria-keyshortcuts="Meta+Enter Control+Enter"
          size="lg"
          disabled={s.sending() || s.pending() || !!s.validation()}
          onClick={() => void s.submit()}
        >
          {action()}
          <kbd
            aria-hidden="true"
            data-testid="submit-shortcut"
            class="ml-2 font-sans text-xs opacity-70"
          >
            {IS_MAC ? '⌘' : 'Ctrl'} ↵
          </kbd>
        </Button>
      </div>
    </div>
  );
}

export function UniversalComposer(props: {
  state: UniversalInputController;
  actions: InputDisplay;
  taskFields: JSX.Element;
  editor: JSX.Element;
  noteTags?: DocumentTags;
  searchResults?: (scopeId: string) => JSX.Element;
}) {
  const s = props.state;
  const a = props.actions;
  const type = () => s.draft().intent;
  const listId = createUniqueId();
  const [attachHotkeys, hotkeyScope] = useHotkeyDOMScope('universal-input');
  const cycleType = (direction: 1 | -1, event?: KeyboardEvent) => {
    if (event?.isComposing) return false;
    s.cycle(direction);
    return true;
  };
  const typeHotkeys = {
    scopeId: hotkeyScope,
    condition: () => !s.sending() && s.scores().length > 1,
    runWithInputFocused: true,
    hide: true,
  };
  registerHotkey({
    ...typeHotkeys,
    hotkey: 'shift+cmd+arrowright',
    description: 'Next content type',
    keyDownHandler: (event) => cycleType(1, event),
  });
  registerHotkey({
    ...typeHotkeys,
    hotkey: 'shift+cmd+arrowleft',
    description: 'Previous content type',
    keyDownHandler: (event) => cycleType(-1, event),
  });
  const field = (
    key: Field,
    label: string,
    options?: {
      multiline?: boolean;
      type?: string;
      list?: string;
      hint?: string;
      prominent?: boolean;
    }
  ) => (
    <FieldInput
      label={label}
      value={s.fields()[key]}
      disabled={s.sending()}
      onChange={(value) => s.edit(key, value)}
      {...options}
    />
  );
  return (
    <section
      class="min-w-0"
      aria-label="Create or find something"
      ref={attachHotkeys}
    >
      <div class="space-y-3">
        <ComposerSurface as="div" data-testid="universal-input-surface">
          {props.editor}
        </ComposerSurface>
        <Show when={s.draft().text.trim() || a.attachmentCount()}>
          <fieldset
            disabled={s.sending()}
            class="universal-input-fields min-w-0 space-y-4 rounded-2xl border border-edge-muted bg-panel px-5 py-4 shadow-sm sm:px-6 sm:py-5"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <label class="relative inline-flex items-center rounded-full bg-hover text-sm font-medium text-ink transition-colors focus-within:ring-2 focus-within:ring-edge-focus">
                <TypeIcon
                  intent={type()}
                  class="pointer-events-none absolute left-3 size-4"
                />
                <select
                  aria-label="Content type"
                  title="Change type · Ctrl/⌘ + Shift + ←/→"
                  class="h-9 max-w-full appearance-none rounded-full bg-transparent pl-9 pr-9 outline-none"
                  disabled={s.sending()}
                  value={s.draft().locked ? (type() ?? '') : ''}
                  onChange={(e) => {
                    const selected = intentSchema.safeParse(
                      e.currentTarget.value
                    );
                    s.choose(selected.success ? selected.data : undefined);
                  }}
                >
                  <option value="">
                    Auto{type() ? ` · ${intentLabels[type()!]}` : ''}
                  </option>
                  <For each={intents}>
                    {(intent) => (
                      <option value={intent}>{intentLabels[intent]}</option>
                    )}
                  </For>
                </select>
                <CaretDown class="pointer-events-none absolute right-3 size-3.5 text-ink-muted" />
              </label>
              <div class="flex flex-wrap items-center gap-2">
                <Show when={!type()}>
                  <For each={rankIntents(s.scores()).slice(0, 2)}>
                    {(candidate) => (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => s.choose(candidate.intent)}
                      >
                        {intentLabels[candidate.intent]}
                      </Button>
                    )}
                  </For>
                </Show>
                <Show when={s.pending() && type() !== 'search'}>
                  <span role="status" class="text-xs text-ink-muted">
                    {type() ? 'Updating fields…' : 'Finding the shape…'}
                  </span>
                </Show>
              </div>
            </div>
            <Show when={a.attachmentCount()}>
              <div class="flex items-center gap-2 text-xs text-ink-muted">
                <span>{a.attachmentCount()} attached item(s) · AI context</span>
                <Button size="sm" variant="ghost" onClick={a.clearAttachments}>
                  Remove
                </Button>
              </div>
            </Show>
            <Show
              when={
                (type() === 'email' && !a.inboxes().length) ||
                (type() === 'calendar' && !a.calendars().length)
              }
            >
              <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-panel px-3 py-2.5">
                <p class="text-xs text-ink-muted">
                  Connect Google to send email and create calendar events. Your
                  draft will be here when you return.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={s.sending() || a.connectingGoogle()}
                  onClick={() => void a.connectGoogle()}
                >
                  Connect Google
                </Button>
              </div>
            </Show>
            <Show when={type() === 'ai'}>
              <AiDraft state={s} actions={a} />
            </Show>
            <Show when={type() === 'search'}>
              {field('query', 'Search for')}
              {props.searchResults?.(hotkeyScope)}
            </Show>
            <Show when={type() === 'note'}>
              <NoteDraft state={s} actions={a} tags={props.noteTags} />
            </Show>
            <Show when={type() === 'task'}>
              <TaskDraft
                state={s}
                properties={
                  <Suspense
                    fallback={
                      <span class="text-xs text-ink-muted">
                        Loading task properties…
                      </span>
                    }
                  >
                    {props.taskFields}
                  </Suspense>
                }
              />
            </Show>
            <Show when={type() === 'email'}>
              <EmailDraft state={s} actions={a} />
            </Show>
            <Show when={type() === 'message'}>
              <MessageDraft state={s} actions={a} />
            </Show>
            <Show when={type() === 'calendar'}>
              <CalendarDraft state={s} actions={a} />
            </Show>
            <div class="border-t border-edge-muted pt-4">
              <ComposerFooter state={s} statusId={`${listId}-status`} />
            </div>
            <Show when={s.error()}>
              <p role="alert" class="text-sm text-failure">
                {s.error()}
              </p>
            </Show>
          </fieldset>
        </Show>
      </div>
      <Show when={s.result()}>
        {(result) => (
          <div
            role="status"
            class="mt-3 flex items-center gap-3 text-sm text-ink-muted"
          >
            {result().message}
            <Show when={result().open}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => result().open?.()}
              >
                Open
              </Button>
            </Show>
          </div>
        )}
      </Show>
    </section>
  );
}
