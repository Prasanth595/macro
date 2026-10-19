import type { ProductFeatureDetail } from '../../core/product-feature-guide';

// Sources: product/docs, folders, tagging, mentions and permissions in apps/docs;
// verified against docs/agent-guide/documents.md at c5cba006.
export const documentsGuides = {
  'document-agents': [
    {
      title: 'Update from an email',
      summary: 'Turn customer feedback into changes in the shared document.',
      intro:
        'When a customer asks for a change, give your agent the email and the document it affects. The agent can read the request and edit the existing file, so your team can review the result where it already works.',
      sections: [
        {
          kind: 'example',
          heading: 'Example request',
          text: 'Update the rollout plan with the dates Valentina confirmed in this email. Keep the rest of the plan as it is.',
          caption:
            'Mention the actual email and rollout plan in your request so the agent opens the right items.',
        },
        {
          kind: 'steps',
          heading: 'From request to revision',
          items: [
            {
              title: 'Point to the sources',
              text: 'Type @ to select the email thread and the document. A mention links to the original item, including the text the agent needs to read.',
            },
            {
              title: 'Describe the change',
              text: 'Name the section or decision you want updated. Include any wording, dates, or details that should stay the same.',
            },
            {
              title: 'Read the result',
              text: 'Open the shared document and check the change against the email. Edit it yourself or ask for another pass in the same conversation.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'The document stays shared',
          text: 'The agent edits the file you referenced. Existing collaborators keep working in that document, and its links continue to point to it. The agent can only open and edit items your account is allowed to access.',
        },
      ],
      links: [
        {
          label: 'Working with agents',
          href: 'https://docs.macro.com/product/agents',
        },
        {
          label: 'Document editing',
          href: 'https://docs.macro.com/product/docs',
        },
      ],
    },
    {
      title: 'Edit together',
      summary: 'Write with teammates and agents in the same document.',
      intro:
        'Open a document with your team and work on it together. Changes appear as people write, including when an agent updates the file. There is no separate draft to collect and paste back into the team’s version.',
      sections: [
        {
          kind: 'text',
          heading: 'One document, several contributors',
          paragraphs: [
            'Use the same editor for a project brief, meeting notes, or a working plan. It supports headings, lists, checklists, tables, images, and links. Teammates can make changes in different parts of the document while you keep writing.',
            'Macro combines simultaneous edits, including edits to the same line. You can keep working through a lost connection and sync changes when you reconnect.',
          ],
        },
        {
          kind: 'facts',
          heading: 'When you need feedback',
          items: [
            {
              title: 'Comments',
              text: 'Select text and leave a comment tied to that passage. Replies stay together, and you can resolve the thread when the feedback is addressed.',
            },
            {
              title: 'Mentions',
              text: 'Mention a teammate in a comment to bring them into the discussion. Simply putting their name in the document body does not notify them.',
            },
            {
              title: 'History',
              text: 'Browse past versions to understand what changed. You can fork an earlier version into a separate document when you need a copy of that state.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Choose who can edit',
          text: 'Use Share to give someone the appropriate access. An editor can change the document; a commenter can leave feedback; a viewer can read it. Sharing a document does not have to mean giving everyone editing rights.',
        },
      ],
      links: [
        {
          label: 'Documents',
          href: 'https://docs.macro.com/product/docs',
        },
        {
          label: 'Sharing and permissions',
          href: 'https://docs.macro.com/permissions',
        },
      ],
    },
  ],
  'document-links': [
    {
      title: 'Reference the email',
      summary: 'Keep the original customer request one click from the brief.',
      intro:
        'A document can link directly to an email thread in Macro. That gives the reader a way to check what the customer actually said, including the replies and attachments, instead of relying on a copied excerpt.',
      sections: [
        {
          kind: 'steps',
          heading: 'Add the source',
          items: [
            {
              title: 'Insert a mention',
              text: 'Type @ in the document and find the email thread. Select the result to insert a reference at the point where it matters.',
            },
            {
              title: 'Explain why it matters',
              text: 'Add a sentence beside the reference, such as which requirement or date the customer confirmed. The link provides evidence; your sentence makes its purpose clear.',
            },
            {
              title: 'Open the conversation',
              text: 'Click the mention to read the original email. You can return to the document after checking the details.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'In a rollout plan',
          text: 'Customer approval: Valentina confirmed the revised launch date in the rollout email thread.',
          caption:
            'Use an email mention after the sentence so the reader can open the conversation.',
        },
        {
          kind: 'note',
          heading: 'Check access to the email',
          text: 'A link in a document is a reference. When teammates need the email itself, share the thread with them or their channel. Shared readers can view the thread; sharing does not give them permission to send replies from your mailbox.',
        },
      ],
      links: [
        {
          label: 'Linking work with mentions',
          href: 'https://docs.macro.com/concepts/mentions',
        },
        {
          label: 'Sharing email',
          href: 'https://docs.macro.com/product/email',
        },
      ],
    },
    {
      title: 'Check the task',
      summary: 'See the current task status from inside the document.',
      intro:
        'Mention a task in a brief or plan to connect the explanation with the work that needs doing. The reference shows the task’s current details and opens the task when someone needs to act.',
      sections: [
        {
          kind: 'facts',
          heading: 'What stays connected',
          items: [
            {
              title: 'The plan',
              text: 'Describe the outcome, requirements, and decisions in the document. Put the task reference beside the part it implements.',
            },
            {
              title: 'The assignment',
              text: 'Keep the owner, status, and priority on the task itself. The mention reflects task information, so a manually typed status in the brief is unnecessary.',
            },
            {
              title: 'The discussion',
              text: 'Open the task to read its description and comments. Questions about the assignment stay with the work instead of becoming another version of the plan.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'In a launch checklist',
          text: 'Before inviting customers, complete the task to review the onboarding email.',
          caption:
            'Insert the real task with @ so readers can see whether it is still open.',
        },
        {
          kind: 'text',
          heading: 'Give the reader a clear next step',
          paragraphs: [
            'Use a task for something someone can finish, such as reviewing a draft or testing a change. Use the document for the information they need to do it. This keeps a long brief readable without hiding the responsibilities inside paragraphs.',
          ],
        },
        {
          kind: 'note',
          heading: 'A reference is not a new task',
          text: 'Mentioning an existing task does not create another assignment. Everyone who can open the reference is looking at the same task.',
        },
      ],
      links: [
        {
          label: 'Tasks',
          href: 'https://docs.macro.com/product/tasks',
        },
        {
          label: 'Mentions',
          href: 'https://docs.macro.com/concepts/mentions',
        },
      ],
    },
    {
      title: 'Read side by side',
      summary: 'Keep a source open while you write or check a document.',
      intro:
        'Use Macro’s split view when you need to compare a document with an email, task, or another file. Both stay open, so you can read the source while changing the draft.',
      sections: [
        {
          kind: 'steps',
          heading: 'Keep both items in view',
          items: [
            {
              title: 'Open the document',
              text: 'Start with the brief, plan, or notes you want to work on.',
            },
            {
              title: 'Open the supporting item',
              text: 'Use Open in new split on the source you need. From a focused list result, Shift + Enter opens it in another split.',
            },
            {
              title: 'Work between the two',
              text: 'Check the original wording, update the document, and follow other references when needed. Each pane shows the original item, with its usual controls.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Useful pairings',
          items: [
            {
              title: 'Email and plan',
              text: 'Check the customer’s dates and requirements while revising the rollout plan.',
            },
            {
              title: 'Task and brief',
              text: 'Read the acceptance details while updating the task’s description or progress.',
            },
            {
              title: 'Two documents',
              text: 'Compare the working plan with the meeting notes that explain a change.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'On a smaller screen',
          text: 'Open the source, read the detail, and return to the document. The link is still useful when there is not enough room to read both comfortably.',
        },
      ],
      links: [
        {
          label: 'Document references',
          href: 'https://docs.macro.com/product/docs',
        },
        {
          label: 'Navigation shortcuts',
          href: 'https://docs.macro.com/keyboard-shortcuts',
        },
      ],
    },
  ],
  'document-organization': [
    {
      title: 'Give docs a home',
      summary: 'Group the files a team or project uses in a folder.',
      intro:
        'Put related documents in a folder so people have a clear place to start. A launch folder might contain the plan, customer brief, and supporting files, while links connect those files to the work elsewhere in Macro.',
      sections: [
        {
          kind: 'steps',
          heading: 'Organize a project',
          items: [
            {
              title: 'Create a folder',
              text: 'Give it a name people will recognize, such as the project or team. Keep the name useful to someone who did not create it.',
            },
            {
              title: 'Move in the documents',
              text: 'Move existing files into the folder. They remain the same documents, so you can keep referencing them from tasks and conversations.',
            },
            {
              title: 'Share the work',
              text: 'Check the folder’s and documents’ sharing settings for the people who need them. You can also share a document directly in the project’s channel.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Folders and links do different jobs',
          paragraphs: [
            'A folder gives a document a place in your file structure. A mention connects it to a conversation or task. You can use both: keep a plan in the project folder, then mention that same plan wherever the team discusses it.',
            'You do not need a new copy for each conversation. Opening a document mention takes the reader to the shared file.',
          ],
        },
        {
          kind: 'note',
          heading: 'Finding a file later',
          text: 'Files shows your documents and files shared with you. Search can find their contents as well as their names, so a folder is a useful starting point rather than the only way back.',
        },
      ],
      links: [
        {
          label: 'Folders',
          href: 'https://docs.macro.com/product/folders',
        },
        {
          label: 'Documents',
          href: 'https://docs.macro.com/product/docs',
        },
      ],
    },
    {
      title: 'Find them by tag',
      summary: 'Find related documents, emails, and tasks with the same tag.',
      intro:
        'A folder tells you where a document lives. A tag tells you what it relates to. Use tags for a project, customer, or area of work, then find the matching items across Macro.',
      sections: [
        {
          kind: 'facts',
          heading: 'Choose the right kind of tag',
          items: [
            {
              title: 'Personal',
              text: 'Use a personal tag for your own organization. Only you see it, so you can group work without changing the team’s system.',
            },
            {
              title: 'Team',
              text: 'Use a team tag when colleagues need the same grouping. A shared project tag can connect documents, tasks, emails, and calls.',
            },
            {
              title: 'More than one',
              text: 'A document can have several tags. A launch plan can belong to both a marketing group and a particular product launch.',
            },
          ],
        },
        {
          kind: 'steps',
          heading: 'Find the connected work',
          items: [
            {
              title: 'Apply the tag',
              text: 'Type # in a document or open its tag controls. Choose an existing tag so related work uses the same one.',
            },
            {
              title: 'Follow it',
              text: 'Click a tag pill to see other items carrying that tag. You can also choose Tags in search filters.',
            },
            {
              title: 'Narrow the results',
              text: 'Choose Any to match one of the selected tags, or All to find items with every selected tag.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Tags do not change access',
          text: 'A shared label helps organize work. It does not make a private document visible to someone who cannot otherwise open it.',
        },
      ],
      links: [
        {
          label: 'Tagging',
          href: 'https://docs.macro.com/product/tagging',
        },
        {
          label: 'Search',
          href: 'https://docs.macro.com/product/search',
        },
      ],
    },
  ],
} satisfies Record<string, readonly ProductFeatureDetail[]>;
