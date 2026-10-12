import LockIcon from '@phosphor/lock-simple.svg';
import TableIcon from '@phosphor/table.svg';
import { Key } from '@solid-primitives/keyed';
import { Button } from '@ui';
import { type Accessor, createSignal, type JSX, Show } from 'solid-js';
import { PropertyIcon } from '../../database/components/property-icon';
import type { PipelineEntry, PipelineEntryCell } from '../core/pipeline-entry';

/** Fields a card shows before "Show more", like the record's first columns. */
const COLLAPSED_FIELDS = 4;

/** One card per pipeline row that references the record. */
export function PipelineEntryCards(props: {
  entries: PipelineEntry[];
  renderCell: (
    entry: Accessor<PipelineEntry>,
    cell: Accessor<PipelineEntryCell>
  ) => JSX.Element;
  onOpenPipeline?: (pipelineId: string) => void;
}) {
  return (
    <Show when={props.entries.length > 0}>
      <section class="flex flex-col gap-2" aria-label="Pipelines">
        <h2 class="text-xs font-medium text-ink-muted">Pipelines</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <Key each={props.entries} by="rowId">
            {(entry) => (
              <PipelineEntryCard
                entry={entry()}
                renderCell={(cell) => props.renderCell(entry, cell)}
                onOpenPipeline={
                  props.onOpenPipeline
                    ? () => props.onOpenPipeline?.(entry().pipeline.id)
                    : undefined
                }
              />
            )}
          </Key>
        </div>
      </section>
    </Show>
  );
}

function PipelineEntryCard(props: {
  entry: PipelineEntry;
  renderCell: (cell: Accessor<PipelineEntryCell>) => JSX.Element;
  onOpenPipeline?: () => void;
}) {
  const [expanded, setExpanded] = createSignal(false);
  const hidden = () => props.entry.cells.length - COLLAPSED_FIELDS;
  const cells = () =>
    expanded()
      ? props.entry.cells
      : props.entry.cells.slice(0, COLLAPSED_FIELDS);
  return (
    <article
      class="flex min-w-0 flex-col rounded-lg border border-edge-muted bg-panel"
      aria-label={props.entry.pipeline.name}
    >
      <header class="flex h-10 items-center gap-2 border-b border-edge-muted px-3">
        <TableIcon class="size-4 shrink-0 text-ink-muted" />
        <Show
          when={props.onOpenPipeline}
          fallback={
            <span class="min-w-0 flex-1 truncate text-sm font-medium">
              {props.entry.pipeline.name}
            </span>
          }
        >
          {(open) => (
            <button
              type="button"
              class="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
              onClick={() => open()()}
            >
              {props.entry.pipeline.name}
            </button>
          )}
        </Show>
        <Show when={!props.entry.pipeline.shared}>
          <LockIcon
            class="size-3.5 shrink-0 text-ink-placeholder"
            aria-label="Private pipeline"
          />
        </Show>
      </header>
      <div class="flex flex-col gap-0.5 px-1.5 py-1.5">
        <Key each={cells()} by={(cell) => cell.column.id}>
          {(cell) => (
            <div class="grid min-h-9 grid-cols-[minmax(5rem,0.75fr)_minmax(0,1.5fr)] items-start gap-2">
              <div
                class="flex min-w-0 items-center gap-2 pl-1.5 pt-2.5 text-xs text-ink-muted"
                title={cell().column.name}
              >
                <PropertyIcon
                  type={cell().column.dataType}
                  entityType={cell().column.specificEntityType}
                />
                <span class="truncate">{cell().column.name}</span>
              </div>
              <div class="min-w-0">{props.renderCell(cell)}</div>
            </div>
          )}
        </Key>
        <Show when={hidden() > 0}>
          <Button
            variant="ghost"
            size="xs"
            class="mt-0.5 self-start text-ink-muted"
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded() ? 'Show less' : `Show ${hidden()} more`}
          </Button>
        </Show>
      </div>
    </article>
  );
}
