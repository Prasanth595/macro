import { describe, expect, it } from 'vitest';
import { localFields, localIntent } from './local-fields';

describe('immediate field suggestions', () => {
  it('uses the addressing line and preserves every body line', () => {
    const text =
      'email Julia\ncan we reschedule tomorrow?\nlet the investors know';
    expect(localIntent(text)).toBe('email');
    expect(localFields(text, 'email')).toEqual({
      recipients: ['Julia'],
      body: 'can we reschedule tomorrow?\nlet the investors know',
    });
  });
  it('handles inline instructions, multiple recipients and partial addressing', () => {
    expect(
      localFields('Email Julia and Alex that I’ll be late', 'email')
    ).toEqual({
      recipients: ['Julia', 'Alex'],
      body: 'I’ll be late',
    });
    expect(localFields('DM John that I’m late', 'message')).toEqual({
      recipients: ['John'],
      body: 'I’m late',
    });
    expect(localIntent('Email')).toBe('email');
    expect(localFields('Email', 'email')).toEqual({ recipients: [], body: '' });
  });
  it('recognizes explicit searches and extracts their query locally', () => {
    for (const text of [
      'find investor update',
      'search for investor update',
      'look for investor update',
    ]) {
      expect(localIntent(text)).toBe('search');
      expect(localFields(text, 'search')).toEqual({ query: 'investor update' });
    }
    expect(localFields('investor update', 'search')).toEqual({
      query: 'investor update',
    });
    expect(localFields('find', 'search')).toEqual({ query: '' });
    expect(localIntent('Help me find a time to meet')).toBeUndefined();
  });
  it('leaves reminders, AI requests and quoted prose to classification', () => {
    for (const text of [
      'Remind me to email Julia',
      'Ask AI to draft an email',
      'The email server is broken',
      '# Email Julia',
    ])
      expect(localIntent(text)).toBeUndefined();
  });
  it('preserves Markdown and follows the selected type for local fields', () => {
    const text = '# Email Julia\n\n- Compare launch dates';
    expect(localFields(text, 'note')).toEqual({
      title: 'Email Julia',
      body: text,
    });
    expect(localFields('email Julia\nhello', 'task')).toEqual({
      title: 'email Julia',
    });
  });
});
