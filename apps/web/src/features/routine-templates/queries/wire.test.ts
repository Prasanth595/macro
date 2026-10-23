import type { TemplateView } from '@service-scheduled-action/generated/schemas';
import { describe, expect, it } from 'vitest';
import {
  applyShareEdits,
  bindingsFromWire,
  bindingsToWire,
  templateFromWire,
} from './wire';

const view: TemplateView = {
  id: 't1',
  owner: 'macro|creator@macro.com',
  source_action_id: 'a1',
  created_at: '2026-10-23T00:00:00Z',
  updated_at: '2026-10-23T00:00:00Z',
  name: 'Digest',
  description: 'Posts a digest.',
  task: {
    target: { $var: 'agent' },
    prompt: '',
    user_prompt:
      'Post to <m-template-variable>{"key":"channel"}</m-template-variable>.',
  },
  trigger: {
    type: 'multiple',
    triggers: [
      { type: 'cron', schedule: { $var: 'schedule' } },
      {
        type: 'events',
        filters: [
          {
            events: ['email.message_received'],
            ids: [{ $var: 'thread' }],
            condition: 'Is it urgent?',
          },
        ],
      },
    ],
  },
  variables: [
    {
      key: 'agent',
      label: 'Agent',
      description: '',
      kind: { type: 'agent' },
      mode: { type: 'variable' },
    },
    {
      key: 'schedule',
      label: 'Schedule',
      description: '',
      kind: { type: 'schedule' },
      mode: {
        type: 'fixed',
        value: { type: 'schedule', cron: '0 0 9 * * *', timezone: 'UTC' },
      },
    },
    {
      key: 'channel',
      label: 'Channel',
      description: 'Where it posts.',
      kind: { type: 'channel' },
      mode: { type: 'variable' },
    },
    {
      key: 'thread',
      label: 'Thread',
      description: '',
      kind: { type: 'event_entity', entity_type: 'email_thread' },
      mode: { type: 'variable' },
    },
  ],
  your_activations: ['r1'],
  activation_count: 3,
};

describe('templateFromWire', () => {
  it('reads variables, fixed values and every trigger shape', () => {
    const template = templateFromWire(view);
    expect(template.variables.map((variable) => variable.kind)).toEqual([
      'agent',
      'schedule',
      'channel',
      'email_thread',
    ]);
    expect(template.variables[1].fixed).toEqual({
      kind: 'schedule',
      cron: '0 0 9 * * *',
      timezone: 'UTC',
    });
    expect(template.triggers).toEqual([
      { kind: 'schedule', key: 'schedule' },
      {
        kind: 'events',
        events: ['email.message_received'],
        keys: ['thread'],
        condition: 'Is it urgent?',
      },
    ]);
    expect(template.yourActivations).toEqual(['r1']);
  });
});

describe('bindings', () => {
  it('round-trip between the wire and the feature model', () => {
    const wire = {
      agent: {
        type: 'agent' as const,
        target: { kind: 'agent' as const, bot_id: 'b1', model: 'm1' },
      },
      person: { type: 'user' as const, user_id: 'macro|a@macro.com' },
      channel: { type: 'entity' as const, id: 'c1', name: 'ops' },
      domain: { type: 'text' as const, text: 'globex.com' },
    };
    const model = bindingsFromWire(wire);
    expect(model.agent).toEqual({
      kind: 'agent',
      target: { kind: 'agent', agentId: 'b1', modelOverride: 'm1' },
    });
    expect(bindingsToWire(model)).toEqual(wire);
  });
});

describe('applyShareEdits', () => {
  it('renames, describes and fixes variables without touching the rest', () => {
    const edited = applyShareEdits(view, {
      name: ' Customer digest ',
      description: 'Weekly.',
      variables: [
        {
          key: 'channel',
          label: 'Digest channel',
          description: 'Where the digest goes.',
          kind: 'channel',
          fixed: { kind: 'entity', id: 'c1', name: 'ops' },
        },
        {
          key: 'schedule',
          label: 'Schedule',
          description: '',
          kind: 'schedule',
        },
      ],
    });
    expect(edited.name).toBe('Customer digest');
    expect(edited.task).toEqual(view.task);
    expect(edited.trigger).toEqual(view.trigger);
    const channel = edited.variables.find((v) => v.key === 'channel');
    expect(channel?.label).toBe('Digest channel');
    expect(channel?.mode).toEqual({
      type: 'fixed',
      value: { type: 'entity', id: 'c1', name: 'ops' },
    });
    expect(edited.variables.find((v) => v.key === 'schedule')?.mode).toEqual({
      type: 'variable',
    });
  });
});
