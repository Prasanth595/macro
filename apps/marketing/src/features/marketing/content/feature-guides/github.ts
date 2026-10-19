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
        'A pull request, or PR, is a proposed code change in GitHub. Share it in a Macro conversation so the team can open the implementation from the discussion that explains why it matters.',
      sections: [
        {
          kind: 'steps',
          heading: 'Bring the code into the conversation',
          items: [
            {
              title: 'Connect GitHub',
              text: 'Link your GitHub account in Macro’s settings and authorize the relevant access.',
            },
            {
              title: 'Share the PR',
              text: 'Paste its GitHub link into the conversation. Macro can show a linked pull request reference with its current status.',
            },
            {
              title: 'Explain the request',
              text: 'Add a sentence saying what you need, such as a review of the upload flow or a check against the customer’s requirements.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'What the reference provides',
          items: [
            {
              title: 'A route to the change',
              text: 'Open the pull request from Macro to read its details and inspect the changed code.',
            },
            {
              title: 'Current status',
              text: 'The linked item reflects whether the PR is open, closed, or merged as GitHub updates arrive.',
            },
            {
              title: 'A connection to the work',
              text: 'Mention the related task or brief so reviewers can understand the purpose as well as the implementation.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Repository access still applies',
          text: 'Sharing a PR link in a channel does not grant access to a private GitHub repository. Teammates need the appropriate GitHub permissions.',
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
        'Open Changes on a pull request to inspect its diff: the files and lines added, removed, or changed. You can read the implementation alongside the PR’s description and discussion.',
      sections: [
        {
          kind: 'facts',
          heading: 'What to look at',
          items: [
            {
              title: 'Changed files',
              text: 'Use the file tree to move to the part of the code relevant to your review.',
            },
            {
              title: 'Added and removed lines',
              text: 'Read the change with the surrounding code. The diff shows what the PR proposes, not just a final file with the edits hidden.',
            },
            {
              title: 'PR discussion',
              text: 'Check the description and existing conversation to understand the reason for the change.',
            },
            {
              title: 'Checks',
              text: 'Review the repository’s automated checks to see whether its tests and other required jobs have completed.',
            },
          ],
        },
        {
          kind: 'steps',
          heading: 'Review with the task in mind',
          items: [
            {
              title: 'Open the assignment',
              text: 'Read the linked task or brief so you know the expected behavior.',
            },
            {
              title: 'Inspect the implementation',
              text: 'Follow the relevant files and compare the change with the requirements.',
            },
            {
              title: 'Continue the review',
              text: 'Use GitHub for formal review comments and approvals. Macro’s diff viewer is for reading the change.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Reading a diff is only one part of review',
          text: 'A change can look reasonable in code and still behave incorrectly. Check the preview or running product when the PR changes something users see.',
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
        'Merge a ready pull request from Macro using your connected GitHub account. Before it goes through, a confirmation shows the repository, PR number, and title so you can check the exact change.',
      sections: [
        {
          kind: 'facts',
          heading: 'When the action appears',
          items: [
            {
              title: 'Open and ready',
              text: 'The PR must be open and no longer a draft.',
            },
            {
              title: 'Checks complete',
              text: 'The PR must have checks, and all must finish with a success, skipped, or neutral result. Running or failing checks keep Merge unavailable.',
            },
            {
              title: 'Connected account',
              text: 'The merge uses your linked GitHub account and its repository access.',
            },
          ],
        },
        {
          kind: 'steps',
          heading: 'Confirm the right change',
          items: [
            {
              title: 'Review the PR',
              text: 'Read the changes, discussion, and check results. Make sure it is the implementation you intend to merge.',
            },
            {
              title: 'Choose Merge',
              text: 'Review the confirmation showing the repository, PR number, and title.',
            },
            {
              title: 'Confirm and check',
              text: 'GitHub applies its permissions and branch protections. Macro refreshes the PR status after a successful merge or shows the reason if GitHub refuses.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'GitHub remains the authority',
          text: 'The action does not bypass required reviews or repository protections. A PR without a Merge button can still be opened on GitHub to inspect what is blocking it.',
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
        'Use the task’s ID to connect a GitHub pull request to the work it implements. Macro can then display the PR on the task and update task progress as the PR changes.',
      sections: [
        {
          kind: 'steps',
          heading: 'Make the link',
          items: [
            {
              title: 'Start with the task',
              text: 'Create or open the Macro task that describes the assignment. Use its actual ID rather than making up a label.',
            },
            {
              title: 'Include the ID in GitHub',
              text: 'Put it in the branch name, pull request title, or PR description. Copying a branch name from the task is a convenient starting point.',
            },
            {
              title: 'Verify the association',
              text: 'After the GitHub update is processed, check that the PR appears on the task. Open the link to confirm it is the correct implementation.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Give both sides enough information',
          items: [
            {
              title: 'Task',
              text: 'Explain the requested behavior, owner, and source material.',
            },
            {
              title: 'Pull request',
              text: 'Explain the code change and any details the reviewer needs to assess it.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'An ID is more reliable than a similar title',
          text: 'Two tasks can have similar wording. The ID lets Macro associate the PR with the specific assignment, so status changes go to the right place.',
        },
        {
          kind: 'note',
          heading: 'Connection required',
          text: 'Your GitHub account and relevant repository access must be connected for Macro to receive and act on the PR updates.',
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
      title: 'Open a PR',
      summary: 'Show that the linked task has reached review.',
      intro:
        'When a linked pull request opens, Macro moves the task to In Review. The team can see that an implementation is available and open the PR from the task to inspect it.',
      sections: [
        {
          kind: 'facts',
          heading: 'What happens',
          items: [
            {
              title: 'The PR opens',
              text: 'GitHub sends the pull request update to Macro through the integration.',
            },
            {
              title: 'The task updates',
              text: 'Macro identifies the task from its ID and sets its status to In Review.',
            },
            {
              title: 'The link stays available',
              text: 'The task keeps a reference to the pull request, making the code easy to find during review.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Make the review understandable',
          paragraphs: [
            'Keep the task’s description current before opening the PR. Reviewers should be able to read the expected behavior, follow the relevant source, and understand what the implementation is meant to accomplish.',
            'Use the pull request description for the implementation details and checks that help a reviewer evaluate the change.',
          ],
        },
        {
          kind: 'note',
          heading: 'In Review is progress, not approval',
          text: 'The status says the work has reached a review stage. It does not mean the code has been approved or that the repository’s checks have passed.',
        },
        {
          kind: 'note',
          heading: 'If the task did not change',
          text: 'Check the task ID in the branch name, PR title, or description, and confirm that the GitHub connection covers the repository.',
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
    {
      title: 'Merge the change',
      summary: 'Complete the linked task when its PR is merged.',
      intro:
        'When GitHub reports that the linked pull request has merged, Macro marks the task Completed. The task and code stay connected, giving the team a record of the implementation behind the finished work.',
      sections: [
        {
          kind: 'steps',
          heading: 'From review to completion',
          items: [
            {
              title: 'Finish the review',
              text: 'Resolve the repository’s review and check requirements before merging.',
            },
            {
              title: 'Merge the linked PR',
              text: 'Merge through GitHub or Macro’s eligible Merge action. The repository’s permissions and protections still apply.',
            },
            {
              title: 'Check the task',
              text: 'The linked task moves to Completed when Macro processes the merge event. The PR reference remains on the task.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Keep the record useful',
          items: [
            {
              title: 'The task',
              text: 'Shows the assignment and its completed status.',
            },
            {
              title: 'The PR',
              text: 'Shows the actual code change, discussion, and merge outcome.',
            },
            {
              title: 'Follow-up work',
              text: 'Use a separate task for a new piece of work that remains after the change, rather than leaving it implied in a completed assignment.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Merged does not always mean released',
          text: 'A repository may deploy later or use a separate release process. The task update reflects the PR merge, not a guarantee that the change is already live for every user.',
        },
      ],
      links: [
        {
          label: 'GitHub integration',
          href: 'https://docs.macro.com/integrations/github',
        },
        {
          label: 'Tasks',
          href: 'https://docs.macro.com/product/tasks',
        },
      ],
    },
    {
      title: 'Close without merging',
      summary: 'Keep abandoned code from looking like finished work.',
      intro:
        'If a linked pull request is closed without being merged, Macro returns the task to Not Started. The assignment remains open because that proposed implementation did not become part of the codebase.',
      sections: [
        {
          kind: 'facts',
          heading: 'How the outcomes differ',
          items: [
            {
              title: 'Merged',
              text: 'The implementation was accepted into the target branch. Macro marks the linked task Completed.',
            },
            {
              title: 'Closed without a merge',
              text: 'That proposed change was abandoned or superseded. Macro sets the linked task to Not Started.',
            },
            {
              title: 'Reopened',
              text: 'When the linked PR is reopened, the task moves back to In Review.',
            },
          ],
        },
        {
          kind: 'steps',
          heading: 'Keep the assignment accurate',
          items: [
            {
              title: 'Explain the reason',
              text: 'Leave a clear note when the PR is being replaced, the approach changed, or the work is no longer needed.',
            },
            {
              title: 'Review the remaining work',
              text: 'Update the task description so the next person knows what to do.',
            },
            {
              title: 'Link the replacement',
              text: 'If another PR takes over the implementation, include the task ID there and verify the new association.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Not Started does not erase history',
          text: 'The task still has its description, discussion, and linked implementation history. The status simply keeps an unmerged change from making the assignment look complete.',
        },
      ],
      links: [
        {
          label: 'GitHub task sync',
          href: 'https://docs.macro.com/integrations/github',
        },
        {
          label: 'Tasks',
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
        'Ask a connected coding agent to pick up a bug from the team conversation. The channel can supply the report, supporting files, and the result the team expects, while the agent works through the implementation.',
      sections: [
        {
          kind: 'example',
          heading: 'Example request',
          text: '@Cursor, investigate the upload failure described in this thread. Use the linked task for the expected behavior, make the smallest fix, and return a pull request for review.',
        },
        {
          kind: 'facts',
          heading: 'What to include',
          items: [
            {
              title: 'The problem',
              text: 'Describe what happens and what should happen instead. Include reproduction steps if you know them.',
            },
            {
              title: 'The sources',
              text: 'Mention the task, customer report, or relevant document so the agent can read the exact information.',
            },
            {
              title: 'The scope',
              text: 'Name the repository or project and any constraints, such as keeping the existing interface.',
            },
            {
              title: 'The result',
              text: 'Ask for a reviewable change and the checks needed to show the bug is fixed.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Keep the team involved',
          paragraphs: [
            'Answer clarifying questions in the thread and add information when the investigation reveals it. When the agent produces a PR, open it and review the actual change.',
          ],
        },
        {
          kind: 'note',
          heading: 'A connected agent needs access',
          text: 'The coding agent must be configured for the repository and runtime it uses. Mentioning Cursor does not by itself grant access or complete that setup.',
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
        'Treat an agent’s pull request as a proposed change to review. Open it in Macro to read the description and diff, then check whether it actually addresses the bug reported by the team.',
      sections: [
        {
          kind: 'steps',
          heading: 'Review against the request',
          items: [
            {
              title: 'Read the task again',
              text: 'Start with the expected behavior and the original report. Make sure the PR is solving the same problem.',
            },
            {
              title: 'Inspect the changes',
              text: 'Open Changes and review the files the agent touched. Look for unrelated edits or parts of the requested behavior that are missing.',
            },
            {
              title: 'Check the result',
              text: 'Read the automated check results and try the affected flow when a preview or local build is available.',
            },
            {
              title: 'Give the next instruction',
              text: 'Ask the agent for a correction when needed. Submit formal review comments or approvals through GitHub.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Questions worth answering',
          items: [
            {
              title: 'Does it fix the cause?',
              text: 'The change should address why the bug happens, not only hide the visible symptom.',
            },
            {
              title: 'Does the existing flow still work?',
              text: 'Check the surrounding behavior that the change could affect.',
            },
            {
              title: 'Can the team maintain it?',
              text: 'The implementation should fit the repository’s patterns and be understandable to a reviewer.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Merge remains a separate action',
          text: 'A PR appearing in the conversation does not mean it has been approved, merged, or released.',
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
        'Macro brings GitHub review activity into the workspace alongside your other work. Open a review request to read the pull request and understand what the author needs from you.',
      sections: [
        {
          kind: 'steps',
          heading: 'Handle a request',
          items: [
            {
              title: 'Open the notification',
              text: 'Go to the linked pull request to read its title, description, and discussion.',
            },
            {
              title: 'Check the assignment',
              text: 'Open the related task or brief if you need the original requirements.',
            },
            {
              title: 'Inspect the change',
              text: 'Use Changes to read the diff and review the check results.',
            },
            {
              title: 'Respond through the right place',
              text: 'Use GitHub for formal review comments and approvals, or discuss the work with your team in Macro.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'The request is a starting point',
          items: [
            {
              title: 'PR status',
              text: 'Check whether the change is still open before spending time reviewing an outdated request.',
            },
            {
              title: 'Existing discussion',
              text: 'Read earlier feedback so you can focus on unresolved questions.',
            },
            {
              title: 'Repository rules',
              text: 'The project may require specific reviewers or checks before it can merge.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Connect the relevant GitHub account',
          text: 'Review activity depends on your GitHub connection and access. A request in Macro does not grant permissions to a private repository you cannot otherwise open.',
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
        'GitHub comments and mentions can bring you back to a pull request from the Macro inbox. Open the linked discussion to understand the question before replying or asking an agent to follow up.',
      sections: [
        {
          kind: 'facts',
          heading: 'Different reasons to open the PR',
          items: [
            {
              title: 'A question',
              text: 'A teammate may need an explanation of the behavior or implementation.',
            },
            {
              title: 'Review feedback',
              text: 'The author may need to change the code or clarify the proposal.',
            },
            {
              title: 'A direct mention',
              text: 'Someone has called your attention to a particular part of the conversation.',
            },
          ],
        },
        {
          kind: 'steps',
          heading: 'Close the loop',
          items: [
            {
              title: 'Read the surrounding discussion',
              text: 'Check the relevant comment and the replies around it. One notification may be only part of the exchange.',
            },
            {
              title: 'Inspect the code if needed',
              text: 'Open the diff to see the change being discussed, and follow the task for the original requirements.',
            },
            {
              title: 'Reply where the decision belongs',
              text: 'Use GitHub for the code review discussion. Use the team channel when the answer affects the broader project or customer conversation.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'A useful team update',
          text: 'The reviewer found a missing edge case in the upload flow. I linked the PR to the task and asked for one more pass.',
        },
        {
          kind: 'note',
          heading: 'Avoid treating every notification as new work',
          text: 'Check whether the question has already been answered or the PR has changed since the notification arrived.',
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
    {
      title: 'One inbox for the follow-up',
      summary: 'Keep code review activity beside the work that explains it.',
      intro:
        'Your review queue is part of a larger workday. Macro’s inbox brings relevant GitHub activity alongside messages, tasks, and email, so you can move from a review request to the conversation or assignment behind it.',
      sections: [
        {
          kind: 'facts',
          heading: 'Follow the work across items',
          items: [
            {
              title: 'Review request',
              text: 'Open the PR to understand the proposed code change and what needs your attention.',
            },
            {
              title: 'Task',
              text: 'Read the assignment, owner, and expected outcome the implementation should satisfy.',
            },
            {
              title: 'Channel message',
              text: 'Catch up on the team’s decisions or ask a question about the direction.',
            },
            {
              title: 'Customer email',
              text: 'Check the original report or requirement when the change came from a customer request.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Use the inbox to decide, then open the source',
          paragraphs: [
            'The inbox helps you see what needs attention. The linked PR, task, or conversation is where you inspect the details and take the appropriate action.',
            'When a review reveals more work, update the task or create a follow-up with a clear owner. Keep the reference to the PR so the next person can understand why it was requested.',
          ],
        },
        {
          kind: 'note',
          heading: 'One inbox does not mean one permission system',
          text: 'Macro items follow their sharing settings, and GitHub repositories keep their own access rules. Connecting the work makes it easier to navigate without making private sources public.',
        },
      ],
      links: [
        {
          label: 'Unified inbox',
          href: 'https://docs.macro.com/product/inbox',
        },
        {
          label: 'GitHub integration',
          href: 'https://docs.macro.com/integrations/github',
        },
      ],
    },
  ],
} satisfies Record<string, readonly ProductFeatureDetail[]>;
