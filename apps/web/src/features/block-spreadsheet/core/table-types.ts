/** The table dialog: converting the selection, or one table's options. */
export type TableDialogState =
  | { kind: 'create'; range: string; name: string }
  | {
      kind: 'edit';
      table: string;
      name: string;
      totalsRow: boolean;
      bandedRows: boolean;
      bandedColumns: boolean;
    };

export type TableDialogInput =
  | { kind: 'create'; range: string; name: string; totalsRow: boolean }
  | {
      kind: 'edit';
      name: string;
      totalsRow: boolean;
      bandedRows: boolean;
      bandedColumns: boolean;
    };

/** One value a column filter lists, and whether the filter shows it. */
export type TableFilterChoice = { value: string; shown: boolean };
