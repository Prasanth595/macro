import { cellPlainText } from '@macro-inc/spreadsheet/cell-mentions';
import {
  type CellSelection,
  selectionBounds,
} from '@macro-inc/spreadsheet/grid-selection';
import {
  checkTableName,
  convertTableToRange,
  createTable,
  filterTable,
  keepsHiddenRow,
  nextTableName,
  renameTable,
  type SheetChanges,
  type SheetTable,
  setTableTotalsRow,
  type TableColumnFilter,
  type TableTotalsFunction,
  tableAt,
  tableBounds,
  tableColumnNames,
  tableDataRows,
  totalsFormula,
  workbookNames,
} from '@macro-inc/spreadsheet/sheet-tables';
import type { WorkbookSheetMetadata } from '@macro-inc/spreadsheet/workbook-metadata';
import { type Accessor, createSignal } from 'solid-js';
import type { CellCopy, SpreadsheetCalculation } from '../core/calculation';
import { sortedRangeCopies } from '../core/sheet-operations';
import {
  formatCellAddress,
  type SpreadsheetCellEdits,
} from '../core/spreadsheet-document';
import type {
  TableDialogInput,
  TableDialogState,
  TableFilterChoice,
} from '../core/table-types';
import type { SpreadsheetStore } from './create-spreadsheet-store';

const TOTAL_LABELS: [string, TableTotalsFunction | undefined][] = [
  ['None', undefined],
  ['Sum', 'sum'],
  ['Average', 'average'],
  ['Count', 'count'],
  ['Count numbers', 'countNums'],
  ['Max', 'max'],
  ['Min', 'min'],
  ['Standard deviation', 'stdDev'],
  ['Variance', 'var'],
];

/** Changes for one sheet merged into a list of sheet changes. */
function mergeChanges(
  changes: SheetChanges,
  sheetId: string,
  edits: SpreadsheetCellEdits,
  metadata: WorkbookSheetMetadata
): SheetChanges {
  const own = changes.find((change) => change.sheetId === sheetId);
  if (!own) return [...changes, { sheetId, edits, metadata }];
  return changes.map((change) =>
    change === own
      ? {
          sheetId,
          edits: { ...edits, ...own.edits },
          metadata: own.metadata ?? metadata,
        }
      : change
  );
}

export function createTableActions(options: {
  store: SpreadsheetStore;
  canEdit: Accessor<boolean>;
  selection: Accessor<CellSelection>;
  /** The active sheet's calculated values. */
  values: Accessor<SpreadsheetCalculation>;
  calculating: Accessor<boolean>;
  copyCells: (copies: CellCopy[]) => Promise<SpreadsheetCellEdits>;
  setNotice: (message: string) => void;
}) {
  const { store } = options;
  const [dialog, setDialog] = createSignal<TableDialogState>();
  const [error, setError] = createSignal<string>();
  let operation = 0;

  const tables = () => store.activeSheet().metadata?.tables;
  const activeTable = () => {
    const { anchor } = options.selection();
    return tableAt(tables(), anchor.row, anchor.column);
  };
  /** What a cell shows: its calculated value, or its text before that. */
  const display = (row: number, column: number) => {
    const address = formatCellAddress(row, column);
    return (
      options.values()[address]?.display ??
      cellPlainText(store.cells()[address]?.value ?? '').replace(/^'/, '')
    );
  };
  const tableNamed = (name: string) =>
    tables()?.find((table) => table.name === name);
  const sheets = () =>
    store.workbook().map(({ id, name, cells, metadata }) => ({
      id,
      name,
      cells,
      metadata,
    }));

  function apply(change: () => SheetChanges) {
    try {
      store.editSheets(change());
      return true;
    } catch (failure) {
      options.setNotice(
        failure instanceof Error
          ? failure.message
          : 'Unable to change the table.'
      );
      return false;
    }
  }

  function openDialog() {
    if (!options.canEdit()) return;
    setError(undefined);
    const table = activeTable();
    if (table) {
      setDialog({
        kind: 'edit',
        table: table.name,
        name: table.name,
        totalsRow: table.totalsRow,
        bandedRows: table.bandedRows,
        bandedColumns: !!table.bandedColumns,
      });
      return;
    }
    const bounds = selectionBounds(options.selection());
    const first = formatCellAddress(bounds.top, bounds.left);
    const last = formatCellAddress(bounds.bottom, bounds.right);
    setDialog({
      kind: 'create',
      range: first === last ? first : `${first}:${last}`,
      name: nextTableName(workbookNames(sheets())),
    });
  }

  function save(input: TableDialogInput) {
    const current = dialog();
    if (!current || !options.canEdit()) return;
    try {
      const sheet = store.activeSheet();
      if (current.kind === 'create' && input.kind === 'create') {
        const name = checkTableName(input.name, workbookNames(sheets()));
        const change = createTable({
          metadata: sheet.metadata,
          cells: sheet.cells,
          range: input.range,
          name,
          totalsRow: input.totalsRow,
          rowCount: store.rowCount(),
          display: (address) => options.values()[address]?.display,
        });
        store.editSheets([
          { sheetId: sheet.id, edits: change.edits, metadata: change.metadata },
        ]);
      } else if (current.kind === 'edit' && input.kind === 'edit') {
        const table = tableNamed(current.table);
        if (!table) throw new Error('This table no longer exists.');
        const totals = setTableTotalsRow({
          metadata: sheet.metadata,
          cells: sheet.cells,
          name: table.name,
          totalsRow: input.totalsRow,
          rowCount: store.rowCount(),
        });
        const metadata: WorkbookSheetMetadata = {
          ...totals.metadata,
          tables: totals.metadata.tables?.map((item) => {
            if (item.name !== table.name) return item;
            const updated: SheetTable = {
              ...item,
              bandedRows: input.bandedRows,
            };
            if (input.bandedColumns) updated.bandedColumns = true;
            else delete updated.bandedColumns;
            return updated;
          }),
        };
        const renamed =
          input.name.trim() === table.name
            ? []
            : renameTable(
                sheets().map((item) =>
                  item.id === sheet.id ? { ...item, metadata } : item
                ),
                sheet.id,
                table.name,
                input.name
              );
        store.editSheets(
          mergeChanges(renamed, sheet.id, totals.edits, metadata)
        );
      }
      setDialog(undefined);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Unable to save the table.'
      );
    }
  }

  function convertToRange() {
    const current = dialog();
    if (current?.kind !== 'edit' || !options.canEdit()) return;
    if (
      apply(() =>
        convertTableToRange(sheets(), store.activeSheetId(), current.table)
      )
    )
      setDialog(undefined);
  }

  /** A column's distinct shown values, numbers first, and which are shown. */
  function columnChoices(name: string, column: number): TableFilterChoice[] {
    const table = tableNamed(name);
    if (!table) return [];
    const { left } = tableBounds(table);
    const { first, last } = tableDataRows(table);
    const filter = table.filters?.[column - left];
    const shown = filter && new Set(filter.values.map((v) => v.toLowerCase()));
    const values = new Map<string, string>();
    for (let row = first; row <= last; row++) {
      const text = display(row, column).trim();
      if (!values.has(text.toLowerCase())) values.set(text.toLowerCase(), text);
    }
    return [...values.values()]
      .sort((a, b) => {
        if (a === '' || b === '') return Number(a === '') - Number(b === '');
        return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
      })
      .map((value) => ({
        value,
        shown:
          !filter ||
          (value === '' ? !!filter.blanks : !!shown?.has(value.toLowerCase())),
      }));
  }

  /** Show only `shown` values of a column; undefined clears its filter. */
  function filterColumn(name: string, column: number, shown?: string[]) {
    const table = tableNamed(name);
    if (!table || !options.canEdit()) return;
    const offset = String(column - tableBounds(table).left);
    const filters = { ...table.filters };
    if (shown) {
      const filter: TableColumnFilter = {
        values: shown.filter((value) => value !== ''),
      };
      if (shown.includes('')) filter.blanks = true;
      filters[offset] = filter;
    } else delete filters[offset];
    const sheet = store.activeSheet();
    apply(() => [
      {
        sheetId: sheet.id,
        edits: {},
        metadata: filterTable({
          metadata: sheet.metadata,
          name,
          filters,
          display,
        }),
      },
    ]);
  }

  /**
   * Sort a table's data rows by a column. Rows its filters hide stay hidden
   * and move with their values.
   */
  async function sortColumn(name: string, column: number, descending: boolean) {
    const table = tableNamed(name);
    if (!table || !options.canEdit()) return;
    if (options.calculating()) {
      options.setNotice('Wait for the sheet to finish calculating, then sort.');
      return;
    }
    const { left, right } = tableBounds(table);
    const { first, last } = tableDataRows(table);
    if (first >= last) return;
    const sheet = store.activeSheet();
    const revision = store.revision();
    const current = ++operation;
    const copies = sortedRangeCopies(
      sheet.cells,
      options.values(),
      {
        anchor: { row: first, column: left },
        focus: { row: last, column: right },
      },
      descending,
      column
    );
    const edits = await options.copyCells(copies);
    if (
      current !== operation ||
      revision !== store.revision() ||
      sheet.id !== store.activeSheetId() ||
      !options.canEdit()
    ) {
      options.setNotice(
        'The sheet changed while sorting. Sort the table again.'
      );
      return;
    }
    const metadata = store.activeSheet().metadata;
    const keeps = keepsHiddenRow(metadata, name);
    const hidden = new Set(metadata?.hiddenRows ?? []);
    const next = new Set([...hidden].filter(keeps));
    for (const copy of copies)
      if (
        copy.from.column === left &&
        hidden.has(copy.from.row) &&
        !keeps(copy.from.row)
      )
        next.add(copy.to.row);
    const { hiddenRows: _hidden, ...rest } = metadata ?? {};
    apply(() => [
      {
        sheetId: sheet.id,
        edits,
        metadata: next.size
          ? { ...rest, hiddenRows: [...next].sort((a, b) => a - b) }
          : rest,
      },
    ]);
  }

  /** The table whose total row holds the active cell, and its column name. */
  const activeTotal = () => {
    const table = activeTable();
    const { anchor } = options.selection();
    if (!table?.totalsRow || anchor.row !== tableBounds(table).bottom) return;
    const names = tableColumnNames(table, store.cells());
    return { table, column: names[anchor.column - tableBounds(table).left] };
  };

  /** The aggregates the active total row cell offers. */
  const totalChoices = () =>
    activeTotal() ? TOTAL_LABELS.map(([label]) => label) : undefined;

  /** Whether `label` was chosen for the active total cell. */
  function pickTotal(label: string) {
    const total = activeTotal();
    if (!total || !options.canEdit()) return false;
    const aggregate = TOTAL_LABELS.find(([item]) => item === label);
    if (!aggregate) return false;
    const { anchor } = options.selection();
    store.setCells({
      [formatCellAddress(anchor.row, anchor.column)]: {
        value: aggregate[1] ? totalsFormula(aggregate[1], total.column) : '',
      },
    });
    return true;
  }

  return {
    dialog,
    error,
    activeTable,
    openDialog,
    closeDialog: () => setDialog(undefined),
    save,
    convertToRange,
    columnChoices,
    filterColumn,
    sortColumn,
    totalChoices,
    pickTotal,
  };
}
