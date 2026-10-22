import { makeGraphqlSoupInput } from '@queries/soup/graphql/ast';
import { describe, expect, it } from 'vitest';
import { agentConversationsQuery } from './agent-conversations-query';

const OWNER = 'macro|dana@example.com';

describe('agentConversationsQuery', () => {
  it('lists the owner’s chats and sessions without routine runs', () => {
    const { body } = agentConversationsQuery(OWNER, { showRoutineRuns: false });

    expect(body.cf).toEqual({ l: { o: OWNER } });
    expect(body.asf).toEqual({
      '&': [
        { l: 'inc' },
        { '&': [{ l: { o: OWNER } }, { '!': { l: { src: 'routine' } } }] },
      ],
    });
    // Every other entity type is pinned to an id that cannot exist.
    expect(body.df).toEqual({
      l: { id: '00000000-0000-0000-0000-000000000000' },
    });
  });

  it('keeps routine runs when asked to', () => {
    const { body } = agentConversationsQuery(OWNER, { showRoutineRuns: true });

    expect(body.asf).toEqual({ '&': [{ l: 'inc' }, { l: { o: OWNER } }] });
  });

  it('translates the routine-run exclusion for GraphQL', () => {
    const input = makeGraphqlSoupInput(
      agentConversationsQuery(OWNER, { showRoutineRuns: false })
    );

    expect(input.initial?.filters?.agentSessionFilter).toEqual({
      and: {
        left: { literal: { include: true } },
        right: {
          and: {
            left: { literal: { owner: OWNER } },
            right: { not: { literal: { source: 'ROUTINE' } } },
          },
        },
      },
    });
  });
});
