import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, expect, it } from 'vitest';
import { Tabs } from './Tabs';

afterEach(cleanup);

it('switches a controlled view by its visible label', () => {
  const [value, setValue] = createSignal<'all' | 'recent' | 'threads'>('all');
  render(() => (
    <>
      <Tabs
        aria-label="Conversation view"
        options={[
          { value: 'all', label: 'All' },
          { value: 'recent', label: 'Recent' },
          { value: 'threads', label: 'Threads' },
        ]}
        value={value()}
        onChange={setValue}
      />
      <p>Current view: {value()}</p>
    </>
  ));

  fireEvent.click(screen.getByText('Recent', { exact: true }));
  expect(screen.getByText('Current view: recent')).toBeTruthy();
  expect(
    screen.getByRole('radio', { name: 'Recent', checked: true })
  ).toBeTruthy();
  expect(
    screen.getByRole('radio', { name: 'All', checked: false })
  ).toBeTruthy();

  fireEvent.click(screen.getByText('Threads', { exact: true }));
  expect(screen.getByText('Current view: threads')).toBeTruthy();
});

it('keeps icon-only options named by their labels', () => {
  const [value, setValue] = createSignal<'messages' | 'files'>('messages');
  const Icon = (props: { class?: string }) => <svg class={props.class} />;
  render(() => (
    <Tabs
      aria-label="Channel sections"
      iconOnly
      options={[
        { value: 'messages', label: 'Messages', icon: Icon },
        { value: 'files', label: 'Attachments', icon: Icon },
      ]}
      value={value()}
      onChange={setValue}
    />
  ));

  fireEvent.click(screen.getByRole('radio', { name: 'Attachments' }));
  expect(value()).toBe('files');
});

it('does not select a disabled option', () => {
  const [value, setValue] = createSignal<'team' | 'personal'>('personal');
  render(() => (
    <Tabs
      aria-label="Owner"
      options={[
        { value: 'team', label: 'Team', disabled: true },
        { value: 'personal', label: 'Personal' },
      ]}
      value={value()}
      onChange={setValue}
    />
  ));

  fireEvent.click(screen.getByText('Team', { exact: true }));
  expect(value()).toBe('personal');
});
