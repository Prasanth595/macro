import type { RangeMove } from '@macro-inc/spreadsheet/workbook-structure';
import { type Accessor, createSignal } from 'solid-js';
import {
  type CellPosition,
  type CellSelection,
  selectionBounds,
} from '../core/grid-selection';
import { moveReplacesValues } from '../core/sheet-operations';
import type { SpreadsheetWorkbookSheet } from '../core/workbook-document';
import type { SpreadsheetStore } from './create-spreadsheet-store';

type PendingMove = {
  move: RangeMove;
  selection: CellSelection;
  before: SpreadsheetWorkbookSheet[];
  revision: number;
};

/**
 * Move the selected cells to another place on their sheet. Replacing values
 * waits for confirmation. The move is one revision-checked structural change,
 * so a collaborator's edit in the meantime cancels it and undo reverses it.
 */
export function createRangeMove(options: {
  store: Pick<
    SpreadsheetStore,
    'workbook' | 'revision' | 'activeSheetId' | 'applyStructure'
  >;
  canMove: Accessor<boolean>;
  moveRange: (
    sheets: SpreadsheetWorkbookSheet[],
    move: RangeMove
  ) => Promise<SpreadsheetWorkbookSheet[]>;
  setBusy: (busy: boolean) => void;
  setNotice: (message: string) => void;
  select: (anchor: CellPosition, focus: CellPosition) => void;
}) {
  const [confirming, setConfirming] = createSignal<PendingMove>();

  async function apply(pending: PendingMove) {
    options.setBusy(true);
    try {
      const next = await options.moveRange(pending.before, pending.move);
      options.store.applyStructure(pending.before, next, pending.revision);
      if (options.store.activeSheetId() !== pending.move.sheetId) return;
      const { rows, columns } = pending.move;
      const { anchor, focus } = pending.selection;
      options.select(
        { row: anchor.row + rows, column: anchor.column + columns },
        { row: focus.row + rows, column: focus.column + columns }
      );
    } catch (error) {
      options.setNotice(
        error instanceof Error ? error.message : 'Unable to move cells.'
      );
    } finally {
      options.setBusy(false);
    }
  }

  return {
    /** A move that replaces values, waiting for confirmation. */
    confirming,
    move(selection: CellSelection, rows: number, columns: number) {
      if (!options.canMove() || (!rows && !columns)) return;
      const before = structuredClone(options.store.workbook());
      const sheetId = options.store.activeSheetId();
      const pending: PendingMove = {
        move: { sheetId, source: selectionBounds(selection), rows, columns },
        selection,
        before,
        revision: options.store.revision(),
      };
      const cells = before.find((sheet) => sheet.id === sheetId)?.cells ?? {};
      if (!moveReplacesValues(cells, pending.move)) return apply(pending);
      setConfirming(pending);
    },
    confirm() {
      const pending = confirming();
      setConfirming(undefined);
      if (pending) return apply(pending);
    },
    cancel: () => setConfirming(undefined),
  };
}
