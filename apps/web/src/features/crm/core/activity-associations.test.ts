import { describe, expect, it } from 'vitest';
import {
  normalizeAssociationEmail,
  resolveActivityAssociations,
} from './activity-associations';

describe('CRM activity associations', () => {
  it('keeps explicit record identity when contacts share an email and omits unresolved links', () => {
    expect(
      resolveActivityAssociations(
        {
          links: [
            { type: 'contact', id: 'second-contact' },
            { type: 'contact', id: 'inaccessible-contact' },
            { type: 'company', id: 'company' },
          ],
          emails: [],
        },
        [
          {
            type: 'contact',
            id: 'first-contact',
            name: 'First contact',
            email: 'person@example.com',
          },
          {
            type: 'contact',
            id: 'second-contact',
            name: 'Second contact',
            email: 'person@example.com',
          },
          { type: 'company', id: 'company', name: 'Example company' },
        ]
      )
    ).toEqual([
      {
        type: 'company',
        id: 'company',
        name: 'Example company',
        match: 'linked',
      },
      {
        type: 'contact',
        id: 'second-contact',
        name: 'Second contact',
        match: 'linked',
      },
    ]);
  });

  it('matches exact normalized contact addresses without inferring company-domain links', () => {
    expect(
      resolveActivityAssociations(
        {
          links: [],
          emails: [normalizeAssociationEmail(' Person@Example.com ')],
        },
        [
          { type: 'company', id: 'company', name: 'Example company' },
          {
            type: 'contact',
            id: 'matched',
            name: 'Matched person',
            email: 'PERSON@example.com',
          },
          {
            type: 'contact',
            id: 'unrelated',
            name: 'Unrelated person',
            email: 'other@example.com',
          },
        ]
      )
    ).toEqual([
      {
        type: 'contact',
        id: 'matched',
        name: 'Matched person',
        match: 'email',
      },
    ]);
  });

  it('deduplicates hydration results and prefers the explicit link over email matching', () => {
    const record = {
      type: 'contact',
      id: 'contact',
      name: 'Contact',
      email: 'person@example.com',
    } as const;
    expect(
      resolveActivityAssociations(
        {
          links: [{ type: 'contact', id: 'contact' }],
          emails: ['person@example.com'],
        },
        [record, record]
      )
    ).toEqual([
      { type: 'contact', id: 'contact', name: 'Contact', match: 'linked' },
    ]);
  });
});
