import { describe, expect, it } from 'vitest';
import {
  resolveBindings,
  scheduleLabel,
  type TemplateVariable,
} from './template';

const variables: TemplateVariable[] = [
  { key: 'agent', label: 'Agent', description: '', kind: 'agent' },
  {
    key: 'schedule',
    label: 'Schedule',
    description: '',
    kind: 'schedule',
    fixed: { kind: 'schedule', cron: '0 0 9 * * 2', timezone: 'UTC' },
  },
  { key: 'channel', label: 'Channel', description: '', kind: 'channel' },
];

describe('resolveBindings', () => {
  it('uses the viewer’s values over fixed ones and reports what is missing', () => {
    const { bindings, missing } = resolveBindings(variables, {
      channel: { kind: 'entity', id: 'c1', name: 'ops' },
    });
    expect(missing).toEqual(['agent']);
    expect(bindings.schedule).toEqual(variables[1].fixed);
    expect(bindings.channel).toEqual({ kind: 'entity', id: 'c1', name: 'ops' });
  });

  it('treats a value of the wrong shape as missing', () => {
    const { missing } = resolveBindings(variables, {
      agent: { kind: 'text', text: 'not an agent' },
      channel: { kind: 'user', userId: 'macro|a@macro.com' },
    });
    expect(missing).toEqual(['agent', 'channel']);
  });
});

describe('scheduleLabel', () => {
  it('describes presets and keeps unusual expressions as written', () => {
    expect(scheduleLabel('0 0 9 * * 2', 'UTC')).toBe(
      'Every Mon at 09:00 (UTC)'
    );
    expect(scheduleLabel('0 30 8 * * *', 'Europe/Paris')).toBe(
      'Every day at 08:30 (Europe/Paris)'
    );
    expect(scheduleLabel('0 0 9 * * Mon', 'UTC')).toBe('0 0 9 * * Mon (UTC)');
  });
});
