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
  it('passes requested tool images and final review images as native model content', async () => {
    const scene = liveScene();
    let step = 0;
    let toolImage = false,
      reviewImage = false;
    const model = new MockLanguageModelV3({
      modelId: 'vision-fixture',
      doGenerate: async ({ prompt }) => {
        const current = step++;
        if (current === 1)
          toolImage = prompt.some(
            (message) =>
              message.role === 'tool' &&
              message.content.some(
                (part) =>
                  part.type === 'tool-result' &&
                  part.output.type === 'content' &&
                  part.output.value.some((value) => value.type === 'image-data')
              )
          );
        if (current === 3)
          reviewImage = prompt.some(
            (message) =>
              message.role === 'user' &&
              message.content.some(
                (part) => part.type === 'file' && part.mediaType === 'image/png'
              )
          );
        return {
          content:
            current === 0
              ? [
                  {
                    type: 'tool-call',
                    toolCallId: 'render-1',
                    toolName: 'renderCanvas',
                    input: '{}',
                  },
                ]
              : current === 1
                ? [
                    {
                      type: 'tool-call',
                      toolCallId: 'create-1',
                      toolName: 'runCode',
                      input: JSON.stringify({
                        code: 'editor.create({type:"rectangle",x:0,y:0,width:100,height:80})',
                      }),
                    },
                  ]
                : [{ type: 'text', text: 'Complete.' }],
          finishReason: {
            unified: current < 2 ? 'tool-calls' : 'stop',
            raw: undefined,
          },
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
        'Add one box',
        model,
        new AbortController().signal,
        'Macro',
        {
          render: async () => ({
            revision: 'frozen',
            clock: {},
            crop: { x: 0, y: 0, width: 100, height: 100 },
            width: 100,
            height: 100,
            objects: [],
            unavailable: [],
            textLayout: [],
            modelMedia: [
              { type: 'image', mediaType: 'image/png', data: 'iVBORw0KGgo=' },
            ],
          }),
        }
      );
      expect(result.operationsApplied).toBe(1);
      expect(toolImage).toBe(true);
      expect(reviewImage).toBe(true);
    } finally {
      scene.server.free();
    }
  });

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
