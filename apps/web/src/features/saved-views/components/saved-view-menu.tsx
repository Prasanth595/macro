import CopyIcon from '@phosphor/copy.svg';
import LinkIcon from '@phosphor/link.svg';
import PencilIcon from '@phosphor/pencil-simple.svg';
import TrashIcon from '@phosphor/trash.svg';
import UsersIcon from '@phosphor/users.svg';
import { Dropdown } from '@ui';
import { Show } from 'solid-js';

export function SavedViewMenuItems(props: {
  owned: boolean;
  canShare: boolean;
  disabled?: boolean;
  onRename: () => void;
  onShare: () => void;
  onDuplicate: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) {
  return (
    <div class="flex w-full flex-col divide-y divide-edge-divider">
      <Dropdown.Group>
        <Show when={props.owned}>
          <Dropdown.Item disabled={props.disabled} onSelect={props.onRename}>
            <PencilIcon class="size-4" />
            Rename
          </Dropdown.Item>
          <Dropdown.Item
            disabled={props.disabled || !props.canShare}
            title={
              props.canShare ? undefined : 'Join a team to share saved views'
            }
            onSelect={props.onShare}
          >
            <UsersIcon class="size-4" />
            Share
          </Dropdown.Item>
        </Show>
        <Dropdown.Item disabled={props.disabled} onSelect={props.onDuplicate}>
          <CopyIcon class="size-4" />
          Duplicate
        </Dropdown.Item>
        <Dropdown.Item onSelect={props.onCopyLink}>
          <LinkIcon class="size-4" />
          Copy link
        </Dropdown.Item>
      </Dropdown.Group>
      <Show when={props.owned}>
        <Dropdown.Group>
          <Dropdown.Item
            class="text-failure-ink"
            disabled={props.disabled}
            onSelect={props.onDelete}
          >
            <TrashIcon class="size-4" />
            Delete view
          </Dropdown.Item>
        </Dropdown.Group>
      </Show>
    </div>
  );
}
