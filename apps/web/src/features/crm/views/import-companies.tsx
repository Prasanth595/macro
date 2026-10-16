import { Button, Dialog, Panel } from '@ui';
import { For, Show } from 'solid-js';
import { createCompanyImport } from '../primitives/import-companies';
import { useCompanyImporter } from './use-crm';

/** The preview lists this many rows; the import takes them all. */
const PREVIEW_ROWS = 100;

export function CrmImport(props: { onClose: () => void }) {
  const { rows, skipped, error, pending, completed, existing, read, run } =
    createCompanyImport(useCompanyImporter());
  const done = () => completed() + existing();
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !pending() && props.onClose()}
      class="w-112 max-w-[calc(100vw-2rem)]"
    >
      <Panel>
        <Panel.Body>
          <div class="flex flex-col gap-4 p-5">
            <Dialog.Title class="text-base font-semibold">
              Import companies
            </Dialog.Title>
            <Dialog.Description class="text-sm text-ink-muted">
              Upload a CSV with a domain column and, optionally, a name or
              company column, such as a Macro CRM export. Review the companies
              before importing them into your team CRM.
            </Dialog.Description>
            <input
              aria-label="Companies CSV"
              type="file"
              accept=".csv,text/csv"
              disabled={pending()}
              onChange={(e) => void read(e.currentTarget.files?.[0])}
              class="text-sm"
            />
            <Show when={rows().length && !pending()}>
              <div class="max-h-64 overflow-auto rounded-lg border border-edge-muted">
                <For each={rows().slice(0, PREVIEW_ROWS)}>
                  {(row) => (
                    <div class="flex justify-between gap-3 border-b border-edge-muted px-3 py-2 text-sm last:border-0">
                      <span class="truncate">{row.name}</span>
                      <span class="text-ink-muted">{row.domain}</span>
                    </div>
                  )}
                </For>
                <Show when={rows().length > PREVIEW_ROWS}>
                  <div class="px-3 py-2 text-sm text-ink-muted">
                    and {(rows().length - PREVIEW_ROWS).toLocaleString()} more
                  </div>
                </Show>
              </div>
            </Show>
            <Show when={skipped() && !done()}>
              <p class="text-sm text-ink-muted">
                {skipped().toLocaleString()} rows skipped: no domain like
                acme.com, or a domain listed earlier in the file.
              </p>
            </Show>
            <Show when={done()}>
              <p role="status" class="text-sm">
                {completed().toLocaleString()}{' '}
                {completed() === 1 ? 'company' : 'companies'} imported
                <Show when={existing()}>
                  , {existing().toLocaleString()} already in your CRM
                </Show>
                .
              </p>
            </Show>
            <Show when={error()}>
              <p role="alert" class="text-sm text-failure">
                {error()}
              </p>
            </Show>
            <div class="flex justify-end gap-2">
              <Button
                variant="ghost"
                disabled={pending()}
                onClick={props.onClose}
              >
                Close
              </Button>
              <Button
                variant="strong"
                disabled={pending() || !rows().length}
                onClick={() => void run()}
              >
                {pending()
                  ? `Importing… ${done().toLocaleString()} of ${rows().length.toLocaleString()}`
                  : `Import ${rows().length ? rows().length.toLocaleString() : ''} companies`}
              </Button>
            </div>
          </div>
        </Panel.Body>
      </Panel>
    </Dialog>
  );
}
