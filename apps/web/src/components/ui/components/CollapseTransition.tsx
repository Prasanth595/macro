import { createAnimationGroup } from '@app/lib/utils/create-animation-group';
import { createResizeObserver } from '@solid-primitives/resize-observer';
import {
  children,
  createComputed,
  type JSX,
  onCleanup,
  onMount,
  Show,
  untrack,
} from 'solid-js';
import { Transition } from 'solid-transition-group';

const COLLAPSE_DURATION = 140;

export type CollapseTransitionProps = {
  open: boolean;
  /** Animate this element's size instead of the body's, when flex owns it. */
  container?: () => HTMLElement | undefined;
  axis?: 'height' | 'width';
  collapsedSize?: number;
  /** Resting size when an external layout solver changes size before exit. */
  expandedSize?: number;
  /** Animate absolutely positioned neighbors with the same timing and cleanup. */
  companions?: (transition: {
    opening: boolean;
    from: number;
    interrupted: boolean;
  }) => readonly { target: HTMLElement; keyframes: Keyframe[] }[];
  /** Includes exit content that stays mounted until its animation finishes. */
  onPresenceChange?: (present: boolean) => void;
  /** Settle active motion synchronously before an external layout change. */
  captureController?: (controller: { finish: () => void }) => void;
  children: JSX.Element;
};

/**
 * Animate a disclosure body, or its containing section when flex owns its size.
 * @do Wrap the body that opens and closes; it mounts only while `open`.
 * @do Use `axis="width"` for a side column such as a file tree beside content.
 * @do Supply `expandedSize` when an external layout solver removes space immediately.
 * @do Supply `companions` when absolutely positioned neighbors need matching motion.
 * @do Keep state the body needs across closing outside it; closing unmounts it.
 * @dont Do not add your own height or opacity transition to the body; the
 *   animation measures it and would fight a second one.
 */
export function CollapseTransition(props: CollapseTransitionProps) {
  const axis = () => props.axis ?? 'height';
  const dimensionProperties = () =>
    axis() === 'height'
      ? ({
          min: 'minHeight',
          max: 'maxHeight',
          start: 'paddingTop',
          end: 'paddingBottom',
        } as const)
      : ({
          min: 'minWidth',
          max: 'maxWidth',
          start: 'paddingLeft',
          end: 'paddingRight',
        } as const);
  const sizeOf = (element: HTMLElement) =>
    element.getBoundingClientRect()[axis()];
  let measuredSize: number | undefined;
  let disposed = false;
  const motion = createAnimationGroup();
  let running: { target: HTMLElement; content: HTMLElement } | undefined;

  // Freeze a flex-owned container at its collapsed size before `Show` mounts
  // children. Otherwise the open content lays out at full height for one frame,
  // siblings reflow, then the enter animation snaps back — a visible jump.
  // Only lock on the closed→open edge; leave steady open/closed sizes alone.
  let wasOpen = untrack(() => props.open);
  createComputed(() => {
    const open = props.open;
    const opening = open && !wasOpen;
    wasOpen = open;
    if (!opening || !props.container) return;
    const target = props.container();
    if (!target) return;
    const collapsedSize = props.collapsedSize ?? sizeOf(target);
    target.style.flexGrow = '0';
    target.style.flexShrink = '0';
    target.style.flexBasis = 'auto';
    target.style.overflow = 'clip';
    target.style.boxSizing = 'border-box';
    target.style[axis()] = `${collapsedSize}px`;
  });

  const content = children(() => (
    <Show when={props.open}>{props.children}</Show>
  ));
  const contentElement = () => {
    const element = content();
    return element instanceof HTMLElement ? element : undefined;
  };
  const container = () => props.container?.() ?? contentElement();

  createResizeObserver(container, (_rect, element) => {
    if (!running) measuredSize = sizeOf(element);
  });
  onMount(() => {
    props.captureController?.({ finish: motion.finish });
    const element = container();
    props.onPresenceChange?.(props.open);
    if (element) measuredSize = sizeOf(element);
  });
  onCleanup(() => {
    disposed = true;
    motion.finish();
  });

  function clearLock(target: HTMLElement) {
    target.style.flexGrow = '';
    target.style.flexShrink = '';
    target.style.flexBasis = '';
    target.style.overflow = '';
    target.style.boxSizing = '';
    target.style.height = '';
    target.style.width = '';
    target.style.minHeight = '';
    target.style.minWidth = '';
    target.style.maxHeight = '';
    target.style.maxWidth = '';
  }

  function measureOpenSize(target: HTMLElement, contentEl: HTMLElement) {
    if (props.expandedSize !== undefined) return props.expandedSize;

    // Prefer the CSS max (resolved to px) so a flex `half` section opens to its
    // cap without unlocking the container and shoving siblings.
    const { max } = dimensionProperties();
    const cssMax = getComputedStyle(target)[max];
    const maxPx =
      cssMax && cssMax !== 'none' && cssMax.endsWith('px')
        ? Number.parseFloat(cssMax)
        : undefined;

    // Content is often `flex-1` inside a clipped container, so measure it out of
    // flow; the container stays locked and siblings do not reflow.
    const style = contentEl.style;
    const previous = {
      position: style.position,
      top: style.top,
      left: style.left,
      right: style.right,
      width: style.width,
      height: style.height,
      flex: style.flex,
      minHeight: style.minHeight,
      maxHeight: style.maxHeight,
      visibility: style.visibility,
    };
    style.position = 'absolute';
    style.top = '0';
    style.left = '0';
    style.right = '0';
    style.width = '100%';
    style.height = 'auto';
    style.flex = 'none';
    style.minHeight = '0';
    style.maxHeight = 'none';
    style.visibility = 'hidden';
    const contentSize = sizeOf(contentEl);
    style.position = previous.position;
    style.top = previous.top;
    style.left = previous.left;
    style.right = previous.right;
    style.width = previous.width;
    style.height = previous.height;
    style.flex = previous.flex;
    style.minHeight = previous.minHeight;
    style.maxHeight = previous.maxHeight;
    style.visibility = previous.visibility;

    const collapsedSize = props.collapsedSize ?? 0;
    const gap =
      Number.parseFloat(
        getComputedStyle(target)[axis() === 'height' ? 'rowGap' : 'columnGap']
      ) || 0;
    const desired = collapsedSize + gap + contentSize;
    return maxPx === undefined ? desired : Math.min(desired, maxPx);
  }

  function resolveFromSize(
    opening: boolean,
    target: HTMLElement,
    collapsedSize: number
  ) {
    if (running) return sizeOf(running.target);
    if (opening) return collapsedSize;
    return props.expandedSize ?? measuredSize ?? sizeOf(target);
  }

  function prefersReducedMotion(target: HTMLElement) {
    return (
      typeof target.animate !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function animate(element: Element, opening: boolean, done: () => void) {
    if (disposed || !(element instanceof HTMLElement) || opening !== props.open)
      return done();

    props.onPresenceChange?.(true);
    const target = props.container?.() ?? element;
    const collapsedSize = props.collapsedSize ?? 0;
    const fromOpacity = running
      ? getComputedStyle(running.content).opacity
      : opening
        ? '0'
        : '1';
    const from = resolveFromSize(opening, target, collapsedSize);
    // Capture neighbors before releasing an interrupted animation's styles.
    const companions = untrack(() =>
      props.companions?.({ opening, from, interrupted: running !== undefined })
    );
    motion.finish();
    const to = opening ? measureOpenSize(target, element) : collapsedSize;
    const style = getComputedStyle(target);
    const {
      min,
      max,
      start: paddingStart,
      end: paddingEnd,
    } = dimensionProperties();
    const startPadding = style[paddingStart];
    const endPadding = style[paddingEnd];
    // Keep an existing CSS max so a `half` section cannot animate past its cap
    // and crush a sibling for the duration of the transition.
    const cssMax = style[max];

    element.inert = !opening;
    if (prefersReducedMotion(target)) {
      clearLock(target);
      props.onPresenceChange?.(opening || props.open);
      done();
      return;
    }

    // Freeze flex allocation only while size is animated; restore natural sizing
    // afterward so async rows, scrolling, and viewport resizes remain unrestricted.
    const sizing = {
      flexGrow: '0',
      flexShrink: '0',
      flexBasis: 'auto',
      [min]: '0',
      [max]: cssMax === 'none' ? 'none' : cssMax,
      boxSizing: 'border-box',
      overflow: 'clip',
    };
    running = { target, content: element };
    motion.start(
      [
        {
          target,
          keyframes: [
            {
              ...sizing,
              [axis()]: `${from}px`,
              [paddingStart]: opening ? '0' : startPadding,
              [paddingEnd]: opening ? '0' : endPadding,
            },
            {
              ...sizing,
              [axis()]: `${to}px`,
              [paddingStart]: opening ? startPadding : '0',
              [paddingEnd]: opening ? endPadding : '0',
            },
          ],
        },
        {
          target: element,
          keyframes: [{ opacity: fromOpacity }, { opacity: opening ? 1 : 0 }],
        },
        ...(companions ?? []),
      ],
      {
        duration: COLLAPSE_DURATION,
        easing: 'ease-out',
        fill: 'both',
      },
      () => {
        running = undefined;
        measuredSize = to;
        clearLock(target);
        props.onPresenceChange?.(opening || props.open);
        done();
      }
    );
  }

  return (
    <Transition
      onEnter={(element, done) => animate(element, true, done)}
      onExit={(element, done) => animate(element, false, done)}
    >
      {content()}
    </Transition>
  );
}
