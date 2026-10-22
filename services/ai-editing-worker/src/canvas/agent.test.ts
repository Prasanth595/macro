import { readLoroGraphicsDocument } from '@macro-inc/graphics/loro';
import { MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import { liveScene } from './test-fixtures';

// The production runner's worker-only WASM module is replaced with Node's
// build of the same QuickJS engine; command validation and execution are real.
vi.mock('../sandbox', async () => {
  const { getQuickJS } = await import('quickjs-emscripten');
  const { runCanvasCode } = await import('./sandbox');
  return {
    runCanvasInSandbox: async (code: string) =>
      runCanvasCode(await getQuickJS(), code),
  };
});
const { editCanvas } = await import('./agent');

describe('Canvas model loop', () => {
  it('retains acknowledged edits and completed usage when a later provider call fails', async () => {
    const scene = liveScene();
    let step = 0;
    const model = new MockLanguageModelV3({
      modelId: 'canvas-fixture',
      doGenerate: async () => {
        if (step++ > 0) throw new Error('Provider unavailable');
        return {
          content: [
            {
              type: 'tool-call',
              toolCallId: 'create-1',
              toolName: 'runCode',
              input: JSON.stringify({
                code: 'editor.create({type:"rectangle",x:0,y:0,width:100,height:50,text:"Keep me"})',
              }),
            },
          ],
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage: {
            inputTokens: {
              total: 10,
              noCache: 10,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: { total: 5, text: 5, reasoning: undefined },
          },
          warnings: [],
        };
      },
    });
    try {
      const result = await editCanvas(
        scene.source,
        'Make a diagram',
        model,
        new AbortController().signal
      );
      expect(result).toMatchObject({
        operationsApplied: 1,
        error: 'Provider unavailable',
        usage: [{ model: 'canvas-fixture', inputTokens: 10, outputTokens: 5 }],
      });
      expect(
        Object.keys(readLoroGraphicsDocument(scene.server, 'scene-root').items)
      ).toHaveLength(2);
      expect(scene.closed()).toBe(true);
    } finally {
      scene.server.free();
    }
  });
});
