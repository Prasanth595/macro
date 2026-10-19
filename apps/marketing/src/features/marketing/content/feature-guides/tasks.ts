import type { ProductFeatureDetail } from '../../core/product-feature-guide';

// Sources: apps/docs/product/tasks.mdx, channels, mentions and email;
// task sharing: docs/agent-guide/tasks.md; PR transitions: crates/github/src/domain/models/sync.rs (c5cba006).
export const tasksGuides = {
  'from-a-message': [
    {
      title: 'Capture the request',
      summary: 'Make a task from the message that started the work.',
      intro:
        'When a request arrives in a channel, turn it into a task from the message itself. Give it a clear name and an owner, while keeping a route back to the conversation that explains it.',
      sections: [
        {
          kind: 'steps',
          heading: 'Make the request actionable',
          items: [
            {
              title: 'Start from the message',
              text: 'Open the message actions and choose Task. On desktop the actions appear when you hover; on a phone, open the message action drawer.',
            },
            {
              title: 'Name the outcome',
              text: 'Write what needs to be finished, such as “Send the revised proposal.” Add an assignee and priority so the next step is clear.',
            },
            {
              title: 'Save and check',
              text: 'Open the task to review its description and linked conversation. Add anything the person doing the work still needs.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'What belongs where',
          items: [
            {
              title: 'The task',
              text: 'Track the assignment, status, and concrete next step here. It gives the request a place in the team’s task list.',
            },
            {
              title: 'The conversation',
              text: 'Keep the original wording and replies available as the background. People can read why the work was requested without reconstructing it from memory.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Review sharing as you create it',
          text: 'The task composer lets you choose team sharing. Check that setting before saving, especially if the request came from a private conversation.',
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
        'An assignment should answer two simple questions: who is taking the next step, and how urgent is it? Set those on the task so the team can see them without reading through a conversation.',
      sections: [
        {
          kind: 'facts',
          heading: 'The fields that matter',
          items: [
            {
              title: 'Assignee',
              text: 'Choose the person responsible for the work. Assigning them sends an inbox notification, so the request reaches the person expected to act.',
            },
            {
              title: 'Priority',
              text: 'Show how the task compares with other work. Use it to distinguish an urgent customer fix from something that can wait.',
            },
            {
              title: 'Status',
              text: 'Use Not Started, In Progress, In Review, and Completed to describe where the task stands. Change it as the work progresses.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'A clear handoff',
          text: 'Julia will draft the proposal. Jacob will review the pricing before it goes to the customer.',
          caption:
            'If those are separate deliverables, create separate tasks so each person has a clear assignment.',
        },
        {
          kind: 'text',
          heading: 'When responsibility changes',
          paragraphs: [
            'Open the task and change the assignee, or ask an agent to make the update. Add a comment explaining the handoff if the new owner needs more information.',
            'Mention someone in a task comment when you need their attention. Writing a name in the description alone does not send the same notification.',
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
        'A task title says what to do. Its description should explain what a good result looks like and provide the sources needed to get there. You can write and format that description like a Macro document.',
      sections: [
        {
          kind: 'facts',
          heading: 'Make the task easy to pick up',
          items: [
            {
              title: 'The outcome',
              text: 'Describe what should be different when the work is finished. A concrete result is more helpful than a long account of how the request arrived.',
            },
            {
              title: 'A checklist',
              text: 'Break a small assignment into checkable steps. If a step needs a different owner or its own status, make it a separate task.',
            },
            {
              title: 'The sources',
              text: 'Mention the customer email, brief, or discussion using @. Readers can open the originals when a summary is not enough.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'Example task description',
          text: 'Update the proposal with the customer’s confirmed seat count. Check the pricing against the latest brief, then ask Julia to review before sending.',
        },
        {
          kind: 'text',
          heading: 'Keep decisions with the task',
          paragraphs: [
            'Use comments for questions, review feedback, and decisions that affect the work. Mention a teammate in a comment when you need a response.',
            'When the scope changes, update the description as well as the conversation. The next person should be able to understand the current assignment by opening the task.',
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
        'Ask an agent to turn a larger request into separate tasks. Explain the outcomes and who should own them, and give it the conversation or document that describes the work.',
      sections: [
        {
          kind: 'example',
          heading: 'Example request',
          text: 'Create a task for Julia to draft the proposal and another for Jacob to review pricing. Link both to this customer email.',
        },
        {
          kind: 'steps',
          heading: 'Give the agent a useful brief',
          items: [
            {
              title: 'Separate the outcomes',
              text: 'Name the pieces of work that can be completed independently. “Draft the proposal” and “Review the pricing” need different owners and different completion checks.',
            },
            {
              title: 'Provide the source',
              text: 'Mention the email, plan, or channel thread the agent should read. Include deadlines or priority if those have already been agreed.',
            },
            {
              title: 'Check the created tasks',
              text: 'Open the linked results. Review the titles, assignments, and descriptions before the team starts using them.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Keep uncertainty visible',
          text: 'If an owner or deadline has not been decided, say so. Ask the agent to leave it unset or bring the question back rather than treating a suggestion as a team decision.',
        },
        {
          kind: 'text',
          heading: 'Continue from the same conversation',
          paragraphs: [
            'You can ask the agent to revise a description, change an assignee, or report which tasks are still open. The updates apply to the shared tasks people use in Macro.',
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
        'When the team agrees on a handoff in a channel, ask the agent to update the task there. The conversation explains the change, and the task records who is now responsible.',
      sections: [
        {
          kind: 'example',
          heading: 'Example request',
          text: 'Julia is taking over the proposal draft. Assign that task to her and keep the pricing review with Jacob.',
        },
        {
          kind: 'steps',
          heading: 'Make the handoff unambiguous',
          items: [
            {
              title: 'Identify the task',
              text: 'Mention the task directly if several assignments have similar names. The agent can then update the correct item without guessing.',
            },
            {
              title: 'Name the new owner',
              text: 'Say who is taking over and which other assignments should stay as they are.',
            },
            {
              title: 'Check the result',
              text: 'Open the task from the agent’s reply and confirm the assignee. Add any handoff notes the new owner needs.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'What the new owner needs',
          items: [
            {
              title: 'The current plan',
              text: 'Keep the description up to date with the work that remains, rather than leaving the original scope after it has changed.',
            },
            {
              title: 'The reason',
              text: 'A short comment can explain the change or link to the channel discussion, so the next person understands what was agreed.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Use the task for the final assignment',
          text: 'A message saying someone will help is useful discussion. Changing the assignee is what makes that responsibility visible on the task.',
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
        'Link the customer’s email in the task description when it contains requirements, attachments, or decisions. The owner can check the source directly instead of working from a shortened retelling.',
      sections: [
        {
          kind: 'steps',
          heading: 'Connect the request to the work',
          items: [
            {
              title: 'Find the thread',
              text: 'Open the email with the relevant request. Check that it is the right conversation, especially when several threads have similar subjects.',
            },
            {
              title: 'Mention it in the task',
              text: 'Type @ in the description and select the email. Add a sentence explaining which part of the request the task covers.',
            },
            {
              title: 'Check the recipient’s access',
              text: 'Share the email with the teammate or channel if they cannot already open it. A task description should not point its owner to a source they cannot read.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'Example task note',
          text: 'The customer confirmed the seat count in this thread. Use that number in the revised proposal and review the attached requirements.',
        },
        {
          kind: 'note',
          heading: 'Reading and replying are different',
          text: 'Sharing an email thread in Macro lets teammates read it. It does not let them send a response from your account. Use normal email forwarding when someone needs to take over the external conversation.',
        },
        {
          kind: 'text',
          heading: 'Keep the task focused',
          paragraphs: [
            'Summarize the required action in the task. Keep the full conversation in the linked email so the task remains easy to scan.',
          ],
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
        'A task can point to the shared brief your team already uses. Open that document beside the task to check requirements, review details, or understand a change without making another copy.',
      sections: [
        {
          kind: 'steps',
          heading: 'Work from the original brief',
          items: [
            {
              title: 'Add the document',
              text: 'Mention the brief in the task description. Explain which section is relevant if it is a long document.',
            },
            {
              title: 'Read it alongside the task',
              text: 'Open the referenced document in another split when you have room. Keep the assignment visible while reading the source.',
            },
            {
              title: 'Record the decision',
              text: 'If the brief changes what needs doing, update the task description or leave a comment explaining the change.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Keep each item useful',
          items: [
            {
              title: 'Brief',
              text: 'Use it for the plan, design, requirements, and decisions shared across the project.',
            },
            {
              title: 'Task',
              text: 'Use it for a specific piece of work, its assignee, and its progress.',
            },
            {
              title: 'Comments',
              text: 'Use them for questions and feedback about that assignment. Mention a person in a comment when you need their attention.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Links follow the shared document',
          text: 'The task opens the same file the team edits. You do not need to replace a pasted attachment every time someone revises the brief.',
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
        'Link the conversation where a requirement or decision was agreed. It helps someone joining the work understand the tradeoffs, unanswered questions, and exact request before they start.',
      sections: [
        {
          kind: 'steps',
          heading: 'Leave a useful trail',
          items: [
            {
              title: 'Choose the relevant message',
              text: 'Find the message or thread that explains the decision. A direct link is easier to use than the name of a busy channel.',
            },
            {
              title: 'Copy its link',
              text: 'Use Copy Link in the message actions. On mobile, open the message action drawer.',
            },
            {
              title: 'Add a short explanation',
              text: 'Put the link in the task with a sentence such as “This is where we agreed to keep guest access out of the first release.”',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'A helpful reference',
          text: 'Decision: ship the upload fix first. The channel thread explains why guest access is being handled separately.',
        },
        {
          kind: 'text',
          heading: 'Use the original thread for follow-up',
          paragraphs: [
            'When you need clarification, reply in the discussion or bring a clear question into the task comments. Keep new decisions reflected in the task’s description so the assignment does not depend on reading every message.',
          ],
        },
        {
          kind: 'note',
          heading: 'Access still follows the source',
          text: 'A link to a private channel does not invite someone into it. Make sure the assignee can read the conversation, or provide the relevant explanation in the task.',
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
        'A task ID tells Macro which piece of work a GitHub pull request belongs to. Include it in the branch name, PR title, or PR description so the task and implementation can be tracked together.',
      sections: [
        {
          kind: 'steps',
          heading: 'Connect the two',
          items: [
            {
              title: 'Connect GitHub',
              text: 'Link your GitHub account from Macro’s settings and authorize the relevant repository access.',
            },
            {
              title: 'Use the task’s ID',
              text: 'Copy the branch name from the task, or include its existing ID in the pull request’s title or description. Use the actual task ID, not just a similar title.',
            },
            {
              title: 'Check the task',
              text: 'Once Macro processes the linked PR, its reference appears on the task. Open it to inspect the code and discussion.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Why the link matters',
          items: [
            {
              title: 'For the assignee',
              text: 'The implementation stays attached to the work it is meant to complete.',
            },
            {
              title: 'For the reviewer',
              text: 'The task provides the original request and acceptance details behind the code change.',
            },
            {
              title: 'For the team',
              text: 'Task status can follow PR events, reducing the need to update the same progress in two places.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'A link does not change GitHub permissions',
          text: 'People still need the appropriate repository access to open and act on a private pull request.',
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
        'Once a pull request is linked, Macro uses its GitHub events to keep the task status current. The task can show that implementation is in review or complete without a separate manual update.',
      sections: [
        {
          kind: 'facts',
          heading: 'How the status changes',
          items: [
            {
              title: 'PR opened',
              text: 'The linked task moves to In Review, so the team can see that the change has reached the review stage.',
            },
            {
              title: 'PR merged',
              text: 'The task becomes Completed. The pull request stays linked as the record of the implementation.',
            },
            {
              title: 'PR closed without merging',
              text: 'The task returns to Not Started. Closing an abandoned PR does not mark the work finished.',
            },
            {
              title: 'PR reopened',
              text: 'The linked task moves back to In Review when the pull request is reopened.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Check the work behind the status',
          paragraphs: [
            'Open the PR from the task when you need to read the changes or understand why a review is blocked. The task status summarizes progress; GitHub still holds the repository’s checks and review requirements.',
          ],
        },
        {
          kind: 'note',
          heading: 'When the scope changes',
          text: 'If a PR is replaced or the task needs more work, review the link and task description. The automation follows the connected pull request, so make sure that PR still represents the assignment.',
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
