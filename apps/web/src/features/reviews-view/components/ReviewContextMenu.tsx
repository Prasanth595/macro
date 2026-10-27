import { makeCopyLinkAction } from '@app/features/next-soup/actions';
import { globalSplitManager } from '@app/signal/splitLayout';
import { ContextMenuContent, MenuItem } from '@core/component/ContextMenu';
import { fireAndForget } from '@core/util/fireAndForget';
import type { GithubPullRequestEntity } from '@entity';
import ArrowSquareOutIcon from '@icon/system/regular/arrow-square-out.svg';
import SplitIcon from '@icon/system/regular/columns.svg';
import CopyIcon from '@icon/system/regular/copy.svg';
import { ContextMenu } from '@kobalte/core/context-menu';

const copyLink = makeCopyLinkAction();

/** A pull request's right-click actions, for list rows and board cards alike. */
export function ReviewContextMenuContent(props: {
  review: GithubPullRequestEntity;
  onOpen: (foreignEntityId: string, newSplit: boolean) => void;
}) {
  return (
    <ContextMenu.Portal>
      <ContextMenuContent class="w-56 text-xs text-ink-muted">
        <MenuItem
          icon={SplitIcon}
          text="Open in new split"
          disabled={!globalSplitManager()?.canAppendSplit()}
          onClick={() => {
            if (globalSplitManager()?.canAppendSplit())
              props.onOpen(props.review.id, true);
          }}
        />
        <MenuItem
          icon={CopyIcon}
          text="Copy Link"
          onClick={() =>
            fireAndForget(copyLink.execute([props.review]), 'reviews-view')
          }
        />
        <MenuItem
          icon={ArrowSquareOutIcon}
          text="Open on GitHub"
          onClick={() =>
            window.open(
              props.review.metadata.url,
              '_blank',
              'noopener,noreferrer'
            )
          }
        />
      </ContextMenuContent>
    </ContextMenu.Portal>
  );
}
