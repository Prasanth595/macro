import type { ProductFeatureDetail } from '../../core/product-feature-guide';

// Sources: apps/docs/product/email.mdx, tagging, search, agents and keyboard-shortcuts;
// mailbox actions and scope checked against docs/agent-guide/email.md at c5cba006.
// General automatic project tagging is not claimed by the verified product docs.
export const emailGuides = {
  'auto-tags': [
    {
      title: 'Organize with tags',
      summary: 'Group email, documents, and tasks by customer or project.',
      intro:
        'Tag an email by customer or project. Use the same tag on related documents and tasks to find them together.',
      sections: [
        {
          kind: 'steps',
          heading: 'Add or change tags',
          items: [
            {
              title: 'Open the thread’s tags',
              text: 'Choose an existing tag or create one in the properties controls. A thread can have several tags.',
            },
            {
              title: 'Choose who uses it',
              text: 'Personal tags are visible to you. Team tags give colleagues the same way to group work.',
            },
          ],
        },
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Tag this customer thread and the rollout plan with the same project tag.',
        },
        {
          kind: 'note',
          heading: 'Removing a tag',
          text: 'Remove it from the thread to change only that email. Deleting a tag in Settings removes it from every item that uses it.',
        },
      ],
      links: [
        {
          label: 'Tagging across Macro',
          href: 'https://docs.macro.com/product/tagging',
        },
        {
          label: 'Email',
          href: 'https://docs.macro.com/product/email',
        },
      ],
    },
    {
      title: 'Find related work',
      summary:
        'Follow a tag from an email to the docs and tasks it relates to.',
      intro:
        'Open a tag on an email to find the documents, tasks, and other items with that tag.',
      sections: [
        {
          kind: 'facts',
          heading: 'Narrow the results',
          items: [
            {
              title: 'Item type',
              text: 'Filter to documents or tasks when you know what you need.',
            },
            {
              title: 'Any tag',
              text: 'Match at least one of the tags you select.',
            },
            {
              title: 'All tags',
              text: 'Match every selected tag, such as both a customer and a project.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Access stays the same',
          text: 'A team tag does not share a private item. People still need access to open it.',
        },
      ],
      links: [
        {
          label: 'Tag filters',
          href: 'https://docs.macro.com/product/search',
        },
        {
          label: 'Tags',
          href: 'https://docs.macro.com/product/tagging',
        },
      ],
    },
  ],
  'email-sharing': [
    {
      title: 'Share the whole thread',
      summary:
        'Share the conversation and keep new replies in the same thread.',
      intro:
        'Share an email in a channel so teammates can read the messages and attachments. New replies stay in the same linked thread.',
      sections: [
        {
          kind: 'steps',
          heading: 'Share an email',
          items: [
            {
              title: 'Choose Share',
              text: 'Open the thread’s share action and select the channel.',
            },
            {
              title: 'Add your question',
              text: 'Tell the team what you need, such as confirming a date or reviewing a proposal.',
            },
            {
              title: 'Open the linked thread',
              text: 'Channel members can read the conversation and return to it when more replies arrive.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Internal discussion stays internal',
          text: 'Channel replies are not sent to the customer. Sharing lets teammates read the thread; it does not let them send email from your account.',
        },
      ],
      links: [
        {
          label: 'Email sharing',
          href: 'https://docs.macro.com/product/email',
        },
        {
          label: 'Channel permissions',
          href: 'https://docs.macro.com/permissions',
        },
      ],
    },
    {
      title: 'Discuss the next step',
      summary:
        'Plan the response with your team while the email stays in view.',
      intro:
        'Discuss a customer’s request in a channel before replying. Mention the plan or task the team needs to update.',
      sections: [
        {
          kind: 'example',
          heading: 'Message to your team',
          text: 'They’re asking to move the rollout forward a week. Julia, can you check the plan? Jacob, can you confirm the pricing before I reply?',
        },
        {
          kind: 'text',
          heading: 'After the team agrees',
          paragraphs: [
            'Update the plan or create a task for the follow-up. Write the customer’s response in the email thread, or ask an agent to prepare a draft.',
          ],
        },
      ],
      links: [
        {
          label: 'Email',
          href: 'https://docs.macro.com/product/email',
        },
        {
          label: 'Channel threads',
          href: 'https://docs.macro.com/product/channels',
        },
      ],
    },
  ],
  'keyboard-speed': [
    {
      title: 'Navigate with J and K',
      summary: 'Move through the inbox without reaching for the mouse.',
      intro:
        'Move through your inbox, open a thread, and return to the list from your keyboard.',
      sections: [
        {
          kind: 'facts',
          heading: 'Inbox shortcuts',
          items: [
            {
              title: 'J / K',
              text: 'Select the next or previous item.',
            },
            {
              title: 'Enter',
              text: 'Open the selected thread.',
            },
            {
              title: 'Shift + Enter',
              text: 'Open the selected item in another split, keeping the list in view.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Return to the list',
          paragraphs: [
            'Use the email view’s return control. Escape closes an active menu or selection first.',
          ],
        },
        {
          kind: 'note',
          heading: 'When typing',
          text: 'Move focus out of the composer or search field before using single-letter shortcuts.',
        },
      ],
      links: [
        {
          label: 'Keyboard shortcuts',
          href: 'https://docs.macro.com/keyboard-shortcuts',
        },
        {
          label: 'Email navigation',
          href: 'https://docs.macro.com/product/email',
        },
      ],
    },
    {
      title: 'Mark it done',
      summary: 'Archive a finished conversation with E.',
      intro:
        'Press E to archive a conversation when it no longer needs your attention.',
      sections: [
        {
          kind: 'facts',
          heading: 'After archiving',
          items: [
            {
              title: 'Out of the inbox',
              text: 'The conversation leaves your inbox in the connected email account.',
            },
            {
              title: 'Still available',
              text: 'Messages and attachments stay available through search and archived mail.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Follow-up work',
          text: 'Archiving the email does not complete any tasks linked to it. Track unfinished work on the task.',
        },
      ],
      links: [
        {
          label: 'Email actions',
          href: 'https://docs.macro.com/product/email',
        },
        {
          label: 'Keyboard reference',
          href: 'https://docs.macro.com/keyboard-shortcuts',
        },
      ],
    },
    {
      title: 'Search all accounts',
      summary: 'Find a conversation across your connected mailboxes.',
      intro:
        'Find a thread across your connected mailboxes using a name, subject, or phrase from the conversation.',
      sections: [
        {
          kind: 'steps',
          heading: 'Find a thread',
          items: [
            {
              title: 'Search',
              text: 'Enter the words you remember. Use quotation marks for an exact phrase.',
            },
            {
              title: 'Filter',
              text: 'Choose Email in workspace search, then narrow by account or tag. Mail search focuses on your mailboxes.',
            },
            {
              title: 'Open the result',
              text: 'Check the sender and message history to confirm you have the right conversation.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Replying from the right account',
          text: 'Check the sending address when replying to mail from several accounts.',
        },
      ],
      links: [
        {
          label: 'Search',
          href: 'https://docs.macro.com/product/search',
        },
        {
          label: 'Multiple email accounts',
          href: 'https://docs.macro.com/product/email',
        },
      ],
    },
  ],
  'agentic-editing': [
    {
      title: 'Use the meeting context',
      summary:
        'Draft a follow-up from the email and what was agreed on the call.',
      intro:
        'Ask an agent to draft a follow-up from the email and a saved call transcript.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Draft a follow-up to Valentina using the demo call transcript. Confirm the rollout dates and link the plan we discussed. Leave it as a draft.',
        },
        {
          kind: 'text',
          heading: 'Give it the sources',
          paragraphs: [
            'Mention the email, saved call, and plan. If you don’t have the call open, give its name and date so the agent can find it.',
          ],
        },
        {
          kind: 'note',
          heading: 'Before sending',
          text: 'Check the draft’s dates, commitments, and links against the sources. You can edit it in the composer or ask for another pass.',
        },
      ],
      links: [
        {
          label: 'Agent email drafts',
          href: 'https://docs.macro.com/product/agents',
        },
        {
          label: 'Saved calls',
          href: 'https://docs.macro.com/product/calls',
        },
      ],
    },
    {
      title: 'Include the right people',
      summary: 'Prepare the recipients and supporting files with the reply.',
      intro:
        'Tell the agent who should receive the reply and which files to include.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Draft a reply to Valentina at Coparse. Copy Julia at Macro and include the sales overview PDF and rollout plan.',
        },
        {
          kind: 'facts',
          heading: 'Check the draft',
          items: [
            {
              title: 'Recipients',
              text: 'Review To, Cc, Bcc, and the sending account.',
            },
            {
              title: 'Attachments',
              text: 'Open each file to check that it is the version you want to send.',
            },
            {
              title: 'Document links',
              text: 'Mentioning a Macro document in an external email enables recipients with the link to view it. Check the document and audience before sending.',
            },
          ],
        },
      ],
      links: [
        {
          label: 'Email recipients and mentions',
          href: 'https://docs.macro.com/product/email',
        },
        {
          label: 'Document sharing',
          href: 'https://docs.macro.com/product/docs',
        },
      ],
    },
    {
      title: 'Edit before sending',
      summary: 'Review the reply in the composer and send when it is ready.',
      intro:
        'Review an agent’s draft in the email composer. Change the text directly or ask for a revision.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Make this shorter. Keep the confirmed rollout dates and end by asking which time works for training. Remove the internal discussion.',
        },
        {
          kind: 'text',
          heading: 'Ready to send',
          paragraphs: [
            'Check names, dates, recipients, and attachments, then send with the email controls. Ask explicitly for a draft when you want to review before delivery.',
          ],
        },
      ],
      links: [
        {
          label: 'Email',
          href: 'https://docs.macro.com/product/email',
        },
        {
          label: 'Working with agents',
          href: 'https://docs.macro.com/product/agents',
        },
      ],
    },
  ],
} satisfies Record<string, readonly ProductFeatureDetail[]>;
