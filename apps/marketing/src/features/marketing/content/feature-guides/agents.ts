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
        'Get a meeting brief from your calendar, customer emails, team discussions, and saved calls.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Prepare me for tomorrow’s customer calls. Summarize recent decisions, open questions, and anything I promised to follow up on. Link the sources.',
        },
        {
          kind: 'text',
          heading: 'Choose what to cover',
          paragraphs: [
            'Name the day or customer and mention any key source. Connect the relevant calendar when you want the agent to start from your schedule.',
          ],
        },
        {
          kind: 'note',
          heading: 'Check important details',
          text: 'Open the sources behind dates and commitments. The brief can only include information your account can access.',
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
        'Ask a question whose answer spans emails, calls, documents, and team discussions.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'What changed in this customer’s rollout since our last call? Compare the recent emails with the plan and tell me what still needs updating.',
        },
        {
          kind: 'text',
          heading: 'Set a time period',
          paragraphs: [
            'Name a date or event to compare against. If sources disagree, ask the agent to show the difference so you can decide which information is current.',
          ],
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
        'Open the references in an agent’s answer to read the original email, document, or call.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Which message confirms that date? Link the source and check whether the later call changed it.',
        },
        {
          kind: 'text',
          heading: 'Read the surrounding context',
          paragraphs: [
            'Check later replies and qualifications that could change the answer. Replay a call when the transcript’s wording is unclear.',
          ],
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
        'Ask an agent to edit the document your team already uses. Keep writing, leave comments, or ask for another pass in that same file.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Add a test checklist to the client upload brief. Cover interrupted uploads and nested folders. Keep the agreed scope and launch dates unchanged.',
        },
        {
          kind: 'steps',
          heading: 'Review and refine',
          items: [
            {
              title: 'Open the revised section',
              text: 'Check the changes against the request. Correct small details directly or ask for a focused revision.',
            },
            {
              title: 'Compare earlier versions',
              text: 'Use document history to review previous states. You can fork an earlier version into a separate document.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Edit access',
          text: 'The agent needs the same permission to edit that your account does.',
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
  ],
  'agent-collaboration': [
    {
      title: 'Make a mockup',
      summary: 'Turn the brief into something the team can discuss.',
      intro:
        'Give an agent a brief and ask for a mockup your team can discuss in the channel.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Mock up folder uploads using this brief. Show a folder option in the existing composer and keep the upload flow simple.',
        },
        {
          kind: 'steps',
          heading: 'Review together',
          items: [
            {
              title: 'Check it against the brief',
              text: 'Point out missing requirements or unnecessary controls. Teammates can add feedback in the same thread.',
            },
            {
              title: 'Record the decision',
              text: 'Update the brief with agreed changes and link the approved mockup when handing it to a coding agent.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'A proposed design',
          text: 'A mockup shows the direction. The feature still needs to be implemented and tested.',
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
      title: 'Bring in Cursor',
      summary:
        'Hand the agreed brief and feedback to a connected coding agent.',
      intro:
        'Ask a connected coding agent to build from the brief, mockup, and decisions in the team’s conversation.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Build folder uploads from this approved mockup. Reuse the existing uploader, preserve nested folders, and return a pull request with a preview.',
        },
        {
          kind: 'text',
          heading: 'Review the result',
          paragraphs: [
            'Try the changed flow, read the pull request, and check the test results. Continue in the thread if the implementation needs another pass.',
          ],
        },
        {
          kind: 'note',
          heading: 'Connection required',
          text: 'The coding agent needs access to the repository and a configured runtime. Mentioning its name does not set up that connection.',
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
      summary: 'Choose a local agent, its workspace, and who can use it.',
      intro:
        'Connect an agent running on your computer to start and follow its work from Macro.',
      sections: [
        {
          kind: 'note',
          heading: 'Availability',
          text: 'The macrod setup guide currently lists Bring Your Own Agent as coming soon. Check the guide and your workspace’s Agents settings before setup.',
        },
        {
          kind: 'steps',
          heading: 'Connect a runtime',
          items: [
            {
              title: 'Prepare your computer',
              text: 'Use a macOS or Linux machine with an authenticated, supported agent and a working directory.',
            },
            {
              title: 'Pair it with Macro',
              text: 'Follow the setup guide from Settings → General → Agents → Runtimes. Run macrod and enter the pairing code in Macro.',
            },
            {
              title: 'Configure the agent',
              text: 'Choose its name, instructions, runtime, and who can use it. Review channel access and the runtime’s file and command permissions.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'While it runs',
          text: 'Keep the computer awake and macrod connected. Models, subscriptions, and approval settings remain with the agent runtime.',
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
        'Connect Macro’s search, reading, and editing tools to an AI client you already use.',
      sections: [
        {
          kind: 'steps',
          heading: 'Connect your client',
          items: [
            {
              title: 'Add the server',
              text: 'Follow the client’s remote MCP setup with https://mcp-server.macro.com/mcp.',
            },
            {
              title: 'Sign in',
              text: 'Complete Macro’s browser authorization. The tools use your account’s permissions.',
            },
            {
              title: 'Ask for work',
              text: 'Find an email, summarize a call, create a task, or update a document. Open the result in Macro to review it.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'No local runtime required',
          text: 'MCP brings Macro tools into your AI client. Use macrod when you want an agent running on your computer to appear in Macro.',
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
  ],
} satisfies Record<string, readonly ProductFeatureDetail[]>;
