import { createSignal, For, type JSX, onCleanup, onMount } from 'solid-js';
import { HOMEPAGE_DEMO_EVENT } from '../core/homepage-demo-scenes';

const SLIDES = [
  {
    label: 'Inbox',
    target: 'Home',
    title: 'Catch up on all your work.',
  },
  {
    label: 'Chat',
    target: 'Chat',
    title: 'Chat with your team and your agents.',
  },
  {
    label: 'Docs',
    target: 'Drive',
    title: 'Write together, in the same document.',
  },
  {
    label: 'CRM',
    target: 'Customers',
    title: 'Move deals forward with the full picture.',
  },
  {
    label: 'Tasks',
    target: 'Tasks',
    title: 'Keep every task connected to the work.',
  },
  {
    label: 'Agents',
    target: 'Agents',
    title: 'Let agents turn your sources into useful work.',
  },
];

function CarouselCaret(props: { direction: 'left' | 'right' }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <defs>
        <linearGradient
          id={`homepage-arrow-${props.direction}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0" stop-color="currentColor" />
          <stop offset="1" stop-color="currentColor" stop-opacity="0.55" />
        </linearGradient>
      </defs>
      <path
        d={
          props.direction === 'left'
            ? 'M14.5 5.5 8 12l6.5 6.5'
            : 'M9.5 5.5 16 12l-6.5 6.5'
        }
        fill="none"
        stroke={`url(#homepage-arrow-${props.direction})`}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

/** The live-site highlights over a workspace that is always interactive. */
export function HomepageDemoCarousel(props: {
  frame: () => HTMLIFrameElement;
  children?: JSX.Element;
}) {
  const [active, setActive] = createSignal(0);
  const [ready, setReady] = createSignal(false);
  const [autoplay, setAutoplay] = createSignal(true);
  let root!: HTMLDivElement;
  let restartAutoplay = () => {};
  let document: Document | null = null;
  let transition: Animation | undefined;
  let swipe: { x: number; y: number; pointerId: number } | undefined;
  const slide = () => SLIDES[active()];
  const buttonFor = (target: string) =>
    document?.querySelector<HTMLButtonElement>(
      `.dummy-rail button[aria-label="${target}"]`
    );
  const showView = () => {
    if (document?.querySelector('[data-homepage-demo]')) {
      props
        .frame()
        .contentWindow?.dispatchEvent(
          new CustomEvent(HOMEPAGE_DEMO_EVENT, { detail: slide().label })
        );
      return;
    }
    buttonFor(slide().target)?.click();
    if (slide().target === 'Drive') {
      Array.from(
        document?.querySelectorAll<HTMLButtonElement>('.dummy-main button') ??
          []
      )
        .find((button) =>
          button.textContent?.trim().startsWith('Website launch plan')
        )
        ?.click();
    }
    if (slide().target === 'Tasks') {
      document
        ?.querySelector<HTMLButtonElement>(
          '[aria-label="Open task Write the launch announcement"]'
        )
        ?.click();
    }
    if (slide().target === 'Agents') {
      Array.from(
        document?.querySelectorAll<HTMLButtonElement>(
          '.dummy-sidebar button'
        ) ?? []
      )
        .find(
          (button) => button.textContent?.trim() === 'Fix the deploy pipeline'
        )
        ?.click();
    }
  };
  const select = (index: number, manual = true) => {
    if (manual) setAutoplay(false);
    setActive((index + SLIDES.length) % SLIDES.length);
    showView();
    restartAutoplay();
    transition?.cancel();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      transition = props.frame().animate([{ opacity: 0.25 }, { opacity: 1 }], {
        duration: 300,
        easing: 'ease-out',
      });
    }
  };

  onMount(() => {
    const frame = props.frame();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) setAutoplay(false);
    let visible = typeof IntersectionObserver === 'undefined';
    let hovered = false;
    let focused = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    restartAutoplay = () => {
      clearTimeout(timer);
      if (
        !ready() ||
        !autoplay() ||
        !visible ||
        hovered ||
        focused ||
        window.document.hidden ||
        motion.matches
      )
        return;
      const duration =
        slide().label === 'Agents'
          ? 16000
          : slide().label === 'Docs'
            ? 14000
            : slide().label === 'CRM'
              ? 12000
              : slide().label === 'Tasks'
                ? 10000
                : 8000;
      timer = setTimeout(() => select(active() + 1, false), duration);
    };
    const motionChanged = () => {
      if (motion.matches) setAutoplay(false);
      restartAutoplay();
    };
    const pauseForUse = () => {
      setAutoplay(false);
      restartAutoplay();
    };
    const enter = () => {
      hovered = true;
      restartAutoplay();
    };
    const leave = () => {
      hovered = false;
      restartAutoplay();
    };
    const focus = () => {
      focused = true;
      restartAutoplay();
    };
    const blur = (event: FocusEvent) => {
      focused =
        event.relatedTarget instanceof Node &&
        root.contains(event.relatedTarget);
      restartAutoplay();
    };
    root.addEventListener('pointerenter', enter);
    root.addEventListener('pointerleave', leave);
    root.addEventListener('focusin', focus);
    root.addEventListener('focusout', blur);
    window.document.addEventListener('visibilitychange', restartAutoplay);
    motion.addEventListener?.('change', motionChanged);
    const visibility =
      typeof IntersectionObserver === 'undefined'
        ? undefined
        : new IntersectionObserver(
            ([entry]) => {
              visible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
              restartAutoplay();
            },
            { threshold: 0.35 }
          );
    visibility?.observe(root);
    const followNavigation = (event: Event) => {
      const target = event.target as Element | null;
      const button = target?.closest('.dummy-rail button[aria-label]');
      if (!button) return;
      const index = SLIDES.findIndex(
        (item) => item.target === button.getAttribute('aria-label')
      );
      if (index >= 0) {
        if (document?.querySelector('[data-homepage-demo]')) select(index);
        else setActive(index);
      }
    };
    const observer = new MutationObserver(() => {
      if (
        !buttonFor('Home') &&
        !document?.querySelector('[data-homepage-demo]')
      )
        return;
      observer.disconnect();
      setReady(true);
      showView();
      restartAutoplay();
    });
    const attach = () => {
      observer.disconnect();
      document?.removeEventListener('click', followNavigation);
      document?.removeEventListener('pointerdown', pauseForUse);
      document?.removeEventListener('keydown', pauseForUse);
      document = frame.contentDocument;
      document?.addEventListener('click', followNavigation);
      document?.addEventListener('pointerdown', pauseForUse);
      document?.addEventListener('keydown', pauseForUse);
      if (
        buttonFor('Home') ||
        document?.querySelector('[data-homepage-demo]')
      ) {
        setReady(true);
        showView();
        restartAutoplay();
      } else if (document?.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    };
    frame.addEventListener('load', attach);
    attach();
    onCleanup(() => {
      document?.removeEventListener('click', followNavigation);
      observer.disconnect();
      visibility?.disconnect();
      clearTimeout(timer);
      root.removeEventListener('pointerenter', enter);
      root.removeEventListener('pointerleave', leave);
      root.removeEventListener('focusin', focus);
      root.removeEventListener('focusout', blur);
      window.document.removeEventListener('visibilitychange', restartAutoplay);
      motion.removeEventListener?.('change', motionChanged);
      document?.removeEventListener('pointerdown', pauseForUse);
      document?.removeEventListener('keydown', pauseForUse);
      transition?.cancel();
      frame.removeEventListener('load', attach);
    });
  });

  return (
    <div
      ref={root}
      class="homepage-demo-carousel"
      aria-roledescription="carousel"
      role="region"
      aria-label="What you can do with Macro"
      onKeyDown={(event) => {
        if (
          !ready() ||
          (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
        )
          return;
        event.preventDefault();
        select(active() + (event.key === 'ArrowRight' ? 1 : -1));
      }}
      onPointerDown={(event) => {
        if (
          !ready() ||
          !event.isPrimary ||
          event.button !== 0 ||
          (event.target as Element).closest('button')
        )
          return;
        swipe = {
          x: event.clientX,
          y: event.clientY,
          pointerId: event.pointerId,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        if (!swipe || swipe.pointerId !== event.pointerId) return;
        const dx = event.clientX - swipe.x;
        const dy = event.clientY - swipe.y;
        swipe = undefined;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) && ready()) {
          select(active() + (dx < 0 ? 1 : -1));
        }
      }}
      onLostPointerCapture={() => {
        swipe = undefined;
      }}
      onPointerCancel={() => {
        swipe = undefined;
      }}
    >
      <div class="homepage-demo-stage-shell">
        <div class="homepage-demo-caption">
          <div class="homepage-demo-slide-controls">
            <For each={SLIDES}>
              {(item, index) => (
                <button
                  type="button"
                  class="homepage-demo-slide-dot"
                  aria-label={`Show ${item.label} highlight`}
                  aria-pressed={active() === index()}
                  disabled={!ready()}
                  onClick={() => select(index())}
                >
                  <span />
                </button>
              )}
            </For>
          </div>
          <div
            class="homepage-demo-slide-copy"
            aria-live={autoplay() ? 'off' : 'polite'}
            aria-atomic="true"
          >
            <h2>{slide().title.replaceAll('\n', ' ')}</h2>
          </div>
        </div>
        <button
          type="button"
          class="homepage-demo-arrow homepage-demo-arrow-previous"
          aria-label="Previous highlight"
          disabled={!ready()}
          onClick={() => select(active() - 1)}
        >
          <CarouselCaret direction="left" />
        </button>
        {props.children}
        <button
          type="button"
          class="homepage-demo-arrow homepage-demo-arrow-next"
          aria-label="Next highlight"
          disabled={!ready()}
          onClick={() => select(active() + 1)}
        >
          <CarouselCaret direction="right" />
        </button>
      </div>
    </div>
  );
}
