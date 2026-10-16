import { cellPlainText } from './cell-mentions';
import { sqrefBounds } from './sheet-rules';
import {
  formatCellAddress,
  parseCellAddress,
  type SpreadsheetCellEdits,
  type SpreadsheetCells,
} from './spreadsheet-document';
import {
  escapedColumnName,
  renameTableReferences,
  resolveStructuredReferences,
  type WorkbookTable,
} from './structured-references';
import type { WorkbookSheetMetadata } from './workbook-metadata';

export const MAX_SHEET_TABLES = 100;
const MAX_TABLE_NAME_LENGTH = 255;
const MAX_FILTER_VALUES = 10_000;
const MAX_FILTER_VALUE_LENGTH = 1_000;

/** The values a column's filter shows, as Excel stores them. */
export type TableColumnFilter = { values: string[]; blanks?: boolean };

/**
 * A named, structured range: a header row naming its columns, data rows and
 * an optional total row. Column names are the header cells' text, so a cell
 * edit renames a column.
 */
export type SheetTable = {
  /** Unique in the workbook, ignoring case; formulas use it. */
  name: string;
  /** Header row through the last row, the total row included. */
  range: string;
  totalsRow: boolean;
  bandedRows: boolean;
  bandedColumns?: boolean;
  firstColumn?: boolean;
  lastColumn?: boolean;
  /** The Excel table style, kept for export. */
  style?: string;
  /** Filters by column position from the table's first column. */
  filters?: Record<string, TableColumnFilter>;
};

/** Total row aggregates and the SUBTOTAL function numbers Excel writes for
 * them, which leave rows hidden by filters out. */
export const TABLE_TOTALS_FUNCTIONS = {
  sum: 109,
  average: 101,
  count: 103,
  countNums: 102,
  max: 104,
  min: 105,
  stdDev: 107,
  var: 110,
} as const;
export type TableTotalsFunction = keyof typeof TABLE_TOTALS_FUNCTIONS;

export type TableBounds = {
  top: number;
  left: number;
  bottom: number;
  right: number;
};

export function tableBounds(table: Pick<SheetTable, 'range'>): TableBounds {
  const [bounds] = sqrefBounds(table.range);
  return bounds;
}

/** The rows of a table that hold data: not its header or total row. */
export function tableDataRows(table: SheetTable) {
  const { top, bottom } = tableBounds(table);
  return { first: top + 1, last: bottom - (table.totalsRow ? 1 : 0) };
}

/** Excel's naming rules: a letter, `_` or `\` first, then letters, digits,
 * `.` and `_`; never something that reads as a cell reference. */
export function validTableName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= MAX_TABLE_NAME_LENGTH &&
    /^[\p{L}_\\][\p{L}\p{N}_.\\]*$/u.test(name) &&
    !/^[A-Z]{1,3}\d+$/i.test(name) &&
    !/^R\d*C\d*$/i.test(name)
  );
}

function validFilter(value: unknown): value is TableColumnFilter {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const filter = value as Record<string, unknown>;
  return (
    Object.keys(filter).every((key) => key === 'values' || key === 'blanks') &&
    Array.isArray(filter.values) &&
    filter.values.length <= MAX_FILTER_VALUES &&
    filter.values.every(
      (item) =>
        typeof item === 'string' && item.length <= MAX_FILTER_VALUE_LENGTH
    ) &&
    (filter.blanks === undefined || typeof filter.blanks === 'boolean')
  );
}

export function validSheetTable(value: unknown): value is SheetTable {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const table = value as Record<string, unknown>;
  if (
    !Object.keys(table).every((key) =>
      [
        'name',
        'range',
        'totalsRow',
        'bandedRows',
        'bandedColumns',
        'firstColumn',
        'lastColumn',
        'style',
        'filters',
      ].includes(key)
    ) ||
    typeof table.name !== 'string' ||
    !validTableName(table.name) ||
    typeof table.range !== 'string' ||
    typeof table.totalsRow !== 'boolean' ||
    typeof table.bandedRows !== 'boolean' ||
    ['bandedColumns', 'firstColumn', 'lastColumn'].some(
      (key) => table[key] !== undefined && typeof table[key] !== 'boolean'
    ) ||
    (table.style !== undefined &&
      (typeof table.style !== 'string' || table.style.length > 255))
  )
    return false;
  const [first, last, ...rest] = table.range.split(':').map(parseCellAddress);
  if (!first || !last || rest.length) return false;
  // A header row and a data row, and the total row when there is one.
  const rows = last.row - first.row + 1;
  if (last.column < first.column || rows < (table.totalsRow ? 3 : 2))
    return false;
  const width = last.column - first.column + 1;
  return (
    table.filters === undefined ||
    (!!table.filters &&
      typeof table.filters === 'object' &&
      !Array.isArray(table.filters) &&
      Object.entries(table.filters).every(
        ([key, filter]) =>
          /^\d+$/.test(key) && Number(key) < width && validFilter(filter)
      ))
  );
}

/**
 * Column names from the header cells: their text, `Column1` and so on for
 * blank or formula headers, and a number appended to repeated names, as
 * Excel names them.
 */
export function tableColumnNames(
  table: Pick<SheetTable, 'range'>,
  cells: SpreadsheetCells
): string[] {
  const { top, left, right } = tableBounds(table);
  const taken = new Set<string>();
  const names: string[] = [];
  for (let column = left; column <= right; column++) {
    const cell = cells[formatCellAddress(top, column)];
    const text =
      !cell || (cell.value.startsWith('=') && cell.format !== 'text')
        ? ''
        : cellPlainText(cell.value).replace(/^'/, '').trim();
    let name = text || `Column${column - left + 1}`;
    for (let suffix = 2; taken.has(name.toLowerCase()); suffix++)
      name = `${text || `Column${column - left + 1}`}${suffix}`;
    taken.add(name.toLowerCase());
    names.push(name);
  }
  return names;
}

/** Where a sheet's tables are and their column names, as formulas see them. */
export function sheetTableLayouts(sheet: {
  name: string;
  cells: SpreadsheetCells;
  metadata?: Pick<WorkbookSheetMetadata, 'tables'>;
}): WorkbookTable[] {
  return (sheet.metadata?.tables ?? []).map((table) => ({
    name: table.name,
    sheet: sheet.name,
    ...tableBounds(table),
    headerRows: 1,
    totalsRows: table.totalsRow ? 1 : 0,
    columns: tableColumnNames(table, sheet.cells),
  }));
}

export function tableAt(
  tables: SheetTable[] | undefined,
  row: number,
  column: number
): SheetTable | undefined {
  return tables?.find((table) => {
    const bounds = tableBounds(table);
    return (
      row >= bounds.top &&
      row <= bounds.bottom &&
      column >= bounds.left &&
      column <= bounds.right
    );
  });
}

function overlaps(first: TableBounds, second: TableBounds) {
  return (
    first.top <= second.bottom &&
    first.bottom >= second.top &&
    first.left <= second.right &&
    first.right >= second.left
  );
}

/** The first `Table1`, `Table2`… not among `taken`. */
export function nextTableName(taken: Iterable<string>): string {
  const names = new Set([...taken].map((name) => name.toLowerCase()));
  for (let index = 1; ; index++)
    if (!names.has(`table${index}`)) return `Table${index}`;
}

/** A valid name no other table or defined name uses, or an explanation. */
export function checkTableName(name: string, taken: Iterable<string>): string {
  const trimmed = name.trim();
  if (!validTableName(trimmed))
    throw new Error(
      `“${trimmed}” is not a valid table name. Start with a letter or underscore and use only letters, numbers, periods and underscores, without spaces; a name cannot look like a cell reference such as A1.`
    );
  const lower = trimmed.toLowerCase();
  if ([...taken].some((existing) => existing.toLowerCase() === lower))
    throw new Error(
      `The workbook already uses the name “${trimmed}”. Choose another table name.`
    );
  return trimmed;
}

/** The total row formula of an aggregate, such as `=SUBTOTAL(109,[Amount])`. */
export function totalsFormula(
  aggregate: TableTotalsFunction,
  column: string
): string {
  return `=SUBTOTAL(${TABLE_TOTALS_FUNCTIONS[aggregate]},[${escapedColumnName(column)}])`;
}

/** The aggregate a total row formula computes for `column`, if it is one. */
export function totalsFunction(
  formula: string,
  column: string,
  table?: string
): TableTotalsFunction | undefined {
  const match =
    /^=\s*SUBTOTAL\s*\(\s*(\d+)\s*,\s*([\p{L}\p{N}_.\\]*)\s*\[(.*)\]\s*\)\s*$/iu.exec(
      formula
    );
  if (!match) return;
  if (match[2] && match[2].toLowerCase() !== table?.toLowerCase()) return;
  if (
    match[3].replace(/'(.)/g, '$1').trim().toLowerCase() !==
    column.toLowerCase()
  )
    return;
  return (Object.keys(TABLE_TOTALS_FUNCTIONS) as TableTotalsFunction[]).find(
    (key) => TABLE_TOTALS_FUNCTIONS[key] === Number(match[1])
  );
}

function isEmpty(cells: SpreadsheetCells, row: number, column: number) {
  return !cells[formatCellAddress(row, column)]?.value;
}

/** The total row's starting cells: a label and the last column's total. */
function totalsRowEdits(
  bounds: TableBounds,
  row: number,
  names: string[],
  cells: SpreadsheetCells
): SpreadsheetCellEdits {
  const edits: SpreadsheetCellEdits = {};
  const last = names.length - 1;
  let numeric = false;
  for (let data = bounds.top + 1; data < row && !numeric; data++) {
    const value = cells[formatCellAddress(data, bounds.right)]?.value ?? '';
    numeric =
      value.startsWith('=') ||
      (value.trim() !== '' && Number.isFinite(Number(value)));
  }
  if (last > 0) edits[formatCellAddress(row, bounds.left)] = { value: 'Total' };
  edits[formatCellAddress(row, bounds.right)] = {
    value: totalsFormula(numeric ? 'sum' : 'count', names[last]),
  };
  return edits;
}

export type TableChange = {
  metadata: WorkbookSheetMetadata;
  edits: SpreadsheetCellEdits;
};

/**
 * Convert a range to a table. Its first row becomes the header row: blank,
 * formula and repeated headers are written as the names Excel would give.
 * A one-row range takes the empty row below as its first data row. A
 * filter on the range's cells moves to the table.
 */
export function createTable(options: {
  metadata: WorkbookSheetMetadata | undefined;
  cells: SpreadsheetCells;
  range: string;
  name: string;
  totalsRow?: boolean;
  rowCount: number;
  /** A header formula's displayed text, which becomes its name. */
  display?: (address: string) => string | undefined;
}): TableChange {
  const { metadata, cells } = options;
  const [first, last = first] = options.range
    .split(':')
    .map((address) => parseCellAddress(address.trim().toUpperCase()));
  if (!first || !last || options.range.split(':').length > 2)
    throw new Error(
      `Invalid range “${options.range}”. Select cells such as A1:D20.`
    );
  const bounds: TableBounds = {
    top: Math.min(first.row, last.row),
    left: Math.min(first.column, last.column),
    bottom: Math.max(first.row, last.row),
    right: Math.max(first.column, last.column),
  };
  if (bounds.top === bounds.bottom) {
    const below = bounds.bottom + 1;
    if (below >= options.rowCount)
      throw new Error('Add a row below the headers, then convert them.');
    for (let column = bounds.left; column <= bounds.right; column++)
      if (!isEmpty(cells, below, column))
        throw new Error(
          'Select the headers and the data below them to convert to a table.'
        );
    bounds.bottom = below;
  }
  if ((metadata?.tables?.length ?? 0) >= MAX_SHEET_TABLES)
    throw new Error(`A sheet can have at most ${MAX_SHEET_TABLES} tables.`);
  if (
    (metadata?.tables ?? []).some((table) =>
      overlaps(tableBounds(table), bounds)
    )
  )
    throw new Error(
      'Tables cannot overlap. Select cells outside the existing table.'
    );
  if (
    (metadata?.merges ?? []).some((merge) =>
      sqrefBounds(merge).some((area) => overlaps(area, bounds))
    )
  )
    throw new Error('Unmerge the cells before converting them to a table.');
  const edits: SpreadsheetCellEdits = {};
  const headerCells: SpreadsheetCells = { ...cells };
  for (let column = bounds.left; column <= bounds.right; column++) {
    const address = formatCellAddress(bounds.top, column);
    const cell = cells[address];
    if (cell?.value.startsWith('=') && cell.format !== 'text') {
      const text = options.display?.(address)?.trim() ?? '';
      headerCells[address] = { ...cell, value: text };
    }
  }
  const range = `${formatCellAddress(bounds.top, bounds.left)}:${formatCellAddress(bounds.bottom, bounds.right)}`;
  const names = tableColumnNames({ range }, headerCells);
  names.forEach((name, offset) => {
    const address = formatCellAddress(bounds.top, bounds.left + offset);
    if (cells[address]?.value !== name)
      edits[address] = { value: name.startsWith('=') ? `'${name}` : name };
  });
  const table: SheetTable = {
    name: options.name,
    range,
    totalsRow: false,
    bandedRows: true,
  };
  let next: WorkbookSheetMetadata = {
    ...metadata,
    tables: [...(metadata?.tables ?? []), table],
  };
  if (
    metadata?.autoFilter &&
    overlaps(sqrefBounds(metadata.autoFilter)[0], bounds)
  )
    delete next.autoFilter;
  if (options.totalsRow) {
    const named: SpreadsheetCells = { ...cells };
    for (const [address, edit] of Object.entries(edits))
      if (edit?.value !== undefined)
        named[address] = { ...cells[address], value: edit.value };
    const change = setTableTotalsRow({
      metadata: next,
      cells: named,
      name: table.name,
      totalsRow: true,
      rowCount: options.rowCount,
    });
    next = change.metadata;
    Object.assign(edits, change.edits);
  }
  return { metadata: next, edits };
}

function replaceTable(
  metadata: WorkbookSheetMetadata,
  name: string,
  update: (table: SheetTable) => SheetTable | undefined
): WorkbookSheetMetadata {
  const tables = (metadata.tables ?? []).flatMap((table) => {
    if (table.name !== name) return [table];
    const next = update(table);
    return next ? [next] : [];
  });
  const { tables: _tables, ...rest } = metadata;
  return tables.length ? { ...rest, tables } : rest;
}

function findTable(metadata: WorkbookSheetMetadata | undefined, name: string) {
  const table = metadata?.tables?.find((item) => item.name === name);
  if (!table)
    throw new Error(`There is no table named “${name}” on this sheet.`);
  return table;
}

/**
 * Add a total row below the data, which must be empty, or remove it. A new
 * total row labels the first column and totals the last.
 */
export function setTableTotalsRow(options: {
  metadata: WorkbookSheetMetadata | undefined;
  cells: SpreadsheetCells;
  name: string;
  totalsRow: boolean;
  rowCount: number;
}): TableChange {
  const table = findTable(options.metadata, options.name);
  const metadata = options.metadata ?? {};
  if (table.totalsRow === options.totalsRow) return { metadata, edits: {} };
  const bounds = tableBounds(table);
  const edits: SpreadsheetCellEdits = {};
  if (!options.totalsRow) {
    for (let column = bounds.left; column <= bounds.right; column++)
      if (!isEmpty(options.cells, bounds.bottom, column))
        edits[formatCellAddress(bounds.bottom, column)] = { value: '' };
    return {
      metadata: replaceTable(metadata, table.name, (current) => ({
        ...current,
        totalsRow: false,
        range: `${formatCellAddress(bounds.top, bounds.left)}:${formatCellAddress(bounds.bottom - 1, bounds.right)}`,
      })),
      edits,
    };
  }
  const row = bounds.bottom + 1;
  const blocked =
    row >= options.rowCount ||
    Array.from({ length: bounds.right - bounds.left + 1 }).some(
      (_, offset) => !isEmpty(options.cells, row, bounds.left + offset)
    ) ||
    (metadata.tables ?? []).some(
      (other) =>
        other.name !== table.name &&
        overlaps(tableBounds(other), { ...bounds, top: row, bottom: row })
    );
  if (blocked)
    throw new Error(
      'The row below the table must be empty to add a total row. Clear it or add rows, then try again.'
    );
  Object.assign(
    edits,
    totalsRowEdits(
      bounds,
      row,
      tableColumnNames(table, options.cells),
      options.cells
    )
  );
  return {
    metadata: replaceTable(metadata, table.name, (current) => ({
      ...current,
      totalsRow: true,
      range: `${formatCellAddress(bounds.top, bounds.left)}:${formatCellAddress(row, bounds.right)}`,
    })),
    edits,
  };
}

/**
 * Typing one value directly below a table, or directly right of it, extends
 * the table to include it, as Excel does. A new column's blank header gets
 * a name. Returns undefined when no table grows.
 */
export function expandTables(options: {
  metadata: WorkbookSheetMetadata | undefined;
  cells: SpreadsheetCells;
  edits: SpreadsheetCellEdits;
}): TableChange | undefined {
  const tables = options.metadata?.tables;
  const entries = Object.entries(options.edits);
  if (!tables?.length || entries.length !== 1) return;
  const [address, edit] = entries[0];
  const position = parseCellAddress(address);
  if (
    !position ||
    !edit?.value ||
    tableAt(tables, position.row, position.column)
  )
    return;
  for (const table of tables) {
    const bounds = tableBounds(table);
    const below =
      !table.totalsRow &&
      position.row === bounds.bottom + 1 &&
      position.column >= bounds.left &&
      position.column <= bounds.right;
    const right =
      position.column === bounds.right + 1 &&
      position.row >= bounds.top &&
      position.row <= bounds.bottom;
    if (!below && !right) continue;
    const grown = below
      ? { ...bounds, bottom: bounds.bottom + 1 }
      : { ...bounds, right: bounds.right + 1 };
    if (
      tables.some(
        (other) =>
          other.name !== table.name && overlaps(tableBounds(other), grown)
      )
    )
      return;
    const edits: SpreadsheetCellEdits = {};
    const header = formatCellAddress(bounds.top, position.column);
    if (
      right &&
      position.row !== bounds.top &&
      isEmpty(options.cells, bounds.top, position.column)
    ) {
      const range = `${formatCellAddress(grown.top, grown.left)}:${formatCellAddress(grown.bottom, grown.right)}`;
      edits[header] = {
        value: tableColumnNames({ range }, options.cells).at(-1) ?? '',
      };
    }
    return {
      metadata: replaceTable(options.metadata ?? {}, table.name, (current) => ({
        ...current,
        range: `${formatCellAddress(grown.top, grown.left)}:${formatCellAddress(grown.bottom, grown.right)}`,
      })),
      edits,
    };
  }
}

/** The data rows a table's filters hide, given each cell's displayed text. */
export function tableFilterHiddenRows(
  table: SheetTable,
  display: (row: number, column: number) => string
): number[] {
  const filters = Object.entries(table.filters ?? {}).map(
    ([offset, filter]) => ({
      column: tableBounds(table).left + Number(offset),
      values: new Set(filter.values.map((value) => value.toLowerCase())),
      blanks: !!filter.blanks,
    })
  );
  if (!filters.length) return [];
  const { first, last } = tableDataRows(table);
  const hidden: number[] = [];
  for (let row = first; row <= last; row++)
    if (
      filters.some(({ column, values, blanks }) => {
        const text = display(row, column).trim();
        return text === '' ? !blanks : !values.has(text.toLowerCase());
      })
    )
      hidden.push(row);
  return hidden;
}

/**
 * Set a table's filters and hide the data rows they leave out. Rows of the
 * table's data the filters keep are shown again.
 */
export function filterTable(options: {
  metadata: WorkbookSheetMetadata | undefined;
  name: string;
  filters: SheetTable['filters'];
  display: (row: number, column: number) => string;
}): WorkbookSheetMetadata {
  const table = findTable(options.metadata, options.name);
  const filters = Object.keys(options.filters ?? {}).length
    ? options.filters
    : undefined;
  const filtered: SheetTable = { ...table, filters };
  if (!filters) delete filtered.filters;
  const { first, last } = tableDataRows(table);
  const hidden = new Set(
    (options.metadata?.hiddenRows ?? []).filter(
      (row) => row < first || row > last
    )
  );
  for (const row of tableFilterHiddenRows(filtered, options.display))
    hidden.add(row);
  const metadata = replaceTable(
    options.metadata ?? {},
    table.name,
    () => filtered
  );
  const { hiddenRows: _hidden, ...rest } = metadata;
  return hidden.size
    ? { ...rest, hiddenRows: [...hidden].sort((a, b) => a - b) }
    : rest;
}

/** A sheet as the workbook-wide table operations read it. */
export type TableSheet = {
  id: string;
  name: string;
  cells: SpreadsheetCells;
  metadata?: WorkbookSheetMetadata;
};

/** Cell and metadata changes for several sheets, written as one change. */
export type SheetChanges = {
  sheetId: string;
  edits: SpreadsheetCellEdits;
  metadata?: WorkbookSheetMetadata;
}[];

/** Names tables and defined names already use in the workbook. */
export function workbookNames(sheets: TableSheet[]): string[] {
  return sheets.flatMap((sheet) => [
    ...(sheet.metadata?.tables ?? []).map((table) => table.name),
    ...(sheet.metadata?.definedNames ?? []).map((entry) => entry.name),
  ]);
}

function rewriteFormulas(
  sheets: TableSheet[],
  rewrite: (formula: string, sheet: TableSheet, address: string) => string
) {
  const changes = new Map<string, SpreadsheetCellEdits>();
  for (const sheet of sheets) {
    const edits: SpreadsheetCellEdits = {};
    for (const [address, cell] of Object.entries(sheet.cells)) {
      if (
        !cell.value.startsWith('=') ||
        cell.format === 'text' ||
        !cell.value.includes('[')
      )
        continue;
      const value = rewrite(cell.value, sheet, address);
      if (value !== cell.value) edits[address] = { value };
    }
    changes.set(sheet.id, edits);
  }
  return changes;
}

/** Rename a table and every formula reference to it. */
export function renameTable(
  sheets: TableSheet[],
  sheetId: string,
  from: string,
  to: string
): SheetChanges {
  const sheet = sheets.find((item) => item.id === sheetId);
  findTable(sheet?.metadata, from);
  if (to.trim() === from) return [];
  const name = checkTableName(
    to,
    workbookNames(sheets).filter((existing) => existing !== from)
  );
  const formulas = rewriteFormulas(sheets, (formula) =>
    renameTableReferences(formula, from, name)
  );
  return sheets.flatMap((item) => {
    const edits = formulas.get(item.id) ?? {};
    const metadata =
      item.id === sheetId
        ? replaceTable(item.metadata ?? {}, from, (table) => ({
            ...table,
            name,
          }))
        : undefined;
    return Object.keys(edits).length || metadata
      ? [{ sheetId: item.id, edits, ...(metadata && { metadata }) }]
      : [];
  });
}

/**
 * Turn a table back into ordinary cells: formulas that refer to it get the
 * cell ranges it covers, and rows its filters hid are shown.
 */
export function convertTableToRange(
  sheets: TableSheet[],
  sheetId: string,
  name: string
): SheetChanges {
  const sheet = sheets.find((item) => item.id === sheetId);
  const table = findTable(sheet?.metadata, name);
  const layouts = sheets.flatMap(sheetTableLayouts);
  const formulas = rewriteFormulas(sheets, (formula, current, address) => {
    const position = parseCellAddress(address)!;
    return (
      resolveStructuredReferences(
        formula,
        layouts,
        current.name,
        position.row,
        position.column,
        { only: name }
      ) ?? formula
    );
  });
  const { first, last } = tableDataRows(table);
  return sheets.flatMap((item) => {
    const edits = formulas.get(item.id) ?? {};
    let metadata: WorkbookSheetMetadata | undefined;
    if (item.id === sheetId) {
      metadata = replaceTable(item.metadata ?? {}, name, () => undefined);
      if (table.filters && metadata.hiddenRows) {
        const hiddenRows = metadata.hiddenRows.filter(
          (row) => row < first || row > last
        );
        if (hiddenRows.length) metadata.hiddenRows = hiddenRows;
        else delete metadata.hiddenRows;
      }
    }
    return Object.keys(edits).length || metadata
      ? [{ sheetId: item.id, edits, ...(metadata && { metadata }) }]
      : [];
  });
}
