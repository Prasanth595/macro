/**
 * Telemetry for opening a channel: one `channel.open` span per channel
 * surface, from its creation to the first frame that paints its messages.
 *
 * Opening a channel is the app's most frequent navigation, and its cost is
 * mostly main-thread work no request timing shows: rendering rows, measuring
 * them, mounting the composer. The span records each stage's distance from the
 * start, the long animation frames in between, and, when a click or key press
 * mounted the surface, the time from that input to the paint.
 *
 * `channel.open.painted_ms` is the number to watch: the `web.channel.open`
 * span metrics in `infra/stacks/monitoring` aggregate it in Datadog. Every
 * stage is also a `performance.measure` named `channel.open.<stage>`, so the
 * same phases show in a DevTools Performance recording.
 *
 * Failures here are swallowed: telemetry must never break opening a channel.
 */

import {
  afterLongFrames,
  afterPaint,
  observeLongFrames,
  summarizeFrames,
} from '@app/observability/long-frames';
import { inputHandledAt } from '@app/observability/ui-operation';
import { type Span, Telemetry } from '@macro-inc/observability';

/** What the surface opened to. */
export type ChannelOpenTarget = 'latest' | 'message' | 'restore';

/** How an open ended. */
type ChannelOpenOutcome =
  /** A frame painted the first messages, or the empty channel. */
  | 'painted'
  /** The first page of messages failed to load. */
  | 'failed'
  /** The surface unmounted before anything painted. */
  | 'abandoned'
  /** The tab was hidden, so no frame could paint. */
  | 'hidden'
  /** Nothing painted within {@link STALL_MS}; reported, not concluded. */
  | 'stalled';

/** A stage of the open, named as its measure and attribute suffix. */
type ChannelOpenStage =
  /** The first page of messages is available. */
  | 'timeline'
  /** The list laid out its first rows (or the empty channel rendered). */
  | 'rendered'
  /** The frame after `rendered` painted. */
  | 'painted';

/**
 * A span reaches the exporter only when it ends, so an open that never paints
 * would otherwise produce nothing at all.
 */
const STALL_MS = 15_000;
/** How long a render waits for its paint; a hidden tab runs no frames. */
const PAINT_TIMEOUT_MS = 5_000;

export type ChannelOpenTrace = {
  /** The first page of messages is ready; `cached` when it was at mount. */
  timeline: (entries: number, cached: boolean) => void;
  /** The first rows laid out; the trace ends once a frame paints them. */
  rendered: () => void;
  /** The first page failed to load. */
  fail: (error: unknown) => void;
  /** The surface unmounted. Ends an open that has not painted yet. */
  dispose: () => void;
};

const openSpans = new Map<string, Span>();

/** The open span of `channelId`, so its first requests can join the trace. */
export function resumeChannelOpenSpan(channelId: string): Span | undefined {
  return openSpans.get(channelId);
}

export function createChannelOpenTrace(
  channelId: string,
  target: ChannelOpenTarget
): ChannelOpenTrace {
  const startedAt = performance.now();
  const span = Telemetry.span('channel.open');
  const frames = observeLongFrames();
  let timelineRecorded = false;
  let rendering = false;
  let painted = false;
  let ended = false;

  const attr = (name: string, value: string | number | boolean) => {
    try {
      span.setAttr(name, typeof value === 'number' ? Math.round(value) : value);
    } catch {
      // See the module comment.
    }
  };
  const set = (name: string, value: string | number | boolean) =>
    attr(`channel.open.${name}`, value);

  const stage = (name: ChannelOpenStage, at: number) => {
    set(`${name}_ms`, at - startedAt);
    try {
      span.event(`channel.open.${name}`);
      performance.measure(`channel.open.${name}`, {
        start: startedAt,
        end: at,
        detail: { channelId },
      });
    } catch {
      // See the module comment.
    }
  };

  const end = (outcome: ChannelOpenOutcome, error?: unknown) => {
    if (ended) return;
    ended = true;
    clearTimeout(stallTimer);
    frames?.stop();
    if (openSpans.get(channelId) === span) openSpans.delete(channelId);
    set('outcome', outcome);
    try {
      if (error !== undefined) span.error(error);
      span.end();
    } catch {
      // See the module comment.
    }
  };

  const unpainted = (): ChannelOpenOutcome =>
    document.visibilityState === 'hidden' ? 'hidden' : 'stalled';
  const stallTimer = setTimeout(() => end(unpainted()), STALL_MS);

  attr('channel.id', channelId);
  set('target', target);
  set('hidden_at_start', document.visibilityState === 'hidden');
  // A second surface for the same channel (another split) takes over request
  // parenting; each span still ends with its own surface.
  openSpans.set(channelId, span);

  return {
    timeline: (entries, cached) => {
      if (ended || timelineRecorded) return;
      timelineRecorded = true;
      stage('timeline', performance.now());
      set('timeline_entries', entries);
      set('cache', cached ? 'hit' : 'miss');
    },
    rendered: () => {
      if (ended || rendering) return;
      rendering = true;
      stage('rendered', performance.now());
      afterPaint(PAINT_TIMEOUT_MS, (paintedAt) => {
        if (ended) return;
        if (paintedAt === undefined) return end(unpainted());
        painted = true;
        stage('painted', paintedAt);
        // Event Timing reports the input once it has painted, as it has now.
        const input = inputHandledAt(startedAt);
        if (input) {
          set('input_type', input.type);
          set('input_to_start_ms', startedAt - input.start);
          set('input_to_painted_ms', paintedAt - input.start);
        }
        afterLongFrames(frames, () => {
          const from = input?.start ?? startedAt;
          for (const [name, value] of Object.entries(
            summarizeFrames(frames, 'channel.open', from, paintedAt)
          ))
            attr(name, value);
          end('painted');
        });
      });
    },
    fail: (error) => end('failed', error),
    // A painted open only waits for its long frames; report it without them.
    dispose: () => end(painted ? 'painted' : 'abandoned'),
  };
}
