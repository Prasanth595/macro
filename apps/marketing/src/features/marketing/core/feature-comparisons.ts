export type FeatureComparison = {
  id: string;
  question: string;
  competitor: string;
  rows: readonly {
    feature: string;
    macro: boolean | 'partial';
    competitor: boolean | 'partial';
    macroNote?: string;
    competitorNote?: string;
  }[];
  article?: { label: string; href: string };
  /** Evidence for maintainers; the public table stays compact. */
  sources: readonly string[];
};

export const emailComparisons: readonly FeatureComparison[] = [
  {
    id: 'superhuman',
    question: 'How does Macro compare with Superhuman Mail?',
    competitor: 'Superhuman Mail',
    rows: [
      {
        feature: 'Use your existing Gmail address',
        macro: true,
        competitor: true,
      },
      { feature: 'Keyboard shortcuts', macro: true, competitor: true },
      { feature: 'AI email drafting', macro: true, competitor: true },
      {
        feature: 'Share live threads without forwarding',
        macro: true,
        competitor: true,
      },
      {
        feature: 'Email, tasks, and chat in one inbox',
        macro: true,
        competitor: false,
      },
    ],
    article: {
      label: 'Macro vs. Superhuman',
      href: '/posts/superhuman-alternative',
    },
    sources: [
      'https://help.superhuman.com/hc/en-us/articles/46005777934733-Managing-Accounts',
      'https://help.superhuman.com/hc/en-us/articles/46005593675917-Shared-Conversations-and-Team-Comments',
      'https://help.superhuman.com/hc/en-us/articles/46005696690317-Superhuman-Mail-MCP-Server',
    ],
  },
  {
    id: 'gmail',
    question: 'How does Macro compare with Gmail?',
    competitor: 'Gmail',
    rows: [
      {
        feature: 'Use your existing Gmail address',
        macro: true,
        competitor: true,
      },
      { feature: 'Keyboard shortcuts', macro: true, competitor: true },
      { feature: 'AI email drafting', macro: true, competitor: true },
      {
        feature: 'Share live threads without forwarding',
        macro: true,
        competitor: false,
      },
      {
        feature: 'Email, tasks, and chat in one inbox',
        macro: true,
        competitor: false,
      },
    ],
    sources: [
      'https://support.google.com/mail/answer/6594',
      'https://support.google.com/mail/answer/14355636',
      'https://support.google.com/mail/answer/6115187',
      'https://support.google.com/mail/answer/138350',
    ],
  },
];

export const documentComparisons: readonly FeatureComparison[] = [
  {
    id: 'notion',
    question: 'How does Macro compare with Notion?',
    competitor: 'Notion',
    rows: [
      { feature: 'Live document collaboration', macro: true, competitor: true },
      {
        feature: 'Agents that create and edit docs',
        macro: true,
        competitor: true,
      },
      { feature: 'Markdown import and export', macro: true, competitor: true },
      { feature: 'Offline document editing', macro: true, competitor: true },
      {
        feature: 'Read live email beside a document',
        macro: true,
        competitor: false,
      },
    ],
    article: { label: 'Macro vs. Notion', href: '/posts/notion-alternative' },
    sources: [
      'https://www.notion.com/help/use-pages-offline',
      'https://www.notion.com/help/images-files-and-media',
      'https://www.notion.com/help/import-data-into-notion',
      'https://www.notion.com/help/export-your-content',
      'https://www.notion.com/help/create-a-subpage',
      'https://www.notion.com/help/notion-agent',
      'https://docs.macro.com/product/docs',
      'https://docs.macro.com/product/folders',
      'https://docs.macro.com/concepts/blocks',
    ],
  },
];

export const taskComparisons: readonly FeatureComparison[] = [
  {
    id: 'linear',
    question: 'How does Macro compare with Linear?',
    competitor: 'Linear',
    rows: [
      {
        feature: 'Status, priority, and assignees',
        macro: true,
        competitor: true,
      },
      { feature: 'Create tasks from email', macro: true, competitor: true },
      {
        feature: 'Update task status from GitHub',
        macro: true,
        competitor: true,
      },
      {
        feature: 'Built-in email and team chat',
        macro: true,
        competitor: false,
      },
    ],
    article: { label: 'Macro vs. Linear', href: '/posts/linear-alternative' },
    sources: [
      'https://linear.app/docs/creating-issues',
      'https://linear.app/docs/slack',
      'https://linear.app/docs/github',
    ],
  },
  {
    id: 'jira',
    question: 'How does Macro compare with Jira?',
    competitor: 'Jira',
    rows: [
      {
        feature: 'Status, priority, and assignees',
        macro: true,
        competitor: true,
      },
      { feature: 'Create tasks from email', macro: true, competitor: true },
      {
        feature: 'Update task status from GitHub',
        macro: true,
        competitor: true,
      },
      {
        feature: 'Built-in email and team chat',
        macro: true,
        competitor: false,
      },
    ],
    sources: [
      'https://support.atlassian.com/jira-cloud-administration/docs/create-issues-and-comments-from-email/',
      'https://support.atlassian.com/jira-cloud-administration/docs/integrate-with-github/',
      'https://support.atlassian.com/cloud-automation/docs/jira-automation-triggers/',
    ],
  },
];

export const chatComparisons: readonly FeatureComparison[] = [
  {
    id: 'slack',
    question: 'How does Macro compare with Slack?',
    competitor: 'Slack',
    rows: [
      {
        feature: 'Channels, threads, and reactions',
        macro: true,
        competitor: true,
      },
      {
        feature: 'Share docs and tasks with a channel',
        macro: true,
        competitor: true,
      },
      { feature: 'Video calls', macro: true, competitor: true },
      {
        feature: 'Agents that act on workspace content',
        macro: true,
        competitor: true,
      },
      {
        feature: 'Email, tasks, and chat in one inbox',
        macro: true,
        competitor: false,
      },
    ],
    article: { label: 'Macro vs. Slack', href: '/posts/slack-alternative' },
    sources: [
      'https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions-',
      'https://slack.com/help/articles/15678967614611-Manage-access-permissions-for-canvases-and-lists',
      'https://slack.com/help/articles/4402059015315-Use-huddles-in-Slack',
      'https://slack.com/help/articles/202026038-How-to-work-with-Slackbot',
    ],
  },
];

// Reviewed 2026-10-20 against the sources below and docs/agent-guide/crm.md.
// A partial reporting mark means agent-generated summaries, not dedicated dashboards.
// Connected workspace tools receive partial credit rather than a cross.
export const crmComparisons: readonly FeatureComparison[] = [
  {
    id: 'salesforce',
    question: 'How does Macro compare with Salesforce?',
    competitor: 'Salesforce',
    rows: [
      { feature: 'Company and contact records', macro: true, competitor: true },
      {
        feature: 'Sales pipelines and board views',
        macro: true,
        competitor: true,
      },
      { feature: 'Custom fields', macro: true, competitor: true },
      {
        feature: 'Email history on customer records',
        macro: true,
        competitor: true,
      },
      {
        feature: 'Email, chat, and docs alongside CRM',
        macro: true,
        competitor: 'partial',
        competitorNote:
          'Available through connected collaboration tools rather than one built-in workspace.',
      },
      {
        feature: 'Sales reporting',
        macro: 'partial',
        macroNote:
          'Agent-generated pipeline summaries; no dedicated sales reporting dashboard.',
        competitor: true,
      },
    ],
    sources: [
      'https://www.salesforce.com/sales/cloud/guide/',
      'https://help.salesforce.com/s/articleView?id=sf.collaboration_admin_welcome.htm&language=en_US&type=5',
      'https://trailhead.salesforce.com/content/learn/projects/customize-a-sales-path-for-your-team/work-with-opportunities-in-the-kanban-view',
      'https://help.salesforce.com/s/articleView?id=xcloud.lex_pro_tips_activity_timeline.htm&language=en_US&type=5',
    ],
  },
  {
    id: 'hubspot',
    question: 'How does Macro compare with HubSpot?',
    competitor: 'HubSpot',
    rows: [
      { feature: 'Company and contact records', macro: true, competitor: true },
      {
        feature: 'Sales pipelines and board views',
        macro: true,
        competitor: true,
      },
      { feature: 'Custom fields', macro: true, competitor: true },
      {
        feature: 'Email history on customer records',
        macro: true,
        competitor: true,
      },
      {
        feature: 'Email, chat, and docs alongside CRM',
        macro: true,
        competitor: 'partial',
        competitorNote:
          'Available through connected collaboration tools rather than one built-in workspace.',
      },
      {
        feature: 'Sales reporting',
        macro: 'partial',
        macroNote:
          'Agent-generated pipeline summaries; no dedicated sales reporting dashboard.',
        competitor: true,
      },
    ],
    sources: [
      'https://knowledge.hubspot.com/object-settings/select-properties-to-show-on-records-in-board-view',
      'https://www.hubspot.com/products/email-integration',
      'https://www.hubspot.com/products/sales/sales-reports',
      'https://knowledge.hubspot.com/integrations/connect-google-drive-to-hubspot',
    ],
  },
  {
    id: 'attio',
    question: 'How does Macro compare with Attio?',
    competitor: 'Attio',
    rows: [
      { feature: 'Company and contact records', macro: true, competitor: true },
      {
        feature: 'Sales pipelines and board views',
        macro: true,
        competitor: true,
      },
      { feature: 'Custom fields', macro: true, competitor: true },
      {
        feature: 'Email history on customer records',
        macro: true,
        competitor: true,
      },
      {
        feature: 'Email, chat, and docs alongside CRM',
        macro: true,
        competitor: 'partial',
        competitorNote:
          'Available through connected collaboration tools rather than one built-in workspace.',
      },
      {
        feature: 'Sales reporting',
        macro: 'partial',
        macroNote:
          'Agent-generated pipeline summaries; no dedicated sales reporting dashboard.',
        competitor: true,
      },
    ],
    sources: [
      'https://attio.com/help/reference/managing-your-data/attributes/create-manage-attributes',
      'https://attio.com/help/academy/introduction/reports',
      'https://attio.com/help/reference/apps/communication-apps/slack-app',
      'https://attio.com/help/reference/apps/data-and-enrichment-apps/notion-app',
    ],
  },
];
