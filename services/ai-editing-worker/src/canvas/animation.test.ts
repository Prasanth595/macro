import { createScene } from '@macro-inc/graphics';
import { describe, expect, it } from 'vitest';
import {
  type CanvasPresentation,
  canvasAnimation,
  runCanvasAnimation,
} from './animation';
import { dependencies } from './dependencies';
import { prepareCanvasEdit } from './operations';
import type { CanvasOp } from './schema';

describe('one batch concurrent presentation lanes', () => {
  it('presents three real regions together and clears all on cancellation', async () => {
    const before = createScene();
    const ops: CanvasOp[] = [0, 400, 800].map((x, index) => ({
      kind: 'create',
      id: `box-${index}`,
      type: 'rectangle',
      x,
      y: 0,
      width: 100,
      height: 80,
    }));
    const after = prepareCanvasEdit(before, ops);
    const steps = canvasAnimation(
      before,
      after,
      dependencies(before, after, ops)
    );
    const controller = new AbortController();
    const values: (CanvasPresentation | undefined)[] = [];
    await expect(
      runCanvasAnimation(
        steps,
        (value) => values.push(value),
        controller.signal,
        () => {},
        async () => {
          controller.abort();
        }
      )
    ).rejects.toThrow();
    expect(values[0]?.lanes).toHaveLength(3);
    expect(values[0]?.lanes?.flatMap((lane) => lane.itemIds).sort()).toEqual([
      'box-0',
      'box-1',
      'box-2',
    ]);
    expect(values[0]?.lanes?.every((lane) => lane.cursor !== null)).toBe(true);
    expect(values.at(-1)).toBeUndefined();
    expect(Object.keys(before.items)).toHaveLength(1);
  });
  it('keeps descendants of a group together', () => {
    const before = prepareCanvasEdit(createScene(), [
      { kind: 'create', id: 'a', type: 'rectangle', x: 0, y: 0 },
      { kind: 'create', id: 'b', type: 'ellipse', x: 400, y: 0 },
      { kind: 'group', id: 'g', ids: ['a', 'b'] },
    ]);
    const ops: CanvasOp[] = [{ kind: 'move', ids: ['g'], dx: 0, dy: 20 }];
    const after = prepareCanvasEdit(before, ops);
    const first = canvasAnimation(
      before,
      after,
      dependencies(before, after, ops)
    )[0];
    if (first.kind !== 'awareness') throw new Error('Missing presentation');
    expect(first.value.lanes).toBeUndefined();
    expect(first.value.preview?.shapes.map((shape) => shape.id).sort()).toEqual(
      ['a', 'b']
    );
  });
});
