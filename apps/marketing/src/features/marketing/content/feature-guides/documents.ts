import type { ProductFeatureDetail } from '../../core/product-feature-guide';

// Sources: product/docs, folders, tagging, mentions and permissions in apps/docs;
// verified against docs/agent-guide/documents.md at c5cba006.
export const documentsGuides = {
  'document-agents': [
    {
      title: 'Update from an email',
      summary: 'Turn customer feedback into changes in the shared document.',
      intro:
        'Give an agent the customer email and the document it affects. It can update the shared file directly.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Update the rollout plan with the dates Valentina confirmed in this email. Keep the rest of the plan as it is.',
        },
        {
          kind: 'steps',
          heading: 'From request to revision',
          items: [
            {
              title: 'Mention both items',
              text: 'Type @ to select the email and document.',
            },
            {
              title: 'Name the change',
              text: 'Say which section to update and what should stay unchanged.',
            },
            {
              title: 'Read the result',
              text: 'Open the revised section and check it against the email. Edit it directly or ask for another pass.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Access',
          text: 'The agent needs permission to read the email and edit the document.',
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
        'Write with teammates and agents in the same document. Changes merge as you work, including edits to the same line.',
      sections: [
        {
          kind: 'text',
          heading: 'Keep writing',
          paragraphs: [
            'Use headings, checklists, tables, images, and links. You can keep working through a lost connection and sync when you reconnect.',
          ],
        },
        {
          kind: 'facts',
          heading: 'Feedback and history',
          items: [
            {
              title: 'Comments',
              text: 'Select text to discuss a passage. Reply in the thread and resolve it when addressed.',
            },
            {
              title: 'Mentions',
              text: 'Mention a teammate in a comment to notify them. A name in the document body does not send that notification.',
            },
            {
              title: 'History',
              text: 'Browse past versions or fork an earlier version into a separate document.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Sharing',
          text: 'Choose viewer, commenter, or editor access in Share.',
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
        'Mention a customer email in a document so readers can open the original thread and attachments.',
      sections: [
        {
          kind: 'steps',
          heading: 'Add a reference',
          items: [
            {
              title: 'Type @ and choose the email',
              text: 'Insert the mention beside the requirement or decision it supports.',
            },
            {
              title: 'Explain the connection',
              text: 'Add a short sentence, such as “Valentina confirmed this date in the rollout email.”',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Give readers access',
          text: 'Share the email with the teammate or channel when needed. A reference alone does not grant access to the thread.',
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
        'Mention a task in the plan to show its current details and let readers open the assignment.',
      sections: [
        {
          kind: 'text',
          heading: 'Link the assignment',
          paragraphs: [
            'Type @ and select the task beside the work it covers. Keep the owner, status, and priority on the task so you don’t need to maintain a separate status in the document.',
          ],
        },
        {
          kind: 'text',
          heading: 'Follow up on the task',
          paragraphs: [
            'Open it to read the description, update progress, or leave a comment. The mention points to the existing task rather than creating another one.',
          ],
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
        'Keep a document open beside the email, task, or file you are using as a source.',
      sections: [
        {
          kind: 'steps',
          heading: 'Open another split',
          items: [
            {
              title: 'Start with the document',
              text: 'Open the plan or draft you want to edit.',
            },
            {
              title: 'Open the source beside it',
              text: 'Choose Open in new split. From a focused list item, use Shift + Enter.',
            },
            {
              title: 'Read and edit',
              text: 'Compare the source with the draft while both remain in view.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Small screens',
          text: 'When two panes feel cramped, open the reference and return to the document after checking it.',
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
      title: 'Organize docs in folders',
      summary: 'Group the files a team or project uses in a folder.',
      intro:
        'Put a project’s plan, brief, and supporting files in a folder so the team has a place to start.',
      sections: [
        {
          kind: 'steps',
          heading: 'Organize the files',
          items: [
            {
              title: 'Create a folder',
              text: 'Name it for the project or team.',
            },
            {
              title: 'Move in existing documents',
              text: 'References keep opening those same documents after they move.',
            },
            {
              title: 'Review sharing',
              text: 'Check the folder and document access for the people who need them.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Link them where needed',
          paragraphs: [
            'Mention the same files in tasks and conversations. You don’t need a copy for each discussion.',
          ],
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
      title: 'Find docs by tag',
      summary: 'Find related documents, emails, and tasks with the same tag.',
      intro:
        'Use a project or customer tag to find related documents, emails, tasks, and calls across Macro.',
      sections: [
        {
          kind: 'steps',
          heading: 'Tag and find',
          items: [
            {
              title: 'Apply a tag',
              text: 'Type # in a document or open its tag controls. Choose an existing tag when possible.',
            },
            {
              title: 'Choose the scope',
              text: 'Personal tags are visible to you. Team tags give colleagues the same grouping.',
            },
            {
              title: 'Filter the results',
              text: 'Click a tag or choose Tags in search. Any matches at least one selected tag; All matches every selected tag.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Access',
          text: 'Tags organize items without changing who can open them.',
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
