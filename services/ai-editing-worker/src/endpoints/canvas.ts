import { zValidator } from '@hono/zod-validator';
import { Telemetry } from '@macro-inc/observability';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { editCanvas } from '../canvas/agent';
import { withCanvasSession } from '../canvas/session';
import { tokenAccessLevel } from '../document-token';
import { type Bindings, getEnv } from '../env';
import { createWorkerSyncSource } from '../sources';
import { buildModels } from './edit';

const body = z
  .object({
    documentId: z.string().uuid(),
    documentToken: z.string().min(1).max(10000),
    request: z.discriminatedUnion('action', [
      z
        .object({
          action: z.literal('read'),
          itemIds: z.array(z.string().max(200)).max(100).optional(),
        })
        .strict(),
      z
        .object({
          action: z.literal('edit'),
          instructions: z.string().min(1).max(20000),
          editorName: z.string().trim().min(1).max(200).optional(),
        })
        .strict(),
    ]),
  })
  .strict();
const app = new Hono<{ Bindings: Bindings }>();
app.use('*', bodyLimit({ maxSize: 64 * 1024 }));
app.post('/', zValidator('json', body), async (c) => {
  const { documentId, documentToken, request } = c.req.valid('json');
  // Comment tokens can connect and send some updates. Do not let them edit a scene.
  // A forged edit claim still fails signature verification on initial sync, before the model starts.
  if (
    request.action === 'edit' &&
    !['edit', 'owner'].includes(tokenAccessLevel(documentToken) ?? '')
  )
    return c.json({ error: 'Editing a canvas requires edit access.' }, 403);
  const signal = AbortSignal.any([
    c.req.raw.signal,
    AbortSignal.timeout(120_000),
  ]);
  try {
    return c.json(
      await Telemetry.span('canvas.ai.session', async (span) => {
        span.setAttr('document.id', documentId);
        span.setAttr('edit.action', request.action);
        // The sync service verifies the scoped token and enforces edit permission on writes.
        const url = new URL(
          `${c.env.SYNC_WS_BASE}/document/${documentId}/connect`
        );
        url.searchParams.set('token', documentToken);
        const trace = span.traceparent();
        if (trace) url.searchParams.set('traceparent', trace);
        if (request.action === 'read')
          return withCanvasSession(
            createWorkerSyncSource(url.toString(), documentId, signal),
            signal,
            async (session) => ({
              canvas: session.read(request.itemIds),
              operationsApplied: 0,
              summary: 'Read the current canvas.',
              usage: [],
            })
          );
        const model = buildModels(
          getEnv(c.env),
          {
            fast: [
              { provider: 'openai', model: 'gpt-5.5' },
              { provider: 'anthropic', model: 'claude-haiku-4-5' },
            ],
          },
          'fast'
        ).fast;
        const result = await editCanvas(
          createWorkerSyncSource(url.toString(), documentId, signal),
          request.instructions,
          model,
          signal,
          request.editorName
        );
        span.setAttr('edit.ops_total', result.operationsApplied);
        span.setAttr(
          'edit.outcome',
          'error' in result ? 'stopped' : 'completed'
        );
        if ('error' in result) span.error(new Error('Canvas editing stopped.'));
        return result;
      })
    );
  } catch (error) {
    return c.json(
      {
        error: signal.aborted
          ? 'Canvas edit cancelled or timed out. Read the canvas before retrying; earlier edits may have applied.'
          : error instanceof Error
            ? error.message
            : 'Canvas operation failed.',
      },
      502
    );
  }
});
export default app;
