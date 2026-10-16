import { cellPlainText } from '@macro-inc/spreadsheet/cell-mentions';
import {
  MAX_SHEET_TABLES,
  type SheetTable,
  type TableColumnFilter,
  tableBounds,
  tableColumnNames,
  totalsFunction,
  validSheetTable,
} from '@macro-inc/spreadsheet/sheet-tables';
import {
  qualifyStructuredReferences,
  type WorkbookTable,
} from '@macro-inc/spreadsheet/structured-references';
import {
  formatCellAddress,
  SPREADSHEET_MAX_ROWS,
  type SpreadsheetCells,
} from './spreadsheet-document';
import type { XlsxArchive } from './xlsx-archive';
import { addFunctionPrefixes } from './xlsx-formula';
import {
  attributes,
  parse,
  rangeBounds,
  relationships,
  unescapeText,
} from './xlsx-parts';
import { escapeXml } from './xlsx-workbook-parts';

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

/** A table part of an imported workbook. */
export type XlsxTable = {
  /** Where formulas find it, to resolve references to it. */
  layout: WorkbookTable;
  /** The table Macro keeps; one without a header row becomes cells. */
  table?: SheetTable;
};

export const TABLE_FILTER_WARNING =
  'Excel table filters other than lists of values are imported as hidden rows.';

/** Read each worksheet's table parts. */
export function readXlsxTables(
  archive: XlsxArchive,
  sheets: { name: string; path: string }[],
  warnings: Set<string>
): XlsxTable[] {
  const tables: XlsxTable[] = [];
  for (const sheet of sheets) {
    let kept = 0;
    for (const relation of relationships(archive, sheet.path).values()) {
      if (relation.type !== 'table' || relation.external) continue;
      const bytes = archive.read(relation.target);
      if (!bytes) continue;
      let layout: WorkbookTable | undefined;
      let style: Record<string, string> | undefined;
      const filters: Record<string, TableColumnFilter> = {};
      let column: string | undefined;
      let filter: TableColumnFilter | undefined;
      parse(bytes, relation.target, (parser) => {
        parser.on('opentag', (node) => {
          const value = attributes(node);
          if (node.local === 'table') {
            const range = rangeBounds(value.ref ?? '');
            const name = value.displayName ?? value.name;
            if (!range || !name) return;
            layout = {
              name,
              sheet: sheet.name,
              ...range,
              headerRows: value.headerRowCount === '0' ? 0 : 1,
              totalsRows: Number(value.totalsRowCount ?? 0) > 0 ? 1 : 0,
              columns: [],
            };
          } else if (node.local === 'tableColumn')
            layout?.columns.push(unescapeText(value.name ?? ''));
          else if (node.local === 'filterColumn') column = value.colId;
          else if (node.local === 'filters' && column !== undefined)
            filter = {
              values: [],
              ...((value.blank === '1' || value.blank === 'true') && {
                blanks: true,
              }),
            };
          else if (node.local === 'filter')
            filter?.values.push(unescapeText(value.val ?? ''));
          else if (
            [
              'customFilters',
              'top10',
              'dynamicFilter',
              'colorFilter',
              'iconFilter',
              'dateGroupItem',
            ].includes(node.local)
          )
            warnings.add(TABLE_FILTER_WARNING);
          else if (node.local === 'tableStyleInfo') style = value;
        });
        parser.on('closetag', (node) => {
          if (node.local === 'filters' && filter && column !== undefined)
            filters[column] = filter;
          if (node.local === 'filters') filter = undefined;
          if (node.local === 'filterColumn') column = undefined;
        });
      });
      if (!layout) continue;
      const shown = (key: string) => style?.[key] === '1';
      const table: SheetTable = {
        name: layout.name,
        range: `${formatCellAddress(layout.top, layout.left)}:${formatCellAddress(layout.bottom, layout.right)}`,
        totalsRow: layout.totalsRows > 0,
        bandedRows: shown('showRowStripes'),
        ...(shown('showColumnStripes') && { bandedColumns: true }),
        ...(shown('showFirstColumn') && { firstColumn: true }),
        ...(shown('showLastColumn') && { lastColumn: true }),
        ...(style?.name && { style: style.name }),
        ...(Object.keys(filters).length && { filters }),
      };
      const fits =
        layout.headerRows > 0 &&
        layout.bottom < SPREADSHEET_MAX_ROWS &&
        kept < MAX_SHEET_TABLES;
      // Filters Macro cannot hold give way to the table.
      const { filters: _filters, ...unfiltered } = table;
      const keep = fits
        ? [table, unfiltered].find((candidate) => validSheetTable(candidate))
        : undefined;
      if (keep === unfiltered && table.filters)
        warnings.add(TABLE_FILTER_WARNING);
      if (keep) kept++;
      tables.push(keep ? { layout, table: keep } : { layout });
    }
  }
  return tables;
}

/** Text for an XML attribute. Parsers turn line breaks and tabs there into
 * spaces, so control characters use OOXML's `_xHHHH_` escape, as Excel
 * writes column names. */
function attribute(value: string) {
  return escapeXml(
    value.replace(/_(x[0-9a-f]{4}_)/gi, '_x005F_$1').replace(
      // Control characters: everything below the space.
      /[^ -\uffff]/g,
      (character) =>
        `_x${character.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}_`
    )
  );
}

/** Text Excel would read as something other than text, such as a number. */
const NOT_TEXT =
  /^(?:[=+@'#-]|[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$|(?:true|false)$)/i;

/** Cells with each table's header holding its column name as text, as
 * Excel requires. */
export function withTableHeaders(
  cells: SpreadsheetCells,
  tables: SheetTable[] | undefined
): SpreadsheetCells {
  if (!tables?.length) return cells;
  const result = { ...cells };
  for (const table of tables) {
    const { top, left } = tableBounds(table);
    tableColumnNames(table, cells).forEach((name, offset) => {
      const address = formatCellAddress(top, left + offset);
      const cell = cells[address];
      const text =
        cell &&
        !(cell.value.startsWith('=') && cell.format !== 'text') &&
        cellPlainText(cell.value).replace(/^'/, '');
      const writtenAsText =
        cell?.format === 'text' ||
        cell?.value.startsWith("'") ||
        (cell && cellPlainText(cell.value) !== cell.value) ||
        !NOT_TEXT.test(name);
      if (text === name && writtenAsText) return;
      result[address] = {
        ...cell,
        value: NOT_TEXT.test(name) ? `'${name}` : name,
      };
    });
  }
  return result;
}

/**
 * The table part Excel reads: its range, column names, total row functions
 * from the total row's cells, value filters and style.
 */
export function xlsxTablePart(options: {
  table: SheetTable;
  id: number;
  sheet: string;
  cells: SpreadsheetCells;
  tables: WorkbookTable[];
}): string {
  const { table } = options;
  const bounds = tableBounds(table);
  const names = tableColumnNames(table, options.cells);
  const columns = names.map((name, offset) => {
    let totals = '';
    let formula = '';
    if (table.totalsRow) {
      const column = bounds.left + offset;
      const value =
        options.cells[formatCellAddress(bounds.bottom, column)]?.value;
      const aggregate = value && totalsFunction(value, name, table.name);
      if (aggregate) totals = ` totalsRowFunction="${aggregate}"`;
      else if (value?.startsWith('=')) {
        totals = ' totalsRowFunction="custom"';
        formula = `<totalsRowFormula>${escapeXml(
          addFunctionPrefixes(
            qualifyStructuredReferences(
              value.slice(1),
              options.tables,
              options.sheet,
              bounds.bottom,
              column
            )
          )
        )}</totalsRowFormula>`;
      } else if (value)
        totals = ` totalsRowLabel="${attribute(value.replace(/^'/, ''))}"`;
    }
    const open = `<tableColumn id="${offset + 1}" name="${attribute(name)}"${totals}`;
    return formula ? `${open}>${formula}</tableColumn>` : `${open}/>`;
  });
  const filterRange = `${formatCellAddress(bounds.top, bounds.left)}:${formatCellAddress(bounds.bottom - (table.totalsRow ? 1 : 0), bounds.right)}`;
  const filters = Object.entries(table.filters ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(
      ([offset, filter]) =>
        `<filterColumn colId="${offset}"><filters${filter.blanks ? ' blank="1"' : ''}>${filter.values
          .map((value) => `<filter val="${attribute(value)}"/>`)
          .join('')}</filters></filterColumn>`
    )
    .join('');
  const flag = (value: boolean | undefined) => (value ? '1' : '0');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<table xmlns="${MAIN}" id="${options.id}" name="${escapeXml(table.name)}" displayName="${escapeXml(table.name)}" ref="${table.range}"${table.totalsRow ? ' totalsRowCount="1"' : ''}><autoFilter ref="${filterRange}"${filters ? `>${filters}</autoFilter>` : '/>'}<tableColumns count="${columns.length}">${columns.join('')}</tableColumns><tableStyleInfo${table.style ? ` name="${escapeXml(table.style)}"` : ''} showFirstColumn="${flag(table.firstColumn)}" showLastColumn="${flag(table.lastColumn)}" showRowStripes="${flag(table.bandedRows)}" showColumnStripes="${flag(table.bandedColumns)}"/></table>`;
}
