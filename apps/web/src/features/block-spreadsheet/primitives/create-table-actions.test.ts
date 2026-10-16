import { LoroDoc } from 'loro-crdt';
import { createRoot, createSignal } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import type { CellCopy } from '../core/calculation';
import type { CellSelection } from '../core/grid-selection';
import {
  formatCellAddress,
  type SpreadsheetCellEdits,
  writeSpreadsheetCells,
} from '../core/spreadsheet-document';
import { createSpreadsheetStore } from './create-spreadsheet-store';
import { createTableActions } from './create-table-actions';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

async function setup() {
  const doc = new LoroDoc();
  writeSpreadsheetCells(doc, {
    A1: { value: 'Region' },
    B1: { value: 'Amount' },
    A2: { value: 'West' },
    B2: { value: '20' },
    A3: { value: 'East' },
    B3: { value: '10' },
    A4: { value: 'North' },
    B4: { value: '30' },
    D1: { value: '=SUM(Table1[Amount])' },
  });
  const notices: string[] = [];
  const result = createRoot((dispose) => {
    cleanups.push(() => {
      dispose();
      doc.free();
    });
    const store = createSpreadsheetStore({
      canEdit: () => true,
      source: {
        doc: () => doc,
        ready: () => true,
        error: () => undefined,
        status: () => 'local',
        peers: () => [],
        setSelection: () => {},
      },
    });
    const [selection, setSelection] = createSignal<CellSelection>({
      anchor: { row: 0, column: 0 },
      focus: { row: 3, column: 1 },
    });
    // Copies move cells as they are, which is what sorting plain values does.
    const copyCells = async (copies: CellCopy[]) => {
      const edits: SpreadsheetCellEdits = {};
      for (const { to, cell } of copies)
        edits[formatCellAddress(to.row, to.column)] = cell;
      return edits;
    };
    const actions = createTableActions({
      store,
      canEdit: () => true,
      selection,
      values: () => ({}),
      calculating: () => false,
      copyCells,
      setNotice: (message) => notices.push(message),
    });
    return { store, actions, setSelection };
  });
  await Promise.resolve();
  return { ...result, notices };
}

describe('table actions', () => {
  it('converts the selection with a total row, then filters and sorts it', async () => {
    const { store, actions } = await setup();
    actions.openDialog();
    expect(actions.dialog()).toEqual({
      kind: 'create',
      range: 'A1:B4',
      name: 'Table1',
    });
    actions.save({
      kind: 'create',
      range: 'A1:B4',
      name: 'Table1',
      totalsRow: true,
    });
    expect(actions.dialog()).toBeUndefined();
    expect(store.activeSheet().metadata?.tables).toEqual([
      { name: 'Table1', range: 'A1:B5', totalsRow: true, bandedRows: true },
    ]);
    expect(store.cells().B5.value).toBe('=SUBTOTAL(109,[Amount])');

    actions.filterColumn('Table1', 0, ['East', 'West']);
    expect(store.activeSheet().metadata?.hiddenRows).toEqual([3]);
    expect(actions.columnChoices('Table1', 0)).toEqual([
      { value: 'East', shown: true },
      { value: 'North', shown: false },
      { value: 'West', shown: true },
    ]);

    await actions.sortColumn('Table1', 1, true);
    // North (30) sorts first and stays hidden; the total row stays put.
    expect(store.cells().A2.value).toBe('North');
    expect(store.cells().A4.value).toBe('East');
    expect(store.cells().B5.value).toBe('=SUBTOTAL(109,[Amount])');
    expect(store.activeSheet().metadata?.hiddenRows).toEqual([1]);

    actions.filterColumn('Table1', 0, undefined);
    expect(store.activeSheet().metadata?.hiddenRows).toBeUndefined();
  });

  it('offers aggregates in the total row and writes the chosen one', async () => {
    const { store, actions, setSelection } = await setup();
    actions.openDialog();
    actions.save({
      kind: 'create',
      range: 'A1:B4',
      name: 'Table1',
      totalsRow: true,
    });
    setSelection({
      anchor: { row: 4, column: 1 },
      focus: { row: 4, column: 1 },
    });
    expect(actions.totalChoices()).toContain('Average');
    expect(actions.pickTotal('Average')).toBe(true);
    expect(store.cells().B5.value).toBe('=SUBTOTAL(101,[Amount])');
    setSelection({
      anchor: { row: 2, column: 1 },
      focus: { row: 2, column: 1 },
    });
    expect(actions.totalChoices()).toBeUndefined();
  });

  it('renames, restyles and removes a total row in one undo step', async () => {
    const { store, actions, setSelection } = await setup();
    actions.openDialog();
    actions.save({
      kind: 'create',
      range: 'A1:B4',
      name: 'Table1',
      totalsRow: true,
    });
    setSelection({
      anchor: { row: 1, column: 0 },
      focus: { row: 1, column: 0 },
    });
    actions.openDialog();
    expect(actions.dialog()).toMatchObject({ kind: 'edit', table: 'Table1' });
    actions.save({
      kind: 'edit',
      name: 'Sales',
      totalsRow: false,
      bandedRows: false,
      bandedColumns: true,
    });
    expect(store.activeSheet().metadata?.tables).toEqual([
      {
        name: 'Sales',
        range: 'A1:B4',
        totalsRow: false,
        bandedRows: false,
        bandedColumns: true,
      },
    ]);
    expect(store.cells().D1.value).toBe('=SUM(Sales[Amount])');
    expect(store.cells().B5).toBeUndefined();
    store.undo();
    expect(store.activeSheet().metadata?.tables?.[0].name).toBe('Table1');
    expect(store.cells().D1.value).toBe('=SUM(Table1[Amount])');
    expect(store.cells().B5.value).toBe('=SUBTOTAL(109,[Amount])');
  });

  it('turns a table back into cells whose formulas use cell ranges', async () => {
    const { store, actions } = await setup();
    actions.openDialog();
    actions.save({
      kind: 'create',
      range: 'A1:B4',
      name: 'Table1',
      totalsRow: false,
    });
    actions.openDialog();
    actions.convertToRange();
    expect(actions.dialog()).toBeUndefined();
    expect(store.activeSheet().metadata?.tables).toBeUndefined();
    expect(store.cells().D1.value).toBe('=SUM($B$2:$B$4)');
  });

  it('explains names that cannot be used', async () => {
    const { actions } = await setup();
    actions.openDialog();
    actions.save({
      kind: 'create',
      range: 'A1:B4',
      name: 'My table',
      totalsRow: false,
    });
    expect(actions.error()).toContain('not a valid table name');
    expect(actions.dialog()).toMatchObject({ kind: 'create' });
  });
});
