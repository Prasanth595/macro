import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  Bindings,
  FillResult,
  RoutineTemplate,
  TemplateValue,
} from '../core/template';
import {
  ActivateTemplateDialog,
  type ValuePickerProps,
} from './activate-template-dialog';

afterEach(cleanup);

const template: RoutineTemplate = {
  id: 't1',
  ownerId: 'macro|creator@macro.com',
  name: 'Customer digest',
  description: '',
  instructions: 'Summarize the week.',
  triggers: [{ kind: 'schedule', key: 'schedule' }],
  variables: [
    { key: 'agent', label: 'Agent', description: '', kind: 'agent' },
    {
      key: 'schedule',
      label: 'Schedule',
      description: '',
      kind: 'schedule',
      fixed: { kind: 'schedule', cron: '0 0 9 * * *', timezone: 'UTC' },
    },
    { key: 'customer', label: 'Customer', description: '', kind: 'text' },
  ],
  yourActivations: [],
  activationCount: 0,
};

const label = (value: TemplateValue) =>
  value.kind === 'text'
    ? value.text
    : value.kind === 'agent'
      ? 'Macro'
      : value.kind;

/** Picks a fixed text so the test drives "Change" without real pickers. */
function Picker(props: ValuePickerProps) {
  return (
    <button
      type="button"
      onClick={() => props.onPick({ kind: 'text', text: 'Initech' })}
    >
      Pick Initech
    </button>
  );
}

function renderDialog(fill: () => Promise<FillResult>) {
  const submit = vi.fn<(bindings: Bindings, name?: string) => Promise<void>>(
    async () => {}
  );
  render(() => (
    <ActivateTemplateDialog
      open
      onOpenChange={() => {}}
      template={template}
      ownerName="Eric"
      label={label}
      fillOnOpen
      title="Activate for me:"
      submitLabel="Activate"
      fill={fill}
      submit={submit}
      Picker={Picker}
    />
  ));
  return { submit };
}

describe('ActivateTemplateDialog', () => {
  it('fills what it can, lets the viewer change the rest, then activates', async () => {
    const { submit } = renderDialog(async () => ({
      rows: [
        {
          key: 'agent',
          value: {
            kind: 'agent',
            target: { kind: 'model', model: 'anthropic/claude-sonnet-5-5' },
          },
          reason: 'Your default model.',
        },
        { key: 'customer', problem: 'Nothing in your workspace fit this.' },
      ],
      name: 'My digest',
    }));

    expect(
      await screen.findByText('Nothing in your workspace fit this.')
    ).toBeTruthy();
    const activate = screen.getByRole('button', { name: 'Activate' });
    expect(activate.hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Change Customer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick Initech' }));
    await waitFor(() => expect(activate.hasAttribute('disabled')).toBe(false));

    fireEvent.click(activate);
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    const [bindings, name] = submit.mock.calls[0];
    expect(name).toBe('My digest');
    expect(bindings.customer).toEqual({ kind: 'text', text: 'Initech' });
    expect(bindings.schedule).toEqual(template.variables[1].fixed);
    expect(bindings.agent?.kind).toBe('agent');
  });

  it('still lets the viewer fill everything by hand when the AI fill fails', async () => {
    renderDialog(async () => {
      throw new Error('unavailable');
    });
    expect(
      await screen.findByText(/Couldn't fill this in automatically/)
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Activate' }).hasAttribute('disabled')
    ).toBe(true);
  });
});
