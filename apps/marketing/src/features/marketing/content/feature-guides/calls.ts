import type { ProductFeatureDetail } from '../../core/product-feature-guide';

// Sources: apps/docs/product/calls.mdx, search, agents and permissions;
// guest/channel-link distinction, transcript seeking and team sharing:
// docs/agent-guide/calls.md and channel/Call in apps/web, c5cba006.
export const callsGuides = {
  'call-start': [
    {
      title: 'Call from a conversation',
      summary: 'Start a call with the people in your channel or DM.',
      intro:
        'Start a call from a channel or direct message when a conversation is easier to resolve out loud.',
      sections: [
        {
          kind: 'steps',
          heading: 'Start a call',
          items: [
            {
              title: 'Open the conversation',
              text: 'Choose the call control in the channel or DM.',
            },
            {
              title: 'Check your devices',
              text: 'Set the microphone and camera, then choose to join. Opening setup does not share audio or video.',
            },
            {
              title: 'Talk and share',
              text: 'Use the call controls for audio, video, and screen sharing.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Check the saved call’s audience',
          text: 'Channel calls default to team sharing. Review Share with team before the discussion; a two-person call does not necessarily have a private recording.',
        },
      ],
      links: [
        {
          label: 'Calls',
          href: 'https://docs.macro.com/product/calls',
        },
        {
          label: 'Call sharing',
          href: 'https://docs.macro.com/permissions',
        },
      ],
    },
    {
      title: 'Invite someone outside Macro',
      summary: 'Use a meeting link for a customer or guest.',
      intro:
        'Use a standalone meeting link for a guest who does not have a Macro account.',
      sections: [
        {
          kind: 'steps',
          heading: 'Invite a guest',
          items: [
            {
              title: 'Create a meeting link',
              text: 'Use the available instant-call or calendar meeting flow. Channel call links may require sign-in.',
            },
            {
              title: 'Send the link',
              text: 'Guests enter their name, check their devices, and choose Join call.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Guest access',
          text: 'The link gives access to the call and its live text discussion, not your workspace or saved recordings.',
        },
        {
          kind: 'note',
          heading: 'Availability',
          text: 'Meeting links are being rolled out. Check the Calls setup guide if these controls are not available.',
        },
      ],
      links: [
        {
          label: 'Calls and meeting setup',
          href: 'https://docs.macro.com/product/calls',
        },
        {
          label: 'Sharing rules',
          href: 'https://docs.macro.com/permissions',
        },
      ],
    },
  ],
  'call-followup': [
    {
      title: 'Find the right call',
      summary: 'Get back to the meeting where a decision was made.',
      intro: 'Find a saved meeting by its name or the words spoken in it.',
      sections: [
        {
          kind: 'facts',
          heading: 'Where to look',
          items: [
            {
              title: 'Calls',
              text: 'Browse your saved meetings or use a channel’s Calls tab to narrow the list.',
            },
            {
              title: 'Workspace search',
              text: 'Search for a phrase or subject from the transcript.',
            },
          ],
        },
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Find the call where we agreed on the training schedule. Tell me the dates and link the source.',
        },
        {
          kind: 'note',
          heading: 'After a call',
          text: 'Transcripts and summaries need time to process before they are available.',
        },
      ],
      links: [
        {
          label: 'Calls',
          href: 'https://docs.macro.com/product/calls',
        },
        {
          label: 'Transcript search',
          href: 'https://docs.macro.com/product/search',
        },
      ],
    },
    {
      title: 'Apply the agreed changes',
      summary: 'Turn meeting decisions into updates to the actual work.',
      intro:
        'Give an agent a saved call and ask it to update the plan, create tasks, or draft a follow-up.',
      sections: [
        {
          kind: 'prompt',
          heading: 'Example prompt',
          text: 'Read the rollout check-in and update the training plan with the dates we agreed. Add a checklist for the remaining work and flag anything undecided.',
        },
        {
          kind: 'text',
          heading: 'Review the update',
          paragraphs: [
            'Mention both the call and the item to change. Check dates, owners, and commitments in the result against the transcript.',
          ],
        },
      ],
      links: [
        {
          label: 'Agents and call context',
          href: 'https://docs.macro.com/product/agents',
        },
        {
          label: 'Calls',
          href: 'https://docs.macro.com/product/calls',
        },
      ],
    },
  ],
  'call-default': [
    {
      title: 'Recording and transcript',
      summary: 'Read the summary, search what was said, or replay a moment.',
      intro:
        'Open a saved call to read the summary, search the transcript, or replay the recording.',
      sections: [
        {
          kind: 'facts',
          heading: 'Choose how to catch up',
          items: [
            {
              title: 'Summary',
              text: 'Read the main topics and outcomes first.',
            },
            {
              title: 'Transcript',
              text: 'Find a phrase or read the discussion in text. Select a line to jump to that moment in the recording.',
            },
            {
              title: 'Recording',
              text: 'Hear the exact wording or watch a demonstration. Replay unclear names or technical terms.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Saved-call access',
          text: 'Sharing settings apply to the recording and transcript. A guest meeting link does not make them public.',
        },
      ],
      links: [
        {
          label: 'Recordings and transcripts',
          href: 'https://docs.macro.com/product/calls',
        },
        {
          label: 'Call permissions',
          href: 'https://docs.macro.com/permissions',
        },
      ],
    },
    {
      title: 'Share with a teammate',
      summary: 'Give someone a way to catch up on the meeting.',
      intro:
        'Share the saved call so a teammate can catch up from its recording, transcript, or summary.',
      sections: [
        {
          kind: 'facts',
          heading: 'Who can open it',
          items: [
            {
              title: 'Team sharing',
              text: 'When enabled, members of the creator’s team can find and open the saved call.',
            },
            {
              title: 'Participants',
              text: 'Signed-in participants retain direct access when wider team sharing is disabled.',
            },
            {
              title: 'Guests',
              text: 'A guest meeting link does not automatically give access to the saved recording.',
            },
          ],
        },
        {
          kind: 'text',
          heading: 'Send a useful reference',
          paragraphs: [
            'Check the call’s sharing settings, then send the link with the part to read or watch and any task that follows.',
          ],
        },
      ],
      links: [
        {
          label: 'Call sharing',
          href: 'https://docs.macro.com/permissions',
        },
        {
          label: 'Calls',
          href: 'https://docs.macro.com/product/calls',
        },
      ],
    },
  ],
} satisfies Record<string, readonly ProductFeatureDetail[]>;
