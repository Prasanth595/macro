import type { useSplitLayout } from '@components/app/split-layout/layout';
import { toast } from '@core/component/Toast/Toast';
import { buildSimpleEntityUrl } from '@core/util/url';
import ArrowSquareOutIcon from '@phosphor/arrow-square-out.svg';
import SplitIcon from '@phosphor/square-half.svg';

type OpenWithSplit = ReturnType<typeof useSplitLayout>['openWithSplit'];

export async function showTaskCreatedToast(
  documentId: string,
  optimisticSnapshot: Uint8Array | undefined,
  openWithSplit: OpenWithSplit
) {
  // Auto-copy link to clipboard
  const url = buildSimpleEntityUrl({ type: 'task', id: documentId });
  let linkCopied = false;
  try {
    await navigator.clipboard.writeText(url);
    linkCopied = true;
  } catch {
    toast.failure('Failed to copy link to clipboard');
  }

  const snapshotParams = optimisticSnapshot
    ? { params: { optimisticSnapshot }, preserveParams: true as const }
    : {};

  toast.success('Task created', {
    subtext: linkCopied ? 'Link copied' : undefined,
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
}
