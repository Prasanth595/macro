import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, expect, it } from 'vitest';
import { Tabs } from './Tabs';

afterEach(cleanup);

it.each(['segmented', 'plain'] as const)(
  'switches a controlled %s view by its visible label',
  (variant) => {
    const [value, setValue] = createSignal('all');
    render(() => (
      <>
        <Tabs
          variant={variant}
          fullWidth
          aria-label="Conversation view"
          list={[
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
    expect(
      screen.getByRole('radio', { name: 'Threads', checked: true })
    ).toBeTruthy();
  }
);
