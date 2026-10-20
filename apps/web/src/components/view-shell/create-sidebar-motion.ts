import { type Accessor, onCleanup } from 'solid-js';

const SIDEBAR_MOTION_DURATION = 140;

/** Animate the solver's settled layout without changing its resize preferences. */
export function createSidebarMotion(
  root: Accessor<HTMLElement | undefined>,
  options: {
    asideSelector?: string;
    edge?: 'left' | 'right';
    onComplete?: () => void;
  } = {}
) {
  const running = new Set<() => void>();
  let revision = 0;
  const cancel = () => {
    for (const finish of running) finish();
  };
  onCleanup(() => {
    revision++;
    cancel();
  });

  return (update: () => void) => {
    const shell = root();
    const currentRevision = ++revision;
    const complete = () => {
      if (revision === currentRevision && running.size === 0) {
        options.onComplete?.();
      }
    };
    const panels = shell?.querySelectorAll<HTMLElement>(
      ':scope > [data-resize-zone] > [data-resize-panel]'
    );
    const before = new Map(
      Array.from(panels ?? [], (panel) => {
        const style = getComputedStyle(panel);
        return [
          panel,
          {
            width: panel.getBoundingClientRect().width,
            left: style.left,
            opacity: style.display === 'none' ? '0' : style.opacity,
          },
        ] as const;
      })
    );
    cancel();
    update();
    if (
      !shell ||
      typeof shell.animate !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      complete();
      return;
    }

    // Solid settles the solver's registrations before measuring the destination.
    queueMicrotask(() => {
      if (revision !== currentRevision || !shell.isConnected) return;
      for (const [panel, from] of before) {
        if (!panel.isConnected) continue;
        const aside = panel.querySelector<HTMLElement>(
          options.asideSelector ?? '[data-view-shell-aside]'
        );
        const hidden = getComputedStyle(panel).display === 'none';
        const width = hidden ? 0 : Number.parseFloat(panel.style.width);
        const left = panel.style.left;
        if (from.width === width && from.left === left) continue;

        const previousOverflow = panel.style.overflow;
        const previousDisplay = panel.style.display;
        const previousAsideWidth = aside?.style.width;
        const rightAnchored = aside && options.edge === 'right';
        const previousAsidePosition = aside?.style.position;
        const previousAsideRight = aside?.style.right;
        const previousAsideTop = aside?.style.top;
        if (aside) {
          // Keep labels and icons at their resting width while their frame closes.
          aside.style.width = `${Math.max(from.width, width)}px`;
          panel.style.overflow = 'clip';
          panel.style.display = 'block';
          if (rightAnchored) {
            aside.style.position = 'absolute';
            aside.style.right = '0px';
            aside.style.top = '0px';
          }
        }
        const animation = panel.animate(
          [
            {
              width: `${from.width}px`,
              left: rightAnchored ? 'auto' : from.left,
              ...(rightAnchored ? { right: '0px' } : {}),
              opacity: aside ? from.opacity : 1,
            },
            {
              width: `${width}px`,
              left: rightAnchored ? 'auto' : left,
              ...(rightAnchored ? { right: '0px' } : {}),
              opacity: aside && hidden ? 0 : 1,
            },
          ],
          {
            duration: SIDEBAR_MOTION_DURATION,
            easing: 'ease-out',
            fill: 'both',
          }
        );
        const finish = () => {
          if (!running.delete(finish)) return;
          animation.cancel();
          if (aside) {
            aside.style.width = previousAsideWidth ?? '';
            panel.style.overflow = previousOverflow;
            panel.style.display = previousDisplay;
            if (rightAnchored) {
              aside.style.position = previousAsidePosition ?? '';
              aside.style.right = previousAsideRight ?? '';
              aside.style.top = previousAsideTop ?? '';
            }
          }
          complete();
        };
        running.add(finish);
        animation.onfinish = finish;
      }
      complete();
    });
  };
}
