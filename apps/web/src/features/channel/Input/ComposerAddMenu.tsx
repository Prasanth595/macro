import PlusIcon from '@phosphor/plus.svg';
import { cn, Dropdown } from '@ui';
import { For, type JSX, Show } from 'solid-js';

export type ComposerAddMenuItem = {
  id: string;
  label: string;
  icon: JSX.Element;
  /** A typed shortcut that does the same thing, e.g. `@`. */
  hint?: string;
  onSelect: () => void;
  /**
   * Run inside the click rather than once the menu has closed, for a file
   * picker that browsers only open from a user gesture.
   */
  inGesture?: boolean;
};

export type ComposerAddMenuGroup = {
  label?: string;
  items: ComposerAddMenuItem[];
};

/** The composer's +: everything that can go into a message, in one menu. */
export function ComposerAddMenu(props: {
  groups: ComposerAddMenuGroup[];
  class?: string;
}) {
  const groups = () => props.groups.filter((group) => group.items.length > 0);
  // Most items move focus into the editor (a mention typeahead, an inserted
  // card), so they run after the menu has closed and instead of the menu's
  // return of focus to the +.
  let pending: (() => void) | undefined;
  const select = (item: ComposerAddMenuItem) => {
    if (item.inGesture) item.onSelect();
    else pending = item.onSelect;
  };

  return (
    <Dropdown placement="top-start" gutter={8}>
      <Dropdown.Trigger
        variant="ghost"
        size="icon-composer"
        class={cn('touch:size-6', props.class)}
        aria-label="Add"
        label="Add"
        // Keep the editor's selection: actions insert where the caret is.
        onPointerDown={(event: PointerEvent) => event.preventDefault()}
      >
        <PlusIcon />
      </Dropdown.Trigger>
      <Dropdown.Content
        class="min-w-56"
        onCloseAutoFocus={(event: Event) => {
          const run = pending;
          pending = undefined;
          if (!run) return;
          event.preventDefault();
          run();
        }}
      >
        <For each={groups()}>
          {(group) => (
            <Dropdown.Group>
              <Show when={group.label}>
                <Dropdown.GroupLabel>{group.label}</Dropdown.GroupLabel>
              </Show>
              <For each={group.items}>
                {(item) => (
                  <Dropdown.Item onSelect={() => select(item)}>
                    <span class="flex size-3.5 shrink-0 items-center justify-center text-ink-muted touch:size-6">
                      {item.icon}
                    </span>
                    <span class="flex-1 truncate">{item.label}</span>
                    <Show when={item.hint}>
                      <span class="shrink-0 pl-4 font-mono text-xs text-ink-extra-muted">
                        {item.hint}
                      </span>
                    </Show>
                  </Dropdown.Item>
                )}
              </For>
            </Dropdown.Group>
          )}
        </For>
      </Dropdown.Content>
    </Dropdown>
  );
}
