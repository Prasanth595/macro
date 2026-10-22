import { useViewTabHotkeys } from '@app/components/view-shell/use-view-tab-hotkeys';
import {
  attachGlobalDOMScope,
  useHotKeyRoot,
  useHotkeyDOMScope,
} from '@core/hotkey/hotkeys';
import { setActiveScope, setPressedKeys } from '@core/hotkey/state';
import { registerPlainText } from '@lexical/plain-text';
import userEvent from '@testing-library/user-event';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  createEditor,
  type LexicalEditor,
} from 'lexical';
import { createRoot, createSignal } from 'solid-js';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useTitleTabNavigation } from './useTitleTabNavigation';

let container: HTMLDivElement;
let titleRoot: HTMLDivElement;
let bodyRoot: HTMLDivElement;
let tagsButton: HTMLButtonElement;
let body: LexicalEditor;
let title: LexicalEditor;
let disposeTitle: () => void;
let dispose: () => void;
let disposeNavigation: () => void;
let setMenuOpen: (open: boolean) => void;
let selectTab: ReturnType<typeof vi.fn<(id: string) => void>>;

beforeEach(() => {
  // jsdom has no caret geometry; Lexical measures it when committing selection.
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  });
  container = document.createElement('div');
  titleRoot = document.createElement('div');
  bodyRoot = document.createElement('div');
  tagsButton = document.createElement('button');
  titleRoot.contentEditable = 'true';
  titleRoot.setAttribute('contenteditable', 'true');
  bodyRoot.contentEditable = 'true';
  bodyRoot.setAttribute('contenteditable', 'true');
  container.append(titleRoot, tagsButton, bodyRoot);
  document.body.append(container);

  title = createEditor();
  body = createEditor();
  title.setRootElement(titleRoot);
  body.setRootElement(bodyRoot);
  disposeTitle = registerPlainText(title);
  title.update(
    () =>
      $getRoot().append(
        $createParagraphNode().append($createTextNode('Updated title'))
      ),
    { discrete: true }
  );
  body.update(
    () =>
      $getRoot().append(
        $createParagraphNode().append($createTextNode('Existing body'))
      ),
    { discrete: true }
  );
  selectTab = vi.fn();
  dispose = createRoot((disposeRoot) => {
    attachGlobalDOMScope(document.body);
    useHotKeyRoot();
    const [attachScope, scopeId] = useHotkeyDOMScope('document-tab-test');
    attachScope(container);
    // Drive and MarkdownDetail currently share the split scope.
    useViewTabHotkeys({
      scopeId,
      ids: () => ['owned', 'recent', 'shared'],
      activeId: () => 'owned',
      setActiveId: selectTab,
    });
    const [menuOpen, setOpen] = createSignal(false);
    setMenuOpen = setOpen;
    disposeNavigation = createRoot((disposeChild) => {
      useTitleTabNavigation({
        scopeId: () => scopeId,
        titleEditor: title,
        documentEditor: () => body,
        menuOpen,
      });
      return disposeChild;
    });
    return disposeRoot;
  });
});

afterEach(() => {
  disposeNavigation();
  dispose();
  disposeTitle();
  title.setRootElement(null);
  body.setRootElement(null);
  container.remove();
  setActiveScope('global');
  setPressedKeys(new Set<string>());
  Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
});

test('Tab moves from an edited title into the existing body without reaching Drive', async () => {
  const user = userEvent.setup();
  titleRoot.focus();
  await user.keyboard('{Tab}');

  expect(document.activeElement).toBe(bodyRoot);
  title.read(() => {
    expect($getRoot().getTextContent()).toBe('Updated title');
  });
  body.read(() => {
    const selection = $getSelection();
    expect($isRangeSelection(selection) && selection.anchor.offset).toBe(0);
    expect($getRoot().getTextContent()).toBe('Existing body');
    expect($getRoot().getChildrenSize()).toBe(1);
  });
  await user.keyboard('{Tab}');
  expect(selectTab).not.toHaveBeenCalled();
});

test('an open title menu keeps its Tab event', async () => {
  setMenuOpen(true);
  titleRoot.focus();
  const onTab = vi.fn((event: KeyboardEvent) => {
    if (event.key === 'Tab') event.preventDefault();
  });
  titleRoot.addEventListener('keydown', onTab);
  await userEvent.setup().keyboard('{Tab}');
  expect(onTab).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(titleRoot);
  expect(selectTab).not.toHaveBeenCalled();
});

test('Shift+Tab retains native backward navigation', async () => {
  titleRoot.focus();
  const onKeyDown = vi.fn();
  titleRoot.addEventListener('keydown', onKeyDown);
  await userEvent.setup().keyboard('{Shift>}{Tab}{/Shift}');
  expect(onKeyDown).toHaveBeenCalled();
  expect(selectTab).not.toHaveBeenCalled();
  expect(document.activeElement).not.toBe(bodyRoot);
});

test('Drive Tab navigation remains available outside the title and after cleanup', async () => {
  const user = userEvent.setup();
  tagsButton.focus();
  await user.keyboard('{Tab}');
  expect(selectTab).toHaveBeenLastCalledWith('recent');

  disposeNavigation();
  selectTab.mockClear();
  tagsButton.focus();
  await user.keyboard('{Tab}');
  expect(selectTab).toHaveBeenLastCalledWith('recent');
});
