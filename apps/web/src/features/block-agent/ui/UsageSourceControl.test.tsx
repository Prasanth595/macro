/** @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsageSourceControl, UsageSourceLabel } from './UsageSourceControl';

afterEach(cleanup);

describe('UsageSourceControl', () => {
  it('turns on the one key on offer', () => {
    const onChoose = vi.fn();
    const { getByRole } = render(() => (
      <UsageSourceControl
        option={{
          id: 'funding',
          name: 'Usage',
          description: null,
          category: null,
          type: 'select',
          currentValue: 'macro',
          options: [
            {
              value: 'macro',
              name: 'Macro usage',
              description: null,
              group: null,
            },
            {
              value: 'personal_api_key',
              name: 'Your API key',
              description: null,
              group: null,
            },
          ],
        }}
        onChoose={onChoose}
      />
    ));

    fireEvent.click(
      getByRole('button', { name: 'Use your own API key for AI chat' })
    );

    expect(onChoose).toHaveBeenCalledWith('personal_api_key');
  });

  it('names the key in use and switches back to Macro usage', () => {
    const onChoose = vi.fn();
    const { getByRole } = render(() => (
      <UsageSourceControl
        option={{
          id: 'funding',
          name: 'Usage',
          description: null,
          category: null,
          type: 'select',
          currentValue: 'team_api_key',
          options: [
            {
              value: 'macro',
              name: 'Macro usage',
              description: null,
              group: null,
            },
            {
              value: 'team_api_key',
              name: 'Team API key',
              description: null,
              group: null,
            },
          ],
        }}
        onChoose={onChoose}
      />
    ));

    fireEvent.click(
      getByRole('button', { name: 'Using team API usage · change usage' })
    );

    expect(onChoose).toHaveBeenCalledWith('macro');
  });

  it('opens a menu instead when both keys are on offer', () => {
    const onChoose = vi.fn();
    const { getByRole } = render(() => (
      <UsageSourceControl
        option={{
          id: 'funding',
          name: 'Usage',
          description: null,
          category: null,
          type: 'select',
          currentValue: 'personal_api_key',
          options: [
            {
              value: 'macro',
              name: 'Macro usage',
              description: null,
              group: null,
            },
            {
              value: 'personal_api_key',
              name: 'Your API key',
              description: null,
              group: null,
            },
            {
              value: 'team_api_key',
              name: 'Team API key',
              description: null,
              group: null,
            },
          ],
        }}
        onChoose={onChoose}
      />
    ));

    const trigger = getByRole('button', {
      name: 'Using your API key · change usage',
    });
    expect(trigger.getAttribute('aria-haspopup')).toBe('true');
    fireEvent.click(trigger);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('labels the key in use above the composer', () => {
    const { getByText } = render(() => (
      <UsageSourceLabel funding="personal_api_key" />
    ));

    expect(getByText('Using your API key')).toBeTruthy();
  });
});
