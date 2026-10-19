import type { ProductFeatureDetail } from '../../core/product-feature-guide';

// Sources: apps/docs/product/crm.mdx, concepts/mentions and CRM MCP tools;
// current records/pipelines distinction and association rules: docs/agent-guide/crm.md (c5cba006).
// Examples match CrmCaptureDemo and CompanyPipelineEntry: deal fields stay separate from company properties.
export const crmGuides = {
  'crm-from-email': [
    {
      title: 'Update a customer’s stage',
      summary:
        'Move the deal to the right stage after a customer conversation.',
      intro:
        'Update a deal’s stage after a customer conversation. In the demo, a confirmed meeting moves the Sales pipeline entry from Lead to Demo.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Move Parlor Studio to Demo in the Sales pipeline. Add the Thursday meeting details to the company’s Discussion.',
        },
        {
          kind: 'facts',
          heading: 'Update the right fields',
          items: [
            {
              title: 'Pipeline entry',
              text: 'Stage, owner, and revenue belong to a deal in a named pipeline. A company can have several deals.',
            },
            {
              title: 'Company record',
              text: 'Company properties are separate from pipeline fields. Updating one does not update the other.',
            },
          ],
        },
      ],
      links: [
        {
          label: 'CRM records',
          href: 'https://docs.macro.com/product/crm',
        },
        {
          label: 'Updating pipeline deals',
          href: 'https://docs.macro.com/AI/mcp/tools/update-pipeline-entries',
        },
      ],
    },
    {
      title: 'Set the account owner',
      summary: 'Show who is responsible for the customer relationship.',
      intro:
        'Assign the teammate responsible for the customer or a particular deal. Include the next step in the company’s Discussion.',
      sections: [
        {
          kind: 'facts',
          heading: 'Choose the assignment',
          items: [
            {
              title: 'Company owner',
              text: 'The company’s Owner property identifies who manages the overall relationship.',
            },
            {
              title: 'Deal owner',
              text: 'A pipeline entry has its own owner. Choose the pipeline when assigning a specific opportunity.',
            },
          ],
        },
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Assign Julia to Parlor Studio’s deal in the Sales pipeline. Add a note that they need the revised proposal before Friday.',
        },
      ],
      links: [
        {
          label: 'CRM',
          href: 'https://docs.macro.com/product/crm',
        },
        {
          label: 'Record properties',
          href: 'https://docs.macro.com/concepts/properties',
        },
      ],
    },
    {
      title: 'Record the next step',
      summary: 'Keep the customer’s decisions and follow-up with the account.',
      intro:
        'Use a company or contact’s Discussion to keep decisions, questions, and handoffs with the customer record.',
      sections: [
        {
          kind: 'example',
          heading: 'Account note',
          text: 'Demo confirmed for Thursday at 9. Alex will coordinate the rollout. Julia will send the revised plan before the call.',
        },
        {
          kind: 'text',
          heading: 'Connect the follow-up',
          paragraphs: [
            'Mention the email or call behind the decision. Create and link a task when the next step needs an owner and status. Use replies for questions about the note.',
          ],
        },
        {
          kind: 'note',
          heading: 'Internal notes',
          text: 'Mentioning a company does not notify its contacts or invite the customer into the discussion.',
        },
      ],
      links: [
        {
          label: 'CRM discussions',
          href: 'https://docs.macro.com/product/crm',
        },
        {
          label: 'Tasks',
          href: 'https://docs.macro.com/product/tasks',
        },
      ],
    },
  ],
  'crm-enrichment': [
    {
      title: 'Create contacts from email',
      summary: 'Start a customer record from your email relationship.',
      intro:
        'With CRM enabled, Macro uses your team’s email relationships to build company and contact records. Contacts are grouped by company email domain.',
      sections: [
        {
          kind: 'facts',
          heading: 'The starting record',
          items: [
            {
              title: 'People',
              text: 'Contacts include their email address and company.',
            },
            {
              title: 'Interactions',
              text: 'First and last interaction details show when the relationship was active.',
            },
            {
              title: 'Your team’s knowledge',
              text: 'Add owners, pipeline stages, and customer notes yourself or ask an agent. You can also create companies and contacts manually.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Email accounts',
          text: 'Automatic enrichment currently uses primary email accounts. CRM must be enabled for the team; secondary mailbox connections do not automatically add their contacts.',
        },
      ],
      links: [
        {
          label: 'CRM setup and records',
          href: 'https://docs.macro.com/product/crm',
        },
      ],
    },
    {
      title: 'Fill in company details',
      summary:
        'Start with public company information, then add what you learn.',
      intro:
        'Macro can add company information from its domain and public sources. Your team adds what it learns from the relationship.',
      sections: [
        {
          kind: 'facts',
          heading: 'Build out the record',
          items: [
            {
              title: 'Company background',
              text: 'Read the description to understand what the business does. Check important details with the customer.',
            },
            {
              title: 'Account details',
              text: 'Set company properties and the fields on each pipeline entry.',
            },
            {
              title: 'Customer conversations',
              text: 'Use Discussion for requirements, decisions, and the next step.',
            },
          ],
        },
      ],
      links: [
        {
          label: 'CRM enrichment',
          href: 'https://docs.macro.com/product/crm',
        },
        {
          label: 'Company properties',
          href: 'https://docs.macro.com/concepts/properties',
        },
      ],
    },
  ],
  'crm-context': [
    {
      title: 'People at the company',
      summary: 'See who is involved and open their individual history.',
      intro:
        'Open a company’s Team tab to find its contacts. Select a person to see their email, conversations, calls, and linked work.',
      sections: [
        {
          kind: 'text',
          heading: 'Find or add a contact',
          paragraphs: [
            'Search by name or email in the company’s contacts or the Customers People list. Create a contact and associate them with the company when someone is missing.',
          ],
        },
        {
          kind: 'text',
          heading: 'Explain their role',
          paragraphs: [
            'Use Discussion to record who approves the proposal or coordinates the rollout, so the next teammate knows whom to involve.',
          ],
        },
      ],
      links: [
        {
          label: 'Companies and contacts',
          href: 'https://docs.macro.com/product/crm',
        },
      ],
    },
    {
      title: 'Emails and calls',
      summary: 'Read the conversations behind the customer relationship.',
      intro:
        'Use a company’s Emails and Calls tabs to read the conversations behind the account.',
      sections: [
        {
          kind: 'facts',
          heading: 'Open the original',
          items: [
            {
              title: 'Emails',
              text: 'Read the thread and attachments to check requirements, dates, or approvals.',
            },
            {
              title: 'Calls',
              text: 'Read the summary or transcript, or replay the recording to hear the exchange.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Email Sync',
          text: 'When enabled for a company, qualifying team email threads are visible through CRM. Turning it off makes those threads private to their participants while keeping the company record.',
        },
      ],
      links: [
        {
          label: 'CRM email sharing',
          href: 'https://docs.macro.com/product/crm',
        },
        {
          label: 'Calls',
          href: 'https://docs.macro.com/product/calls',
        },
      ],
    },
    {
      title: 'Files and tasks',
      summary: 'Find the documents and assignments connected to an account.',
      intro:
        'Open Files and Tasks on a company to find its proposals, plans, and follow-up work.',
      sections: [
        {
          kind: 'facts',
          heading: 'Connect work to the account',
          items: [
            {
              title: 'Mentions',
              text: 'Mention the company or contact in a document, task, or discussion.',
            },
            {
              title: 'Properties',
              text: 'Set the Companies or Contacts property on an item.',
            },
            {
              title: 'Tasks and attachments',
              text: 'Create a task from the company’s Tasks tab to connect it. Files can also include attachments from company email threads.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Sharing',
          text: 'These are links to the original items. Their access rules still apply, and linking them does not notify the customer.',
        },
      ],
      links: [
        {
          label: 'CRM references',
          href: 'https://docs.macro.com/product/crm',
        },
        {
          label: 'Mentions and access',
          href: 'https://docs.macro.com/concepts/mentions',
        },
      ],
    },
  ],
  'crm-agents': [
    {
      title: 'Update after the sales sync',
      summary: 'Turn the meeting’s decisions into specific CRM updates.',
      intro:
        'Ask an agent to turn agreed meeting decisions into CRM changes, using the saved call or team discussion.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Read this sales sync. Update the deal owners we agreed on in the Sales pipeline and add the next steps to each company’s Discussion. List any undecided stage changes.',
        },
        {
          kind: 'text',
          heading: 'Name the destination',
          paragraphs: [
            'Specify the company or deal and its pipeline. Company properties and pipeline fields are separate. Open the updated records to check the result.',
          ],
        },
      ],
      links: [
        {
          label: 'Agents',
          href: 'https://docs.macro.com/product/agents',
        },
        {
          label: 'Pipeline tools',
          href: 'https://docs.macro.com/AI/mcp/tools/find-pipeline-entries',
        },
      ],
    },
    {
      title: 'Work through MCP',
      summary: 'Read and update the CRM from an AI client you already use.',
      intro:
        'Use Macro’s CRM tools from a supported AI client. Changes appear on the same records your team uses in Macro.',
      sections: [
        {
          kind: 'steps',
          heading: 'Connect and ask',
          items: [
            {
              title: 'Set up Macro’s MCP server',
              text: 'Follow the client setup guide and sign in with your Macro account.',
            },
            {
              title: 'Name the work',
              text: 'Ask for a company’s history, deals in a pipeline stage, or a specific record update. The tools use your account’s access.',
            },
          ],
        },
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Find deals in Proposal in the Sales pipeline. Show each owner and the next step recorded on the company.',
        },
      ],
      links: [
        {
          label: 'MCP setup',
          href: 'https://docs.macro.com/AI/mcp/overview',
        },
        {
          label: 'CRM tool reference',
          href: 'https://docs.macro.com/AI/mcp/tools/index',
        },
      ],
    },
  ],
} satisfies Record<string, readonly ProductFeatureDetail[]>;
