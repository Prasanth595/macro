import type { useSplitLayout } from '@components/app/split-layout/layout';
import { toast } from '@core/component/Toast/Toast';
import { fireAndForget } from '@core/util/fireAndForget';
import { buildSimpleEntityUrl } from '@core/util/url';
import ArrowSquareOutIcon from '@phosphor/arrow-square-out.svg';
import SplitIcon from '@phosphor/square-half.svg';

type OpenWithSplit = ReturnType<typeof useSplitLayout>['openWithSplit'];

export function showTaskCreatedToast(
  documentId: string,
  optimisticSnapshot: Uint8Array | undefined,
  openWithSplit: OpenWithSplit
) {
  const snapshotParams = optimisticSnapshot
    ? { params: { optimisticSnapshot }, preserveParams: true as const }
    : {};

  toast.success('Task created', {
    actions: [
      {
        label: 'Open',
        icon: ArrowSquareOutIcon,
        onClick: () => {
          openWithSplit(
            { type: 'task', id: documentId, ...snapshotParams },
            { referredFrom: null }
          );
        },
      },
      {
        label: 'Open (New Split)',
        icon: SplitIcon,
        onClick: () => {
          openWithSplit(
            { type: 'task', id: documentId, ...snapshotParams },
            { referredFrom: null, preferNewSplit: true }
          );
        },
      },
    ],
  });

  // The write needs the click's user activation, which can lapse while the
  // server creates the task. The browser then denies it or holds it behind a
  // permission prompt, and the toast must not wait on either.
  fireAndForget(copyTaskLink(documentId), 'compose-task');
}

async function copyTaskLink(documentId: string) {
  try {
    await navigator.clipboard.writeText(
      buildSimpleEntityUrl({ type: 'task', id: documentId })
    );
  } catch {
    // A denied write is expected, and the toast already confirmed the task.
  }
}
