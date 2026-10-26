import type { AttachmentCopyChoice } from '@app/features/email-message/core/attachment-open';
import { Dropdown } from '@ui';
import { For, Show } from 'solid-js';

/**
 * Asks which file to open: a Drive copy the viewer already saved, the
 * attachment's current edits, or a fresh copy of the original.
 */
export function AttachmentCopyMenu(props: {
  anchor: HTMLElement;
  fileName: string;
  copies: AttachmentCopyChoice[];
  includeCurrent: boolean;
  onOpenCurrent: () => void;
  onOpenCopy: (documentId: string) => void;
  onFreshCopy: () => void;
  onClose: () => void;
}) {
  return (
    <Dropdown
      open
      getAnchorRect={() => props.anchor.getBoundingClientRect()}
      placement="bottom-start"
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <Dropdown.Trigger class="sr-only" tabIndex={-1}>
        Open {props.fileName}
      </Dropdown.Trigger>
      <Dropdown.Content
        class="w-64"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (props.anchor.isConnected) props.anchor.focus();
        }}
      >
        <Dropdown.Group>
          <Dropdown.GroupLabel>Open</Dropdown.GroupLabel>
          <Show when={props.includeCurrent}>
            <Dropdown.Item onSelect={() => props.onOpenCurrent()}>
              <div class="flex min-w-0 flex-col">
                <span class="truncate">{props.fileName || 'Edited copy'}</span>
                <span class="text-xs text-ink-muted">Your edits</span>
              </div>
            </Dropdown.Item>
          </Show>
          <For each={props.copies}>
            {(copy) => (
              <Dropdown.Item onSelect={() => props.onOpenCopy(copy.documentId)}>
                <div class="flex min-w-0 flex-col">
                  <span class="truncate">{copy.name || props.fileName}</span>
                  <span class="text-xs text-ink-muted">In your Drive</span>
                </div>
              </Dropdown.Item>
            )}
          </For>
          <Dropdown.Item onSelect={() => props.onFreshCopy()}>
            <div class="flex min-w-0 flex-col">
              <span>Fresh copy</span>
              <span class="text-xs text-ink-muted">
                Original file, saved to Drive
              </span>
            </div>
          </Dropdown.Item>
        </Dropdown.Group>
      </Dropdown.Content>
    </Dropdown>
  );
}
