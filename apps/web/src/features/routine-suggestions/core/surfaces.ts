/**
 * The view sidebars that show routine suggestions. Each surface names the
 * part of Macro its suggestions automate; the projection prompt lists these
 * same keys, so a suggestion's `surface` is one of them.
 */
export const routineSurfaces = [
  'email',
  'calendar',
  'tasks',
  'files',
  'crm',
  'chat',
  'calls',
  'reviews',
  'agents',
] as const;

export type RoutineSurface = (typeof routineSurfaces)[number];

export type RoutineSurfaceCopy = {
  /** Names the surface in the modal title and filter chips. */
  label: string;
  /** Heads the surface's group where suggestions of every surface are listed. */
  groupLabel: string;
  /** The sidebar card's one-line pitch. */
  pitch: string;
  /** What the projection prompt should automate on this surface. */
  focus: string;
};

export const routineSurfaceCopy: Record<RoutineSurface, RoutineSurfaceCopy> = {
  email: {
    label: 'Email',
    groupLabel: 'Email automations',
    pitch: 'Let AI triage, tag, and follow up on your mail',
    focus:
      'Email: labeling and sorting incoming mail by what it is, flagging mail from important senders or about important topics, drafting replies, nudging the user about unanswered threads, and daily inbox digests.',
  },
  calendar: {
    label: 'Calendar',
    groupLabel: 'Calendar automations',
    pitch: 'Prep for meetings before they start',
    focus:
      'Calendar: meeting prep briefs, daily agenda summaries, protecting focus time, and follow-ups for upcoming events.',
  },
  tasks: {
    label: 'Tasks',
    groupLabel: 'Task automations',
    pitch: 'Keep tasks moving without the busywork',
    focus:
      'Tasks: creating follow-up tasks after calls, turning emailed requests into tasks, weekly task reviews, and nudges for overdue or stalled work.',
  },
  files: {
    label: 'Files',
    groupLabel: 'Document automations',
    pitch: 'Keep your documents organized and current',
    focus:
      'Files and documents: summarizing new documents, filing documents into projects, keeping recurring reports and notes up to date, and weekly document digests.',
  },
  crm: {
    label: 'CRM',
    groupLabel: 'CRM automations',
    pitch: 'Keep every company and deal in the right place',
    focus:
      'CRM: adding companies and contacts from email and calls, keeping pipeline stages accurate, double checking that every entry is in the right pipeline position, and flagging deals that went quiet.',
  },
  chat: {
    label: 'Chat',
    groupLabel: 'Chat automations',
    pitch: 'Never miss what matters in your channels',
    focus:
      'Chat and channels: daily channel digests, surfacing questions that need the user, and posting regular updates.',
  },
  calls: {
    label: 'Calls',
    groupLabel: 'Call automations',
    pitch: 'Turn every call into next steps',
    focus:
      'Calls: summarizing calls, extracting action items, creating follow-up tasks and emails at the end of every call, and logging call outcomes to the CRM.',
  },
  reviews: {
    label: 'Reviews',
    groupLabel: 'Code review automations',
    pitch: 'Stay on top of pull requests',
    focus:
      'Pull request reviews: daily digests of pull requests waiting on the user, reminders for stale reviews, and release summaries. Suggest these only when the workspace shows the user works with code; otherwise return none for this surface.',
  },
  agents: {
    label: 'Agents',
    groupLabel: 'Workspace automations',
    pitch: 'Put your recurring work on autopilot',
    focus:
      'Agents: cross-workspace automations that do not fit one surface, such as a morning briefing, a weekly review of priorities, research on a schedule, and end-of-week reports.',
  },
};
