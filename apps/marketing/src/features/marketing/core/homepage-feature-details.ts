/** Public feature explanations grounded in the product pages and their demos. */
export type HomepageFeatureDetail = {
  title: string;
  text: string;
  body: string;
  example: string;
};

export const homepageFeatureDetails = {
  email: [
    {
      title: 'Share an email in chat',
      text: 'Let your team work from the same email thread.',
      body: 'Share the thread, then mention it in a channel. Teammates with access can open the conversation and see later replies, without forwarding another copy.',
      example:
        'A customer asks to change the rollout date. Share the thread in your launch channel so the team can agree on a reply.',
    },
    {
      title: 'Draft from your work',
      text: 'Give Macro the context behind the reply.',
      body: 'Ask the agent to use an email, call, or document available to it. Review the draft, change anything you need, and send it when it is ready.',
      example:
        '“Draft a follow-up from this call. Include the rollout plan and the next steps we agreed on.”',
    },
    {
      title: 'Keep replies together',
      text: 'Keep the discussion attached to the message that started it.',
      body: 'Replies sit in a thread below the original message. Add reactions, mention teammates, and bring in the documents or tasks the discussion needs.',
      example:
        'Discuss a customer’s pricing question in one thread while the rest of the channel keeps moving.',
    },
    {
      title: 'Find the context',
      text: 'Open the source instead of asking someone to explain it again.',
      body: 'Mention an email, document, or task in the conversation. The reference opens the workspace item, so you can read the details and return to the discussion.',
      example:
        'A teammate asks why the deadline changed. Open the linked plan and customer thread from the message.',
    },
  ],
  documents: [
    {
      title: 'Write together',
      text: 'One document for your team and your agents.',
      body: 'See edits as they happen, even when people work in the same paragraph. Comment on specific text to keep feedback next to the part it concerns.',
      example:
        'One person updates the launch plan while another adds the checklist. An agent helps revise the introduction in the same document.',
    },
    {
      title: 'Turn decisions into tasks',
      text: 'Give a request a place to get done.',
      body: 'Create a task from a message and assign it to someone. Mention the relevant document inside the task so the owner has the plan and the request together.',
      example:
        '“Update the pricing page” becomes an assigned task linked to the website brief.',
    },
    {
      title: 'Keep track of changes',
      text: 'See how a document reached its current version.',
      body: 'Browse earlier versions and follow edits from people and agents. When you need an earlier draft, you can make a new copy from that version.',
      example:
        'Compare the proposal before and after a customer review without searching for an old attachment.',
    },
    {
      title: 'Give every task an owner',
      text: 'Make the next step clear.',
      body: 'Set an assignee, status, and priority. My Tasks shows your assignments; Created by me helps you follow the work you have asked others to do.',
      example:
        'Assign the announcement to Julia and the signup check to Teo, with both tasks linked to the launch plan.',
    },
  ],
  agents: [
    {
      title: 'Start from a conversation',
      text: 'Hand off the task where the team is already talking about it.',
      body: 'Mention an agent and include the task or source material it needs. The request stays in the conversation, so your teammates can follow the handoff.',
      example:
        '“Investigate the failing deploy and open a pull request with a fix. The error log is in this thread.”',
    },
    {
      title: 'Follow the work',
      text: 'See what the agent is doing, not just its final answer.',
      body: 'Open the agent session to read its progress and tool calls. Use that context to check the approach or give the agent a follow-up instruction.',
      example:
        'See which files the agent read and which checks it ran before reviewing the fix.',
    },
    {
      title: 'Review the changes',
      text: 'Read the work before it lands.',
      body: 'Open the linked pull request to inspect the diff. Keep the review connected to the agent session and the conversation that explains the change.',
      example:
        'Check the fix for a flaky deploy, ask for one adjustment, then review the updated pull request.',
    },
    {
      title: 'Keep the result connected',
      text: 'Follow the task from the original request to the finished change.',
      body: 'The linked pull request gives the task a concrete result. When that pull request is merged, Macro can mark the associated task done.',
      example:
        'A merged invite-flow fix closes its linked task, so the team does not have to update the status again.',
    },
  ],
  spreadsheet: [
    {
      title: 'Work in the same sheet',
      text: 'Keep a shared list current without passing files around.',
      body: 'Work together in the same spreadsheet. Update rows, use formulas, and keep the information your team needs in one workspace item.',
      example:
        'Sales and support maintain the same customer follow-up list instead of separate exports.',
    },
    {
      title: 'Bring your data along',
      text: 'Start with the records you already have.',
      body: 'Use CSV import to bring existing records into a database. Review the columns and keep working with the imported data in Macro.',
      example:
        'Bring an existing account list into a pipeline, then add owners and stages as your team works through it.',
    },
    {
      title: 'Ask an agent to help',
      text: 'Let an agent help assemble the information.',
      body: 'Tell the agent which sources to use and what you want in the sheet. It can gather information and update the data alongside your team.',
      example:
        '“Find the most active accounts this month and put them in a follow-up list with the account owner.”',
    },
    {
      title: 'Connect data to the work',
      text: 'Keep the list close to the conversation about it.',
      body: 'Mention the spreadsheet in a channel or document. Teammates can open the shared item from the discussion instead of working from a pasted snapshot.',
      example:
        'Link the customer follow-up list in the sales channel so the team can discuss and update the same rows.',
    },
  ],
  crm: [
    {
      title: 'Start with your email',
      text: 'Build your CRM from the people your team talks to.',
      body: 'When your team emails someone at a new company domain, Macro creates the contact and company record. Personal addresses such as Gmail do not create companies.',
      example:
        'A new customer conversation gives the team a company record to build on, before anyone starts filling in the pipeline.',
    },
    {
      title: 'See the full relationship',
      text: 'Open a company and see the work behind the deal.',
      body: 'Find its emails, calls, files, and team discussion in the record. Keep questions and decisions with the customer instead of scattered across separate conversations.',
      example:
        'Before a follow-up call, read the last email, open the rollout plan, and check what your teammate promised.',
    },
    {
      title: 'Keep the pipeline current',
      text: 'Move deals forward as the conversation changes.',
      body: 'Use a pipeline to track the stage, owner, and value of a deal. Move a card to another stage or ask an agent to update the CRM from the context you provide.',
      example:
        'After a sales call, ask Macro to move the account to Proposal and assign the follow-up to its owner.',
    },
    {
      title: 'Follow up with context',
      text: 'Write the next message from what actually happened.',
      body: 'Ask Macro to draft from the customer’s email, call notes, and linked documents. Review the message before sending it.',
      example:
        '“Write a follow-up with the rollout dates we discussed and a link to the proposal.”',
    },
  ],
} as const satisfies Record<string, readonly HomepageFeatureDetail[]>;
