import type { ProductFeatureDetail } from '../../core/product-feature-guide';

// Sources: apps/docs/product/tasks.mdx, channels, mentions and email;
// task sharing: docs/agent-guide/tasks.md; PR transitions: crates/github/src/domain/models/sync.rs (c5cba006).
export const tasksGuides = {
  'from-a-message': [
    {
      title: 'Create a task from a message',
      summary: 'Make a task from the message that started the work.',
      intro:
        'Turn a channel message into a task with an owner and a link back to the original conversation.',
      sections: [
        {
          kind: 'steps',
          heading: 'Create from a message',
          items: [
            {
              title: 'Choose Task',
              text: 'Open the message actions. On desktop, hover over the message; on mobile, use its action drawer.',
            },
            {
              title: 'Describe the outcome',
              text: 'Give the task a clear name, assignee, and priority. Add the details needed to complete it.',
            },
            {
              title: 'Save the task',
              text: 'Check its description and the linked conversation.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Team sharing',
          text: 'Review sharing in the task composer, especially when the request came from a private conversation.',
        },
      ],
      links: [
        {
          label: 'Creating and managing tasks',
          href: 'https://docs.macro.com/product/tasks',
        },
        {
          label: 'Message actions',
          href: 'https://docs.macro.com/product/channels',
        },
      ],
    },
    {
      title: 'Choose an owner',
      summary: 'Make it clear who is responsible and what matters first.',
      intro:
        'Set who is responsible, how urgent the work is, and where it stands.',
      sections: [
        {
          kind: 'facts',
          heading: 'Task fields',
          items: [
            {
              title: 'Assignee',
              text: 'Choose the person taking the next step. Assignment sends them an inbox notification.',
            },
            {
              title: 'Priority',
              text: 'Show how the task compares with other work.',
            },
            {
              title: 'Status',
              text: 'Track progress with Not Started, In Progress, In Review, and Completed.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Handing work over',
          paragraphs: [
            'Change the assignee and leave a comment with what remains. Mention someone in a comment to notify them; a name in the description does not.',
          ],
        },
      ],
      links: [
        {
          label: 'Task assignments',
          href: 'https://docs.macro.com/product/tasks',
        },
        {
          label: 'Notifications and sharing',
          href: 'https://docs.macro.com/permissions',
        },
      ],
    },
    {
      title: 'Add the missing details',
      summary: 'Give someone enough information to complete the task.',
      intro:
        'Use the task description to explain the expected result and link the sources needed to get there.',
      sections: [
        {
          kind: 'facts',
          heading: 'Include what helps',
          items: [
            {
              title: 'Outcome',
              text: 'Describe what should be different when the work is finished.',
            },
            {
              title: 'Checklist',
              text: 'Break the assignment into checkable steps. Give separate tasks to work that needs its own owner or status.',
            },
            {
              title: 'Sources',
              text: 'Use @ to mention the email, brief, or document behind the request.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Keep the description current',
          paragraphs: [
            'Discuss questions in comments and update the description when the scope changes.',
          ],
        },
      ],
      links: [
        {
          label: 'Tasks',
          href: 'https://docs.macro.com/product/tasks',
        },
        {
          label: 'Editor and formatting',
          href: 'https://docs.macro.com/product/docs',
        },
      ],
    },
  ],
  'ask-macro': [
    {
      title: 'Create several tasks',
      summary: 'Split a request into clear assignments for the team.',
      intro:
        'Ask an agent to split a request into separate assignments, using the source conversation or document.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Create a task for Julia to draft the proposal and another for Jacob to review pricing. Link both to this customer email.',
        },
        {
          kind: 'text',
          heading: 'Include agreed details',
          paragraphs: [
            'Specify owners, priorities, and deadlines when decided. Leave undecided fields unset. Open the created tasks to check their assignments and descriptions.',
          ],
        },
      ],
      links: [
        {
          label: 'Agents and task actions',
          href: 'https://docs.macro.com/product/agents',
        },
        {
          label: 'Tasks',
          href: 'https://docs.macro.com/product/tasks',
        },
      ],
    },
    {
      title: 'Reassign in chat',
      summary: 'Update the task when someone else takes over.',
      intro:
        'Ask an agent to change the assignee when someone else takes over a task.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Julia is taking over the proposal draft. Assign that task to her and keep the pricing review with Jacob.',
        },
        {
          kind: 'text',
          heading: 'Make the handoff clear',
          paragraphs: [
            'Mention the task so the agent updates the right item. Add a comment explaining the remaining work, then check the new assignee on the task.',
          ],
        },
      ],
      links: [
        {
          label: 'Task assignments',
          href: 'https://docs.macro.com/product/tasks',
        },
        {
          label: 'Agents in channels',
          href: 'https://docs.macro.com/product/agents',
        },
      ],
    },
  ],
  'from-docs-and-email': [
    {
      title: 'Reference the customer email',
      summary: 'Let the task’s owner read the original request.',
      intro:
        'Link the customer’s email in the task description so the owner can read the request and attachments.',
      sections: [
        {
          kind: 'steps',
          heading: 'Add the source',
          items: [
            {
              title: 'Mention the email',
              text: 'Type @ in the description and select the thread.',
            },
            {
              title: 'Explain what to use',
              text: 'Say which requirement, date, or attachment matters for this assignment.',
            },
            {
              title: 'Check access',
              text: 'Share the email with the teammate or channel if they cannot already open it.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Reading access',
          text: 'Sharing the thread does not let the assignee send email from your account.',
        },
      ],
      links: [
        {
          label: 'Email sharing',
          href: 'https://docs.macro.com/product/email',
        },
        {
          label: 'Mentions',
          href: 'https://docs.macro.com/concepts/mentions',
        },
      ],
    },
    {
      title: 'Open the brief beside the task',
      summary: 'Read the requirements while working through the assignment.',
      intro:
        'Keep the project brief one click from the task, so the assignee can check requirements while working.',
      sections: [
        {
          kind: 'text',
          heading: 'Reference the document',
          paragraphs: [
            'Type @ in the task description and select the brief. The link opens the shared file, including later edits.',
          ],
        },
        {
          kind: 'text',
          heading: 'Read while you work',
          paragraphs: [
            'Open the brief in another split to keep the task visible. Update the task description when a decision in the brief changes the assignment.',
          ],
        },
      ],
      links: [
        {
          label: 'Documents',
          href: 'https://docs.macro.com/product/docs',
        },
        {
          label: 'Tasks',
          href: 'https://docs.macro.com/product/tasks',
        },
      ],
    },
    {
      title: 'Find the discussion',
      summary: 'Keep the reasoning behind a task within reach.',
      intro:
        'Link the message where the team agreed on a requirement or decision.',
      sections: [
        {
          kind: 'steps',
          heading: 'Link the decision',
          items: [
            {
              title: 'Copy the message link',
              text: 'Choose Copy Link in the message actions. On mobile, open its action drawer.',
            },
            {
              title: 'Add it to the task',
              text: 'Include a sentence explaining the decision, such as why guest access is outside this release.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Private channels',
          text: 'The assignee needs access to read the linked conversation. Share the relevant explanation in the task if they cannot open it.',
        },
      ],
      links: [
        {
          label: 'Channel message links',
          href: 'https://docs.macro.com/product/channels',
        },
        {
          label: 'Permissions',
          href: 'https://docs.macro.com/permissions',
        },
      ],
    },
  ],
  github: [
    {
      title: 'Link by task ID',
      summary: 'Connect the task to the pull request that implements it.',
      intro:
        'Include a task’s ID in the branch name, PR title, or PR description to connect the assignment to its implementation.',
      sections: [
        {
          kind: 'steps',
          heading: 'Connect a pull request',
          items: [
            {
              title: 'Connect GitHub',
              text: 'Authorize your GitHub account and the relevant repository in Macro’s settings.',
            },
            {
              title: 'Use the task ID',
              text: 'Copy the branch name from the task or add its ID to the PR.',
            },
            {
              title: 'Check the link',
              text: 'After Macro processes the GitHub update, open the PR reference on the task.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Repository access',
          text: 'A task link does not grant access to a private GitHub repository.',
        },
      ],
      links: [
        {
          label: 'GitHub connection',
          href: 'https://docs.macro.com/integrations/github',
        },
        {
          label: 'Tasks',
          href: 'https://docs.macro.com/product/tasks',
        },
      ],
    },
    {
      title: 'Move through review',
      summary: 'Let pull request changes update the linked task.',
      intro:
        'A linked pull request updates the task’s status as it opens, merges, or closes.',
      sections: [
        {
          kind: 'facts',
          heading: 'Task status follows the PR',
          items: [
            {
              title: 'Opened or reopened',
              text: 'In Review',
            },
            {
              title: 'Merged',
              text: 'Completed',
            },
            {
              title: 'Closed without merging',
              text: 'Not Started',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'When the implementation changes',
          paragraphs: [
            'Include the task ID on a replacement PR and check the link. GitHub still controls reviews and checks; a merge does not necessarily mean the change has been deployed.',
          ],
        },
      ],
      links: [
        {
          label: 'GitHub task sync',
          href: 'https://docs.macro.com/integrations/github',
        },
        {
          label: 'Task statuses',
          href: 'https://docs.macro.com/product/tasks',
        },
      ],
    },
  ],
} satisfies Record<string, readonly ProductFeatureDetail[]>;
