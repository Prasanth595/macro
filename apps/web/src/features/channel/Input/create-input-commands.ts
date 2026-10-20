import { fireAndForget } from '@core/util/fireAndForget';
import { Telemetry } from '@macro-inc/observability';
import type { Accessor } from 'solid-js';
import type { InputAttachmentTracker } from './attachment-tracker';
import type {
  InputAttachmentData,
  InputCallbacks,
  InputCommands,
  InputData,
  InputSnapshot,
} from './types';
import { hasSendableInputContent } from './utils/sendable-content';

type CreateInputCommandsDeps = {
  view: Accessor<InputData>;
  snapshot: Accessor<InputSnapshot>;
  attachmentTracker: InputAttachmentTracker;
  setIsSending: (value: boolean) => void;
  setShowFormatRibbon: (updater: (prev: boolean) => boolean) => void;
  reset: () => void;
  clearComposer?: () => void;
  removeTrackedAttachment: (id: string) => void;
  attachFiles?: (files: File[]) => Promise<void> | void;
  callbacks?: InputCallbacks;
};

export function createInputCommands(
  deps: CreateInputCommandsDeps
): InputCommands {
  const reportCallbackError = (error: unknown) =>
    Telemetry.error(error, { surface: 'channel-input' });

  const removeAttachment = (attachment: InputAttachmentData) => {
    deps.removeTrackedAttachment(attachment.id);
    const current = deps.snapshot();
    fireAndForget(
      deps.callbacks?.onRemoveAttachment?.(attachment, current),
      'channel-input'
    );
  };

  const doSend = async (): Promise<boolean> => {
    if (!deps.callbacks?.onSend) return false;

    const current = deps.snapshot();
    if (!hasSendableInputContent(current)) return false;
    deps.setIsSending(true);
    try {
      await deps.callbacks.onSend(current);
      deps.reset();
      deps.clearComposer?.();
      return true;
    } finally {
      deps.setIsSending(false);
    }
  };

  return {
    send: async () => {
      // Block if a send is already in flight (isSending = true)
      if (
        deps.view().hasPendingAttachments &&
        !deps.attachmentTracker.hasPending()
      ) {
        return false;
      }
      // If uploads are pending, queue the send intent for when they complete
      if (deps.attachmentTracker.hasPending()) {
        const current = deps.snapshot();
        if (!hasSendableInputContent(current)) return false;
        deps.attachmentTracker.setSendQueued(true);
        return false;
      }
      // Clear any queued state since we're sending now
      deps.attachmentTracker.setSendQueued(false);
      return doSend();
    },
    attachFiles: async (files: File[]) => {
      if (files.length === 0) return;
      await deps.attachFiles?.(files);
    },
    toggleFormatRibbon: () => {
      deps.setShowFormatRibbon((open) => {
        const next = !open;
        Promise.resolve(deps.callbacks?.onToggleFormatRibbon?.(next)).catch(
          reportCallbackError
        );
        return next;
      });
    },
    close: () => {
      const current = deps.snapshot();
      deps.reset();
      deps.clearComposer?.();
      Promise.resolve(deps.callbacks?.onClose?.(current)).catch(
        reportCallbackError
      );
    },
    removeAttachment,
  };
}
