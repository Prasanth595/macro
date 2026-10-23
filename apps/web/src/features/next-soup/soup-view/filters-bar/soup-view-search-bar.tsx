import { useSoup } from '@app/features/next-soup/soup-context';
import { registerSearchSplit } from '@app/features/next-soup/soup-view/search-controllers';
import { useSoupView } from '@app/features/next-soup/soup-view/soup-view-context';
import { useSplitPanelOrThrow } from '@components/app/split-layout/layoutUtils';
import { buildConfig } from '@core/component/LexicalMarkdown/builder/MarkdownConfigBuilder';
import { MarkdownShell } from '@core/component/LexicalMarkdown/builder/MarkdownShell';
import type { EditorControls } from '@core/component/LexicalMarkdown/builder/types';
import { registerHotkey } from '@core/hotkey/hotkeys';
import { markdownToPlainText } from '@macro-inc/lexical-core/utils/parsers';
import SearchIcon from '@phosphor/magnifying-glass.svg';
import XIcon from '@phosphor/x.svg?component-solid';
import { cn, Hotkey } from '@ui';
import {
  $getRoot,
  $selectAll,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND,
} from 'lexical';
import {
  batch,
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
  Show,
  untrack,
} from 'solid-js';

type SearchbarVariant = 'filled' | 'secondary';
interface SoupSearchbarProps {
  variant?: SearchbarVariant;
  autoFocus?: boolean;
  onDismiss?: () => void;
  placeholder?: string;
  initialValue?: string;
}

/** Split-owned history, focus shortcuts and navigation around the shared search input. */
export function SoupSearchbar(props: SoupSearchbarProps) {
  const { searchText, setSearchText, setSearchPaused, queryFilters } =
    useSoupView();
  const soup = useSoup();
  const panel = useSplitPanelOrThrow();
  const persisted = panel.handle.currentEntryState()?.['search.text'];
  const initialValue =
    typeof persisted === 'string'
      ? persisted
      : searchText() || props.initialValue || '';
  if (searchText() !== initialValue) setSearchText(initialValue);
  let controls: EditorControls | undefined;
  const hotkey = registerHotkey({
    hotkey: 'cmd+f',
    scopeId: panel.splitHotkeyScope,
    registrationType: 'add',
    description: 'Search',
    runWithInputFocused: true,
    keyDownHandler: () => {
      if (!controls) return false;
      controls.focus();
      controls.getLexical().update(() => $selectAll());
      return true;
    },
  });
  onMount(() => {
    const content = panel.handle.content();
    if (content.type !== 'component' || content.id !== 'search') return;
    onCleanup(
      registerSearchSplit(panel.handle.id, {
        applyOverrides: ({ query, filters, clientFilters }) => {
          batch(() => {
            controls?.setMarkdown(query);
            controls?.getLexical().update(() => $getRoot().selectEnd());
            controls?.blur();
            setSearchText(query);
            queryFilters.replace(filters);
            soup.predicates.set(clientFilters);
          });
          queueMicrotask(() =>
            panel.panelRef()?.focus({ preventScroll: true })
          );
        },
        focus: () => {
          setTimeout(() => controls?.focus());
        },
      })
    );
  });
  return (
    <SearchbarInput
      {...props}
      value={searchText()}
      initialValue={initialValue}
      onChange={setSearchText}
      onPauseChange={setSearchPaused}
      shortcut={hotkey.hotkey()}
      onConnect={(value) => {
        controls = value;
      }}
    />
  );
}

/** The global Search editor, usable without a soup view or split context. */
export function SearchbarInput(
  props: SoupSearchbarProps & {
    value: string;
    onChange: (value: string) => void;
    onPauseChange?: (paused: boolean) => void;
    onConnect?: (controls: EditorControls) => void;
    shortcut?: string;
    label?: string;
  }
) {
  // Keep rich editor markup separate from the plain query acknowledged by the host.
  const [markdown, setMarkdown] = createSignal(
    untrack(() => props.initialValue ?? props.value)
  );
  let acknowledgedQuery = markdownToPlainText(props.value).trim();
  const publish = (value: string) => {
    setMarkdown(value);
    if (editor.controls.isInlineMenuOpen()) return;
    const text = markdownToPlainText(value).trim();
    acknowledgedQuery = text;
    if (text !== props.value) props.onChange(text);
  };
  createEffect(
    on(
      () => props.value,
      (value) => {
        const query = markdownToPlainText(value).trim();
        if (query === acknowledgedQuery) return;
        acknowledgedQuery = query;
        setMarkdown(value);
      }
    )
  );
  const editor = buildConfig('chat')
    .namespace('soup-search-bar')
    .singleLine()
    .withMentions({ sources: ['users'], disableMentionTracking: true })
    .withHistory({ timeGap: 400 })
    .onChange(publish)
    .onEnter(() => {
      if (editor.controls.isInlineMenuOpen()) return false;
      editor.controls.blur();
      return true;
    })
    .onEscape(() => {
      editor.controls.blur();
      props.onDismiss?.();
      return true;
    })
    .onTab((event) => {
      event.preventDefault();
      return true;
    })
    .use((lex) =>
      lex.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        () => {
          if (editor.controls.isInlineMenuOpen()) return false;
          lex.getRootElement()?.blur();
          return true;
        },
        COMMAND_PRIORITY_HIGH
      )
    );
  const hasContent = () => !!markdown().trim();
  createEffect(
    on(
      () => editor.controls.isInlineMenuOpen(),
      (open, wasOpen) => {
        props.onPauseChange?.(open);
        if (wasOpen && !open) untrack(() => publish(markdown()));
      }
    )
  );
  return (
    <div
      class="w-full items-center shrink-0 grow min-w-0 mobile:-order-2"
      data-search-bar-wrapper
      data-no-focus-restore
      onFocusOut={(event) => {
        if (hasContent() || !props.onDismiss) return;
        const next = event.relatedTarget as Node | null;
        if (next && event.currentTarget.contains(next)) return;
        props.onDismiss();
      }}
    >
      <div
        class={cn(
          'group w-full relative flex items-center gap-1 rounded-lg h-7 mobile:h-9 pl-1 pr-1 py-1 mobile:min-w-35 border text-xs',
          props.variant === 'filled'
            ? 'bg-ink/5 text-ink-muted hover:bg-ink/7 hover:text-ink border-edge-muted focus-within:bg-ink/7 focus-within:text-ink focus-within:border-accent'
            : 'bg-surface text-ink-muted border-edge-muted hover:text-ink focus-within:text-ink focus-within:border-accent'
        )}
      >
        <SearchIcon class="size-4 shrink-0" />
        <div
          data-soup-search
          class="flex-1 min-w-0 whitespace-nowrap overflow-hidden **:[[contenteditable]]:outline-none **:[[contenteditable]]:p-0 **:[[contenteditable]]:whitespace-nowrap **:[[contenteditable]]:min-h-lh [&_p]:my-0 [&_p]:whitespace-nowrap"
        >
          <MarkdownShell
            config={editor}
            placeholder={props.placeholder ?? 'Search'}
            autofocus={props.autoFocus}
            value={markdown()}
            class="min-h-0! overflow-visible!"
            ariaLabel={props.label ?? 'Search'}
            onConnect={() => {
              props.onConnect?.(editor.controls);
            }}
          />
        </div>
        <Show when={!hasContent() && !props.onDismiss && props.shortcut}>
          <div class="shrink-0 text-xxs text-ink-extra-muted rounded-sm border border-ink/5 px-1.5 py-px group-focus-within:hidden">
            <Hotkey shortcut={props.shortcut} class="flex gap-1" />
          </div>
        </Show>
        <Show when={hasContent() || props.onDismiss}>
          <button
            type="button"
            aria-label="Clear search"
            class="ml-auto size-4 mobile:size-6 shrink-0 hover:opacity-60"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMarkdown('');
              acknowledgedQuery = '';
              props.onChange('');
              props.onDismiss?.();
            }}
          >
            <XIcon class="size-4 mobile:size-6" />
          </button>
        </Show>
      </div>
    </div>
  );
}
