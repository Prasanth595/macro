import { MENU_ITEM_CLASS, MenuGroup } from '@core/component/ContextMenu';
import { ContextMenu } from '@kobalte/core/context-menu';
import CopyIcon from '@phosphor/copy.svg';
import LinkIcon from '@phosphor/link.svg';
import PencilIcon from '@phosphor/pencil-simple.svg';
import TrashIcon from '@phosphor/trash.svg';
import UsersIcon from '@phosphor/users.svg';
import { cn, Dropdown } from '@ui';
import { Show } from 'solid-js';

export function SavedViewMenuItems(props: {
  context?: boolean;
  owned: boolean;
  canShare: boolean;
  disabled?: boolean;
  onRename: () => void;
  onShare: () => void;
  onDuplicate: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) {
  const Item = props.context ? ContextMenu.Item : Dropdown.Item;
  const Group = props.context ? MenuGroup : Dropdown.Group;
  return (
    <>
      <Group>
        <Show when={props.owned}>
          <Item
            class={props.context ? MENU_ITEM_CLASS : undefined}
            disabled={props.disabled}
            onSelect={props.onRename}
          >
            <PencilIcon class="size-4" />
            Rename
          </Item>
          <Item
            class={props.context ? MENU_ITEM_CLASS : undefined}
            disabled={props.disabled || !props.canShare}
            title={
              props.canShare ? undefined : 'Join a team to share saved views'
            }
            onSelect={props.onShare}
          >
            <UsersIcon class="size-4" />
            Share
          </Item>
        </Show>
        <Item
          class={props.context ? MENU_ITEM_CLASS : undefined}
          disabled={props.disabled}
          onSelect={props.onDuplicate}
        >
          <CopyIcon class="size-4" />
          Duplicate
        </Item>
        <Item
          class={props.context ? MENU_ITEM_CLASS : undefined}
          onSelect={props.onCopyLink}
        >
          <LinkIcon class="size-4" />
          Copy link
        </Item>
      </Group>
      <Show when={props.owned}>
        <Group>
          <Item
            class={cn(props.context && MENU_ITEM_CLASS, 'text-failure-ink')}
            disabled={props.disabled}
            onSelect={props.onDelete}
          >
            <TrashIcon class="size-4" />
            Delete view
          </Item>
        </Group>
      </Show>
    </>
  );
}
