import type { ProductFeatureDetail } from '../../core/product-feature-guide';

// Sources: apps/docs/product/crm.mdx, concepts/mentions and CRM MCP tools;
// current records/pipelines distinction and association rules: docs/agent-guide/crm.md (c5cba006).
// CrmCaptureDemo changes company properties, not pipeline-entry fields.
export const crmGuides = {
  'crm-from-email': [
    {
      title: 'Update a customer’s stage',
      summary: 'Record what changed after the customer conversation.',
      intro:
        'After a call or email changes the relationship, update the customer’s stage or ask an agent to do it. In this demo, the agent changes the company record from Lead to Demo after a meeting is agreed.',
      sections: [
        {
          kind: 'example',
          heading: 'Example request',
          text: 'We agreed to a demo on Thursday. Set this company’s Stage to Demo and add the meeting details to its Discussion.',
        },
        {
          kind: 'facts',
          heading: 'Choose the right place to update',
          items: [
            {
              title: 'Company record',
              text: 'Its properties describe the customer. The Stage field shown in this demo belongs to that company record.',
            },
            {
              title: 'Pipeline deal',
              text: 'A pipeline entry has its own stage, owner, and other fields. A company can have several entries, so name the pipeline when you mean a particular deal.',
            },
            {
              title: 'Customer notes',
              text: 'Use Discussion for the explanation: what was agreed, who attended, and what happens next.',
            },
          ],
        },
        {
          kind: 'steps',
          heading: 'Check the change',
          items: [
            {
              title: 'Open the record or pipeline',
              text: 'Verify the stage on the item you asked to change. Company properties and pipeline fields are separate.',
            },
            {
              title: 'Keep the source',
              text: 'Reference the call or email that explains the update so the team can check the agreement.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Stages need a decision',
          text: 'Creating or enriching a company does not tell Macro whether a deal is qualified or won. You decide what the stage should be, or instruct an agent based on the evidence.',
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
        'Set an owner on the company record so the team knows who is handling the account. You can edit the property directly or include the assignment in an agent request after a customer conversation.',
      sections: [
        {
          kind: 'steps',
          heading: 'Make the responsibility clear',
          items: [
            {
              title: 'Choose the account',
              text: 'Open the company you mean. Check its name and domain when there are similar records.',
            },
            {
              title: 'Set the owner',
              text: 'Choose the teammate responsible for the relationship. If you ask an agent, name the person clearly.',
            },
            {
              title: 'Add the handoff details',
              text: 'Use the company’s Discussion for information the new owner needs, such as the next meeting and the customer’s main concern.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'Example request',
          text: 'Make Julia the owner of this company. Add a note that the customer wants a revised proposal before Friday.',
        },
        {
          kind: 'facts',
          heading: 'Account ownership and deal ownership',
          items: [
            {
              title: 'Account owner',
              text: 'The Owner property on the company record describes responsibility for the customer overall.',
            },
            {
              title: 'Deal owner',
              text: 'A pipeline entry can have a different owner. Set that field in the relevant pipeline when someone is responsible for a particular opportunity.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Assignment does not replace a handoff',
          text: 'The field makes responsibility visible. A brief note and links to the recent conversation give the new owner enough information to act.',
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
        'Use the company’s Discussion to record the detail that would otherwise disappear into a sales conversation. Notes stay on the customer record, where teammates can find them before their next interaction.',
      sections: [
        {
          kind: 'facts',
          heading: 'A useful account note',
          items: [
            {
              title: 'The decision',
              text: 'Write what the customer agreed to or asked for. Be specific about dates, scope, or open questions.',
            },
            {
              title: 'The people',
              text: 'Name who is coordinating the work on each side. Use teammate mentions when someone needs a notification.',
            },
            {
              title: 'The next action',
              text: 'Say what should happen next and who is taking it. Create a task when the step needs an owner and progress tracking.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'Example note',
          text: 'Demo agreed for Thursday at 9. Alex is coordinating the rollout on the customer’s side. Julia will send the revised plan before the call.',
        },
        {
          kind: 'text',
          heading: 'Keep the source close',
          paragraphs: [
            'Mention the saved call or supporting document when it explains the note. A teammate can open the original rather than relying on a summary alone.',
            'Company discussions support replies and reactions, so follow-up questions can stay with the account instead of starting another disconnected chat.',
          ],
        },
        {
          kind: 'note',
          heading: 'A note and a task serve different purposes',
          text: 'A note records what happened. A task tracks something that needs doing. Link the task from the account when the follow-up should appear in someone’s work list.',
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
        'With CRM enabled for your team, Macro uses your team’s email relationships to build company and contact records. People are grouped by their company’s email domain, giving you a starting point without entering the same contact again.',
      sections: [
        {
          kind: 'facts',
          heading: 'What the record brings together',
          items: [
            {
              title: 'Contact',
              text: 'The person and their email address, associated with the company they belong to.',
            },
            {
              title: 'Company',
              text: 'A shared record based on the email domain, so several people at the same business can appear together.',
            },
            {
              title: 'Interaction history',
              text: 'First and last interaction information helps the team understand how recently the relationship has been active.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Add what only your team knows',
          paragraphs: [
            'Email can identify a relationship, but it cannot decide your sales process. Open the record to add the account owner, the appropriate stage, and notes about the customer’s needs.',
            'You can also create a company or contact manually when the relationship has not started through email.',
          ],
        },
        {
          kind: 'note',
          heading: 'Which email contributes',
          text: 'The CRM documentation currently specifies primary email accounts for automatic enrichment. Connecting a secondary mailbox does not mean its contacts will automatically populate the CRM.',
        },
        {
          kind: 'note',
          heading: 'Team setup',
          text: 'CRM needs to be enabled for the team. If records are missing, check with your team admin before assuming a new contact was created.',
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
        'Macro can enrich a company record with information from its domain and public sources. That gives you a short introduction to the business before your team adds the details of the relationship.',
      sections: [
        {
          kind: 'facts',
          heading: 'Two kinds of information',
          items: [
            {
              title: 'About the company',
              text: 'Public information can explain what the business does. Use it as background when preparing for an introduction or meeting.',
            },
            {
              title: 'About the account',
              text: 'Your team supplies the owner, stage, revenue, and other properties that describe its relationship with the company.',
            },
            {
              title: 'What was agreed',
              text: 'Keep meeting decisions, customer requirements, and handoff details in the record’s Discussion.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'Add your own knowledge',
          text: 'They are evaluating a rollout for the operations team. Their main question is how guests will review uploaded files.',
          caption:
            'This is relationship knowledge from your conversations, rather than something a public company description can provide.',
        },
        {
          kind: 'text',
          heading: 'Read the record before the meeting',
          paragraphs: [
            'Start with the company description, then look at its contacts and recent conversations. The combination helps you understand both who the company is and what your team is working on with it.',
          ],
        },
        {
          kind: 'note',
          heading: 'Review before relying on it',
          text: 'Public descriptions can be incomplete or out of date. Check important details with the customer and keep your account notes current.',
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
        'The company’s Team tab brings together its contacts. Open a person to see their own relationship with your team, or stay on the company to understand the account as a whole.',
      sections: [
        {
          kind: 'facts',
          heading: 'Company and contact views',
          items: [
            {
              title: 'Company',
              text: 'Use the company record for the overall relationship, its contacts, and the work associated with the business.',
            },
            {
              title: 'Contact',
              text: 'Use the person’s record for their email address, conversations, calls, and directly linked work.',
            },
            {
              title: 'People list',
              text: 'Use People in Customers when you know the person’s name or email but do not know which company record to open.',
            },
          ],
        },
        {
          kind: 'steps',
          heading: 'Prepare for a new participant',
          items: [
            {
              title: 'Find the person',
              text: 'Search the company’s contacts or the People list by name or email.',
            },
            {
              title: 'Read their history',
              text: 'Check the relevant conversations and notes before assuming what they already know.',
            },
            {
              title: 'Add the missing connection',
              text: 'Create a contact if needed and associate them with the right company.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Use contacts for people, notes for roles',
          text: 'A contact identifies a person. A Discussion note can explain their role in the decision, such as who approves the proposal or coordinates the rollout. Keep that explanation with the account for the next teammate.',
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
        'Open a company’s Emails and Calls tabs to find conversations associated with the account. They give you a way to check what was actually said before answering a customer or updating the team.',
      sections: [
        {
          kind: 'facts',
          heading: 'Choose the source you need',
          items: [
            {
              title: 'Email',
              text: 'Read the original thread, including replies and attachments available to you. It is useful for exact requirements, dates, and written approvals.',
            },
            {
              title: 'Call',
              text: 'Open a saved call to read the transcript or summary, or replay the recording when the wording and tone matter.',
            },
            {
              title: 'Discussion',
              text: 'Read the team’s account notes to understand its interpretation and planned follow-up.',
            },
          ],
        },
        {
          kind: 'steps',
          heading: 'Catch up before replying',
          items: [
            {
              title: 'Find the recent exchange',
              text: 'Look at the most relevant conversation, not just the latest item by date.',
            },
            {
              title: 'Check the details',
              text: 'Open the original source when a short summary leaves a question unanswered.',
            },
            {
              title: 'Record the follow-up',
              text: 'Update the account note or linked task so the next person can see what is happening.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Email Sync controls team visibility',
          text: 'When Email Sync is enabled for a company, qualifying team email threads can be visible through CRM. Turning it off keeps the company record but makes those threads private to their participants. Record access does not automatically give access to every mailbox.',
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
        'Use a company’s Files and Tasks tabs to find the work associated with that customer. A proposal, rollout plan, and follow-up task can be linked to the account while remaining the same items your team uses elsewhere.',
      sections: [
        {
          kind: 'facts',
          heading: 'How work connects to a record',
          items: [
            {
              title: 'Mentions',
              text: 'Mention the company or contact in the document, task, or discussion to create a reference.',
            },
            {
              title: 'Properties',
              text: 'Use a Companies or Contacts property when the item belongs to that relationship.',
            },
            {
              title: 'Email attachments',
              text: 'The company’s Files view can also include attachments from its email conversations.',
            },
          ],
        },
        {
          kind: 'steps',
          heading: 'Make the next step easy to find',
          items: [
            {
              title: 'Open the right tab',
              text: 'Use Files for supporting documents and Tasks for the work that still needs doing.',
            },
            {
              title: 'Open the original item',
              text: 'Read the document or update the task itself. The record is gathering references, so you are not editing a second copy.',
            },
            {
              title: 'Create follow-up work',
              text: 'Creating a task from the company’s Tasks tab connects it to the company, helping the team find it later.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Links do not widen access',
          text: 'Associating a file with a customer does not make it public or notify the customer. The item’s own sharing rules still apply.',
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
    {
      title: 'Customer notes',
      summary: 'Keep the account’s history in a shared discussion.',
      intro:
        'Every company and contact has a Discussion for team notes. Record decisions, questions, and customer details there so they remain attached to the relationship after the conversation moves on.',
      sections: [
        {
          kind: 'example',
          heading: 'A useful customer note',
          text: 'The team wants to test guest review before the rollout. Julia will send a sample this week, and we will review feedback on Friday.',
        },
        {
          kind: 'facts',
          heading: 'Use the discussion for',
          items: [
            {
              title: 'Decisions',
              text: 'Record what was agreed and any conditions attached to it. Link the email or call that explains the decision.',
            },
            {
              title: 'Handoffs',
              text: 'Explain the next step and who owns it. Mention a teammate when they need to pick up the conversation.',
            },
            {
              title: 'Questions',
              text: 'Ask a follow-up in the same thread so the answer stays beside the original note.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Make the history readable',
          paragraphs: [
            'Write enough for a teammate who was not on the call. Names, dates, and concrete decisions help more than a broad note such as “good meeting.”',
            'Use replies to continue a topic, and create a new note for a separate update. The record’s Discussion supports the same familiar thread and reaction pattern as other conversations in Macro.',
          ],
        },
        {
          kind: 'note',
          heading: 'Customer records are not public conversations',
          text: 'Mentioning a company creates a reference to its record. It does not invite the customer, notify its contacts, or change who can open the record.',
        },
      ],
      links: [
        {
          label: 'CRM discussions',
          href: 'https://docs.macro.com/product/crm',
        },
        {
          label: 'Mentions',
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
        'Give the agent the sales discussion or saved call and tell it which agreed changes to make. It can update account properties, add notes, or work with pipeline entries using the same records your team sees.',
      sections: [
        {
          kind: 'example',
          heading: 'Example request',
          text: 'Read this sales sync. Update the owners we explicitly agreed on, add the next steps to the company discussions, and list any stage changes that still need a decision.',
        },
        {
          kind: 'steps',
          heading: 'Keep the changes precise',
          items: [
            {
              title: 'Identify the source',
              text: 'Mention the call, notes, or channel thread. If it covers several accounts, make clear which customers are in scope.',
            },
            {
              title: 'Name the destination',
              text: 'Say whether you mean a company record or a deal in a named pipeline. Their stage and owner fields are independent.',
            },
            {
              title: 'Review the result',
              text: 'Open the affected records and check the changed fields. Read the added notes to make sure they reflect what was agreed.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Useful requests',
          items: [
            {
              title: 'Read first',
              text: 'Ask for a summary of proposed updates before changing records when the discussion was exploratory.',
            },
            {
              title: 'Make agreed changes',
              text: 'Give the agent explicit decisions, such as a new owner or a confirmed stage, when you want it to update the CRM.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Availability follows access',
          text: 'An agent can only work with the records and pipelines your account can access. Team settings and pipeline sharing still apply.',
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
        'MCP is a connection that lets an AI client use Macro’s tools. Connect it to work with your customer records and pipelines from a supported client, using your Macro account and its permissions.',
      sections: [
        {
          kind: 'steps',
          heading: 'Connect the client',
          items: [
            {
              title: 'Open Macro’s MCP setup',
              text: 'Go to Settings and find MCP server, or follow the client instructions in the setup guide.',
            },
            {
              title: 'Sign in to Macro',
              text: 'Complete the authorization flow from your client. The connection uses your account, so it can work with the information you are allowed to access.',
            },
            {
              title: 'Start with a specific request',
              text: 'Name the company or pipeline and say whether you want an answer or a change.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Examples of CRM work',
          items: [
            {
              title: 'Find and read',
              text: 'Find a company, read its contacts and notes, or ask which deals are in a particular pipeline stage.',
            },
            {
              title: 'Update a record',
              text: 'Set the company’s owner or other properties when you have decided what should change.',
            },
            {
              title: 'Manage a pipeline',
              text: 'Find entries, change their stage or owner, and review the result in Macro. Pipeline entries are separate from company properties.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'No second CRM copy',
          text: 'The tools read and change the Macro records. A change made through the connected client appears in the workspace your team uses.',
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
