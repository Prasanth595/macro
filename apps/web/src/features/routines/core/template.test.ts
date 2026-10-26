import { describe, expect, it } from 'vitest';
import {
  extractTemplateVariables,
  fillTemplatePrompt,
  fillTemplateTrigger,
} from './template';

const author =
  '<m-user-mention>{"userId":"macro|eric@macro.com","email":"eric@macro.com","displayName":"Eric"}</m-user-mention>';
const teammate =
  '<m-user-mention>{"userId":"macro|priya@macro.com","email":"priya@macro.com","displayName":"Priya Shah"}</m-user-mention>';
const channel =
  '<m-document-mention>{"documentId":"channel-1","documentName":"customer-success","blockName":"channel"}</m-document-mention>';
const doc =
  '<m-document-mention>{"documentId":"doc-1","documentName":"Acme account","blockName":"md"}</m-document-mention>';

const prompt = `Post the digest to ${channel}. Pull renewal dates from ${doc}. Assign follow-ups to ${teammate} and DM ${author} a summary. Repeat in ${channel}.`;

const cron = {
  type: 'cron' as const,
  schedule: '0 0 9 * * 2',
  timezone: 'America/Los_Angeles',
};

const activator = {
  userId: 'macro|jun@macro.com',
  email: 'jun@macro.com',
  displayName: 'Jun',
  timezone: 'America/New_York',
};

describe('extractTemplateVariables', () => {
  it('fills the author and time zone as the activator and keeps other references', () => {
    expect(
      extractTemplateVariables({
        prompt,
        timezone: cron.timezone,
        authorId: 'macro|eric@macro.com',
      })
    ).toEqual([
      {
        kind: 'item',
        id: 'channel-1',
        block_name: 'channel',
        label: 'customer-success',
        fill: 'shared',
      },
      {
        kind: 'item',
        id: 'doc-1',
        block_name: 'md',
        label: 'Acme account',
        fill: 'shared',
      },
      {
        kind: 'user',
        id: 'macro|priya@macro.com',
        label: 'Priya Shah',
        fill: 'shared',
      },
      {
        kind: 'user',
        id: 'macro|eric@macro.com',
        label: 'Eric',
        fill: 'activator',
      },
      { kind: 'time_zone', timezone: 'America/Los_Angeles', fill: 'activator' },
    ]);
  });

  it('has no time zone for event-only routines', () => {
    expect(
      extractTemplateVariables({
        prompt: 'Summarize it',
        timezone: undefined,
        authorId: 'macro|eric@macro.com',
      })
    ).toEqual([]);
  });
});

describe('fillTemplatePrompt', () => {
  const variables = extractTemplateVariables({
    prompt,
    timezone: cron.timezone,
    authorId: 'macro|eric@macro.com',
  });

  it('names the activator in place of the author and leaves out dropped references as text', () => {
    const filled = fillTemplatePrompt({
      prompt,
      variables,
      activator,
      choices: new Map([['doc-1', 'leave_out']]),
    });
    expect(filled).toBe(
      `Post the digest to ${channel}. Pull renewal dates from Acme account. Assign follow-ups to ${teammate} and DM <m-user-mention>{"userId":"macro|jun@macro.com","email":"jun@macro.com","displayName":"Jun"}</m-user-mention> a summary. Repeat in ${channel}.`
    );
  });

  it('leaves out an unchosen per-person reference', () => {
    const filled = fillTemplatePrompt({
      prompt: `Read ${doc}`,
      variables: [
        {
          kind: 'item',
          id: 'doc-1',
          block_name: 'md',
          label: 'Acme account',
          fill: 'choice',
        },
      ],
      activator,
      choices: new Map(),
    });
    expect(filled).toBe('Read Acme account');
  });
});

describe('fillTemplateTrigger', () => {
  it('moves every schedule to the activator time zone', () => {
    const trigger = {
      type: 'multiple' as const,
      triggers: [cron, { type: 'events' as const, filters: [] }],
    };
    expect(
      fillTemplateTrigger({
        trigger,
        variables: [
          { kind: 'time_zone', timezone: cron.timezone, fill: 'activator' },
        ],
        activator,
      })
    ).toEqual({
      type: 'multiple',
      triggers: [
        { ...cron, timezone: 'America/New_York' },
        { type: 'events', filters: [] },
      ],
    });
  });

  it('keeps the author time zone when it is shared', () => {
    expect(
      fillTemplateTrigger({
        trigger: cron,
        variables: [
          { kind: 'time_zone', timezone: cron.timezone, fill: 'shared' },
        ],
        activator,
      })
    ).toEqual(cron);
  });
});
