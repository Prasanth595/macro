import { describe, expect, it } from 'vitest';
import { serializeTriggers } from '../../routines/queries/routine-trigger-mapping';
import {
  decodeRoutineSuggestions,
  pickDefaultOn,
  type RoutineSuggestionsResult,
  suggestionToDraft,
} from './suggestions';

type Raw = RoutineSuggestionsResult['suggestions'][number];

function raw(overrides: Partial<Raw>): Raw {
  return {
    surface: 'email',
    title: 'Tag invoices',
    summary: 'Labels invoices as they arrive.',
    reason: 'You get invoices from Acme weekly',
    instructions: 'Label every invoice from Acme as Finance.',
    icon: 'tag',
    keepProbability: 0.5,
    notify: false,
    trigger: {
      kind: 'event',
      event: 'email.message_received',
      condition: 'Is this email an invoice?',
    },
    ...overrides,
  };
}

describe('decodeRoutineSuggestions', () => {
  it('turns event and schedule suggestions into routine triggers', () => {
    const [event, weekly, daily, monthly] = decodeRoutineSuggestions(
      {
        suggestions: [
          raw({}),
          raw({
            surface: 'calendar',
            title: 'Morning brief',
            trigger: {
              kind: 'schedule',
              frequency: 'week',
              time: '08:30',
              weekdays: ['mon', 'Fri', 'mon'],
            },
          }),
          raw({
            surface: 'chat',
            title: 'Channel digest',
            trigger: { kind: 'schedule', frequency: 'day', time: '17:00' },
          }),
          raw({
            surface: 'crm',
            title: 'Pipeline audit',
            trigger: {
              kind: 'schedule',
              frequency: 'month',
              time: '09:00',
              dayOfMonth: 2,
            },
          }),
        ],
      },
      'America/New_York'
    );
    expect(serializeTriggers([event.trigger])).toEqual({
      type: 'events',
      filters: [
        {
          events: ['email.message_received'],
          condition: 'Is this email an invoice?',
        },
      ],
    });
    expect(event.when).toBe('When a new email arrives');
    expect(serializeTriggers([weekly.trigger])).toEqual({
      type: 'cron',
      schedule: '0 30 8 * * 2,6',
      timezone: 'America/New_York',
    });
    expect(serializeTriggers([daily.trigger])).toEqual({
      type: 'cron',
      schedule: '0 0 17 * * 1,2,3,4,5,6,7',
      timezone: 'America/New_York',
    });
    expect(serializeTriggers([monthly.trigger])).toEqual({
      type: 'cron',
      schedule: '0 0 9 2 * *',
      timezone: 'America/New_York',
    });
  });

  it('drops malformed suggestions without failing the rest', () => {
    const decoded = decodeRoutineSuggestions(
      {
        suggestions: [
          raw({ surface: 'spreadsheets' }),
          raw({
            title: 'Bad event',
            trigger: { kind: 'event', event: 'channel.mentioned' },
          }),
          raw({
            title: 'Bad time',
            trigger: { kind: 'schedule', frequency: 'day', time: '9am' },
          }),
          raw({
            title: 'No days',
            trigger: {
              kind: 'schedule',
              frequency: 'week',
              time: '09:00',
              weekdays: ['someday'],
            },
          }),
          raw({ title: '  ', instructions: 'Do it.' }),
          raw({ title: 'Unknown icon', icon: 'rocket' }),
        ],
      },
      'UTC'
    );
    expect(
      decoded.map((suggestion) => [suggestion.title, suggestion.icon])
    ).toEqual([['Unknown icon', 'sparkle']]);
  });

  it('keeps at most three per surface and no repeats', () => {
    const decoded = decodeRoutineSuggestions(
      {
        suggestions: [
          raw({ title: 'One' }),
          raw({ title: 'one' }),
          raw({ title: 'Two' }),
          raw({ title: 'Three' }),
          raw({ title: 'Four' }),
          raw({ surface: 'tasks', title: 'One' }),
        ],
      },
      'UTC'
    );
    expect(
      decoded.map((suggestion) => [suggestion.surface, suggestion.title])
    ).toEqual([
      ['email', 'One'],
      ['email', 'Two'],
      ['email', 'Three'],
      ['tasks', 'One'],
    ]);
  });
});

describe('suggestionToDraft', () => {
  it('creates an enabled routine that shows its runs when it notifies', () => {
    const [suggestion] = decodeRoutineSuggestions(
      { suggestions: [raw({ notify: true })] },
      'UTC'
    );
    const draft = suggestionToDraft(suggestion, {
      kind: 'agent',
      agentId: '0198c7a3-0000-7000-8000-000000000001',
    });
    expect(draft).toMatchObject({
      name: 'Tag invoices',
      prompt: 'Label every invoice from Acme as Finance.',
      enabled: true,
      runVisibility: 'listed',
      target: {
        kind: 'agent',
        agentId: '0198c7a3-0000-7000-8000-000000000001',
      },
    });
    expect(draft.triggers?.[0]?.id).not.toBe(suggestion.trigger.id);
  });
});

describe('pickDefaultOn', () => {
  const titled = (probabilities: number[]) =>
    decodeRoutineSuggestions(
      {
        suggestions: probabilities.map((keepProbability, index) =>
          raw({
            surface: ['email', 'tasks', 'crm'][index % 3],
            title: `Routine ${index}`,
            keepProbability,
          })
        ),
      },
      'UTC'
    );
  const titlesOf = (
    suggestions: ReturnType<typeof titled>,
    ids: ReadonlySet<string>
  ) =>
    suggestions
      .filter((suggestion) => ids.has(suggestion.id))
      .map((suggestion) => suggestion.title);

  it('turns on every likely keeper, up to five, most likely first', () => {
    const three = titled([0.5, 0.92, 0.81, 0.3, 0.8, 0.79]);
    expect(titlesOf(three, pickDefaultOn(three))).toEqual([
      'Routine 1',
      'Routine 2',
      'Routine 4',
    ]);
    const many = titled([0.9, 0.95, 0.85, 0.99, 0.81, 0.8, 0.97]);
    expect(pickDefaultOn(many).size).toBe(5);
    expect(pickDefaultOn(many).has(many[5].id)).toBe(false);
  });

  it('tops up to two with the next most likely when few clear the bar', () => {
    const unsure = titled([0.2, 0.6, 0.85, 0.55]);
    expect(titlesOf(unsure, pickDefaultOn(unsure))).toEqual([
      'Routine 1',
      'Routine 2',
    ]);
    expect(pickDefaultOn(titled([0.4])).size).toBe(1);
    expect(pickDefaultOn([]).size).toBe(0);
  });

  it('reads out-of-range estimates as their nearest bound', () => {
    const [high, low] = titled([3, Number.NaN]);
    expect(high.keepProbability).toBe(1);
    expect(low.keepProbability).toBe(0);
  });
});
