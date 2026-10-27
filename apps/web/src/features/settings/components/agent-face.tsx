import { cn } from '@ui';
import {
  createUniqueId,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from 'solid-js';
import { type AgentFaceShape, agentFaceLook } from '../core/agent-face';
import './agent-face.css';

/** Idle blinks and watches; thinking spins its outline; done redraws it in color. */
export type AgentFaceState = 'idle' | 'thinking' | 'done';

const OUTLINES: Record<AgentFaceShape, string> = {
  round: 'M31 62A29 29 0 1 1 89 62A29 29 0 1 1 31 62Z',
  leaf: 'M60 33L89 33L89 62A29 29 0 1 1 60 33Z',
  block:
    'M43 34H77A11 11 0 0 1 88 45V79A11 11 0 0 1 77 90H43A11 11 0 0 1 32 79V45A11 11 0 0 1 43 34Z',
};

/**
 * An agent's Line face: a monoline head in ink with one accent, on an app-icon
 * tile. Shape, mouth, and accent come from `seed` (the agent's @tag).
 */
export function AgentFace(props: {
  seed: string;
  state?: AgentFaceState;
  /** Eyes follow the pointer, for a large preview rather than list rows. */
  followPointer?: boolean;
  class?: string;
}) {
  const look = () => agentFaceLook(props.seed);
  const tileId = createUniqueId();
  let root!: SVGSVGElement;
  onMount(() => {
    if (!props.followPointer) return;
    const follow = (event: PointerEvent) => {
      const box = root.getBoundingClientRect();
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      const distance = Math.hypot(dx, dy) || 1;
      const reach = distance / (distance + 160);
      root.style.setProperty(
        '--agent-face-look-x',
        ((dx / distance) * reach).toFixed(3)
      );
      root.style.setProperty(
        '--agent-face-look-y',
        ((dy / distance) * reach).toFixed(3)
      );
    };
    window.addEventListener('pointermove', follow, { passive: true });
    onCleanup(() => window.removeEventListener('pointermove', follow));
  });
  return (
    <svg
      ref={root}
      viewBox="0 0 120 120"
      aria-hidden="true"
      data-agent-face
      data-state={props.state ?? 'idle'}
      class={cn('agent-face', props.class)}
      style={{
        '--agent-face-accent': `var(--color-${look().color})`,
        // Offset blinks so a list of agents doesn't blink in unison.
        '--agent-face-blink-delay': `${-(props.seed.length % 5) * 0.9}s`,
      }}
    >
      <defs>
        <linearGradient id={tileId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ 'stop-color': 'var(--color-surface-2)' }} />
          <stop offset="1" style={{ 'stop-color': 'var(--color-surface-1)' }} />
        </linearGradient>
      </defs>
      <rect
        x="9"
        y="8"
        width="102"
        height="102"
        rx="30"
        fill={`url(#${tileId})`}
      />
      <rect
        x="9.5"
        y="8.5"
        width="101"
        height="101"
        rx="29.5"
        class="agent-face-rim"
      />
      <path
        d={OUTLINES[look().shape]}
        pathLength="100"
        class="agent-face-outline"
      />
      <path
        d={OUTLINES[look().shape]}
        pathLength="100"
        class="agent-face-trace"
      />
      <Show when={look().shape === 'leaf'}>
        <circle cx="95" cy="27" r="3.8" class="agent-face-accent-fill" />
      </Show>
      <g class="agent-face-features">
        <For each={[53.5, 66.5]}>
          {(x) => (
            <g transform={`translate(${x} 57)`}>
              <ellipse rx="3.4" ry="3.4" class="agent-face-eye" />
              <path d="M-3.8 1.5Q0 -3.4 3.8 1.5" class="agent-face-happy" />
            </g>
          )}
        </For>
        <g transform="translate(60 71)">
          <Switch>
            <Match when={look().mouth === 'smile'}>
              <path
                d="M-6 -1Q0 4.5 6 -1"
                class="agent-face-mouth agent-face-mouth-accent"
              />
            </Match>
            <Match when={look().mouth === 'level'}>
              <path d="M-3.5 0H3.5" class="agent-face-mouth" />
            </Match>
            <Match when={look().mouth === 'cursor'}>
              <rect
                x="-4"
                y="-2.4"
                width="8"
                height="4.8"
                rx="1.4"
                class="agent-face-mouth agent-face-accent-fill"
              />
            </Match>
          </Switch>
          <path d="M-6.5 -1.5Q0 5.5 6.5 -1.5" class="agent-face-smile" />
        </g>
      </g>
    </svg>
  );
}
