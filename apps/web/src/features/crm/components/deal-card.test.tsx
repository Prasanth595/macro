import { cleanup, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DealPill } from './deal-card';

afterEach(cleanup);

describe('deal date editor', () => {
  it('shows the next action immediately and drops it when the save fails', async () => {
    let finish: (saved: boolean) => void = () => {};
    const save = new Promise<boolean>((resolve) => {
      finish = resolve;
    });
    render(() => (
      <DealPill
        presentation="line"
        when="2026-10-15"
        next="Email"
        plan=""
        outcome={null}
        onWhen={() => true}
        onNext={() => save}
        onPlan={() => {}}
        onOutcome={() => true}
        onHappened={async () => {}}
        onLast={async () => {}}
      />
    ));

    await userEvent.click(screen.getByRole('button', { name: /15\/10\/2026/ }));
    const call = screen.getByRole('button', { name: 'Call', exact: true });
    const email = screen.getByRole('button', { name: 'Email', exact: true });
    expect(email.className).toContain('6d4aff');
    await userEvent.click(call);
    expect(call.className).toContain('6d4aff');
    expect(email.className).not.toContain('6d4aff');
    finish(false);
    await waitFor(() => expect(call.className).not.toContain('6d4aff'));
    expect(email.className).toContain('6d4aff');
  });
});
