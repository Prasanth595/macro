import { fireAndForget } from '@core/util/fireAndForget';
import type { CacheHost } from '@graphql-cache/host/types';
import { Telemetry } from '@macro-inc/observability';
import {
  type Accessor,
  createMemo,
  createRenderEffect,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';
import {
  beginCollectionCoverageScan,
  type CollectionCoverageScan,
} from '../collection-coverage';

/** One foreground network scan, separate from the persisted completed scope. */
export function createCollectionCoverage(options: {
  host: Accessor<CacheHost | undefined>;
  request: Accessor<
    | {
        userId: string;
        scope: string;
        filters: Record<string, unknown>;
      }
    | undefined
  >;
}) {
  const request = createMemo(options.request, undefined, {
    equals: (previous, next) =>
      JSON.stringify(previous) === JSON.stringify(next),
  });
  const [readyFor, setReadyFor] = createSignal<{
    request: NonNullable<ReturnType<typeof request>>;
    host: CacheHost;
  }>();
  const ready = () => {
    const current = request();
    const host = options.host();
    if (!current || !host || host.disabled || !host.collectionCoverage)
      return true;
    const settled = readyFor();
    return settled?.request === current && settled.host === host;
  };
  const [failed, setFailed] = createSignal(false);
  let initialization = Promise.resolve();
  let finish = async (_keys: readonly string[]) => {};

  createRenderEffect(
    on([request, options.host], ([current, host]) => {
      finish = async () => {};
      setFailed(false);
      if (!current || !host || host.disabled || !host.collectionCoverage) {
        initialization = Promise.resolve();
        setReadyFor(undefined);
        return;
      }
      setReadyFor(undefined);
      let active = true;
      let publishing = false;
      let published = false;
      let scan: CollectionCoverageScan | undefined;
      onCleanup(() => {
        active = false;
      });
      finish = async (keys) => {
        if (!active || !scan || publishing || published) return;
        publishing = true;
        try {
          const appended = await scan.append(keys);
          if (!active) return;
          if (!appended) {
            setFailed(true);
            return;
          }
          const completed = await scan.complete();
          if (!active) return;
          published = completed;
          if (!completed) setFailed(true);
        } catch (error) {
          if (active) setFailed(true);
          throw error;
        } finally {
          publishing = false;
        }
      };
      const begin = async () => {
        try {
          const generation = await host.currentStorageGeneration();
          if (!active) return;
          const started = await beginCollectionCoverageScan(
            host,
            current.userId,
            generation,
            { kind: 'filter', filters: current.filters }
          );
          if (!active) return;
          scan = started;
        } catch (error) {
          // Metadata failure never blocks displaying or retrying network rows.
          Telemetry.error(error, {
            'error.source': 'soup-collection-coverage',
          });
        } finally {
          if (active) setReadyFor({ request: current, host });
        }
      };
      initialization = begin();
      fireAndForget(initialization, 'soup-collection-coverage');
    })
  );

  return {
    ready,
    failed,
    waitUntilReady: () => initialization,
    finish: (keys: readonly string[]) => finish(keys),
  };
}
