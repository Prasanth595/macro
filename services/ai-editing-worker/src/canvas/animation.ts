import {
  type GraphicsDocument,
  isShape,
  resolveConnector,
  shapeDefinition,
  worldMatrix,
} from '@macro-inc/graphics';
import {
  type ActionGuard,
  type PeerPresence,
  type PresenceShape,
  presenceItemState,
  presenceRegionOccupants,
} from '@macro-inc/graphics/loro';
import {
  plainRichText,
  richTextPlainText,
  validCanvasText,
} from '@macro-inc/lexical-core/canvas-text';
import { match } from 'ts-pattern';
import type { CanvasDependencies } from './dependencies';

export type CanvasPresentation = Pick<
  PeerPresence,
  'selectedIds' | 'cursor' | 'preview'
>;
export type CanvasAnimationStep =
  | { kind: 'awareness'; value: CanvasPresentation }
  | { kind: 'pause'; ms: number };

/** Native Canvas counterpart of the document queue: presentation steps, then one caller-owned commit. */
export function canvasAnimation(
  before: GraphicsDocument,
  after: GraphicsDocument,
  deps: CanvasDependencies
): CanvasAnimationStep[] {
  const occupants = presenceRegionOccupants(before, deps.regions);
  const guard: ActionGuard = {
    items: Object.fromEntries(
      [...new Set([...deps.reads, ...deps.writes, ...occupants])].map((id) => [
        id,
        presenceItemState(before.items[id]),
      ])
    ),
    regions: deps.regions,
    occupants,
  };
  const ids = [
    ...new Set(
      [...deps.writes, ...deps.reads].filter((id) => {
        const item = after.items[id] ?? before.items[id];
        return (
          isShape(item) && (deps.writes.has(id) || item.type === 'connector')
        );
      })
    ),
  ].slice(0, 100);
  const steps: CanvasAnimationStep[] = [];
  for (let frame = 0; frame <= 8; frame++) {
    const progress = frame / 8;
    const shapes: PresenceShape[] = [];
    for (const id of ids) {
      const source = before.items[id];
      let target = after.items[id] ?? source;
      if (!isShape(target)) continue;
      if (target.type === 'connector')
        target = resolveConnector(after.items[id] ? after : before, target);
      let item = target;
      if (item.type === 'text' && validCanvasText(item.geometry.content))
        item = {
          ...item,
          geometry: {
            ...item.geometry,
            content: plainRichText(
              richTextPlainText(item.geometry.content).slice(
                0,
                Math.ceil(
                  richTextPlainText(item.geometry.content).length * progress
                )
              )
            ),
          },
        };
      else
        item = match(item)
          .with(
            { type: 'rectangle' },
            { type: 'ellipse' },
            { type: 'connector' },
            (shape) => {
              const label = shape.geometry.label;
              if (!label || !validCanvasText(label.content)) return shape;
              const content = plainRichText(
                richTextPlainText(label.content).slice(
                  0,
                  Math.ceil(richTextPlainText(label.content).length * progress)
                ),
                'center'
              );
              return match(shape)
                .with({ type: 'rectangle' }, (shape) => ({
                  ...shape,
                  geometry: { ...shape.geometry, label: { ...label, content } },
                }))
                .with({ type: 'ellipse' }, (shape) => ({
                  ...shape,
                  geometry: { ...shape.geometry, label: { ...label, content } },
                }))
                .with({ type: 'connector' }, (shape) => ({
                  ...shape,
                  geometry: { ...shape.geometry, label: { ...label, content } },
                }))
                .exhaustive();
            }
          )
          .otherwise((shape) => shape);
      if (!after.items[id])
        item = {
          ...item,
          appearance: { ...item.appearance, opacity: 1 - progress },
        };
      if (item.type === 'connector') {
        const from =
          source?.type === 'connector'
            ? resolveConnector(before, source).geometry
            : undefined;
        const geometry = item.geometry;
        const start = from?.start.point ?? geometry.start.point;
        const end = from?.end.point ?? geometry.start.point;
        item = {
          ...item,
          geometry: {
            ...geometry,
            start: {
              ...geometry.start,
              point: {
                x: start.x + (geometry.start.point.x - start.x) * progress,
                y: start.y + (geometry.start.point.y - start.y) * progress,
              },
            },
            end: {
              ...geometry.end,
              point: {
                x: end.x + (geometry.end.point.x - end.x) * progress,
                y: end.y + (geometry.end.point.y - end.y) * progress,
              },
            },
          },
        };
      }
      const world = worldMatrix(after.items[id] ? after : before, id);
      const start = source ? worldMatrix(before, id) : world;
      const bounds = shapeDefinition(item.type).bounds(item);
      const oldBounds = isShape(source)
        ? shapeDefinition(source.type).bounds(source)
        : { width: 0, height: 0 };
      shapes.push({
        id,
        kind: item.type === 'ellipse' ? 'ellipse' : 'rectangle',
        width: oldBounds.width + (bounds.width - oldBounds.width) * progress,
        height:
          oldBounds.height + (bounds.height - oldBounds.height) * progress,
        world: [
          world[0],
          world[1],
          world[2],
          world[3],
          start[4] + (world[4] - start[4]) * progress,
          start[5] + (world[5] - start[5]) * progress,
        ],
        ...(item.type === 'rectangle' ||
        item.type === 'ellipse' ||
        item.type === 'text' ||
        item.type === 'connector'
          ? {
              item: {
                type: item.type,
                geometry: JSON.stringify(item.geometry),
                appearance: { ...item.appearance },
              },
            }
          : {}),
      });
    }
    const first = shapes[0];
    const value: CanvasPresentation = {
      selectedIds: ids,
      cursor: first ? { x: first.world[4], y: first.world[5] } : null,
      preview: { kind: 'ai', shapes, box: null, guard },
    };
    if (JSON.stringify(value).length > 100_000)
      return [{ kind: 'awareness', value: { ...value, preview: null } }];
    steps.push({ kind: 'awareness', value });
    if (frame < 8) steps.push({ kind: 'pause', ms: 100 });
  }
  return steps;
}

export async function runCanvasAnimation(
  steps: CanvasAnimationStep[],
  present: (value: CanvasPresentation | undefined) => void,
  signal: AbortSignal,
  check: () => void,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abort);
        resolve();
      }, ms);
      signal.addEventListener('abort', abort, { once: true });
    })
) {
  try {
    for (const step of steps) {
      signal.throwIfAborted();
      check();
      if (step.kind === 'awareness') present(step.value);
      else await sleep(step.ms);
    }
  } catch (error) {
    present(undefined);
    throw error;
  }
}
