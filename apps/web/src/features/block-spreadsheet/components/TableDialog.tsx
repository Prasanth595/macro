import { Button } from '@ui/components/Button';
import { createSignal, Show } from 'solid-js';
import type {
  TableDialogInput,
  TableDialogState,
} from '../primitives/create-table-actions';
import { SpreadsheetDialog } from './SpreadsheetDialog';

/** Converts the selection to a table, or changes one table's options. */
export function TableDialog(props: {
  dialog: TableDialogState | undefined;
  error?: string;
  onSave: (input: TableDialogInput) => void;
  onConvertToRange: () => void;
  onClose: () => void;
  onRestoreFocus: () => void;
}) {
  return (
    <SpreadsheetDialog
      open={!!props.dialog}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      onRestoreFocus={props.onRestoreFocus}
      position="center"
      class="w-96"
    >
      <Show when={props.dialog} keyed>
        {(dialog) => <TableForm {...props} dialog={dialog} />}
      </Show>
    </SpreadsheetDialog>
  );
}

function TextField(props: {
  label: string;
  value: string;
  placeholder?: string;
  onInput: (value: string) => void;
}) {
  return (
    <label class="flex flex-col gap-1 text-xs font-medium text-ink-muted">
      {props.label}
      <input
        required
        value={props.value}
        placeholder={props.placeholder}
        onInput={(event) => props.onInput(event.currentTarget.value)}
        class="w-full rounded border border-edge-muted bg-input px-3 py-2 text-sm font-normal text-ink outline-none placeholder:text-ink-placeholder focus:border-accent"
      />
    </label>
  );
}

function Option(props: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label class="flex items-center gap-2 touch:min-h-[44px]">
      <input
        type="checkbox"
        class="touch:size-[20px]"
        checked={props.checked}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
      />
      {props.label}
    </label>
  );
}

function TableForm(props: {
  dialog: TableDialogState;
  error?: string;
  onSave: (input: TableDialogInput) => void;
  onConvertToRange: () => void;
  onClose: () => void;
}) {
  const dialog = props.dialog;
  const [range, setRange] = createSignal(
    dialog.kind === 'create' ? dialog.range : ''
  );
  const [name, setName] = createSignal(dialog.name);
  const [totalsRow, setTotalsRow] = createSignal(
    dialog.kind === 'edit' && dialog.totalsRow
  );
  const [bandedRows, setBandedRows] = createSignal(
    dialog.kind === 'create' || dialog.bandedRows
  );
  const [bandedColumns, setBandedColumns] = createSignal(
    dialog.kind === 'edit' && dialog.bandedColumns
  );
  return (
    <form
      class="flex flex-col gap-3 p-5 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave(
          dialog.kind === 'create'
            ? {
                kind: 'create',
                range: range().trim(),
                name: name(),
                totalsRow: totalsRow(),
              }
            : {
                kind: 'edit',
                name: name(),
                totalsRow: totalsRow(),
                bandedRows: bandedRows(),
                bandedColumns: bandedColumns(),
              }
        );
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <SpreadsheetDialog.Title class="font-semibold">
        {dialog.kind === 'create' ? 'Convert to table' : 'Table options'}
      </SpreadsheetDialog.Title>
      <SpreadsheetDialog.Description class="text-ink-muted">
        {dialog.kind === 'create'
          ? 'The first row becomes the header row. Formulas can refer to the table by name, such as Table1[Amount].'
          : `Formulas refer to this table as ${dialog.table}[Column].`}
      </SpreadsheetDialog.Description>
      <Show when={dialog.kind === 'create'}>
        <TextField
          label="Range"
          value={range()}
          placeholder="A1:D20"
          onInput={setRange}
        />
      </Show>
      <TextField label="Table name" value={name()} onInput={setName} />
      <fieldset class="flex flex-col gap-2">
        <Option
          label="Total row"
          checked={totalsRow()}
          onChange={setTotalsRow}
        />
        <Show when={dialog.kind === 'edit'}>
          <Option
            label="Banded rows"
            checked={bandedRows()}
            onChange={setBandedRows}
          />
          <Option
            label="Banded columns"
            checked={bandedColumns()}
            onChange={setBandedColumns}
          />
        </Show>
      </fieldset>
      <Show when={props.error}>
        {(error) => (
          <p role="alert" class="text-xs text-failure">
            {error()}
          </p>
        )}
      </Show>
      <div class="mt-1 flex items-center gap-2">
        <Show when={dialog.kind === 'edit'}>
          <Button
            variant="ghost"
            type="button"
            onClick={props.onConvertToRange}
          >
            Convert to range
          </Button>
        </Show>
        <div class="ml-auto flex gap-2">
          <Button variant="ghost" type="button" onClick={props.onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="strong">
            {dialog.kind === 'create' ? 'Create table' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  );
}
