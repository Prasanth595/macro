import BuildingsIcon from '@icon/system/regular/buildings.svg';
import EnvelopeIcon from '@icon/system/regular/envelope-simple.svg';
import UserIcon from '@icon/system/regular/user.svg';
import { badgeTriggerClasses, Dropdown, Tooltip } from '@ui';
import { For, Show } from 'solid-js';
import type { ActivityAssociation } from '../core/activity-associations';
import type { CrmRecordTarget } from '../core/record';

/** Supporting CRM links, independent of the item's own open action. */
export function ActivityAssociations(props: {
  associations: ActivityAssociation[];
  onOpen(target: CrmRecordTarget, newSplit: boolean): void;
}) {
  const remaining = () => props.associations.slice(2);
  return (
    <Show when={props.associations.length > 0}>
      <div
        role="group"
        aria-label="CRM associations"
        class="flex min-w-0 flex-wrap items-center gap-1.5 pb-2 pl-8 pr-2 text-xs"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <span class="shrink-0 text-ink-extra-muted">
          {props.associations.every((record) => record.match === 'email')
            ? 'Email match'
            : 'Linked to'}
        </span>
        <For each={props.associations.slice(0, 2)}>
          {(record) => (
            <Tooltip
              label={`${record.name} · ${record.match === 'email' ? 'Matched contact email' : `Linked ${record.type}`}`}
            >
              <button
                type="button"
                class={badgeTriggerClasses({
                  variant: 'outline',
                  size: 'xs',
                  class: 'max-w-[min(10rem,30cqw)]',
                })}
                onClick={(event) => props.onOpen(record, event.shiftKey)}
              >
                <Show
                  when={record.type === 'company'}
                  fallback={<UserIcon class="size-3" />}
                >
                  <BuildingsIcon class="size-3" />
                </Show>
                <span class="truncate">{record.name}</span>
                <Show when={record.match === 'email'}>
                  <EnvelopeIcon class="size-3 text-ink-extra-muted" />
                </Show>
              </button>
            </Tooltip>
          )}
        </For>
        <Show when={remaining().length > 0}>
          <Dropdown placement="bottom-start">
            <Dropdown.Trigger
              variant="ghost"
              size="xs"
              aria-label={`Show ${remaining().length} more associations`}
            >
              +{remaining().length}
            </Dropdown.Trigger>
            <Dropdown.Content
              class="max-w-72"
              onClick={(event: MouseEvent) => event.stopPropagation()}
            >
              <Dropdown.Group>
                <Dropdown.GroupLabel>Related records</Dropdown.GroupLabel>
                <For each={remaining()}>
                  {(record) => (
                    <Dropdown.Item onSelect={() => props.onOpen(record, false)}>
                      <Show
                        when={record.type === 'company'}
                        fallback={<UserIcon class="size-4 shrink-0" />}
                      >
                        <BuildingsIcon class="size-4 shrink-0" />
                      </Show>
                      <span class="min-w-0 flex-1 truncate">{record.name}</span>
                      <Show when={record.match === 'email'}>
                        <EnvelopeIcon class="size-3.5 shrink-0 text-ink-extra-muted" />
                      </Show>
                    </Dropdown.Item>
                  )}
                </For>
              </Dropdown.Group>
            </Dropdown.Content>
          </Dropdown>
        </Show>
      </div>
    </Show>
  );
}
