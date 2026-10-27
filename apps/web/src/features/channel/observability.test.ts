import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { spans, input } = vi.hoisted(() => ({
  spans: [] as {
    name: string;
    attrs: Record<string, unknown>;
    ends: number;
    errors: unknown[];
  }[],
  input: { current: undefined as { type: string; start: number } | undefined },
}));

vi.mock('@macro-inc/observability', () => ({
  Telemetry: {
    span: (name: string) => {
      const record = {
        name,
        attrs: {} as Record<string, unknown>,
        ends: 0,
        errors: [] as unknown[],
      };
      spans.push(record);
      return {
        setAttr: (key: string, value: unknown) => {
          record.attrs[key] = value;
        },
        event: () => {},
        error: (error: unknown) => record.errors.push(error),
        end: () => {
          record.ends++;
        },
      };
    },
  },
}));
vi.mock('@app/observability/ui-operation', () => ({
  inputHandledAt: () => input.current,
}));

import {
  createChannelOpenTrace,
  noteChannelPrefetch,
  resumeChannelOpenSpan,
} from './observability';

describe('channel open telemetry', () => {
  let now = 100;
  let frames: FrameRequestCallback[];
  let visibility: DocumentVisibilityState;

  const runFrame = () => {
    const pending = frames.splice(0);
    for (const frame of pending) frame(now);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    now = 100;
    frames = [];
    visibility = 'visible';
    spans.length = 0;
    input.current = undefined;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(performance, 'measure').mockImplementation(
      () => ({}) as PerformanceMeasure
    );
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
      () => visibility
    );
    vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
      frames.push(frame);
      return frames.length;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('ends at the first paint with each stage measured from the start', () => {
    input.current = { type: 'click', start: 40 };
    const trace = createChannelOpenTrace('channel-1', 'latest');
    expect(resumeChannelOpenSpan('channel-1')).toBeDefined();

    now = 180;
    trace.timeline(42, false);
    now = 260;
    trace.rendered();
    runFrame();
    now = 300;
    runFrame();

    expect(spans).toHaveLength(1);
    expect(spans[0]?.ends).toBe(1);
    expect(spans[0]?.attrs).toMatchObject({
      'channel.id': 'channel-1',
      'channel.open.target': 'latest',
      'channel.open.cache': 'miss',
      'channel.open.timeline_entries': 42,
      'channel.open.timeline_ms': 80,
      'channel.open.rendered_ms': 160,
      'channel.open.painted_ms': 200,
      'channel.open.input_type': 'click',
      'channel.open.input_to_start_ms': 60,
      'channel.open.input_to_painted_ms': 260,
      'channel.open.outcome': 'painted',
    });
    // Later requests for the channel no longer join a finished open.
    expect(resumeChannelOpenSpan('channel-1')).toBeUndefined();
  });

  it('reports how far ahead a press prefetched the page, once', () => {
    now = 20;
    noteChannelPrefetch('channel-1');
    now = 100;
    createChannelOpenTrace('channel-1', 'latest').dispose();
    createChannelOpenTrace('channel-1', 'latest').dispose();

    expect(spans[0]?.attrs['channel.open.prefetch_lead_ms']).toBe(80);
    expect(spans[1]?.attrs).not.toHaveProperty('channel.open.prefetch_lead_ms');
  });

  it('ignores a prefetch that did not lead to this open', () => {
    noteChannelPrefetch('channel-1');
    now += 10_000;
    createChannelOpenTrace('channel-1', 'latest').dispose();

    expect(spans[0]?.attrs).not.toHaveProperty('channel.open.prefetch_lead_ms');
  });

  it('reports a surface that unmounts before painting as abandoned', () => {
    const trace = createChannelOpenTrace('channel-1', 'latest');
    trace.rendered();
    trace.dispose();
    runFrame();
    runFrame();

    expect(spans[0]?.ends).toBe(1);
    expect(spans[0]?.attrs['channel.open.outcome']).toBe('abandoned');
  });

  it('marks a failed first page as an error', () => {
    const error = new Error('timeline unavailable');
    const trace = createChannelOpenTrace('channel-1', 'message');
    trace.fail(error);
    trace.dispose();

    expect(spans[0]?.ends).toBe(1);
    expect(spans[0]?.errors).toEqual([error]);
    expect(spans[0]?.attrs['channel.open.outcome']).toBe('failed');
  });

  it('reports an open that cannot paint in a hidden tab', () => {
    const trace = createChannelOpenTrace('channel-1', 'restore');
    visibility = 'hidden';
    trace.rendered();
    vi.advanceTimersByTime(5_000);

    expect(spans[0]?.ends).toBe(1);
    expect(spans[0]?.attrs['channel.open.outcome']).toBe('hidden');
  });
});
