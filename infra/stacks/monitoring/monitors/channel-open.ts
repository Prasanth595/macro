// Channel open performance, from the browser's `channel.open` span
// (apps/web/src/features/channel/observability.ts).
//
// New span-based metrics, not adopted from the UI. Datadog computes them from
// every ingested span before retention sampling, so they cover each traced
// open; browser traces are sent only where PostHog's `enable-browser-otel`
// flag is on.
import * as datadog from '@pulumi/datadog';

const CHANNEL_OPEN = 'service:web-app @channel.open.outcome:*';

const BY_ENVIRONMENT = { path: 'env', tagName: 'env' };
const BY_CACHE = { path: '@channel.open.cache', tagName: 'cache' };
const BY_TARGET = { path: '@channel.open.target', tagName: 'target' };

// From the channel surface's creation to the first frame that paints its
// messages: the time a person waits once the app has started the open.
new datadog.SpansMetric('web-channel-open-painted', {
  name: 'web.channel.open.painted',
  compute: {
    aggregationType: 'distribution',
    path: '@channel.open.painted_ms',
    includePercentiles: true,
  },
  filter: { query: 'service:web-app @channel.open.outcome:painted' },
  groupBies: [BY_ENVIRONMENT, BY_CACHE, BY_TARGET],
});

// From the click or key press that opened the channel to that paint, when the
// input mounted the surface synchronously: the delay a person perceives.
new datadog.SpansMetric('web-channel-open-input-to-painted', {
  name: 'web.channel.open.input_to_painted',
  compute: {
    aggregationType: 'distribution',
    path: '@channel.open.input_to_painted_ms',
    includePercentiles: true,
  },
  filter: {
    query:
      'service:web-app @channel.open.outcome:painted @channel.open.input_to_painted_ms:*',
  },
  groupBies: [BY_ENVIRONMENT, BY_CACHE],
});

// Every open by outcome, so failed, abandoned, and stalled opens show as a
// share of all of them.
new datadog.SpansMetric('web-channel-open-count', {
  name: 'web.channel.open.count',
  compute: { aggregationType: 'count' },
  filter: { query: CHANNEL_OPEN },
  groupBies: [
    BY_ENVIRONMENT,
    { path: '@channel.open.outcome', tagName: 'outcome' },
  ],
});
