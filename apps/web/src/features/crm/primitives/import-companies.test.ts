import { createRoot } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { createCrmCsv } from '../core/export';
import { createCompanyImport } from './import-companies';

const file = (text: string) => ({ size: text.length, text: async () => text });

function setup(
  create: (row: {
    name: string;
    domain: string;
  }) => Promise<'created' | 'exists'>
) {
  const refresh = vi.fn(async () => {});
  const { state, dispose } = createRoot((dispose) => ({
    state: createCompanyImport({ create, refresh }),
    dispose,
  }));
  return { state, dispose, refresh };
}

describe('company import', () => {
  it('imports a CRM companies export', async () => {
    const create = vi.fn(async () => 'created' as const);
    const { state, dispose, refresh } = setup(create);
    const companies = Array.from({ length: 150 }, (_, index) => ({
      name: `Company ${index}`,
      domains: `company${index}.com; alias${index}.com`,
      stage: 'Churned',
    }));
    await state.read(
      file(
        createCrmCsv(
          [
            { id: 'name', label: 'Company' },
            { id: 'domains', label: 'Domains' },
            { id: 'stage', label: 'Stage' },
          ],
          [
            ...companies,
            { name: '=Formula Co', domains: 'formula.co', stage: '' },
            { name: 'No domain', domains: '', stage: '' },
            { name: 'Repeat', domains: 'company0.com', stage: '' },
          ]
        )
      )
    );
    expect(state.error()).toBe('');
    expect(state.rows()).toHaveLength(151);
    expect(state.rows()[0]).toEqual({
      name: 'Company 0',
      domain: 'company0.com',
    });
    expect(state.rows()[150]).toEqual({
      name: '=Formula Co',
      domain: 'formula.co',
    });
    expect(state.skipped()).toBe(2);
    await state.run();
    expect(create).toHaveBeenCalledTimes(151);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(state.completed()).toBe(151);
    expect(state.rows()).toEqual([]);
    dispose();
  });

  it('counts companies the team already tracks without failing them', async () => {
    const { state, dispose } = setup(async (row) =>
      row.domain === 'known.example' ? 'exists' : 'created'
    );
    await state.read(
      file('name,domain\nKnown,known.example\nNew,https://www.new.example/')
    );
    await state.run();
    expect(state.completed()).toBe(1);
    expect(state.existing()).toBe(1);
    expect(state.error()).toBe('');
    dispose();
  });

  it('retries only failed rows and preserves the successful count', async () => {
    let fail = true;
    const create = vi.fn(async (row: { name: string; domain: string }) => {
      if (row.name === 'Retry' && fail) throw new Error('temporary failure');
      return 'created' as const;
    });
    const { state, dispose } = setup(create);
    await state.read(
      file('Name,Domain\nDone,DONE.EXAMPLE\nRetry,retry.example')
    );
    expect(state.error()).toBe('');
    await state.run();
    expect(state.completed()).toBe(1);
    expect(state.rows()).toEqual([{ name: 'Retry', domain: 'retry.example' }]);
    expect(state.error()).toContain('Successful rows will not be retried');
    fail = false;
    await state.run();
    expect(state.completed()).toBe(2);
    expect(state.rows()).toEqual([]);
    expect(create.mock.calls.map(([row]) => row.name)).toEqual([
      'Done',
      'Retry',
      'Retry',
    ]);
    dispose();
  });

  it('rejects oversized files and files without domains before any mutation', async () => {
    const create = vi.fn(async () => 'created' as const);
    const { state, dispose } = setup(create);
    await state.read(file('x'.repeat(5 * 1024 * 1024 + 1)));
    expect(state.error()).toContain('smaller than 5 MB');
    await state.read(file('name,website\nInvalid,not a domain'));
    expect(state.error()).toBe('No rows have a domain like acme.com.');
    await state.read(file('name,stage\nAcme,Lead'));
    expect(state.error()).toContain('Include a Domain column');
    await state.run();
    expect(create).not.toHaveBeenCalled();
    expect(state.rows()).toEqual([]);
    dispose();
  });
});
