import { createSignal, type JSX, onCleanup, onMount, Show } from 'solid-js';

const SLIDES = [
  {
    label: 'Inbox',
    target: 'Home',
    title: 'One inbox for emails, agents,\ntasks, and messages.',
    description: '',
  },
  {
    label: 'Chat',
    target: 'Chat',
    title: 'Chat with your team and your agents.',
    description:
      'Discuss the launch, share the source, and turn feedback into tasks.',
  },
  {
    label: 'Docs',
    target: 'Drive',
    title: 'Docs your team and agents can edit.',
    description:
      'Your team and agents edit the same document, with every change recorded.',
  },
  {
    label: 'CRM',
    target: 'Customers',
    title: 'CRM connected to every conversation.',
    description:
      'See emails, notes, tasks, and the next step alongside each company.',
  },
  {
    label: 'Tasks',
    target: 'Tasks',
    title: 'Tasks for your team and your agents.',
    description:
      'Assign work to people or agents without losing the original discussion.',
  },
  {
    label: 'Agents',
    target: 'Agents',
    title: 'Agents that work across your workspace.',
    description:
      'Ask an agent to read documents, check conversations, and act on tasks.',
  },
];

/** The live-site highlights over a workspace that is always interactive. */
export function HomepageDemoCarousel(props: {
  frame: () => HTMLIFrameElement;
  children?: JSX.Element;
}) {
  const [active, setActive] = createSignal(0);
  const [ready, setReady] = createSignal(false);
  let document: Document | null = null;
  let transition: Animation | undefined;
  let swipe: { x: number; y: number; pointerId: number } | undefined;
  const slide = () => SLIDES[active()];
  const buttonFor = (target: string) =>
    document?.querySelector<HTMLButtonElement>(
      `.dummy-rail button[aria-label="${target}"]`
    );
  const showView = () => {
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
  const select = (index: number) => {
    setActive((index + SLIDES.length) % SLIDES.length);
    showView();
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
    const followNavigation = (event: Event) => {
      const target = event.target as Element | null;
      const button = target?.closest('.dummy-rail button[aria-label]');
      if (!button) return;
      const index = SLIDES.findIndex(
        (item) => item.target === button.getAttribute('aria-label')
      );
      if (index >= 0) setActive(index);
    };
    const observer = new MutationObserver(() => {
      if (!buttonFor('Home')) return;
      observer.disconnect();
      setReady(true);
      showView();
    });
    const attach = () => {
      observer.disconnect();
      document?.removeEventListener('click', followNavigation);
      document = frame.contentDocument;
      document?.addEventListener('click', followNavigation);
      if (buttonFor('Home')) {
        setReady(true);
        showView();
      } else if (document?.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    };
    frame.addEventListener('load', attach);
    attach();
    onCleanup(() => {
      document?.removeEventListener('click', followNavigation);
      observer.disconnect();
      transition?.cancel();
      frame.removeEventListener('load', attach);
    });
  });

  return (
    <div
      class="homepage-demo-carousel"
      aria-roledescription="carousel"
      role="region"
      aria-label="What you can do with Macro"
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
      <div
        class="homepage-demo-slide-copy"
        aria-live="polite"
        aria-atomic="true"
      >
        <h2>{slide().title}</h2>
        <Show when={slide().description}>
          <p>{slide().description}</p>
        </Show>
      </div>
      <div
        class="homepage-demo-slide-controls"
        onKeyDown={(event) => {
          if (
            !ready() ||
            (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
          )
            return;
          event.preventDefault();
          select(active() + (event.key === 'ArrowRight' ? 1 : -1));
        }}
      >
        <button
          type="button"
          class="homepage-demo-arrow"
          aria-label="Previous highlight"
          disabled={!ready()}
          onClick={() => select(active() - 1)}
        >
          <span aria-hidden="true">←</span>
        </button>
        <span class="homepage-demo-current" aria-live="polite">
          {slide().label}
        </span>
        <button
          type="button"
          class="homepage-demo-arrow"
          aria-label="Next highlight"
          disabled={!ready()}
          onClick={() => select(active() + 1)}
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
      {props.children}
    </div>
  );
}
