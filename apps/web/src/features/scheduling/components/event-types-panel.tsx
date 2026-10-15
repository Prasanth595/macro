import { SearchBar } from '@app/components/view-shell';
import {
  ContextMenuContent,
  ContextMenuTrigger,
  MENU_ITEM_CLASS,
  MenuGroup,
} from '@core/component/ContextMenu';
import { ContextMenu } from '@kobalte/core/context-menu';
import External from '@phosphor/arrow-square-out.svg';
import ArrowsClockwise from '@phosphor/arrows-clockwise.svg';
import Copy from '@phosphor/copy.svg';
import Dots from '@phosphor/dots-three.svg';
import Globe from '@phosphor/globe-simple.svg';
import Link from '@phosphor/link.svg';
import Pencil from '@phosphor/pencil-simple.svg';
import Timer from '@phosphor/timer.svg';
import Trash from '@phosphor/trash.svg';
import User from '@phosphor/user.svg';
import Users from '@phosphor/users.svg';
import { propertyPillClasses } from '@property/extractors/property-pill-classes';
import { Badge, Button, cn, Dropdown, ToggleSwitch } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import { match } from 'ts-pattern';
import type { EventType, SchedulingScope } from '../core/types';

export function EventTypesPanel(props: {
  events: EventType[];
  owner?: SchedulingScope;
  search?: string;
  canEdit: boolean;
  saving: boolean;
  onView: (event: EventType, opener?: HTMLElement) => void;
  onEdit: (event: EventType, opener?: HTMLElement) => void;
  onToggle: (event: EventType, enabled: boolean) => void;
  onDuplicate: (event: EventType, opener?: HTMLElement) => void;
  onDelete: (event: EventType) => void;
  onCopy: (event: EventType) => void;
  link: (event: EventType) => string;
}) {
  const [localSearch, setSearch] = createSignal('');
  const search = () => (props.search ?? localSearch()).trim();
  const [removing, setRemoving] = createSignal<string>();
  const filtered = () =>
    props.events.filter((e) =>
      `${e.title} ${e.description} ${e.slug} ${props.owner?.name ?? ''} ${props.owner?.teamId ? 'team' : 'personal'}`
        .toLowerCase()
        .includes(search().toLowerCase())
    );
  function MenuItems(menu: {
    event: EventType;
    opener?: HTMLElement;
    context?: boolean;
  }) {
    const Item = menu.context ? ContextMenu.Item : Dropdown.Item;
    const Group = menu.context ? MenuGroup : Dropdown.Group;
    return (
      <>
        <Group>
          <Item
            class={menu.context ? MENU_ITEM_CLASS : undefined}
            disabled={!menu.event.enabled}
            onSelect={() => props.onCopy(menu.event)}
          >
            <Copy class="size-4" />
            Copy link
          </Item>
          <Item
            class={menu.context ? MENU_ITEM_CLASS : undefined}
            onSelect={() => {
              window.open(
                props.link(menu.event),
                '_blank',
                'noopener,noreferrer'
              );
            }}
          >
            <External class="size-4" />
            Preview
          </Item>
        </Group>
        <Show when={props.canEdit}>
          <Group>
            <Item
              class={menu.context ? MENU_ITEM_CLASS : undefined}
              disabled={props.saving}
              onSelect={() => props.onEdit(menu.event, menu.opener)}
            >
              <Pencil class="size-4" />
              Edit
            </Item>
            <Item
              class={menu.context ? MENU_ITEM_CLASS : undefined}
              disabled={props.saving}
              onSelect={() => props.onDuplicate(menu.event, menu.opener)}
            >
              <Copy class="size-4" />
              Duplicate
            </Item>
          </Group>
          <Group>
            <Item
              class={cn(menu.context && MENU_ITEM_CLASS, 'text-failure')}
              disabled={props.saving}
              onSelect={() => setRemoving(menu.event.id)}
            >
              <Trash class="size-4" />
              Delete
            </Item>
          </Group>
        </Show>
      </>
    );
  }
  return (
    <div class="@container/booking-links flex min-w-0 flex-col gap-1">
      <Show when={props.search === undefined}>
        <SearchBar
          label="Search booking links"
          placeholder="Search booking links…"
          value={localSearch()}
          onValueChange={setSearch}
          class="mb-3 max-w-md"
        />
      </Show>
      <div>
        <For
          each={filtered()}
          fallback={
            <div class="flex flex-col items-center gap-3 px-6 py-8 text-center">
              <Link class="size-7 text-ink-muted" />
              <h2 class="font-semibold">
                {search()
                  ? 'No matching event types'
                  : 'Create your first booking link'}
              </h2>
              <p class="max-w-sm text-sm text-ink-muted">
                {search()
                  ? 'Try a different title or link.'
                  : 'Choose a duration and availability, then share your link.'}
              </p>
            </div>
          }
        >
          {(event) => {
            let rowButton: HTMLButtonElement | undefined;
            return (
              <ContextMenu>
                <ContextMenuTrigger
                  as="article"
                  disabled={props.saving}
                  class="min-h-10 min-w-0 rounded-xl px-2 py-1 transition-opacity hover:bg-list-hover focus-within:bg-list-hover"
                  classList={{ 'opacity-50': !event.enabled }}
                >
                  <div class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 @min-[36rem]/booking-links:grid-cols-[auto_minmax(0,1fr)_auto]">
                    <ToggleSwitch
                      checked={event.enabled}
                      disabled={!props.canEdit || props.saving}
                      label={
                        <span class="sr-only">
                          Accept bookings for {event.title}
                        </span>
                      }
                      class="shrink-0"
                      size="sm"
                      onChange={(v) => props.onToggle(event, v)}
                    />
                    <button
                      ref={rowButton}
                      type="button"
                      aria-label={event.title}
                      onClick={(click) =>
                        props.onView(event, click.currentTarget)
                      }
                      class="flex min-w-0 items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Link
                        aria-hidden="true"
                        class="size-4 shrink-0 text-ink-muted"
                      />
                      <h2 class="min-w-0 max-w-[min(16rem,60%)] shrink-0 truncate text-sm font-medium">
                        {event.title}
                      </h2>
                      <Show when={event.description}>
                        <p class="min-w-0 flex-1 truncate text-sm text-ink-muted">
                          {event.description}
                        </p>
                      </Show>
                    </button>
                    <div class="col-start-2 flex min-w-0 flex-wrap items-center justify-end gap-2 @min-[36rem]/booking-links:col-start-auto">
                      <Dropdown>
                        <Dropdown.Trigger
                          as="button"
                          type="button"
                          aria-label={`Link actions for ${event.title}`}
                          class={propertyPillClasses({
                            variant: 'outline',
                            size: 'md',
                            readOnly: true,
                            class: 'min-w-0 max-w-56 shrink',
                          })}
                        >
                          <Globe aria-hidden="true" class="size-3" />
                          <span class="truncate">/{event.slug}</span>
                        </Dropdown.Trigger>
                        <Dropdown.Content class="min-w-40">
                          <Dropdown.Group>
                            <Dropdown.Item
                              disabled={!event.enabled}
                              onSelect={() => props.onCopy(event)}
                            >
                              <Copy class="size-4" />
                              Copy link
                            </Dropdown.Item>
                            <Dropdown.Item
                              onSelect={() => {
                                window.open(
                                  props.link(event),
                                  '_blank',
                                  'noopener,noreferrer'
                                );
                              }}
                            >
                              <External class="size-4" />
                              Open in new tab
                            </Dropdown.Item>
                          </Dropdown.Group>
                        </Dropdown.Content>
                      </Dropdown>
                      <Badge
                        variant="outline"
                        size="md"
                        class={propertyPillClasses({
                          variant: 'outline',
                          size: 'md',
                          readOnly: true,
                        })}
                      >
                        <Timer aria-hidden="true" class="size-3" />
                        {event.durationMinutes}m
                      </Badge>
                      <Badge
                        variant="outline"
                        size="md"
                        class={propertyPillClasses({
                          variant: 'outline',
                          size: 'md',
                          readOnly: true,
                        })}
                      >
                        {match(event.mode)
                          .with('individual', () => (
                            <>
                              <User aria-hidden="true" class="size-3" />
                              Individual
                            </>
                          ))
                          .with('collective', () => (
                            <>
                              <Users aria-hidden="true" class="size-3" />
                              Collective
                            </>
                          ))
                          .with('roundRobin', () => (
                            <>
                              <ArrowsClockwise
                                aria-hidden="true"
                                class="size-3"
                              />
                              Round robin
                            </>
                          ))
                          .exhaustive()}
                      </Badge>
                      <Dropdown>
                        <Dropdown.Trigger
                          variant="ghost"
                          size="icon-sm"
                          label={`Options for ${event.title}`}
                          class="shrink-0"
                          disabled={props.saving}
                          tooltipDisabled
                        >
                          <Dots class="size-4" />
                        </Dropdown.Trigger>
                        <Dropdown.Content class="min-w-40">
                          <MenuItems event={event} opener={rowButton} />
                        </Dropdown.Content>
                      </Dropdown>
                    </div>
                  </div>
                  <Show when={props.canEdit && removing() === event.id}>
                    <div class="mt-4 flex flex-wrap items-center gap-3 border-t border-edge-muted pt-4">
                      <p class="flex-1 text-sm">
                        Delete this event type? Existing bookings are kept.
                      </p>
                      <Button
                        variant="ghost"
                        onClick={() => setRemoving(undefined)}
                      >
                        Keep
                      </Button>
                      <Button
                        variant="outline"
                        disabled={props.saving}
                        onClick={() => props.onDelete(event)}
                      >
                        Delete event type
                      </Button>
                    </div>
                  </Show>
                </ContextMenuTrigger>
                <ContextMenu.Portal>
                  <ContextMenuContent class="min-w-40">
                    <MenuItems event={event} opener={rowButton} context />
                  </ContextMenuContent>
                </ContextMenu.Portal>
              </ContextMenu>
            );
          }}
        </For>
      </div>
    </div>
  );
}
