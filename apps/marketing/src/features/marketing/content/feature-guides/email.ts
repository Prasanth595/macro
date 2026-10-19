import type { ProductFeatureDetail } from '../../core/product-feature-guide';

// Sources: apps/docs/product/email.mdx, tagging, search, agents and keyboard-shortcuts;
// mailbox actions and scope checked against docs/agent-guide/email.md at c5cba006.
// General automatic project tagging is not claimed by the verified product docs.
export const emailGuides = {
  'auto-tags': [
    {
      title: 'Organize with tags',
      summary: 'Group email by the customer or project it belongs to.',
      intro:
        'Tags give an email a useful connection to the rest of your work. Label a thread by customer, project, or topic, then use that same tag on the documents and tasks that belong with it.',
      sections: [
        {
          kind: 'facts',
          heading: 'A useful tagging system',
          items: [
            {
              title: 'Project',
              text: 'Use a tag for the initiative the email supports, such as a launch or rollout. Related briefs and tasks can carry the same tag.',
            },
            {
              title: 'Customer',
              text: 'Group conversations about the same relationship, even when they have different subjects.',
            },
            {
              title: 'Several tags',
              text: 'A thread can have more than one tag. You can describe both the customer and the project without choosing between them.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'Ask an agent to help',
          text: 'Tag this customer thread and the rollout plan with the same project tag.',
          caption:
            'An agent can apply tags when you ask. You can also add or remove them yourself in the item’s tag controls.',
        },
        {
          kind: 'text',
          heading: 'Find the group later',
          paragraphs: [
            'Click a tag to see the matching work, or choose Tags in search filters. Use an existing team tag when colleagues should use the same grouping; use a personal tag for your own organization.',
          ],
        },
        {
          kind: 'note',
          heading: 'Tags and inbox labels are different',
          text: 'Macro tags work across email, documents, tasks, and other items. Your email provider’s labels still handle mailbox organization such as Inbox and Starred.',
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
      title: 'Adjust a tag',
      summary: 'Keep a thread’s labels useful as the conversation changes.',
      intro:
        'Tags should describe the work as it is now. Add one when a conversation becomes part of a project, or remove one when it no longer helps you find the thread.',
      sections: [
        {
          kind: 'steps',
          heading: 'Change the thread’s tags',
          items: [
            {
              title: 'Open the tag controls',
              text: 'Select the email thread and open its tags from the properties controls. You can choose an existing tag or create one.',
            },
            {
              title: 'Add or remove a label',
              text: 'Select the tags that fit the conversation. Removing a tag from this thread leaves the tag available on other items.',
            },
            {
              title: 'Check the group',
              text: 'Open the tag or filter by it to see the other work in the same group.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Choose the right scope',
          items: [
            {
              title: 'Personal tag',
              text: 'Visible to you. Useful for your own follow-up system or a temporary group of messages.',
            },
            {
              title: 'Team tag',
              text: 'Shared with your team. Useful for a project or area that colleagues should organize consistently.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Removing a tag is different from deleting it',
          text: 'Removing a tag from one email only changes that email. Deleting the tag itself in Settings removes it from every item that uses it. Use the thread’s tag controls for a local correction.',
        },
      ],
      links: [
        {
          label: 'Creating and editing tags',
          href: 'https://docs.macro.com/product/tagging',
        },
      ],
    },
    {
      title: 'Find related work',
      summary:
        'Follow a tag from an email to the docs and tasks it relates to.',
      intro:
        'A customer conversation rarely ends at email. Use a shared tag to find the plan, tasks, and calls that belong to the same work, even when their titles do not use the same words.',
      sections: [
        {
          kind: 'example',
          heading: 'One project, several kinds of work',
          text: 'A rollout email, the rollout plan, and the task to prepare training can all carry the same project tag.',
        },
        {
          kind: 'steps',
          heading: 'Follow the connection',
          items: [
            {
              title: 'Start with the thread',
              text: 'Open a tag on the email to find other items carrying it. The tag points to a group of work, not a copied set of files.',
            },
            {
              title: 'Filter the results',
              text: 'Choose the item type when you only need documents or tasks. Add another tag to narrow the group further.',
            },
            {
              title: 'Choose Any or All',
              text: 'Any matches at least one selected tag. All finds items that carry every selected tag, such as both the customer and the launch.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Tags work best with direct references',
          paragraphs: [
            'Use a tag to find a group. Use an @mention when a specific document or email is the source for a decision. The two work together: one helps you discover the work, the other points to the exact item.',
          ],
        },
        {
          kind: 'note',
          heading: 'Search respects access',
          text: 'A team tag does not make a private email or document readable to the whole team. People still need access to each item.',
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
        'Let teammates read the original conversation without forwarding it.',
      intro:
        'Share an email thread into a Macro channel when the team needs the customer’s exact words. Teammates can open the messages and attachments from the conversation where you are discussing the work.',
      sections: [
        {
          kind: 'steps',
          heading: 'Bring the email into a channel',
          items: [
            {
              title: 'Choose Share',
              text: 'Open the email thread and choose its share action. Select the channel whose members need to read it.',
            },
            {
              title: 'Add a short note',
              text: 'Explain what you want the team to notice or decide. A line such as “Can we confirm this timeline?” makes the shared email actionable.',
            },
            {
              title: 'Open it from the conversation',
              text: 'The channel receives the linked thread. Members can read the original messages instead of a forwarded copy with missing history.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'What sharing allows',
          items: [
            {
              title: 'Read',
              text: 'Recipients can view the full shared thread and its attachments.',
            },
            {
              title: 'Discuss',
              text: 'Teammates can talk about it in the channel and connect the discussion to a document or task.',
            },
            {
              title: 'Reply to the customer',
              text: 'Sharing the thread does not authorize teammates to send email from your account. Forward the email when someone needs to take over the external reply.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Choose the audience deliberately',
          text: 'The people in the selected channel can read the shared conversation. Use a channel that matches the audience for the customer’s information.',
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
      title: 'Keep new replies together',
      summary:
        'Let the team return to the same thread as the conversation continues.',
      intro:
        'A shared email points to the live thread in Macro. When another reply arrives in that thread, the team can return to the same shared item to read the updated conversation.',
      sections: [
        {
          kind: 'text',
          heading: 'One place to follow the exchange',
          paragraphs: [
            'Forwarded emails capture a moment in a conversation. A shared thread keeps the messages together, so a teammate can read the earlier request and the latest answer in order.',
            'Use the channel discussion to call attention to a new decision or question. People can open the linked email to check the wording without receiving another forwarded version.',
          ],
        },
        {
          kind: 'example',
          heading: 'A typical follow-up',
          text: 'Valentina has confirmed the Thursday demo in the shared email. Can we update the rollout plan and check who is joining?',
        },
        {
          kind: 'facts',
          heading: 'What stays separate',
          items: [
            {
              title: 'The email thread',
              text: 'Contains the customer’s messages and external replies.',
            },
            {
              title: 'The team conversation',
              text: 'Contains internal planning, questions, and decisions. A channel reply is not sent to the email participants.',
            },
            {
              title: 'A new email thread',
              text: 'If the customer starts a separate conversation, share that thread too. The original link does not combine unrelated emails.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Reading does not grant sending access',
          text: 'Teammates can read the shared thread, but they cannot reply from your mailbox just because it was shared.',
        },
      ],
      links: [
        {
          label: 'Shared email',
          href: 'https://docs.macro.com/product/email',
        },
        {
          label: 'Channels',
          href: 'https://docs.macro.com/product/channels',
        },
      ],
    },
    {
      title: 'Discuss the next step',
      summary:
        'Plan the response with your team while the email stays in view.',
      intro:
        'Share the customer’s email and ask the team a specific question about it. The internal discussion stays in Macro, with the thread available for anyone who needs the details.',
      sections: [
        {
          kind: 'example',
          heading: 'A useful message to the team',
          text: 'They are asking to move the rollout forward a week. Can Julia check the plan and Jacob confirm the pricing before I reply?',
        },
        {
          kind: 'facts',
          heading: 'Connect the pieces',
          items: [
            {
              title: 'The customer request',
              text: 'Share the full email thread so people can read the original wording and attachments.',
            },
            {
              title: 'The working document',
              text: 'Mention the proposal or rollout plan so teammates can open and update the file under discussion.',
            },
            {
              title: 'The assignment',
              text: 'Create or mention a task when someone needs to complete a concrete next step. Put the owner and status on that task.',
            },
          ],
        },
        {
          kind: 'steps',
          heading: 'Close the loop',
          items: [
            {
              title: 'Agree internally',
              text: 'Use replies in the channel to settle the question. Keep the discussion attached to the request so later readers can understand the decision.',
            },
            {
              title: 'Prepare the external answer',
              text: 'Write the response in the email thread, or ask an agent for a draft using the agreed details. Review it before sending.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Internal replies stay internal',
          text: 'A message in the Macro channel is a team conversation. It is not added to the customer’s email thread.',
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
        'Use J and K to move through the email list from your keyboard. It is a simple way to scan what arrived, open the conversations that matter, and keep going through the rest.',
      sections: [
        {
          kind: 'facts',
          heading: 'The basic controls',
          items: [
            {
              title: 'J',
              text: 'Move down to the next item in the list.',
            },
            {
              title: 'K',
              text: 'Move up to the previous item.',
            },
            {
              title: 'Enter',
              text: 'Open the selected conversation in the current pane.',
            },
            {
              title: 'Shift + Enter',
              text: 'Open the selected item in a new split when you want to keep the list available.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Start with the right list',
          paragraphs: [
            'Choose the inbox, tab, or filters you want to work through before you begin. The keyboard moves through the items in that list, so you can focus on one account or work across the connected accounts together.',
          ],
        },
        {
          kind: 'steps',
          heading: 'A short inbox pass',
          items: [
            {
              title: 'Select and open',
              text: 'Move to a conversation with J or K, then press Enter to read it.',
            },
            {
              title: 'Take the next step',
              text: 'Reply, keep it for later, or mark it done when it no longer needs attention. Return to the list to continue.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'While you are typing',
          text: 'Letters entered in a message or search field belong to that text field. Move focus back to the list before using single-letter navigation shortcuts.',
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
      title: 'Open and return',
      summary: 'Read a thread and get back to the list from your keyboard.',
      intro:
        'Move between the inbox and an email without losing the thread of your work. Open the selected conversation, read what you need, and return to the list to continue.',
      sections: [
        {
          kind: 'steps',
          heading: 'Read a conversation',
          items: [
            {
              title: 'Select the email',
              text: 'Use the arrow keys or J and K in the list to choose a thread.',
            },
            {
              title: 'Press Enter',
              text: 'Open it in the current pane. Read the messages and attachments, or write a reply if it needs one.',
            },
            {
              title: 'Return to the list',
              text: 'Use the email view’s return control. Escape dismisses an active selection or open control; use the navigation controls to get back when focus is inside a different part of the interface.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'When you want both views',
          items: [
            {
              title: 'A second split',
              text: 'Shift + Enter opens a focused list item in a new split. You can keep the inbox on one side and the email on the other.',
            },
            {
              title: 'One pane',
              text: 'Use the current pane when screen space is limited or you want to concentrate on one conversation.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Shortcuts depend on focus',
          text: 'Escape may close a menu before affecting the email view. Check which part of the interface has focus if a shortcut does something different from what you expected.',
        },
      ],
      links: [
        {
          label: 'Navigation shortcuts',
          href: 'https://docs.macro.com/keyboard-shortcuts',
        },
        {
          label: 'Email',
          href: 'https://docs.macro.com/product/email',
        },
      ],
    },
    {
      title: 'Mark it done',
      summary: 'Archive a finished conversation with E.',
      intro:
        'When an email no longer needs attention, mark it done with E. In Mail, this archives the conversation and removes it from the inbox so you can focus on what remains.',
      sections: [
        {
          kind: 'facts',
          heading: 'What happens to the email',
          items: [
            {
              title: 'It leaves the inbox',
              text: 'The conversation no longer occupies the active inbox list after the archive action is applied.',
            },
            {
              title: 'It is kept',
              text: 'Archive does not delete the messages or attachments. You can find the conversation again through search or your archived mail.',
            },
            {
              title: 'The mailbox stays connected',
              text: 'Macro applies email actions to the connected account, so archiving is part of your mailbox workflow.',
            },
          ],
        },
        {
          kind: 'steps',
          heading: 'Use it when you have finished',
          items: [
            {
              title: 'Read and act',
              text: 'Reply, create a task, or share the thread with the person who needs it.',
            },
            {
              title: 'Press E',
              text: 'With the conversation selected and focus outside a text field, mark it done.',
            },
            {
              title: 'Continue through the list',
              text: 'Move to the next item with J or K and repeat as needed.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'An email and a task have different completion states',
          text: 'Archiving a customer conversation does not mean the work it requested is finished. Keep that assignment on a task with its own owner and status.',
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
        'Search your connected email accounts from Macro instead of checking each mailbox separately. Use words from the subject or message, then narrow the results when you know who or what you are looking for.',
      sections: [
        {
          kind: 'steps',
          heading: 'Find the right conversation',
          items: [
            {
              title: 'Enter a useful phrase',
              text: 'Search for the customer, project, subject, or wording you remember. Use quotation marks when the exact phrase matters.',
            },
            {
              title: 'Narrow the results',
              text: 'Use the email type and available account or tag filters. Check the selected inboxes if a conversation seems to be missing.',
            },
            {
              title: 'Open the original thread',
              text: 'Read the sender, account, and message history to confirm it is the conversation you meant.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Two ways to search',
          items: [
            {
              title: 'Across Macro',
              text: 'Use search when the source could be an email, document, task, or call transcript. Filter to Email when that is the item you need.',
            },
            {
              title: 'Within Mail',
              text: 'Use the email view’s search to focus on your mailboxes and the selected filters.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Check the sending address',
          text: 'Finding mail from several accounts in one place does not make them the same mailbox. When drafting a reply, check which connected address will send it.',
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
        'Give the agent the email thread and saved meeting transcript when you need a follow-up. It can read both sources and prepare a draft that reflects the conversation you actually had.',
      sections: [
        {
          kind: 'example',
          heading: 'Example request',
          text: 'Draft a follow-up to Valentina using the demo call transcript. Confirm the rollout dates and include the plan we discussed. Leave it as a draft.',
        },
        {
          kind: 'steps',
          heading: 'Prepare a grounded reply',
          items: [
            {
              title: 'Identify the meeting',
              text: 'Mention the saved call or give enough detail to find it, such as its name and date. Check that the agent uses the right conversation.',
            },
            {
              title: 'Name the outcome',
              text: 'Say whether the reply should recap decisions, answer a question, or ask for a next step. Point to any document it should include.',
            },
            {
              title: 'Review against the sources',
              text: 'Open the draft and check the dates, promises, and links. If something is unclear, read the transcript or email before sending.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'A summary is a starting point',
          text: 'The transcript provides detail the agent can use, but the draft still needs your judgment. Check commitments and wording before sending them to a customer.',
        },
        {
          kind: 'text',
          heading: 'Continue refining',
          paragraphs: [
            'Ask for a shorter version or adjust the tone. You can also edit the draft directly in the email composer.',
          ],
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
        'Tell the agent who should receive the email and which material belongs with it. The editable draft lets you check the audience and supporting files along with the wording.',
      sections: [
        {
          kind: 'facts',
          heading: 'Be specific in the request',
          items: [
            {
              title: 'To',
              text: 'Name the person who should receive the main reply. Use their actual contact or email address when names could be confused.',
            },
            {
              title: 'Cc',
              text: 'Name teammates or other participants who should be copied. Do not assume everyone mentioned in the source conversation should receive the email.',
            },
            {
              title: 'Files and links',
              text: 'Identify the document or attachment you want included. Say whether the recipient needs a file copy or a link to the Macro document.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'Example request',
          text: 'Reply to Valentina, copy Julia, and include the sales overview PDF and the rollout plan. Keep it as a draft for me to check.',
        },
        {
          kind: 'steps',
          heading: 'Check the draft',
          items: [
            {
              title: 'Review the audience',
              text: 'Verify To, Cc, Bcc, and the sending account.',
            },
            {
              title: 'Open the material',
              text: 'Check that the attached file is the right version and that the links are appropriate for the recipient.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Macro document links can change sharing',
          text: 'Mentioning a Macro document in an external email inserts a link and enables recipients with the link to view it. Review the document and audience before sending.',
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
        'An agent can help prepare the email, but you should be able to read and change the draft as ordinary email. Review it in the composer before sending the answer to the customer.',
      sections: [
        {
          kind: 'steps',
          heading: 'Make it ready to send',
          items: [
            {
              title: 'Read it as the recipient',
              text: 'Check that the first sentence answers the question and that the next step is clear. Remove details the recipient does not need.',
            },
            {
              title: 'Verify the facts',
              text: 'Check names, dates, prices, and commitments against the source email or document. Open any links the draft includes.',
            },
            {
              title: 'Check the envelope',
              text: 'Review the sending account, recipients, subject, and attachments. Then send through the normal email controls.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'A useful revision request',
          text: 'Make this shorter. Keep the confirmed rollout dates, remove the internal discussion, and end by asking which time works for the training call.',
        },
        {
          kind: 'text',
          heading: 'Edit in whichever way is faster',
          paragraphs: [
            'Type changes directly in the composer for a quick correction. Ask the agent for another pass when you want to change the structure, tone, or amount of detail.',
            'If you want review before delivery, explicitly ask for a draft. Do not phrase a drafting request as an instruction to send immediately.',
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
