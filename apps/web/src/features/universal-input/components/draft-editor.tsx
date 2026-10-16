import type { EditorConfigBuilder } from '@core/component/LexicalMarkdown/builder/MarkdownConfigBuilder';
import { ComposerEditor } from '@core/component/LexicalMarkdown/component/ComposerEditor';
import { createMediaQuery } from '@solid-primitives/media';
import { createEffect, createSignal, onCleanup, Show, untrack } from 'solid-js';
import { RESET_UNIVERSAL_INPUT_EVENT } from '../core/editor-events';
import { createExamplePlaceholder } from './example-placeholder';

/** Keep the Lexical document mounted while inference reveals editable fields. */
export function DraftEditor(props: {
  config: EditorConfigBuilder;
  text: string;
  disabled: boolean;
  onChange: (markdown: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  registerFocus?: (focus: () => void) => void;
}) {
  const examples = [
    'dinner with julia tomorrow at 9pm',
    'email julia that I’ll be late',
    'fix notification clicks, priority urgent',
    'note ideas for the next launch',
    'find the investor update',
  ];
  const reduceMotion = createMediaQuery('(prefers-reduced-motion: reduce)');
  const example = createExamplePlaceholder(
    examples,
    () => !props.text.trim() && !reduceMotion()
  );
  const [connected, setConnected] = createSignal(false);
  const initialValue = untrack(() => props.text);
  const config = props.config
    .onChange((markdown) => {
      if (markdown !== props.text) props.onChange(markdown);
    })
    .onEnter((event) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.isComposing ||
        config.controls.isInlineMenuOpen()
      )
        return false;
      props.onSubmit();
      return true;
    });

  // External draft restoration and successful submission update the editor.
  // Ordinary typing must keep Lexical's selection, formatting and undo history.
  createEffect(() => {
    if (!connected()) return;
    const text = props.text;
    untrack(() => {
      if (text !== config.controls.getMarkdown())
        config.controls.setMarkdown(text);
    });
  });

  return (
    // Match Home's compact row: 33.75px controls plus 7.5px padding per side.
    <div class="relative flex min-h-[48.75px] flex-col justify-center px-5 py-3 sm:px-6">
      <ComposerEditor
        config={config}
        placeholder="Your input"
        initialValue={initialValue}
        disabled={props.disabled}
        class="h-auto! min-h-6! [&>[data-markdown-editable]]:min-h-6! [&>[data-markdown-editable]]:max-h-80! [&>[data-markdown-editable]]:outline-none [&>[data-markdown-placeholder]]:hidden"
        refFn={(element) => {
          element.setAttribute('aria-label', 'Your input');
          element.setAttribute('data-universal-input', '');
          const reset = () => {
            if (props.disabled) return;
            props.onReset();
            config.controls.clear();
          };
          element.addEventListener(RESET_UNIVERSAL_INPUT_EVENT, reset);
          onCleanup(() =>
            element.removeEventListener(RESET_UNIVERSAL_INPUT_EVENT, reset)
          );
        }}
        onConnect={() => {
          setConnected(true);
          props.registerFocus?.(() => config.controls.focus());
        }}
      />
      <Show when={!props.text.trim()}>
        <span
          aria-hidden="true"
          data-testid="input-example"
          class="pointer-events-none absolute inset-x-5 top-1/2 -translate-y-1/2 truncate text-base leading-[24.375px] text-ink-placeholder sm:inset-x-6"
        >
          try: {example()}
        </span>
      </Show>
    </div>
  );
}
