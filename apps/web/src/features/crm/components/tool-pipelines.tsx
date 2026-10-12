import { Tool } from '@core/component/AI/component/tool/Tool';
import Buildings from '@phosphor-icons/core/regular/buildings.svg';
import Kanban from '@phosphor-icons/core/regular/kanban.svg';
import User from '@phosphor-icons/core/regular/user.svg';
import type { NamedTool } from '@service-cognition/generated/tools/tool';
import { For, Show } from 'solid-js';

type Pipeline = NamedTool<
  'ListPipelines',
  'response'
>['data']['pipelines'][number];
type Entry = NamedTool<
  'FindPipelineEntries',
  'response'
>['data']['pipelines'][number]['entries'][number];
type UpdatedEntry = NamedTool<
  'UpdatePipelineEntries',
  'response'
>['data']['updated'][number];
type Record = Entry['record'];

/** A field value as one line: people by email, lists joined. */
export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return 'empty';
  if (Array.isArray(value)) return value.map(formatFieldValue).join(', ');
  if (typeof value === 'string') return value.replace(/^macro\|/, '');
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}

export function recordName(record: Record) {
  return record.name ?? record.detail ?? record.id;
}

function entrySummary(entry: Entry) {
  return Object.entries(entry.fields)
    .slice(0, 3)
    .map(([name, value]) => `${name}: ${formatFieldValue(value)}`)
    .join(' · ');
}

function RecordIcon(props: { record: Record }) {
  const isContact = () => props.record.detail?.includes('@') === true;
  return (
    <Show when={isContact()} fallback={<Buildings class="size-4" />}>
      <User class="size-4" />
    </Show>
  );
}

function Line(props: { title: string; subtitle?: string }) {
  return (
    <div class="min-w-0 flex-1">
      <div class="truncate text-xs text-ink">{props.title}</div>
      <Show when={props.subtitle}>
        {(subtitle) => (
          <div class="truncate text-xs text-ink-placeholder">{subtitle()}</div>
        )}
      </Show>
    </div>
  );
}

export function PipelinesToolResponse(props: { pipelines: Pipeline[] }) {
  return (
    <Tool.List>
      <Show
        when={props.pipelines.length > 0}
        fallback={<Tool.ListItem>No pipelines.</Tool.ListItem>}
      >
        <For each={props.pipelines}>
          {(pipeline) => (
            <Tool.ListItem icon={<Kanban class="size-4" />}>
              <Line
                title={pipeline.name}
                subtitle={
                  pipeline.fields
                    .find((field) => field.name === 'Stage')
                    ?.options?.join(' → ') ?? `Tracks ${pipeline.tracks}s`
                }
              />
            </Tool.ListItem>
          )}
        </For>
      </Show>
    </Tool.List>
  );
}

export function PipelineEntriesToolResponse(props: {
  entries: Entry[];
  empty: string;
}) {
  return (
    <Tool.List>
      <Show
        when={props.entries.length > 0}
        fallback={<Tool.ListItem>{props.empty}</Tool.ListItem>}
      >
        <For each={props.entries}>
          {(entry) => (
            <Tool.ListItem icon={<RecordIcon record={entry.record} />}>
              <Line
                title={recordName(entry.record)}
                subtitle={entrySummary(entry)}
              />
            </Tool.ListItem>
          )}
        </For>
      </Show>
    </Tool.List>
  );
}

export function UpdatedEntriesToolResponse(props: { updated: UpdatedEntry[] }) {
  return (
    <Tool.List>
      <For each={props.updated}>
        {(entry) => (
          <Tool.ListItem icon={<RecordIcon record={entry.record} />}>
            <Line
              title={recordName(entry.record)}
              subtitle={entry.changes
                .map(
                  (change) =>
                    `${change.field}: ${formatFieldValue(change.before)} → ${formatFieldValue(change.after)}`
                )
                .join(' · ')}
            />
          </Tool.ListItem>
        )}
      </For>
    </Tool.List>
  );
}
