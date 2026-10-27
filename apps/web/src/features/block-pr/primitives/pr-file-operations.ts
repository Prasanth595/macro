import type { FileOperation } from '@components/app/split-layout/components/SplitFileMenu';
import { toast } from '@core/component/Toast/Toast';
import { fireAndForget } from '@core/util/fireAndForget';
import { openExternalUrl } from '@core/util/url';
import GithubIcon from '@icon/mcp-github.svg';
import ArrowCounterClockwise from '@icon/system/regular/arrow-counter-clockwise.svg';
import Eye from '@icon/system/regular/eye.svg';
import FileDashed from '@icon/system/regular/file-dashed.svg';
import GitBranch from '@icon/system/regular/git-branch.svg';
import GitMerge from '@icon/system/regular/git-merge.svg';
import Link from '@icon/system/regular/link.svg';
import XCircle from '@icon/system/regular/x-circle.svg';
import { queryClient } from '@queries/client';
import { soupKeys } from '@queries/soup/keys';
import { useSetGithubPullRequestDraftMutation } from '@queries/storage/pr-draft';
import { useSetGithubPullRequestStateMutation } from '@queries/storage/pr-state';
import { type Accessor, getOwner, type Owner } from 'solid-js';
import {
  invalidatePrForeignEntity,
  type PrForeignEntityData,
} from '../data/queries';
import { prDisplayName, prHtmlUrl } from '../util/prKey';
import {
  createMergePullRequestAction,
  type MergePullRequestTarget,
  pullRequestFailureMessage,
} from './create-merge-pull-request-action';

async function copyToClipboard(text: string, confirmation: string) {
  await navigator.clipboard.writeText(text);
  toast.success(confirmation);
}

/**
 * A pull request's own actions for its "…" menu, shared by every PR surface:
 * merge, draft state, close or reopen, its GitHub link, and its branch.
 * GitHub decides whether the signed-in user may make a change and says why
 * when it declines.
 */
export function usePrFileOperations(
  detail: Accessor<PrForeignEntityData | undefined>,
  /** Asks before merging; the host supplies the dialog. */
  confirmMerge: (
    target: MergePullRequestTarget,
    owner: Owner | null
  ) => Promise<boolean>
): Accessor<FileOperation[]> {
  const owner = getOwner();
  // The routes patch the stored pull request first, so refetches see the
  // change: the detail itself and the lists showing it.
  const refresh = () => {
    const id = detail()?.id;
    if (id) invalidatePrForeignEntity(id);
    queryClient.invalidateQueries({ queryKey: soupKeys.astItems._def });
  };
  const merge = createMergePullRequestAction({
    confirm: (target) => confirmMerge(target, owner),
    onMerged: refresh,
  });
  const setDraft = useSetGithubPullRequestDraftMutation();
  const setState = useSetGithubPullRequestStateMutation();

  const change = async (
    request: () => Promise<unknown>,
    copy: { done: string; failed: string }
  ) => {
    try {
      await request();
    } catch (error) {
      toast.failure(pullRequestFailureMessage(error, copy.failed));
      return;
    }
    toast.success(copy.done);
    refresh();
  };

  return () => {
    const data = detail();
    if (!data) return [];
    const { prRef, pullRequest } = data;
    const target = {
      owner: prRef.owner,
      repo: prRef.repo,
      number: prRef.number,
    };
    const name = prDisplayName(prRef);
    const githubUrl = pullRequest.url || prHtmlUrl(prRef);
    const isOpen = pullRequest.status === 'open';
    const operations: FileOperation[] = [];

    if (isOpen && pullRequest.draft !== true) {
      operations.push({
        label: 'Merge pull request',
        icon: GitMerge,
        action: () =>
          fireAndForget(
            merge.merge({ ...prRef, title: pullRequest.name }),
            'pr-merge'
          ),
      });
    }
    if (isOpen && pullRequest.draft === true) {
      operations.push({
        label: 'Mark ready for review',
        icon: Eye,
        action: () =>
          fireAndForget(
            change(() => setDraft.mutateAsync({ ...target, draft: false }), {
              done: `Ready for review: ${name}`,
              failed: 'Failed to mark pull request ready for review',
            }),
            'pr-file-menu'
          ),
      });
    }
    if (isOpen && pullRequest.draft === false) {
      operations.push({
        label: 'Convert to draft',
        icon: FileDashed,
        action: () =>
          fireAndForget(
            change(() => setDraft.mutateAsync({ ...target, draft: true }), {
              done: `Converted to draft: ${name}`,
              failed: 'Failed to convert pull request to a draft',
            }),
            'pr-file-menu'
          ),
      });
    }
    if (isOpen) {
      operations.push({
        label: 'Close pull request',
        icon: XCircle,
        action: () =>
          fireAndForget(
            change(() => setState.mutateAsync({ ...target, state: 'closed' }), {
              done: `Closed ${name}`,
              failed: 'Failed to close pull request',
            }),
            'pr-file-menu'
          ),
      });
    }
    if (pullRequest.status === 'closed') {
      operations.push({
        label: 'Reopen pull request',
        icon: ArrowCounterClockwise,
        action: () =>
          fireAndForget(
            change(() => setState.mutateAsync({ ...target, state: 'open' }), {
              done: `Reopened ${name}`,
              failed: 'Failed to reopen pull request',
            }),
            'pr-file-menu'
          ),
      });
    }

    operations.push(
      {
        group: 'sharing',
        label: 'Copy GitHub link',
        icon: Link,
        action: () =>
          fireAndForget(
            copyToClipboard(githubUrl, 'GitHub link copied to clipboard'),
            'pr-file-menu'
          ),
      },
      {
        group: 'sharing',
        label: 'Open on GitHub',
        icon: GithubIcon,
        action: () => openExternalUrl(githubUrl),
      }
    );
    const headBranch = data.headBranch;
    if (headBranch) {
      operations.push({
        group: 'sharing',
        label: 'Copy branch name',
        icon: GitBranch,
        action: () =>
          fireAndForget(
            copyToClipboard(headBranch, 'Branch name copied to clipboard'),
            'pr-file-menu'
          ),
      });
    }
    return operations;
  };
}
