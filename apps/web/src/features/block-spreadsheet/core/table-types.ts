import type { SheetTable } from '@macro-inc/spreadsheet/sheet-tables';
import type { GroupSummary } from '@macro-inc/spreadsheet/table-groups';
import type { JSX } from 'solid-js';

/** The table dialog: renaming a table, or changing the cells it covers. */
export type TableDialogState =
  | { kind: 'rename'; table: string; name: string }
  | { kind: 'range'; table: string; range: string };

export type TableDialogInput =
  | { kind: 'rename'; name: string }
  | { kind: 'range'; range: string };

/** One value a column filter lists, and whether the filter shows it. */
export type TableFilterChoice = { value: string; shown: boolean };

/** A group by view of a table: its rows grouped by one column's values,
 * with another column summarized for each group. */
export type TableGroupView = {
  table: string;
  column: number;
  summaryColumn: number;
  summary: GroupSummary;
};

/** Formatting options a table's menu toggles. */
export type TableOption =
  | 'bandedRows'
  | 'bandedColumns'
  | 'firstColumn'
  | 'lastColumn';

/** What the grid draws for tables beyond their style. */
export type TableGridUi = {
  /** The menu of a header cell of `table`, in sheet column `column`. */
  columnMenu: (table: () => SheetTable, column: number) => JSX.Element;
  /** A table's name and menu, placed by `style` above its header row or,
   * for a table in the first row, compact in the column header bar. */
  tableMenu: (
    table: () => SheetTable,
    style: () => JSX.CSSProperties,
    inHeader: () => boolean
  ) => JSX.Element;
  /** Why a cell's value does not fit its column's type. */
  mismatch: (row: number, column: number) => string | undefined;
  /** The aggregate a total row cell shows, such as `Sum`. */
  totalLabel: (row: number, column: number) => string | undefined;
  /** A table's column names. */
  columnNames: (table: string) => string[];
  /** The table whose menu is open. */
  menuTable: () => string | undefined;
};
