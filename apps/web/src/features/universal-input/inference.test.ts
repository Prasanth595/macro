import { beforeEach, expect, it, vi } from 'vitest';
import { createInferenceSource } from './inference';

const { extract } = vi.hoisted(() => ({ extract: vi.fn() }));
vi.mock('@service-cognition/universal-input', () => ({
  universalInputClient: { extract },
}));
beforeEach(() => extract.mockReset());

it('waits for the task field catalog before invoking extraction', async () => {
  const catalog = [{ name: 'Priority', options: ['Urgent'] }];
  let ready!: (value: typeof catalog) => void;
  const properties = () =>
    new Promise<typeof catalog>((resolve) => {
      ready = resolve;
    });
  const source = createInferenceSource('me', properties);
  const result = source.extract('Fix clicks\npriority urgent', 'task', 7);
  expect(extract).not.toHaveBeenCalled();
  ready(catalog);
  await result;
  expect(extract).toHaveBeenCalledWith(
    'Fix clicks\npriority urgent',
    'task',
    7,
    catalog
  );
});

it('extracts email immediately without waiting for unrelated task metadata', async () => {
  const properties = vi.fn(
    () => new Promise<{ name: string; options: string[] }[]>(() => {})
  );
  await createInferenceSource('me', properties).extract(
    'Email Julia',
    'email',
    2
  );
  expect(properties).not.toHaveBeenCalled();
  expect(extract).toHaveBeenCalledWith('Email Julia', 'email', 2, []);
});
