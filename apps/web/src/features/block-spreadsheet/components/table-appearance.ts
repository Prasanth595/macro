import {
  type SheetTable,
  tableAt,
  tableBounds,
} from '@macro-inc/spreadsheet/sheet-tables';

/** The Office theme's accent colors, which Excel's table styles use. */
const ACCENTS = [
  '#4472C4',
  '#ED7D31',
  '#A5A5A5',
  '#FFC000',
  '#5B9BD5',
  '#70AD47',
];

/**
 * An Excel table style's color and whether its header is filled. Each style
 * family repeats gray and the six accents, so TableStyleMedium2 (Excel's
 * default) is the first accent. A custom style draws as the default.
 */
function styleAccent(style: string) {
  const match = /^TableStyle(Light|Medium|Dark)(\d+)$/.exec(style);
  if (!match) return { color: ACCENTS[0], filledHeader: true };
  const offset = (Number(match[2]) - 1) % 7;
  return {
    color: offset ? ACCENTS[offset - 1] : '#7F7F7F',
    filledHeader: match[1] !== 'Light',
  };
}

/** How a table draws one of its cells, under the cell's own formatting. */
export type TableCellLook = {
  background?: string;
  color?: string;
  bold?: boolean;
  borderTop?: string;
  borderBottom?: string;
  /** The table whose header row holds the cell. */
  header?: SheetTable;
};

export function tableCellLook(
  tables: SheetTable[] | undefined,
  row: number,
  column: number
): TableCellLook | undefined {
  const table = tableAt(tables, row, column);
  if (!table) return;
  const bounds = tableBounds(table);
  if (!table.style) return row === bounds.top ? { header: table } : {};
  const { color, filledHeader } = styleAccent(table.style);
  if (row === bounds.top)
    return filledHeader
      ? { background: color, color: '#ffffff', bold: true, header: table }
      : { bold: true, borderBottom: `1px solid ${color}`, header: table };
  if (table.totalsRow && row === bounds.bottom)
    return { bold: true, borderTop: `3px double ${color}` };
  const stripe =
    (table.bandedRows && (row - bounds.top - 1) % 2 === 0) ||
    (!!table.bandedColumns && (column - bounds.left) % 2 === 0);
  const emphasized =
    (table.firstColumn && column === bounds.left) ||
    (table.lastColumn && column === bounds.right);
  return {
    // A translucent tint reads on light and dark themes alike.
    ...(stripe && {
      background: `color-mix(in srgb, ${color} 18%, transparent)`,
    }),
    ...(emphasized && { bold: true }),
  };
}
