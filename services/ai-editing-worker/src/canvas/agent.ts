import {
  generateText,
  hasToolCall,
  type LanguageModel,
  stepCountIs,
  tool,
} from 'ai';
import { z } from 'zod';
import { TokenTracker } from '../ai-editing/token-tracker';
import { runCanvasInSandbox } from '../sandbox';
import SYSTEM from './prompt.md';
import {
  type CanvasSource,
  CanvasWriteError,
  withCanvasSession,
} from './session';

export async function editCanvas(
  source: CanvasSource,
  instructions: string,
  model: LanguageModel,
  signal: AbortSignal,
  editorName?: string
) {
  const uncertainWrite = new AbortController();
  const editSignal = AbortSignal.any([signal, uncertainWrite.signal]);
  let operationsApplied = 0;
  const tracker = new TokenTracker();
  try {
    return await withCanvasSession(
      source,
      signal,
      async (session) => {
        let clarification: string | undefined;
        let pendingSnippet = Promise.resolve();
        const result = await generateText({
          model,
          system: SYSTEM,
          prompt: `Request: ${instructions}\n\n<canvas-data>${session.read()}</canvas-data>`,
          abortSignal: editSignal,
          stopWhen: [stepCountIs(6), hasToolCall('reportBlocked')],
          onStepFinish: (step) => {
            tracker.add({ modelId: step.response.modelId }, step.usage);
          },
          tools: {
            readCanvas: tool({
              description: 'Read the current merged live scene.',
              inputSchema: z.object({
                itemIds: z.array(z.string().max(200)).max(100).optional(),
              }),
              execute: async ({ itemIds }) => session.read(itemIds),
            }),
            runCode: tool({
              description:
                'Run bounded JavaScript with the editor SDK. One snippet validates fully before committing. Returns the changed scene. Do not repeat a successful create.',
              inputSchema: z.object({ code: z.string().max(50_000) }),
              execute: ({ code }) => {
                // A provider may emit parallel calls; serialize them through acknowledgement.
                const work = pendingSnippet.then(async () => {
                  editSignal.throwIfAborted();
                  const ops = await runCanvasInSandbox(code);
                  editSignal.throwIfAborted();
                  const outcome = await session
                    .apply(ops)
                    .catch((error: unknown) => {
                      if (error instanceof CanvasWriteError)
                        uncertainWrite.abort(error);
                      throw error;
                    });
                  operationsApplied += outcome.operationsApplied;
                  return outcome;
                });
                pendingSnippet = work.then(
                  () => {},
                  () => {}
                );
                return work;
              },
            }),
            reportBlocked: tool({
              description:
                'Explain missing information or unsupported operations.',
              inputSchema: z.object({ message: z.string().max(2000) }),
              execute: async ({ message }) => {
                clarification = message;
                return message;
              },
            }),
          },
        });
        if (!operationsApplied && !clarification)
          throw new Error('No Canvas edits were applied.');
        return {
          operationsApplied,
          summary:
            result.text ||
            (result.finishReason === 'tool-calls'
              ? `Applied ${operationsApplied} canvas operations before reaching the step limit. ReadCanvas and review before continuing.`
              : `Applied ${operationsApplied} canvas operations.`),
          clarification,
          usage: tracker.toEntries(),
        };
      },
      editorName
    );
  } catch (error) {
    // Retain completed provider usage even when a later step/flush fails.
    return {
      operationsApplied,
      summary: `Stopped after ${operationsApplied} acknowledged canvas operations.`,
      usage: tracker.toEntries(),
      error:
        error instanceof Error
          ? error.message
          : 'Canvas editing failed. Read the canvas before retrying.',
    };
  }
}
