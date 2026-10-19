import type { ProductFeatureDetail } from '../../core/product-feature-guide';

// Sources: apps/docs/product/channels.mdx, email, docs, agents, permissions,
// concepts/mentions and AI/bring-your-own.mdx at c5cba006.
export const channelsGuides = {
  'shared-work': [
    {
      title: 'Read the customer email',
      summary: 'Open the full customer thread from the team conversation.',
      intro:
        'Share an email in a channel when the team needs to read it together. The original thread stays available beside the internal discussion, including the messages and attachments that explain the request.',
      sections: [
        {
          kind: 'example',
          heading: 'A clear request to the team',
          text: 'Valentina sent the final requirements. Can we check the rollout plan against this thread before replying?',
        },
        {
          kind: 'steps',
          heading: 'Discuss the actual source',
          items: [
            {
              title: 'Share the email',
              text: 'Use Share on the email thread and choose the channel. Add a note explaining what the team needs to decide.',
            },
            {
              title: 'Open it from the message',
              text: 'Teammates can follow the email reference to read the full conversation instead of a copied excerpt.',
            },
            {
              title: 'Keep the next step nearby',
              text: 'Mention the relevant plan or task in the channel, so the customer request and the work it creates are connected.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Two conversations',
          items: [
            {
              title: 'With the customer',
              text: 'The email thread contains the external exchange. New replies in that thread remain available in the shared item.',
            },
            {
              title: 'With your team',
              text: 'Channel replies are internal discussion. They are not sent to the customer as email.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Sharing is for reading',
          text: 'Access to a shared thread does not let a teammate reply from your email account. Forward the email when someone needs to take over the external response.',
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
        'Mention the working document in the channel, then open it to make the change. The conversation points to the file your team already uses, so everyone can discuss and edit the same version.',
      sections: [
        {
          kind: 'steps',
          heading: 'Bring the file into the discussion',
          items: [
            {
              title: 'Mention the document',
              text: 'Type @ and select the file. Add a sentence explaining the decision or section you want people to review.',
            },
            {
              title: 'Open the original',
              text: 'Follow the reference to the document. With edit access, you can change the text directly while teammates work in it too.',
            },
            {
              title: 'Continue the discussion',
              text: 'Return to the thread to explain what changed or ask for feedback. The link still opens the shared document.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Where to leave feedback',
          items: [
            {
              title: 'Channel reply',
              text: 'Use it for a decision or question the whole conversation needs to follow.',
            },
            {
              title: 'Document comment',
              text: 'Select text and leave a comment when the feedback concerns a particular sentence or section.',
            },
            {
              title: 'Direct edit',
              text: 'Make the change yourself when you have editing access and the change is agreed.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Sharing follows the channel',
          text: 'Posting a document mention shares it with the channel’s members through Macro’s sharing system. Check the channel audience and the document’s access level when choosing who should be able to read or edit.',
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
        'A channel message can point to a task with an owner and a status. Open that task when you need to do the work, check progress, or understand what is still missing.',
      sections: [
        {
          kind: 'facts',
          heading: 'A task mention gives the discussion',
          items: [
            {
              title: 'A destination',
              text: 'The person doing the work can open the task and read the description, sources, and comments.',
            },
            {
              title: 'Current progress',
              text: 'The live task reference reflects its status, so the conversation can stay connected as the assignment changes.',
            },
            {
              title: 'A shared reference',
              text: 'Teammates can refer to the same task instead of creating duplicate assignments in separate conversations.',
            },
          ],
        },
        {
          kind: 'steps',
          heading: 'Turn a request into work',
          items: [
            {
              title: 'Start from the request',
              text: 'Use the message’s Task action, or ask an agent to create a task from the conversation.',
            },
            {
              title: 'Set the assignment',
              text: 'Give it a clear title, choose the owner, and add the information needed to complete it.',
            },
            {
              title: 'Link the result',
              text: 'Mention the task in the thread so others can find it and follow progress.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Use comments for task-specific follow-up',
          text: 'Keep questions about the assignment in the task’s comments. Use the channel when the answer changes the wider project discussion.',
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
      summary: 'Share a document with the people already in the conversation.',
      intro:
        'Posting a document mention in a channel gives its members access through that channel. It keeps the conversation and the material it depends on together, without a separate access request from every teammate.',
      sections: [
        {
          kind: 'steps',
          heading: 'Share where the work happens',
          items: [
            {
              title: 'Choose the right channel',
              text: 'Check its participants. A team channel is discoverable by the team; a private channel is visible only to the people added to it.',
            },
            {
              title: 'Mention the document',
              text: 'Type @, choose the item, and send the message. The reference opens the original document.',
            },
            {
              title: 'Check the access level',
              text: 'Use the document’s sharing controls when you need to review who can view, comment, or edit.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'When membership changes',
          items: [
            {
              title: 'Someone joins',
              text: 'They gain channel-based access to the documents already shared there, along with the full channel history.',
            },
            {
              title: 'Someone leaves',
              text: 'They lose access granted through that channel. Other direct sharing or team access can still give them access separately.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Different items have different sharing rules',
          text: 'Documents use channel sharing. CRM company and contact records follow team access rules, and GitHub repositories keep their own permissions. Mentioning one does not bypass those rules.',
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
    {
      title: 'Include new members',
      summary: 'Let a new teammate catch up on the discussion and shared work.',
      intro:
        'When someone joins a channel, they can read its full message history. Documents shared through the channel become available to them too, so they can follow earlier decisions and open the work being discussed.',
      sections: [
        {
          kind: 'facts',
          heading: 'What helps them catch up',
          items: [
            {
              title: 'Earlier messages',
              text: 'New members can read from the beginning, including conversations from before they joined.',
            },
            {
              title: 'Shared documents',
              text: 'Channel-based access gives them a way to open the files referenced in the discussion.',
            },
            {
              title: 'Threads',
              text: 'Replies stay with their parent message, making a decision easier to follow without searching through unrelated updates.',
            },
          ],
        },
        {
          kind: 'steps',
          heading: 'Make the introduction useful',
          items: [
            {
              title: 'Add the person',
              text: 'Use the channel’s participant controls. Choose a private or team channel based on who should be able to discover the conversation.',
            },
            {
              title: 'Point to a starting place',
              text: 'Send a short welcome with the current plan, relevant task, and one or two useful threads.',
            },
            {
              title: 'Explain the next step',
              text: 'Tell them what they are joining to do rather than leaving them to infer it from the history.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Adding someone shares history',
          text: 'Channel access includes earlier messages, not just new ones. Check that the channel is the right audience before adding someone outside the existing group.',
        },
      ],
      links: [
        {
          label: 'Channel membership',
          href: 'https://docs.macro.com/product/channels',
        },
        {
          label: 'Access through channels',
          href: 'https://docs.macro.com/permissions',
        },
      ],
    },
  ],
  'channel-agents': [
    {
      title: 'Ask in front of the team',
      summary: 'Let teammates see the request and follow the agent’s answer.',
      intro:
        'Mention @Macro in a channel to bring an agent into the team’s conversation. It can answer a question, find information, or help with a specific task while people add the details it needs.',
      sections: [
        {
          kind: 'example',
          heading: 'Example request',
          text: '@Macro, read the customer feedback in this thread and list the changes we still need to make to the rollout plan.',
        },
        {
          kind: 'steps',
          heading: 'Get a useful response',
          items: [
            {
              title: 'Ask a specific question',
              text: 'Say what result you want, such as a summary, draft, or update to a named document.',
            },
            {
              title: 'Add the relevant sources',
              text: 'Mention the document, email, or task that should guide the answer. Teammates can add missing details in the conversation.',
            },
            {
              title: 'Check and continue',
              text: 'Read the answer together. Open the referenced items, ask a follow-up, or give a clear instruction for the next action.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'The team can follow',
          items: [
            {
              title: 'The request',
              text: 'Everyone in the conversation can see what the agent was asked to do.',
            },
            {
              title: 'The result',
              text: 'Its reply stays with the thread, so later readers can understand how the work developed.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Reading and changing are different requests',
          text: 'Ask for a summary when you want information. Ask for an update when you want the agent to change a file or task. Be clear about whether an email should stay a draft.',
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
        'A specific source makes an agent request easier to follow and check. Mention the item directly so the agent can read the work you mean, even when other files have similar names.',
      sections: [
        {
          kind: 'steps',
          heading: 'Give the request a clear starting point',
          items: [
            {
              title: 'Type @',
              text: 'Choose the document, task, email, or other item from the mention menu.',
            },
            {
              title: 'Explain its role',
              text: 'Say whether the item is a source to read, a file to update, or an example of the result you want.',
            },
            {
              title: 'Describe the outcome',
              text: 'Tell the agent what to produce, and name anything it should preserve.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'Example request',
          text: 'Use this customer email to update the requirements section of this brief. Leave the launch dates unchanged.',
        },
        {
          kind: 'text',
          heading: 'When you do not know the source',
          paragraphs: [
            'You can ask the agent to search for it. Give useful clues such as the customer, project, or date. Check which item it finds before relying on the answer or asking for a change.',
            'Mentioning a source is particularly useful when you already have it open. It gives everyone in the conversation a direct route to the same material.',
          ],
        },
        {
          kind: 'note',
          heading: 'Access still applies',
          text: 'An agent inherits the permissions of the account it is acting for. Referencing a private file does not let it open that file without access.',
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
        'Macro’s built-in agent is available through @Macro. If your workspace supports connected agents, you can also bring an agent you run yourself into the conversation, with its own instructions and runtime.',
      sections: [
        {
          kind: 'facts',
          heading: 'Two ways to connect',
          items: [
            {
              title: 'An agent in Macro',
              text: 'A local runtime connected through macrod can power a named agent that participates in permitted Macro channels.',
            },
            {
              title: 'Macro in another client',
              text: 'An MCP connection gives an external AI client tools to search, read, and change your Macro work from that client.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Give the agent a clear role',
          paragraphs: [
            'Name the work it should do and mention the sources it should use. For a coding task, include the problem, relevant project, and the result the team expects.',
            'Review the connected agent’s channel access and runtime settings. A local agent runs on the chosen computer and can use that runtime’s files, tools, models, and permissions.',
          ],
        },
        {
          kind: 'note',
          heading: 'Local runtime availability',
          text: 'The current macrod setup guide marks Bring Your Own Agent as coming soon. Check that guide and your workspace’s available settings before setting it up. Macro’s MCP connection is a separate option with its own setup instructions.',
        },
        {
          kind: 'note',
          heading: 'Keep the distinction clear',
          text: '@Macro invokes Macro’s built-in agents. A separately connected agent or bot does not automatically have the same tools or access.',
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
      title: 'Expand a thread',
      summary:
        'Read the replies while keeping the surrounding conversation in view.',
      intro:
        'Open the replies under a message to follow a discussion inline. The parent message stays visible, so you can see both the original question and the responses that followed it.',
      sections: [
        {
          kind: 'steps',
          heading: 'Read the complete exchange',
          items: [
            {
              title: 'Find the parent message',
              text: 'Start with the request, update, or decision that began the discussion.',
            },
            {
              title: 'Open its replies',
              text: 'Expand the thread to read the indented responses beneath it. Use the thread indicator to find follow-up activity.',
            },
            {
              title: 'Open the supporting work',
              text: 'Follow document, email, or task references when the replies depend on information outside the conversation.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Why threads help',
          items: [
            {
              title: 'One topic stays together',
              text: 'Questions and answers about the same message have a clear place, even while the channel discusses other work.',
            },
            {
              title: 'Later readers can catch up',
              text: 'Someone returning to the channel can follow the exchange without piecing together scattered replies.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Decide whether to reply or start a topic',
          paragraphs: [
            'Reply in the thread when you are continuing that discussion. Start a new channel message when the subject is separate or the whole channel needs a fresh update.',
          ],
        },
        {
          kind: 'note',
          heading: 'Access follows the channel',
          text: 'A thread is part of its channel. Opening a reply does not create a separate private conversation.',
        },
      ],
      links: [
        {
          label: 'Threaded replies',
          href: 'https://docs.macro.com/product/channels',
        },
      ],
    },
    {
      title: 'Reply where it belongs',
      summary: 'Keep an answer attached to the question it resolves.',
      intro:
        'Reply to the original message when your answer belongs to an existing discussion. It keeps the request, clarification, and decision together for everyone who needs to follow the work.',
      sections: [
        {
          kind: 'steps',
          heading: 'Continue the thread',
          items: [
            {
              title: 'Open the replies',
              text: 'Choose the message you are answering, then use its reply controls.',
            },
            {
              title: 'Make the answer specific',
              text: 'Address the question and include the relevant file or task if the reader should open it.',
            },
            {
              title: 'Mention the right person',
              text: 'Mention a teammate when you need their input. Use a reaction for a simple acknowledgment that does not need another message.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'A useful follow-up',
          text: 'The revised plan is ready. Julia, can you check the training dates before we send it to the customer?',
          caption:
            'Mention the plan itself so the reviewer can open the current document.',
        },
        {
          kind: 'text',
          heading: 'Keep decisions reflected in the work',
          paragraphs: [
            'A thread is a useful record of how the team reached a decision. If the answer changes an assignment or plan, update the task or document too, so someone opening it later sees the current version.',
          ],
        },
        {
          kind: 'note',
          heading: 'A new topic deserves a new message',
          text: 'Keep the thread focused enough that the parent message still explains why the replies are there. A separate request is easier to find as its own message.',
        },
      ],
      links: [
        {
          label: 'Channel messages and replies',
          href: 'https://docs.macro.com/product/channels',
        },
        {
          label: 'Mentions',
          href: 'https://docs.macro.com/concepts/mentions',
        },
      ],
    },
  ],
} satisfies Record<string, readonly ProductFeatureDetail[]>;
