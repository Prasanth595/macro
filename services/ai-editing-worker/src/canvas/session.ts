import { schema } from '@loro-mirror/core';
import { createAwareness } from '@macro-inc/collaboration/collab/awareness';
import { SyncEngine } from '@macro-inc/collaboration/collab/engine';
import { LoroManager } from '@macro-inc/collaboration/collab/manager';
import type {
  InitialSync,
  LiveSyncSource,
  SyncError,
} from '@macro-inc/collaboration/collab/source';
import {
  InMemoryWALStore,
  WALSyncer,
} from '@macro-inc/collaboration/collab/wal';
import {
  type GraphicsDocument,
  worldBounds,
  worldMatrix,
} from '@macro-inc/graphics';
import {
  createLoroGraphicsBackendFromDoc,
  type PeerPresence,
} from '@macro-inc/graphics/loro';
import {
  richTextPlainText,
  validCanvasText,
} from '@macro-inc/lexical-core/canvas-text';
import { Telemetry } from '@macro-inc/observability';
import type { ResultAsync } from 'neverthrow';
import { createRoot } from 'solid-js';
import { prepareCanvasEdit } from './operations';
import type { CanvasOp } from './schema';

export type CanvasSource = LiveSyncSource & {
  doInitialSync(): ResultAsync<InitialSync, SyncError>;
};

/** A committed update may already have reached peers; never replay its intent. */
export class CanvasWriteError extends Error {}

/** Open only the server's winning seed, never independently seed a live room. */
export async function withCanvasSession<T>(
  source: CanvasSource,
  signal: AbortSignal,
  run: (session: {
    read: (itemIds?: string[]) => string;
    apply: (
      ops: CanvasOp[]
    ) => Promise<{ operationsApplied: number; canvas: string }>;
  }) => Promise<T>,
  editorName = 'Macro'
): Promise<T> {
  const manager = new LoroManager(schema({}), {
    documentId: source.documentId,
    mirror: false,
  });
  let lastAppend = Promise.resolve();
  class CanvasWAL extends WALSyncer<Uint8Array> {
    override append(update: Uint8Array): Promise<void> {
      const previous = lastAppend;
      const work = super.append(update);
      lastAppend = Promise.all([previous, work]).then(() => {});
      return lastAppend;
    }
  }
  const wal = new CanvasWAL(new InMemoryWALStore<Uint8Array>(), (updates) =>
    source.pushUpdate(updates)
  );
  let engine: { stop(): void } | undefined;
  let disposeBackend = () => {};
  let stopManager = () => {};
  let stopPresence = () => {};
  let clearPresence = () => {};
  try {
    signal.throwIfAborted();
    const initial = await Telemetry.span(
      'canvas.ai.sync_init',
      async () => await source.doInitialSync()
    );
    if (initial.isErr())
      throw new Error(
        `Canvas sync failed (${initial.error.type}). Open the canvas in Macro before editing.`
      );
    const loaded = await manager.initializeFromSnapshot(initial.value.snapshot);
    if (loaded.isErr()) throw new Error('Invalid canvas snapshot.');
    const doc = manager.doc;
    const meta = doc.getMap('canvasMeta');
    const rootId = meta.get('rootId');
    if (meta.get('format') !== 1 || typeof rootId !== 'string')
      throw new Error(
        'Unsupported shared canvas. Open the canvas in Macro to initialize it.'
      );
    // Full-width random session IDs cannot collide across worker isolates.
    // Durable bot attribution comes from the signed actor, not this peer range.
    const peer = manager.peerId;
    source.registerPeerId(peer);
    const backend = createLoroGraphicsBackendFromDoc(
      doc,
      rootId,
      () => !signal.aborted && manager.doc === doc
    );
    disposeBackend = backend.dispose;
    const awareness = createRoot((dispose) => {
      stopPresence = dispose;
      return createAwareness<string, PeerPresence | null>(
        doc.peerIdStr,
        undefined,
        { encode: JSON.stringify, decode: () => null }
      );
    });
    const activeEngine = new SyncEngine({
      loroManager: manager,
      awareness,
      syncs: { wal, live: source },
      bindings: { onRemoteState: () => {} },
    });
    engine = activeEngine;
    stopManager = manager.onStateChange((state) =>
      queueMicrotask(() => activeEngine.onStateUpdate(state))
    );
    activeEngine.start();
    clearPresence = () => {
      awareness.updateLocalAwareness(undefined);
      activeEngine.onLocalAwarenessChange();
    };
    const check = () => {
      signal.throwIfAborted();
      if (manager.doc !== doc)
        throw new Error(
          'Canvas reconnected with a replacement snapshot. Read the canvas before retrying; earlier edits may have applied.'
        );
    };
    const read = (itemIds?: string[]) => {
      check();
      return describeCanvas(backend.getDocument(), itemIds);
    };
    const result = await run({
      read,
      async apply(ops) {
        check();
        // No await between reading the merged scene, validation and its one local commit.
        const next = prepareCanvasEdit(backend.getDocument(), ops);
        check();
        const selectedIds = [
          ...new Set(ops.flatMap((op) => ('ids' in op ? op.ids : [op.id]))),
        ]
          .filter((id) => next.items[id])
          .slice(0, 100);
        const first = selectedIds[0];
        const bounds = first ? worldBounds(next, first) : undefined;
        awareness.updateLocalAwareness({
          id: doc.peerIdStr,
          name: editorName.endsWith('(AI)')
            ? editorName.slice(0, 200)
            : `${editorName.slice(0, 190)} (AI)`,
          color: 'cyan',
          cursor: bounds ? { x: bounds.x, y: bounds.y } : null,
          selectedIds,
          clock: backend.getClock(),
          preview: null,
        });
        activeEngine.onLocalAwarenessChange();
        await Telemetry.span('canvas.ai.apply', async (span) => {
          span.setAttr('edit.ops_total', ops.length);
          backend.commit(next);
          try {
            await lastAppend;
            await wal.flush();
            if ((await wal.summary()).dirty)
              throw new Error('Canvas write acknowledgement was lost.');
          } catch {
            throw new CanvasWriteError(
              'Canvas write acknowledgement was lost. Read the canvas before retrying; the edit may have applied.'
            );
          }
        });
        return { operationsApplied: ops.length, canvas: read() };
      },
    });
    await Telemetry.span('canvas.ai.flush', async () => {
      await lastAppend;
      await wal.flush();
      if ((await wal.summary()).dirty)
        throw new Error(
          'Canvas edits were not acknowledged. Read the canvas before retrying.'
        );
    });
    return result;
  } finally {
    clearPresence();
    stopPresence();
    stopManager();
    engine?.stop();
    disposeBackend();
    wal.destroy();
    manager.dispose();
    source.cleanup();
  }
}

/** Bounded scene inspection includes stable IDs, local/world geometry and order. */
export function describeCanvas(
  document: GraphicsDocument,
  itemIds?: string[]
): string {
  const all = Object.values(document.items).filter(
    (item) => item.type !== 'surface'
  );
  const selected = itemIds
    ? all.filter((item) => itemIds.includes(item.id))
    : all;
  const items = selected.slice(0, 300).map((item) => {
    const content =
      item.type === 'text'
        ? item.geometry.content
        : 'geometry' in item && 'label' in item.geometry
          ? item.geometry.label?.content
          : undefined;
    return {
      ...item,
      text:
        content && validCanvasText(content)
          ? richTextPlainText(content).slice(0, 2000)
          : undefined,
      world: worldMatrix(document, item.id),
      bounds: worldBounds(document, item.id),
    };
  });
  const text = JSON.stringify(
    {
      rootId: document.rootId,
      totalItems: all.length,
      matchedItems: selected.length,
      truncated: selected.length > 300,
      items,
    },
    (key, value: unknown) =>
      key === 'content'
        ? undefined
        : key === 'points' && Array.isArray(value)
          ? value.slice(0, 64)
          : value
  );
  if (text.length > 500_000)
    throw new Error(
      'Canvas too large for AI inspection. Reduce its content before editing.'
    );
  return text;
}
