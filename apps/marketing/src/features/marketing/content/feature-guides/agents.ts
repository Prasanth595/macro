import type { ProductFeatureDetail } from '../../core/product-feature-guide';

// Sources: apps/docs/product/agents.mdx, unified-memory, calendar, docs,
// AI/bring-your-own.mdx and AI/mcp/overview.mdx at c5cba006.
// Preserve the local-runtime availability notice from the published setup guide.
export const agentsGuides = {
  'agent-sources': [
    {
      title: 'Prepare for a meeting',
      summary: 'Get a brief based on the customer’s actual conversations.',
      intro:
        'Ask an agent to prepare you for a meeting using the calendar and the work around it. It can gather earlier emails, discussions, and saved calls to explain what has happened and what still needs an answer.',
      sections: [
        {
          kind: 'example',
          heading: 'Example request',
          text: 'Prepare me for tomorrow’s customer calls. For each meeting, summarize the latest conversation, open questions, and anything I promised to follow up on. Link the sources.',
        },
        {
          kind: 'steps',
          heading: 'Make the brief useful',
          items: [
            {
              title: 'Define the scope',
              text: 'Name the day, customer, or meeting. Check that the relevant calendar is connected if you want the agent to start from your schedule.',
            },
            {
              title: 'Add a source when you know it',
              text: 'Mention a customer thread, call, or document when it is especially relevant. The agent can also search for accessible work.',
            },
            {
              title: 'Review before the meeting',
              text: 'Open the references behind important dates, commitments, and unresolved questions. Use a follow-up prompt to fill gaps.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'A good brief answers',
          items: [
            {
              title: 'What changed?',
              text: 'The recent decisions or requests since the last conversation.',
            },
            {
              title: 'What is open?',
              text: 'Questions that still need a decision from your team or the customer.',
            },
            {
              title: 'What comes next?',
              text: 'The concrete outcome you should aim for in the meeting.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'It works with accessible information',
          text: 'The agent can use the sources your account can access. A missing calendar connection or private thread can leave gaps in the brief.',
        },
      ],
      links: [
        {
          label: 'Agents',
          href: 'https://docs.macro.com/product/agents',
        },
        {
          label: 'Calendar',
          href: 'https://docs.macro.com/product/calendar',
        },
      ],
    },
    {
      title: 'Connect the conversations',
      summary:
        'Bring related emails, calls, and team discussions into one answer.',
      intro:
        'Ask a question about the work, even when the answer is spread across several conversations. The agent can search accessible sources and explain how the customer’s request, the team’s discussion, and the current plan fit together.',
      sections: [
        {
          kind: 'facts',
          heading: 'Each source contributes something',
          items: [
            {
              title: 'Email',
              text: 'The customer’s questions, requirements, and written commitments.',
            },
            {
              title: 'Channels',
              text: 'The team’s discussion, decisions, and questions about how to respond.',
            },
            {
              title: 'Calls',
              text: 'Details agreed in meetings, available through the saved transcript and recording.',
            },
            {
              title: 'Tasks and documents',
              text: 'The current assignments and plans that should reflect those decisions.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'Example question',
          text: 'What has changed in this customer’s rollout since our last call? Compare the recent emails with the plan and tell me what still needs updating.',
        },
        {
          kind: 'text',
          heading: 'Be clear about the time period',
          paragraphs: [
            'Include a date or event when you need a comparison. “Since last week’s call” is easier to check than an open-ended request for everything about a customer.',
            'When sources disagree, ask the agent to show the difference instead of quietly choosing one. A later conversation may change an earlier plan, but you should be able to see why.',
          ],
        },
        {
          kind: 'note',
          heading: 'Start with references you recognize',
          text: 'Open a few of the linked sources to confirm the agent found the right customer and project before using the answer for a consequential update.',
        },
      ],
      links: [
        {
          label: 'Workspace memory',
          href: 'https://docs.macro.com/product/unified-memory',
        },
        {
          label: 'Agents',
          href: 'https://docs.macro.com/product/agents',
        },
      ],
    },
    {
      title: 'Check the sources',
      summary: 'Open the original work behind an agent’s answer.',
      intro:
        'A useful answer should make it possible to check the important details. Follow the documents, emails, or calls referenced by the agent to see the original information and decide what to do next.',
      sections: [
        {
          kind: 'steps',
          heading: 'Verify what matters',
          items: [
            {
              title: 'Open the referenced item',
              text: 'Check the source behind a date, commitment, or status rather than relying only on the summary.',
            },
            {
              title: 'Read the surrounding detail',
              text: 'Look for qualifications, later replies, or a change that affects the answer.',
            },
            {
              title: 'Ask a focused follow-up',
              text: 'If the answer is unclear, tell the agent what needs checking and which source should resolve it.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'Example follow-up',
          text: 'Which message confirms that date? Show me the source and check whether the later call changed it.',
        },
        {
          kind: 'facts',
          heading: 'Different kinds of evidence',
          items: [
            {
              title: 'A document',
              text: 'Shows the plan or written requirement currently shared with the team.',
            },
            {
              title: 'An email',
              text: 'Shows what was said to or agreed with the customer.',
            },
            {
              title: 'A call transcript',
              text: 'Shows the meeting discussion; replay the recording when the exact wording needs checking.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'A reference is a route to the evidence',
          text: 'An answer with a link can still misread the source. Check the details that affect the decision, and ask for uncertainty to be stated when the available information does not settle the question.',
        },
      ],
      links: [
        {
          label: 'Agents and workspace context',
          href: 'https://docs.macro.com/product/agents',
        },
        {
          label: 'Mentions',
          href: 'https://docs.macro.com/concepts/mentions',
        },
      ],
    },
  ],
  'agent-actions': [
    {
      title: 'Change the shared file',
      summary: 'Have the agent update the document your team already uses.',
      intro:
        'Point the agent at an existing document and describe the change. It can edit that shared file directly, letting your team review the result in the place where the work belongs.',
      sections: [
        {
          kind: 'example',
          heading: 'Example request',
          text: 'Add a test checklist to the client upload brief. Cover interrupted uploads and reviewer labels. Keep the agreed scope and launch dates unchanged.',
        },
        {
          kind: 'steps',
          heading: 'Give a clear editing instruction',
          items: [
            {
              title: 'Identify the document',
              text: 'Mention the exact file. A specific reference avoids confusion when several documents have similar names.',
            },
            {
              title: 'Describe the desired change',
              text: 'Name the section, information, or outcome you want. Include what should remain as it is.',
            },
            {
              title: 'Review the shared result',
              text: 'Open the file and read the revised section. Make a direct edit or ask the agent to refine it.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Useful edits',
          items: [
            {
              title: 'Incorporate feedback',
              text: 'Turn agreed comments or customer requests into changes in the brief.',
            },
            {
              title: 'Add missing structure',
              text: 'Create a checklist or clearer section when the document needs a practical next step.',
            },
            {
              title: 'Update facts',
              text: 'Revise dates or requirements from a source you explicitly provide.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Edit access is required',
          text: 'The agent acts with your permissions. It cannot change a document your account can only view.',
        },
      ],
      links: [
        {
          label: 'Agent document actions',
          href: 'https://docs.macro.com/product/agents',
        },
        {
          label: 'Document editing',
          href: 'https://docs.macro.com/product/docs',
        },
      ],
    },
    {
      title: 'Keep refining it',
      summary:
        'Work with the agent and your teammates until the file is ready.',
      intro:
        'An agent’s first pass can become the next working version of the document. Read it, make your own edits, and ask for another focused change while the team continues in the same file.',
      sections: [
        {
          kind: 'facts',
          heading: 'Choose the quickest kind of feedback',
          items: [
            {
              title: 'Edit directly',
              text: 'Fix a name, date, or sentence yourself when that is faster than explaining it.',
            },
            {
              title: 'Ask for another pass',
              text: 'Tell the agent what needs changing, such as a shorter introduction or a more specific checklist.',
            },
            {
              title: 'Leave a comment',
              text: 'Use a comment on the relevant text when the team needs to discuss a decision before editing.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'Example follow-up',
          text: 'The checklist is useful. Make each item something we can actually test, and remove the guest-access work from this version.',
        },
        {
          kind: 'text',
          heading: 'Keep the agreed parts stable',
          paragraphs: [
            'Name what should stay the same when a revision is narrow. That helps the next pass focus on the problem instead of rewriting the whole document.',
            'Teammates can keep editing the shared file. Review the latest version before approving it, especially when several people have contributed since the agent started.',
          ],
        },
        {
          kind: 'note',
          heading: 'Use history when you need to compare',
          text: 'Document history lets you browse earlier states. You can fork a previous version into a new document if you need to preserve or examine that version separately.',
        },
      ],
      links: [
        {
          label: 'Collaboration and history',
          href: 'https://docs.macro.com/product/docs',
        },
        {
          label: 'Agents',
          href: 'https://docs.macro.com/product/agents',
        },
      ],
    },
  ],
  'agent-collaboration': [
    {
      title: 'Make a mockup',
      summary: 'Turn the brief into something the team can discuss.',
      intro:
        'Ask the agent for a mockup when a written idea needs a concrete visual direction. Give it the client brief and the question the team needs to answer, then review the result in the conversation.',
      sections: [
        {
          kind: 'example',
          heading: 'Example request',
          text: 'Make a mockup for the client upload page using this brief. Show who is reviewing each file, and keep the existing upload flow simple.',
        },
        {
          kind: 'steps',
          heading: 'Start from the real requirements',
          items: [
            {
              title: 'Provide the brief',
              text: 'Mention the source document so the agent can read the customer’s needs and the agreed scope.',
            },
            {
              title: 'Name the decision',
              text: 'Explain what the mockup should help you decide, such as the information hierarchy or where an action belongs.',
            },
            {
              title: 'Review the result',
              text: 'Open the generated output and compare it with the brief. Ask for changes where the layout misses a requirement or adds something unnecessary.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'What to check',
          items: [
            {
              title: 'Clarity',
              text: 'Can a person tell what the screen is for and what they should do next?',
            },
            {
              title: 'Scope',
              text: 'Does it show the feature being discussed without adding unrelated controls?',
            },
            {
              title: 'Implementation',
              text: 'Which details should the coding agent carry into the actual product?',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'A mockup is a proposal',
          text: 'It gives the team something to review. It does not establish that a feature has been implemented or that the interface behaves correctly.',
        },
      ],
      links: [
        {
          label: 'Agents and creative work',
          href: 'https://docs.macro.com/product/agents',
        },
      ],
    },
    {
      title: 'Give feedback together',
      summary:
        'Keep the brief, mockup, and decisions in the same conversation.',
      intro:
        'Discuss the mockup in the channel where the team requested it. People can open the same output, explain what needs changing, and agree on the direction before implementation begins.',
      sections: [
        {
          kind: 'facts',
          heading: 'Useful feedback is specific',
          items: [
            {
              title: 'Name the problem',
              text: 'Explain what is confusing or missing, such as an unclear reviewer name or an action that is hard to find.',
            },
            {
              title: 'Connect it to the goal',
              text: 'Say which part of the brief the change supports. This helps separate a requirement from a preference.',
            },
            {
              title: 'State the decision',
              text: 'Once the team agrees, record what should change and what should remain.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'Example feedback',
          text: 'Keep the existing upload area. Put the reviewer’s name beside each file so the client can see who is checking it without opening another page.',
        },
        {
          kind: 'steps',
          heading: 'Make the handoff readable',
          items: [
            {
              title: 'Collect the decisions',
              text: 'Summarize the changes the team agreed on, rather than asking the implementer to infer them from every reply.',
            },
            {
              title: 'Update the brief if needed',
              text: 'When feedback changes the requirements, reflect it in the shared document too.',
            },
            {
              title: 'Point to the approved direction',
              text: 'Mention the relevant output and brief when asking a coding agent to continue.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Keep questions separate from instructions',
          text: 'An idea raised during review is not necessarily a decision. Make clear which changes are ready to build and which still need discussion.',
        },
      ],
      links: [
        {
          label: 'Channels and threads',
          href: 'https://docs.macro.com/product/channels',
        },
        {
          label: 'Working with agents',
          href: 'https://docs.macro.com/product/agents',
        },
      ],
    },
    {
      title: 'Bring in Cursor',
      summary:
        'Hand the agreed brief and feedback to a connected coding agent.',
      intro:
        'Once the direction is clear, ask a connected coding agent to implement it. In the demo, Cursor continues from the brief and mockup already discussed by the team.',
      sections: [
        {
          kind: 'steps',
          heading: 'Give the agent an actionable handoff',
          items: [
            {
              title: 'Confirm the connection',
              text: 'Use the coding agent connected to your workspace and the repository it is allowed to work on.',
            },
            {
              title: 'Reference the agreed material',
              text: 'Point to the brief, mockup, and final decisions. Explain which parts of the existing product should stay as they are.',
            },
            {
              title: 'Ask for a reviewable result',
              text: 'Have the agent make the change and provide a preview or pull request that the team can inspect.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'Example request',
          text: 'Build the reviewer labels from this approved mockup. Use the existing upload components and include the brief’s test checklist in your verification.',
        },
        {
          kind: 'facts',
          heading: 'Before calling it finished',
          items: [
            {
              title: 'Inspect the result',
              text: 'Try the main flow and the screen sizes that matter. A generated preview is a starting point for review.',
            },
            {
              title: 'Read the changes',
              text: 'Open the pull request to understand what changed and check the repository’s test results.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Tools and access depend on the connection',
          text: 'Cursor or another coding agent needs the appropriate repository and runtime access. Mentioning its name alone does not configure that access.',
        },
      ],
      links: [
        {
          label: 'Coding agents',
          href: 'https://docs.macro.com/product/agents',
        },
        {
          label: 'GitHub integration',
          href: 'https://docs.macro.com/integrations/github',
        },
      ],
    },
  ],
  'existing-agents': [
    {
      title: 'Connect through macrod',
      summary: 'Bring an agent running on your computer into Macro.',
      intro:
        'macrod connects a local coding agent to your Macro workspace. The work runs on your computer, while Macro provides a place to start and follow its sessions.',
      sections: [
        {
          kind: 'note',
          heading: 'Availability',
          text: 'The current setup guide marks Bring Your Own Agent as coming soon. Check that guide and the Agents settings available in your workspace before beginning setup.',
        },
        {
          kind: 'facts',
          heading: 'What you need',
          items: [
            {
              title: 'A computer',
              text: 'A macOS or Linux machine that can remain online while the agent works.',
            },
            {
              title: 'An installed agent',
              text: 'An authenticated supported agent, such as Claude Code, Codex, OpenCode, OpenClaw, or Hermes. A custom Agent Client Protocol command is also supported by the setup guide.',
            },
            {
              title: 'A workspace',
              text: 'The directory in which the agent should work, with access appropriate to the task.',
            },
          ],
        },
        {
          kind: 'steps',
          heading: 'How connection works',
          items: [
            {
              title: 'Set up the runtime',
              text: 'Follow Settings → General → Agents → Runtimes → New runtime and the official macrod setup guide.',
            },
            {
              title: 'Pair the computer',
              text: 'Run macrod, choose the agent and workspace, then enter the pairing code in Macro. Review whether the runtime is private or available to the team.',
            },
            {
              title: 'Create the Macro agent',
              text: 'Give the agent a name and instructions, choose the connected runtime, and review its sharing and channel access.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Keep the runtime running',
          text: 'The computer must stay awake and macrod must remain connected. Local commands and file access follow the agent runtime’s permissions; review those before sharing it with teammates.',
        },
      ],
      links: [
        {
          label: 'macrod setup and availability',
          href: 'https://docs.macro.com/AI/bring-your-own',
        },
      ],
    },
    {
      title: 'Use Macro through MCP',
      summary: 'Use Macro’s tools from your preferred AI client.',
      intro:
        'MCP lets a supported AI client connect to Macro’s search, reading, and editing tools. You can work with the same documents, tasks, and conversations from the client you already use.',
      sections: [
        {
          kind: 'steps',
          heading: 'Connect once',
          items: [
            {
              title: 'Choose your client',
              text: 'Follow the setup instructions for Claude Code, Codex, or an editor that supports a remote MCP server.',
            },
            {
              title: 'Add Macro’s server',
              text: 'Use the official endpoint: https://mcp-server.macro.com/mcp. The server runs remotely, so this connection does not require macrod on your computer.',
            },
            {
              title: 'Authorize your account',
              text: 'Complete Macro’s browser sign-in flow from the client. The tools use the access of that Macro account.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'What to ask for',
          items: [
            {
              title: 'Find and read',
              text: 'Locate a customer email, read a brief, or summarize a saved call.',
            },
            {
              title: 'Create and update',
              text: 'Make a task, edit a document, or change a CRM field when you want the client to take action.',
            },
            {
              title: 'Check the result',
              text: 'Open the changed item in Macro to review the work in the same place your team uses it.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'MCP and local agents are different connections',
          text: 'MCP brings Macro tools into another client. macrod brings an agent running on your computer into Macro. Choose the connection for the direction you need.',
        },
      ],
      links: [
        {
          label: 'Client setup instructions',
          href: 'https://docs.macro.com/AI/mcp/overview',
        },
        {
          label: 'Available tools',
          href: 'https://docs.macro.com/AI/mcp/tools/index',
        },
      ],
    },
    {
      title: 'Keep your runtime',
      summary: 'Choose where the agent runs and which tools it can use.',
      intro:
        'An agent’s runtime is the software that carries out its work. Connecting an agent to Macro does not make every runtime the same: its models, commands, file access, and approval settings still depend on that runtime.',
      sections: [
        {
          kind: 'facts',
          heading: 'The parts you control',
          items: [
            {
              title: 'Agent instructions',
              text: 'The name and guidance that describe what the agent should do.',
            },
            {
              title: 'Runtime',
              text: 'The installed or hosted software that runs the session and provides its tools.',
            },
            {
              title: 'Workspace',
              text: 'The files and project the local agent is allowed to work with.',
            },
            {
              title: 'Access',
              text: 'Whether only you can start its work or your team can use it, together with the runtime’s own permissions.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Use the connection that fits your work',
          paragraphs: [
            'A local agent can work in the selected directory on your machine. An external MCP client can use Macro’s tools from its own environment. Each setup has its own requirements, so follow the guide for the connection you choose.',
          ],
        },
        {
          kind: 'note',
          heading: 'Local runtime availability',
          text: 'The macrod guide currently marks Bring Your Own Agent as coming soon. Supported agents and setup requirements are listed there.',
        },
        {
          kind: 'note',
          heading: 'Subscriptions and permissions stay with the provider',
          text: 'Use the model choices and account entitlements supported by your agent. Review its approval settings before letting teammates start work on a local machine.',
        },
      ],
      links: [
        {
          label: 'Runtime setup',
          href: 'https://docs.macro.com/AI/bring-your-own',
        },
        {
          label: 'MCP connection',
          href: 'https://docs.macro.com/AI/mcp/overview',
        },
      ],
    },
  ],
} satisfies Record<string, readonly ProductFeatureDetail[]>;
