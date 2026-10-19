import type { ProductFeatureDetail } from '../../core/product-feature-guide';

// Sources: apps/docs/integrations/github.mdx and product/tasks, inbox, agents;
// viewer/merge constraints: docs/agent-guide/pull-requests.md;
// task transitions: crates/github/src/domain/models/sync.rs (c5cba006).
export const githubGuides = {
  'pr-links': [
    {
      title: 'Share the pull request',
      summary: 'Connect a proposed code change to the team’s discussion.',
      intro:
        'Share a GitHub pull request in a Macro conversation so teammates can open the code change from the discussion.',
      sections: [
        {
          kind: 'steps',
          heading: 'Share a PR',
          items: [
            {
              title: 'Connect GitHub',
              text: 'Authorize your account and repository access in Macro’s settings.',
            },
            {
              title: 'Paste the link',
              text: 'Macro shows a PR reference with its current status.',
            },
            {
              title: 'Add the request',
              text: 'Say what needs review and mention the related task or brief.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Private repositories',
          text: 'Sharing a link does not grant repository access. Teammates still need GitHub permission.',
        },
      ],
      links: [
        {
          label: 'GitHub integration',
          href: 'https://docs.macro.com/integrations/github',
        },
        {
          label: 'Linking work',
          href: 'https://docs.macro.com/concepts/mentions',
        },
      ],
    },
    {
      title: 'Read the diff',
      summary: 'See which files and lines changed without leaving Macro.',
      intro:
        'Open Changes on a pull request to see the files and lines it adds, removes, or edits.',
      sections: [
        {
          kind: 'facts',
          heading: 'Review the change',
          items: [
            {
              title: 'Files',
              text: 'Use the file tree to move between changed files.',
            },
            {
              title: 'Diff',
              text: 'Read the changed lines alongside the surrounding code.',
            },
            {
              title: 'Discussion and checks',
              text: 'Read the PR description and feedback, then check the repository’s test results.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Formal reviews',
          text: 'Use GitHub to submit review comments and approvals. Macro’s diff viewer is for reading the change.',
        },
      ],
      links: [
        {
          label: 'GitHub and linked work',
          href: 'https://docs.macro.com/integrations/github',
        },
      ],
    },
    {
      title: 'Merge in Macro',
      summary: 'Merge an eligible PR with GitHub’s requirements still applied.',
      intro:
        'Merge an eligible pull request using your connected GitHub account. Confirm the repository, PR number, and title before it goes through.',
      sections: [
        {
          kind: 'facts',
          heading: 'Merge requirements',
          items: [
            {
              title: 'Ready for review',
              text: 'The PR must be open and no longer a draft.',
            },
            {
              title: 'Checks finished',
              text: 'The PR must have checks, all with success, skipped, or neutral results. Running or failing checks keep Merge unavailable.',
            },
            {
              title: 'GitHub permissions',
              text: 'Your account’s access, required reviews, and branch protections still apply.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'After confirming',
          paragraphs: [
            'Macro refreshes the merged status or shows GitHub’s reason for refusing the merge.',
          ],
        },
      ],
      links: [
        {
          label: 'GitHub connection',
          href: 'https://docs.macro.com/integrations/github',
        },
      ],
    },
  ],
  'pr-tasks': [
    {
      title: 'Link the task ID',
      summary: 'Tell Macro which assignment the pull request belongs to.',
      intro:
        'Add a Macro task ID to the branch name, pull request title, or PR description. The PR then appears on that task.',
      sections: [
        {
          kind: 'steps',
          heading: 'Make the connection',
          items: [
            {
              title: 'Start with the task',
              text: 'Use the existing task’s ID. You can copy a branch name from the task.',
            },
            {
              title: 'Include it in GitHub',
              text: 'Add the ID before creating or updating the PR.',
            },
            {
              title: 'Check the association',
              text: 'Open the task after Macro receives the GitHub update and confirm the linked PR.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Connection required',
          text: 'Connect your GitHub account with access to the repository so Macro can receive its updates.',
        },
      ],
      links: [
        {
          label: 'Task and PR linking',
          href: 'https://docs.macro.com/integrations/github',
        },
        {
          label: 'Tasks',
          href: 'https://docs.macro.com/product/tasks',
        },
      ],
    },
    {
      title: 'Follow task progress',
      summary: 'Keep task status in sync as the PR opens, merges, or closes.',
      intro:
        'Once a PR is linked by task ID, its GitHub events update the task’s status.',
      sections: [
        {
          kind: 'facts',
          heading: 'How progress changes',
          items: [
            {
              title: 'Opened or reopened',
              text: 'The task moves to In Review.',
            },
            {
              title: 'Merged',
              text: 'The task becomes Completed and keeps the PR reference.',
            },
            {
              title: 'Closed without merging',
              text: 'The task returns to Not Started. Link a replacement PR with the same task ID if work continues.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Review and release',
          text: 'In Review does not mean approved. Completed reflects the merge; deployment may happen later.',
        },
      ],
      links: [
        {
          label: 'GitHub task updates',
          href: 'https://docs.macro.com/integrations/github',
        },
        {
          label: 'Task statuses',
          href: 'https://docs.macro.com/product/tasks',
        },
      ],
    },
  ],
  'coding-agents': [
    {
      title: 'Assign the bug to Cursor',
      summary: 'Give a connected coding agent a clear problem to investigate.',
      intro:
        'Ask a connected coding agent to investigate a bug using the report and task in the team conversation.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: '@Cursor, investigate the upload failure in this thread. Use the linked task for the expected behavior and return a fix as a pull request.',
        },
        {
          kind: 'text',
          heading: 'Give it enough to start',
          paragraphs: [
            'Include reproduction steps, the repository, and any constraints. Answer follow-up questions in the thread while the agent works.',
          ],
        },
        {
          kind: 'note',
          heading: 'Setup',
          text: 'The agent needs a configured runtime and repository access. Mentioning Cursor does not set up the connection.',
        },
      ],
      links: [
        {
          label: 'Agents',
          href: 'https://docs.macro.com/product/agents',
        },
        {
          label: 'GitHub integration',
          href: 'https://docs.macro.com/integrations/github',
        },
      ],
    },
    {
      title: 'Inspect the pull request',
      summary: 'Review the agent’s implementation before accepting it.',
      intro:
        'Review the coding agent’s proposed change against the original task.',
      sections: [
        {
          kind: 'steps',
          heading: 'Check the result',
          items: [
            {
              title: 'Read the diff',
              text: 'Open Changes and check that the edits solve the reported problem without unrelated changes.',
            },
            {
              title: 'Try the affected flow',
              text: 'Use the preview or local build and read the automated check results.',
            },
            {
              title: 'Request a correction',
              text: 'Continue in the agent thread when needed. Submit formal review comments and approvals through GitHub.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Before merging',
          text: 'A PR in the conversation is still a proposal. Review and merge are separate actions.',
        },
      ],
      links: [
        {
          label: 'GitHub integration',
          href: 'https://docs.macro.com/integrations/github',
        },
        {
          label: 'Working with agents',
          href: 'https://docs.macro.com/product/agents',
        },
      ],
    },
  ],
  'review-inbox': [
    {
      title: 'Review requests',
      summary: 'Find the pull requests waiting for your input.',
      intro:
        'Find GitHub review requests in your Macro inbox beside messages, tasks, and email.',
      sections: [
        {
          kind: 'steps',
          heading: 'Pick up a review',
          items: [
            {
              title: 'Open the request',
              text: 'Read the PR description and earlier feedback to see what needs your input.',
            },
            {
              title: 'Check the task',
              text: 'Follow the linked assignment for the expected behavior.',
            },
            {
              title: 'Inspect and respond',
              text: 'Read the diff and checks in Macro. Use GitHub for formal review comments and approvals.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'GitHub connection',
          text: 'Review activity depends on your connected account and repository access.',
        },
      ],
      links: [
        {
          label: 'GitHub connection',
          href: 'https://docs.macro.com/integrations/github',
        },
        {
          label: 'Unified inbox',
          href: 'https://docs.macro.com/product/inbox',
        },
      ],
    },
    {
      title: 'Comments and mentions',
      summary: 'See when a code discussion needs your attention.',
      intro:
        'Open GitHub comments and mentions from your Macro inbox to return to the code discussion.',
      sections: [
        {
          kind: 'text',
          heading: 'Read the exchange',
          paragraphs: [
            'Check the surrounding replies and current PR state before responding. Open Changes if the question concerns a specific edit.',
          ],
        },
        {
          kind: 'text',
          heading: 'Reply in the right place',
          paragraphs: [
            'Keep code-review discussion on GitHub. Use the Macro channel when a decision affects the broader project, and update the task if it creates more work.',
          ],
        },
      ],
      links: [
        {
          label: 'GitHub integration',
          href: 'https://docs.macro.com/integrations/github',
        },
        {
          label: 'Inbox',
          href: 'https://docs.macro.com/product/inbox',
        },
      ],
    },
  ],
} satisfies Record<string, readonly ProductFeatureDetail[]>;
