import { createLoroGraphicsBackendFromDoc } from '@macro-inc/graphics/loro';
import { okAsync } from 'neverthrow';
import { describe, expect, it } from 'vitest';
import { prepareCanvasEdit } from './operations';
import { withCanvasSession } from './session';
import { liveScene } from './test-fixtures';

describe('live Canvas editing sessions', () => {
  it('reads without writes and always closes the source', async () => {
    const scene = liveScene();
    try {
      const read = await withCanvasSession(
        scene.source,
        new AbortController().signal,
        async (session) => session.read()
      );
      expect(JSON.parse(read)).toMatchObject({
        totalItems: 0,
        truncated: false,
      });
      expect(scene.writes()).toBe(0);
      expect(scene.closed()).toBe(true);
    } finally {
      scene.server.free();
    }
  });

  it('keeps remote human items arriving between model reads and applies', async () => {
    const scene = liveScene();
    try {
      await withCanvasSession(
        scene.source,
        new AbortController().signal,
        async (session) => {
          session.read();
          const human = createLoroGraphicsBackendFromDoc(
            scene.server,
            'scene-root'
          );
          const update = Promise.withResolvers<Uint8Array>();
          human.subscribeUpdates(update.resolve);
          human.commit(
            prepareCanvasEdit(human.getDocument(), [
              {
                kind: 'create',
                id: 'human',
                type: 'ellipse',
                x: 20,
                y: 20,
                width: 50,
                height: 50,
              },
            ])
          );
          const bytes = await update.promise;
          // Engine imports immediately through its real remote-update entry point.
          scene.send({ type: 'update', update: bytes });
          const result = await session.apply([
            {
              kind: 'create',
              id: 'bot',
              type: 'rectangle',
              x: 100,
              y: 20,
              width: 50,
              height: 50,
            },
          ]);
          expect(result.operationsApplied).toBe(1);
          human.dispose();
        }
      );
      const result = createLoroGraphicsBackendFromDoc(
        scene.server,
        'scene-root'
      );
      expect(Object.keys(result.getDocument().items).sort()).toEqual([
        'bot',
        'human',
        'scene-root',
      ]);
      result.dispose();
      expect(scene.closed()).toBe(true);
    } finally {
      scene.server.free();
    }
  });

  it('waits for the actual server acknowledgement before reporting success', async () => {
    const scene = liveScene();
    const sent = Promise.withResolvers<void>();
    const ack = Promise.withResolvers<boolean>();
    scene.source.pushUpdate = async (updates) => {
      updates.forEach((update) => scene.server.import(update));
      sent.resolve();
      return ack.promise;
    };
    let finished = false;
    try {
      const work = withCanvasSession(
        scene.source,
        new AbortController().signal,
        async (session) =>
          session.apply([
            {
              kind: 'create',
              id: 'bot',
              type: 'rectangle',
              x: 0,
              y: 0,
              width: 50,
              height: 50,
            },
          ])
      ).then((result) => {
        finished = true;
        return result;
      });
      await sent.promise;
      expect(finished).toBe(false);
      ack.resolve(true);
      expect((await work).operationsApplied).toBe(1);
      expect(scene.closed()).toBe(true);
    } finally {
      scene.server.free();
    }
  });

  it('reports an uncertain write if the server received it but the acknowledgement was lost', async () => {
    const scene = liveScene();
    scene.source.pushUpdate = async (updates) => {
      updates.forEach((update) => scene.server.import(update));
      return false;
    };
    try {
      await expect(
        withCanvasSession(
          scene.source,
          new AbortController().signal,
          async (session) =>
            session.apply([
              {
                kind: 'create',
                id: 'bot',
                type: 'rectangle',
                x: 0,
                y: 0,
                width: 50,
                height: 50,
              },
            ])
        )
      ).rejects.toThrow('may have applied');
      expect(scene.closed()).toBe(true);
    } finally {
      scene.server.free();
    }
  });

  it('cancels before mutation and cleans up invalid initial snapshots', async () => {
    const scene = liveScene();
    const controller = new AbortController();
    try {
      await expect(
        withCanvasSession(scene.source, controller.signal, async (session) => {
          controller.abort();
          return session.apply([
            {
              kind: 'create',
              id: 'bot',
              type: 'rectangle',
              x: 0,
              y: 0,
              width: 50,
              height: 50,
            },
          ]);
        })
      ).rejects.toThrow();
      expect(scene.writes()).toBe(0);
      expect(scene.closed()).toBe(true);
      scene.source.doInitialSync = () =>
        okAsync({
          snapshot: new Uint8Array([1, 2, 3]),
          awareness: new Uint8Array(),
        });
      await expect(
        withCanvasSession(
          scene.source,
          new AbortController().signal,
          async (session) => session.read()
        )
      ).rejects.toThrow('Invalid canvas snapshot');
    } finally {
      scene.server.free();
    }
  });
});
