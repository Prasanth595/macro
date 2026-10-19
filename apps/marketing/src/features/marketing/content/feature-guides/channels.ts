import type { ProductFeatureDetail } from '../../core/product-feature-guide';

// Sources: apps/docs/product/channels.mdx, email, docs, agents, permissions,
// concepts/mentions and AI/bring-your-own.mdx at c5cba006.
export const channelsGuides = {
  'shared-work': [
    {
      title: 'Read the customer email',
      summary: 'Open the full customer thread from the team conversation.',
      intro:
        'Share a customer email in a channel so the team can open the original messages and attachments.',
      sections: [
        {
          kind: 'steps',
          heading: 'Share the source',
          items: [
            {
              title: 'Choose Share on the email',
              text: 'Select the channel and add the question you want the team to answer.',
            },
            {
              title: 'Discuss it in the channel',
              text: 'Teammates open the linked email to read it. Later email replies remain available in the same thread.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Replies stay separate',
          text: 'Channel messages are internal. Sharing an email gives reading access, not permission to send from your mailbox.',
        },
      ],
      links: [
        {
          label: 'Sharing email',
          href: 'https://docs.macro.com/product/email',
        },
        {
          label: 'Channels',
          href: 'https://docs.macro.com/product/channels',
        },
      ],
    },
    {
      title: 'Edit the shared doc',
      summary: 'Open and update the document the conversation is about.',
      intro:
        'Type @ to mention a document in the conversation. Open the reference to edit the same file your team is using.',
      sections: [
        {
          kind: 'facts',
          heading: 'Choose where to respond',
          items: [
            {
              title: 'Edit the document',
              text: 'Make an agreed change directly when you have edit access.',
            },
            {
              title: 'Comment on a passage',
              text: 'Select text in the document when feedback concerns a specific sentence or section.',
            },
            {
              title: 'Reply in the channel',
              text: 'Keep wider project decisions with the team’s discussion.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Check the audience',
          text: 'A document mention shares access through the channel. Review its members and the document’s sharing settings.',
        },
      ],
      links: [
        {
          label: 'Documents',
          href: 'https://docs.macro.com/product/docs',
        },
        {
          label: 'Channel sharing',
          href: 'https://docs.macro.com/permissions',
        },
      ],
    },
    {
      title: 'Open the next task',
      summary: 'Follow a request from the conversation to its assignment.',
      intro:
        'Mention a task in the conversation to show its current status and give teammates a direct way to open it.',
      sections: [
        {
          kind: 'steps',
          heading: 'Create a task from a request',
          items: [
            {
              title: 'Use the message’s Task action',
              text: 'You can also ask an agent to create the task from the conversation.',
            },
            {
              title: 'Set the assignment',
              text: 'Add a clear title, owner, and the information needed to finish it.',
            },
            {
              title: 'Link it in the thread',
              text: 'Teammates can follow the same assignment as its status changes.',
            },
          ],
        },
      ],
      links: [
        {
          label: 'Tasks',
          href: 'https://docs.macro.com/product/tasks',
        },
        {
          label: 'Live mentions',
          href: 'https://docs.macro.com/concepts/mentions',
        },
      ],
    },
  ],
  'channel-access': [
    {
      title: 'Give the channel access',
      summary: 'Share documents with channel members, including new teammates.',
      intro:
        'Share a document in a channel to give its members access. New members can read the full channel history and open documents shared there.',
      sections: [
        {
          kind: 'facts',
          heading: 'How membership affects access',
          items: [
            {
              title: 'Joining',
              text: 'New members gain access through the channel, including documents shared before they joined.',
            },
            {
              title: 'Leaving',
              text: 'Access granted through that channel ends. Direct or team sharing may still give the person access.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Review the audience',
          paragraphs: [
            'Check participants before posting or adding someone. Use the document’s sharing controls to review who can view, comment, or edit.',
          ],
        },
        {
          kind: 'note',
          heading: 'Other types of work',
          text: 'CRM records follow team access rules. GitHub repositories keep their own permissions. A mention does not bypass either.',
        },
      ],
      links: [
        {
          label: 'Permissions',
          href: 'https://docs.macro.com/permissions',
        },
        {
          label: 'What mentions share',
          href: 'https://docs.macro.com/concepts/mentions',
        },
      ],
    },
  ],
  'channel-agents': [
    {
      title: 'Ask in front of the team',
      summary: 'Let teammates see the request and follow the agent’s answer.',
      intro:
        'Mention @Macro in a channel to ask an agent for help. The team can see the request, add context, and follow the answer.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: '@Macro, read the customer feedback in this thread and list the changes we still need to make to the rollout plan.',
        },
        {
          kind: 'text',
          heading: 'Continue in the thread',
          paragraphs: [
            'Mention the files the agent should use. Ask a follow-up or name the changes you want it to make after the team reviews its answer.',
          ],
        },
      ],
      links: [
        {
          label: 'Agents in channels',
          href: 'https://docs.macro.com/product/agents',
        },
        {
          label: 'Channels',
          href: 'https://docs.macro.com/product/channels',
        },
      ],
    },
    {
      title: 'Reference the actual work',
      summary: 'Give the agent the exact document, email, or task to use.',
      intro:
        'Use @ to select the document, email, or task the agent should work with.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Use this customer email to update the requirements in this brief. Leave the launch dates unchanged.',
        },
        {
          kind: 'text',
          heading: 'When you need to find the source',
          paragraphs: [
            'Ask the agent to search by customer, project, or date. Check the item it finds before asking it to make a change.',
          ],
        },
        {
          kind: 'note',
          heading: 'Access',
          text: 'The agent can only open and change items your account has permission to use.',
        },
      ],
      links: [
        {
          label: 'Mentions in agent requests',
          href: 'https://docs.macro.com/concepts/mentions',
        },
        {
          label: 'Agents',
          href: 'https://docs.macro.com/product/agents',
        },
      ],
    },
    {
      title: 'Bring your own agent',
      summary: 'Use a connected agent with your team’s conversation.',
      intro:
        'A connected agent can join your team’s conversation with its own instructions and tools.',
      sections: [
        {
          kind: 'facts',
          heading: 'Choose a connection',
          items: [
            {
              title: 'macrod',
              text: 'Brings an agent running on your computer into Macro. Its tools, files, and permissions come from that runtime.',
            },
            {
              title: 'MCP',
              text: 'Brings Macro’s tools into an external AI client. It is a separate connection from an agent in a channel.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Availability',
          text: 'The macrod setup guide currently lists Bring Your Own Agent as coming soon. Check the guide and your workspace’s Agents settings for availability.',
        },
      ],
      links: [
        {
          label: 'Bring your own agent',
          href: 'https://docs.macro.com/AI/bring-your-own',
        },
        {
          label: 'MCP setup',
          href: 'https://docs.macro.com/AI/mcp/overview',
        },
      ],
    },
  ],
  'catch-up': [
    {
      title: 'Follow a thread',
      summary: 'Read and reply to a discussion beneath the original message.',
      intro:
        'Open the replies beneath a message to read the discussion without losing the original question.',
      sections: [
        {
          kind: 'text',
          heading: 'Keep replies with the question',
          paragraphs: [
            'Reply in the thread to continue that topic. Start a new channel message for a separate request. Mention a teammate when you need their input; use a reaction for a quick acknowledgment.',
          ],
        },
        {
          kind: 'text',
          heading: 'Keep decisions in the work',
          paragraphs: [
            'If the discussion changes a plan or assignment, update the document or task too. The next person should not have to read every reply to find the current decision.',
          ],
        },
      ],
      links: [
        {
          label: 'Threaded replies',
          href: 'https://docs.macro.com/product/channels',
        },
      ],
    },
  ],
} satisfies Record<string, readonly ProductFeatureDetail[]>;
