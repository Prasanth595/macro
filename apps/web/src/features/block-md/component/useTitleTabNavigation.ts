import { $selectDocumentStart } from '@core/component/LexicalMarkdown/plugins/block-decorator-navigation';
import { registerHotkey } from '@core/hotkey/hotkeys';
import type { LexicalEditor } from 'lexical';
import { type Accessor, createEffect, on } from 'solid-js';

export function useTitleTabNavigation(options: {
  scopeId: Accessor<string | undefined>;
  titleEditor: LexicalEditor;
  documentEditor: Accessor<LexicalEditor | undefined>;
  menuOpen: Accessor<boolean>;
}) {
  createEffect(
    on(options.scopeId, (scopeId) => {
      if (!scopeId) return;
      registerHotkey({
        scopeId,
        hotkey: 'tab',
        registrationType: 'add',
        description: 'Focus document body',
        runWithInputFocused: true,
        hide: true,
        // Inline menus own Tab while choosing an emoji or tag.
        condition: () =>
          document.activeElement === options.titleEditor.getRootElement() &&
          !options.menuOpen(),
        keyDownHandler: () => {
          const editor = options.documentEditor();
          const root = editor?.getRootElement();
          if (!editor || !root || !editor.isEditable()) return false;

          // Focus explicitly: selecting a leading block decorator has no DOM caret.
          root.focus({ preventScroll: true });
          editor.update($selectDocumentStart);
          return true;
        },
      });
    })
  );
}
