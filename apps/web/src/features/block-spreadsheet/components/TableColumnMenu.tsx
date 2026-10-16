import CaretDown from '@phosphor/caret-down.svg';
import SortAscending from '@phosphor/sort-ascending.svg';
import SortDescending from '@phosphor/sort-descending.svg';
import Funnel from '@phosphor-fill/funnel-simple-fill.svg';
import { Dropdown } from '@ui/components/Dropdown';
import { createSignal, Index, Show } from 'solid-js';
import type { TableFilterChoice } from '../core/table-types';

/** Values listed at once; a column with more lists the first of them. */
const MAX_CHOICES = 500;

/**
 * A table header's sort and filter menu, opened from the button at the
 * header's right edge as in Excel. Each checkbox applies at once.
 */
export function TableColumnMenu(props: {
  column: string;
  filtered: boolean;
  choices: () => TableFilterChoice[];
  onSort: (descending: boolean) => void;
  onFilter: (shown: string[] | undefined) => void;
  onRestoreFocus: () => void;
}) {
  const [open, setOpen] = createSignal(false);
  const choices = () => (open() ? props.choices() : []);
  const toggle = (value: string, checked: boolean) => {
    const all = props.choices();
    const shown = all
      .filter((choice) => (choice.value === value ? checked : choice.shown))
      .map((choice) => choice.value);
    props.onFilter(shown.length === all.length ? undefined : shown);
  };
  return (
    <div
      class="absolute right-0.5 top-1/2 z-[2] size-4 -translate-y-1/2 touch:size-6"
      onPointerDown={(event) => event.stopPropagation()}
      onDblClick={(event) => event.stopPropagation()}
    >
      <Dropdown
        open={open()}
        onOpenChange={setOpen}
        placement="bottom-end"
        modal={false}
      >
        <Dropdown.Trigger
          variant="ghost"
          size="icon-xs"
          label={`Sort and filter ${props.column}`}
          tabIndex={-1}
          class="size-full min-h-0 min-w-0 rounded-sm border border-edge-muted bg-panel p-0 text-ink-muted hover:text-ink touch:min-h-0 touch:min-w-0"
        >
          <Show when={props.filtered} fallback={<CaretDown class="size-3" />}>
            <Funnel class="size-3 text-accent" />
          </Show>
        </Dropdown.Trigger>
        <Dropdown.Content
          class="max-h-[min(24rem,70dvh)] min-w-48 max-w-80 overflow-y-auto overscroll-contain text-xs touch:text-[max(14px,0.875rem)] touch:[&_[role=menuitem]]:min-h-[44px] touch:[&_[role=menuitemcheckbox]]:min-h-[44px]"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // Kobalte returns focus to its trigger after this handler.
            queueMicrotask(props.onRestoreFocus);
          }}
        >
          <Dropdown.Group>
            <Dropdown.Item closeOnSelect onSelect={() => props.onSort(false)}>
              <SortAscending class="size-4" />
              Sort A → Z
            </Dropdown.Item>
            <Dropdown.Item closeOnSelect onSelect={() => props.onSort(true)}>
              <SortDescending class="size-4" />
              Sort Z → A
            </Dropdown.Item>
          </Dropdown.Group>
          <Dropdown.Group>
            <Dropdown.GroupLabel>Show rows with</Dropdown.GroupLabel>
            <Dropdown.CheckboxItem
              closeOnSelect={false}
              checked={choices().every((choice) => choice.shown)}
              onChange={(checked) => props.onFilter(checked ? undefined : [])}
            >
              Select all
            </Dropdown.CheckboxItem>
            <Index each={choices().slice(0, MAX_CHOICES)}>
              {(choice) => (
                <Dropdown.CheckboxItem
                  closeOnSelect={false}
                  checked={choice().shown}
                  onChange={(checked) => toggle(choice().value, checked)}
                >
                  <span class="truncate">{choice().value || '(Blanks)'}</span>
                </Dropdown.CheckboxItem>
              )}
            </Index>
            <Show when={choices().length > MAX_CHOICES}>
              <p class="px-2 py-1 text-ink-extra-muted">
                Showing the first {MAX_CHOICES} of {choices().length} values.
              </p>
            </Show>
          </Dropdown.Group>
          <Show when={props.filtered}>
            <Dropdown.Group>
              <Dropdown.Item
                closeOnSelect
                onSelect={() => props.onFilter(undefined)}
              >
                Clear filter
              </Dropdown.Item>
            </Dropdown.Group>
          </Show>
        </Dropdown.Content>
      </Dropdown>
    </div>
  );
}
