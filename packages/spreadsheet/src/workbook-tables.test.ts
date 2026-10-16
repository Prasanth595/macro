import { LoroDoc } from 'loro-crdt';
import { afterAll, describe, expect, it } from 'vitest';
import { validateSpreadsheetDocument } from './document-validation';
import {
  readSpreadsheetCells,
  writeSpreadsheetCells,
} from './spreadsheet-document';
import {
  addSpreadsheetSheet,
  createSpreadsheetTable,
  deleteSpreadsheetSheet,
  duplicateSpreadsheetSheet,
  importSpreadsheetSheets,
  readSpreadsheetWorkbook,
} from './workbook-document';

const documents: LoroDoc[] = [];
function document() {
  const doc = new LoroDoc();
  doc.getMap('spreadsheetMeta').set('formatVersion', 1);
  writeSpreadsheetCells(doc, {
    A1: { value: 'Item' },
    B1: { value: 'Qty' },
    A2: { value: 'Pens' },
    B2: { value: '2' },
    C2: { value: '=Sales[@Qty]*2' },
  });
  documents.push(doc);
  return doc;
}
afterAll(() => {
  for (const doc of documents) doc.free();
});

describe('tables in the workbook document', () => {
  it('creates a table with the next free name and a valid document', () => {
    const doc = document();
    expect(createSpreadsheetTable(doc, 'sheet1', { range: 'A1:B2' })).toBe(
      'Table1'
    );
    expect(() =>
      createSpreadsheetTable(doc, 'sheet1', { range: 'D1:E2', name: 'table1' })
    ).toThrow('already uses the name');
    doc.commit();
    validateSpreadsheetDocument(doc);
    expect(readSpreadsheetWorkbook(doc)[0].metadata?.tables).toEqual([
      { name: 'Table1', range: 'A1:B2', totalsRow: false, bandedRows: true },
    ]);
  });

  it('gives a duplicated sheet new table names that its formulas use', () => {
    const doc = document();
    createSpreadsheetTable(doc, 'sheet1', { range: 'A1:C2', name: 'Sales' });
    doc.commit();
    const copy = duplicateSpreadsheetSheet(doc, 'sheet1');
    const sheet = readSpreadsheetWorkbook(doc).find((item) => item.id === copy);
    expect(sheet?.metadata?.tables?.[0].name).toBe('Table1');
    expect(readSpreadsheetCells(doc, copy).C2.value).toBe('=Table1[@Qty]*2');
    expect(readSpreadsheetCells(doc, 'sheet1').C2.value).toBe('=Sales[@Qty]*2');
  });

  it('keeps a sheet whose tables other sheets use', () => {
    const doc = document();
    createSpreadsheetTable(doc, 'sheet1', { range: 'A1:C2', name: 'Sales' });
    const other = addSpreadsheetSheet(doc, 'Summary');
    writeSpreadsheetCells(doc, { A1: { value: '=SUM(Sales[Qty])' } }, other);
    expect(() => deleteSpreadsheetSheet(doc, 'sheet1')).toThrow(
      'use the table “Sales”'
    );
    writeSpreadsheetCells(doc, { A1: { value: '1' } }, other);
    deleteSpreadsheetSheet(doc, 'sheet1');
    expect(readSpreadsheetWorkbook(doc).map((sheet) => sheet.name)).toEqual([
      'Summary',
    ]);
  });

  it('refuses to append sheets whose table names the workbook uses', () => {
    const doc = document();
    createSpreadsheetTable(doc, 'sheet1', { range: 'A1:C2', name: 'Sales' });
    doc.commit();
    expect(() =>
      importSpreadsheetSheets(doc, [
        {
          name: 'Imported',
          cells: { A1: { value: 'X' } },
          rowCount: 200,
          columnWidths: {},
          metadata: {
            tables: [
              {
                name: 'SALES',
                range: 'A1:A2',
                totalsRow: false,
                bandedRows: true,
              },
            ],
          },
        },
      ])
    ).toThrow('already has a table or name called “SALES”');
  });
});
