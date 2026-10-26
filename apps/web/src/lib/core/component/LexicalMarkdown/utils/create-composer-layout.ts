import { createResizeObserver } from '@solid-primitives/resize-observer';
import { $getRoot, $isParagraphNode, type LexicalEditor } from 'lexical';
import {
  type Accessor,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';
import { match } from 'ts-pattern';
import { createHasMultilineStructure } from './create-has-multiline-structure';

/** Auto fits the content; expanded and collapsed are host presentation overrides. */
export type ComposerLayoutMode = 'auto' | 'expanded' | 'collapsed';

/**
 * Own the layout decision and measure wrapping at the compact layout's width.
 * The container must use data-composer-compact="true"/"false" for width styles
 * so expanded inputs can use an inert copy to measure their compact layout.
 */
export function createComposerLayout(
  editor: LexicalEditor,
  options: {
    container: Accessor<HTMLElement | undefined>;
    mode?: Accessor<ComposerLayoutMode>;
  }
) {
  const [root, setRoot] = createSignal<HTMLElement | null>(null);
  const hasMultilineStructure = createHasMultilineStructure(editor);
  const [hasWrappedLines, setHasWrappedLines] = createSignal(false);
  const hasMultilineContent = () =>
    hasMultilineStructure() || hasWrappedLines();
  const isCompact = () =>
    match(options.mode?.() ?? 'auto')
      .with('auto', () => !hasMultilineContent())
      .with('expanded', () => false)
      .with('collapsed', () => true)
      .exhaustive();
  let queued = false;
  let disposed = false;
  let resizeFrame: number | undefined;

  const measure = () => {
    const element = root();
    const container = options.container();
    if (!element || !container?.parentElement || !container.contains(element))
      return;

    const empty = editor.getEditorState().read(() => {
      const content = $getRoot();
      const first = content.getFirstChild();
      return (
        content.getChildrenSize() === 0 ||
        (content.getChildrenSize() === 1 &&
          $isParagraphNode(first) &&
          first.getChildrenSize() === 0)
      );
    });
    if (empty) {
      setHasWrappedLines(false);
      return;
    }

    const measureWrapping = (target: HTMLElement) => {
      if (target.getBoundingClientRect().width <= 0) return;
      const range = element.ownerDocument.createRange();
      range.selectNodeContents(target);
      const lineHeight = Number.parseFloat(getComputedStyle(target).lineHeight);
      setHasWrappedLines(range.getBoundingClientRect().height > lineHeight + 1);
    };

    // Compact inputs already have the width we need. Measuring the live editor
    // avoids inserting and removing a second composer on every keystroke.
    if (container.dataset.composerCompact === 'true') {
      measureWrapping(element);
      return;
    }
    const containerWidth = container.getBoundingClientRect().width;
    if (containerWidth <= 0) return;

    // Measure the actual compact CSS, including controls and padding, even if
    // this composer mounted expanded or its controls changed while expanded.
    const probe = container.cloneNode(true) as HTMLElement;
    const probeEditor = probe.querySelector<HTMLElement>(
      '[data-lexical-editor="true"]'
    );
    if (!probeEditor) return;
    probe.removeAttribute('id');
    for (const child of probe.querySelectorAll('[id]'))
      child.removeAttribute('id');
    for (const editable of probe.querySelectorAll<HTMLElement>(
      '[contenteditable]'
    ))
      editable.contentEditable = 'false';
    probe.inert = true;
    probe.setAttribute('aria-hidden', 'true');
    probe.setAttribute('data-composer-compact', 'true');
    Object.assign(probe.style, {
      position: 'absolute',
      visibility: 'hidden',
      pointerEvents: 'none',
      top: '0',
      left: '0',
      boxSizing: 'border-box',
      width: `${containerWidth}px`,
      height: 'auto',
      minHeight: '0',
      maxHeight: 'none',
      overflow: 'hidden',
    });
    container.parentElement.append(probe);
    try {
      measureWrapping(probeEditor);
    } finally {
      probe.remove();
    }
  };

  // Lexical and Solid may still be updating the DOM when a draft changes.
  // A microtask measures the committed layout, including in background tabs.
  const schedule = () => {
    if (queued || disposed) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!disposed) measure();
    });
  };

  onCleanup(
    editor.registerRootListener((element) => {
      setRoot(element);
    })
  );
  const observedSizes = new WeakMap<
    Element,
    { width: number; height: number }
  >();
  // A wrapping change can resize the container and its scroll viewport.
  // Applying it during ResizeObserver delivery invalidates ancestors already
  // measured in that delivery. Coalesce resize work into the next frame;
  // draft edits still measure in a microtask before their first paint.
  createResizeObserver(
    () => [root(), options.container()],
    ({ width, height }, element) => {
      const previous = observedSizes.get(element);
      // Container height follows our layout decision. Editor height can also
      // change when an image or decorator finishes rendering, without a DOM edit.
      if (
        previous?.width === width &&
        (element !== root() || previous.height === height)
      )
        return;
      observedSizes.set(element, { width, height });
      if (resizeFrame !== undefined) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = undefined;
        schedule();
      });
    }
  );
  createEffect(
    on([root, options.container], ([element, container]) => {
      if (!element || !container) return;
      // Decorators can finish rendering after Lexical commits; controls can also
      // change the available inline width without resizing the expanded editor.
      // DOM mutations cover committed editor updates too. A second Lexical
      // update listener also measures selection-only changes and duplicates work.
      const observer = new MutationObserver((records) => {
        if (
          records.some(
            (record) =>
              record.target !== container ||
              record.type !== 'attributes' ||
              record.attributeName !== 'data-composer-compact'
          )
        )
          schedule();
      });
      observer.observe(container, {
        childList: true,
        characterData: true,
        attributes: true,
        subtree: true,
      });
      const fonts = element.ownerDocument.fonts;
      fonts?.addEventListener('loadingdone', schedule);
      schedule();
      onCleanup(() => {
        observer.disconnect();
        fonts?.removeEventListener('loadingdone', schedule);
      });
    })
  );
  onCleanup(() => {
    disposed = true;
    if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
  });

  return { isCompact, hasMultilineContent };
}
