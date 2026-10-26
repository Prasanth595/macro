import { createResizeObserver } from '@solid-primitives/resize-observer';
import type { LexicalEditor } from 'lexical';
import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';
import { match } from 'ts-pattern';
import { createHasMultilineStructure } from './create-has-multiline-structure';

/** Auto fits the content; expanded and collapsed are host presentation overrides. */
export type ComposerLayoutMode = 'auto' | 'expanded' | 'collapsed';

function readLineHeight(element: HTMLElement) {
  const style = getComputedStyle(element);
  const lineHeight = Number.parseFloat(style.lineHeight);
  if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;
  const fontSize = Number.parseFloat(style.fontSize);
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.2 : 0;
}

function contentHeight(element: HTMLElement) {
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect().height;
}

/**
 * Own the layout decision and measure wrapping at the compact layout's width.
 * The container must use data-composer-compact="true"/"false" for width styles
 * so an inert copy can measure the compact layout without changing the live one.
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
  const hostMode = () => options.mode?.() ?? 'auto';
  const isCompact = () =>
    match(hostMode())
      .with('auto', () => !hasMultilineContent())
      .with('expanded', () => false)
      .with('collapsed', () => true)
      .exhaustive();
  let queued = false;
  let disposed = false;
  let resizeFrame: number | undefined;
  let lastMeasure:
    | { width: number; textLength: number; wrapped: boolean }
    | undefined;

  const applyWrappedLines = (height: number, lineHeight: number) => {
    if (lineHeight <= 0) return;
    // Hysteresis: once wrapped, stay wrapped until the line is clearly single.
    if (hasWrappedLines()) {
      setHasWrappedLines(height > lineHeight);
    } else {
      setHasWrappedLines(height > lineHeight + 1);
    }
  };

  const measureLive = (element: HTMLElement) => {
    const lineHeight = readLineHeight(element);
    applyWrappedLines(contentHeight(element), lineHeight);
  };

  const measureCompactProbe = (
    container: HTMLElement,
    element: HTMLElement,
    containerWidth: number
  ): boolean => {
    const probe = container.cloneNode(true) as HTMLElement;
    const probeEditor = probe.querySelector<HTMLElement>(
      '[data-lexical-editor="true"]'
    );
    if (!probeEditor) return false;
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
    // Keep the probe out of the live composer tree so inserting it cannot
    // resize the container, fire observers, or loop with layout.
    const host = element.ownerDocument.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    Object.assign(host.style, {
      position: 'fixed',
      left: '-200vw',
      top: '0',
      pointerEvents: 'none',
      visibility: 'hidden',
    });
    host.append(probe);
    element.ownerDocument.body.append(host);
    try {
      if (probeEditor.getBoundingClientRect().width <= 0) return false;
      applyWrappedLines(
        contentHeight(probeEditor),
        readLineHeight(probeEditor)
      );
      return true;
    } finally {
      host.remove();
    }
  };

  const measure = () => {
    const element = root();
    const container = options.container();
    if (!element || !container?.parentElement || !container.contains(element))
      return;
    const containerWidth = container.getBoundingClientRect().width;
    if (containerWidth <= 0) return;

    const textLength = element.textContent?.length ?? 0;
    if (
      lastMeasure &&
      lastMeasure.wrapped &&
      lastMeasure.width === containerWidth &&
      textLength >= lastMeasure.textLength
    ) {
      lastMeasure = { ...lastMeasure, textLength };
      return;
    }

    // The live compact editor is already at the width wrapping cares about.
    if (container.getAttribute('data-composer-compact') === 'true') {
      measureLive(element);
    } else if (!measureCompactProbe(container, element, containerWidth)) {
      return;
    }
    lastMeasure = {
      width: containerWidth,
      textLength,
      wrapped: hasWrappedLines(),
    };
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
  onCleanup(editor.registerUpdateListener(schedule));
  // A wrapping change can resize the container and its scroll viewport.
  // Applying it during ResizeObserver delivery invalidates ancestors already
  // measured in that delivery. Coalesce resize work into the next frame;
  // draft edits still measure in a microtask before their first paint.
  createResizeObserver(
    () => [root(), options.container()],
    () => {
      if (resizeFrame !== undefined) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = undefined;
        schedule();
      });
    }
  );
  createEffect(() => {
    hostMode();
    options.container();
    schedule();
  });
  createEffect(() => {
    const element = root();
    const container = options.container();
    if (!element || !container) return;
    // Decorators and chrome can change the compact editor width after Lexical
    // commits. Text edits are already covered by the update listener.
    const observer = new MutationObserver(schedule);
    observer.observe(container, {
      childList: true,
      subtree: true,
    });
    const fonts = element.ownerDocument.fonts;
    fonts?.addEventListener('loadingdone', schedule);
    schedule();
    onCleanup(() => {
      observer.disconnect();
      fonts?.removeEventListener('loadingdone', schedule);
    });
  });
  onCleanup(() => {
    disposed = true;
    if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
  });

  return { isCompact, hasMultilineContent };
}
