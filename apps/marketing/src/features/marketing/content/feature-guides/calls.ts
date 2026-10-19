import type { ProductFeatureDetail } from '../../core/product-feature-guide';

// Sources: apps/docs/product/calls.mdx, search, agents and permissions;
// guest/channel-link distinction, transcript seeking and team sharing:
// docs/agent-guide/calls.md and channel/Call in apps/web, c5cba006.
export const callsGuides = {
  'call-start': [
    {
      title: 'Call from a channel',
      summary: 'Talk with the people already in the conversation.',
      intro:
        'Start a call from the channel when a discussion is easier to resolve out loud. The channel provides the group and the surrounding work, so you can move from messages to a live conversation.',
      sections: [
        {
          kind: 'steps',
          heading: 'Start the conversation',
          items: [
            {
              title: 'Open the channel',
              text: 'Choose the conversation with the people you want to call. Use its call control to begin.',
            },
            {
              title: 'Check your devices',
              text: 'Set your microphone and camera before joining. Joining is a deliberate action; opening the setup screen does not start sharing your audio or video.',
            },
            {
              title: 'Talk and work together',
              text: 'Use the call controls for audio, video, and screen sharing. Keep the relevant documents and tasks available while you discuss them.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'After the call',
          items: [
            {
              title: 'Saved record',
              text: 'When processing is complete, the call record gives you the recording, transcript, and summary.',
            },
            {
              title: 'Channel history',
              text: 'Find the channel’s recordings from its Calls tab so the meeting stays connected to the conversation.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Check sharing before the discussion',
          text: 'Channel calls default to sharing with the team. Review Share with team in the call controls if the saved conversation should have a narrower audience.',
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
      title: 'Call from a DM',
      summary: 'Move a one-to-one conversation into a call.',
      intro:
        'When a direct message needs a quick explanation, start a call with that person. You can talk through a document or decision and return to the written conversation afterward.',
      sections: [
        {
          kind: 'steps',
          heading: 'Start from the conversation',
          items: [
            {
              title: 'Open the DM',
              text: 'Use the direct conversation with the person you want to call, then select the call control.',
            },
            {
              title: 'Join when ready',
              text: 'Check your microphone and camera in setup. The call starts when you choose to join or start it.',
            },
            {
              title: 'Use the right medium',
              text: 'Talk through the question, share your screen if needed, and record a clear next step in the relevant task or document.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'A good reason for a quick call',
          text: 'Can we look at the training slides together? I want to check the order before updating the plan.',
        },
        {
          kind: 'text',
          heading: 'Find the conversation afterward',
          paragraphs: [
            'The saved call can provide a recording and transcript once processing finishes. Use it when you need to check a detail or ask an agent to help with the follow-up.',
          ],
        },
        {
          kind: 'note',
          heading: 'A DM does not imply a private recording',
          text: 'Check the call’s sharing setting. The audience for a saved call can include the team when team sharing is enabled, even if only two people were in the live conversation.',
        },
      ],
      links: [
        {
          label: 'Starting a call',
          href: 'https://docs.macro.com/product/calls',
        },
        {
          label: 'Recording access',
          href: 'https://docs.macro.com/permissions',
        },
      ],
    },
    {
      title: 'Invite someone outside Macro',
      summary: 'Use a meeting link for a customer or guest.',
      intro:
        'Use a standalone Macro meeting link when someone without a Macro account needs to join. They can enter their name, choose their devices, and join the call without joining your workspace.',
      sections: [
        {
          kind: 'steps',
          heading: 'Prepare a guest call',
          items: [
            {
              title: 'Create the meeting',
              text: 'Use the available instant-call or calendar meeting flow and obtain its shareable meeting link.',
            },
            {
              title: 'Send the right link',
              text: 'Use the standalone meeting link for a guest. A link to a channel call may require a signed-in Macro account.',
            },
            {
              title: 'Let the guest join',
              text: 'The guest enters a name, checks microphone and camera settings, then chooses Join call. Merely opening the page does not join them automatically.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'What a guest can access',
          items: [
            {
              title: 'During the call',
              text: 'The meeting room and its live text discussion.',
            },
            {
              title: 'Your workspace',
              text: 'Joining does not give the guest access to the channel, files, or other work in Macro.',
            },
            {
              title: 'After the call',
              text: 'The invitation does not automatically grant anonymous access to saved recordings and transcripts. Review sharing separately if the guest needs a follow-up.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Use the options available in your workspace',
          text: 'Meeting-link features are being rolled out. If the relevant call-link controls are unavailable, check the current Calls setup guide.',
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
      intro:
        'Find a saved call by its name or the words spoken in it. Open the transcript to check the decision before asking an agent to draft a follow-up or change a plan.',
      sections: [
        {
          kind: 'steps',
          heading: 'Find the source',
          items: [
            {
              title: 'Start in Calls',
              text: 'Search the Calls view when you know it was a meeting. A channel’s Calls tab narrows the list to that conversation.',
            },
            {
              title: 'Search the wording',
              text: 'Use workspace search when you remember a phrase or subject from the transcript. The source may be easier to find by its contents than its title.',
            },
            {
              title: 'Confirm the meeting',
              text: 'Check the name, participants, and date before using it as the basis for a change.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'Ask an agent to find it',
          text: 'Find the call where we agreed on the revised training schedule. Tell me the dates and link the source.',
        },
        {
          kind: 'facts',
          heading: 'Choose how much detail to read',
          items: [
            {
              title: 'Summary',
              text: 'Start with the main points when you need a quick reminder.',
            },
            {
              title: 'Transcript',
              text: 'Read the actual exchange when the decision needs more explanation.',
            },
            {
              title: 'Recording',
              text: 'Replay the relevant moment when you need to hear what was said.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Wait for the saved material',
          text: 'Transcription and summary generation happen after the call. A newly finished meeting may need processing time before every part is available.',
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
        'Use a saved call as the source for a document or task update. An agent can read the transcript and make the changes you request, so the meeting’s decisions reach the work your team uses.',
      sections: [
        {
          kind: 'example',
          heading: 'Example request',
          text: 'Read the rollout check-in and update the training plan with the dates we agreed. Add a checklist for the remaining work, and leave uncertain details for me to review.',
        },
        {
          kind: 'steps',
          heading: 'Make the follow-up clear',
          items: [
            {
              title: 'Point to the call and file',
              text: 'Mention the saved meeting and the document or task that needs changing.',
            },
            {
              title: 'Describe the result',
              text: 'Say which decisions should become edits. Ask for a draft or proposed list first when the discussion did not reach a clear conclusion.',
            },
            {
              title: 'Review the update',
              text: 'Open the changed file. Check dates, owners, and commitments against the transcript before relying on them.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Useful outcomes',
          items: [
            {
              title: 'Updated plan',
              text: 'Revise the shared document with the agreed sequence, requirements, or dates.',
            },
            {
              title: 'Follow-up tasks',
              text: 'Give each action an owner and a clear outcome so it can be tracked after the meeting.',
            },
            {
              title: 'Customer draft',
              text: 'Prepare an email recap from the call, then review the recipients and wording before sending.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Separate decisions from suggestions',
          text: 'A transcript can contain ideas that were considered and rejected. Tell the agent to use confirmed decisions and flag anything that remains unresolved.',
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
      title: 'Replay the recording',
      summary: 'Hear the original conversation when the details matter.',
      intro:
        'Open the saved call to replay the conversation. A recording is useful when a summary misses an important qualification or you want to hear the exact explanation behind a decision.',
      sections: [
        {
          kind: 'steps',
          heading: 'Go back to the moment',
          items: [
            {
              title: 'Open the saved call',
              text: 'Find it in Calls or the channel’s call history. Check the date and participants to confirm the meeting.',
            },
            {
              title: 'Use the transcript',
              text: 'Find the relevant line and select it to jump to that moment in the recording.',
            },
            {
              title: 'Read around it',
              text: 'Listen to the surrounding exchange before treating one sentence as the final decision.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'Use the right view',
          items: [
            {
              title: 'Summary',
              text: 'A quick introduction to the meeting’s main points.',
            },
            {
              title: 'Transcript',
              text: 'A readable account of what was said, with a route to specific moments.',
            },
            {
              title: 'Recording',
              text: 'The original audio and video, useful when tone or a demonstration matters.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Sharing controls who can replay',
          text: 'The call’s access settings govern its saved material. Review team sharing when the recording should have a limited audience.',
        },
        {
          kind: 'note',
          heading: 'Recording is visible to participants',
          text: 'The call interface shows a recording and transcription notice. Check the call settings and audience before discussing material that should not be shared with the team.',
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
      title: 'Read the transcript',
      summary: 'Find what was said without replaying the whole meeting.',
      intro:
        'A saved transcript turns the meeting into text you can read and search. Scan for the decision you need, then jump to the recording if you want to hear that part of the conversation.',
      sections: [
        {
          kind: 'facts',
          heading: 'What you can do',
          items: [
            {
              title: 'Read',
              text: 'Follow the conversation in text when you do not need to watch the whole recording.',
            },
            {
              title: 'Find a phrase',
              text: 'Search for the customer, topic, or wording you remember. Transcript content is included in Macro’s search.',
            },
            {
              title: 'Jump to a moment',
              text: 'Select a transcript line to move the recording to that point.',
            },
            {
              title: 'Ask a question',
              text: 'Give the saved call to an agent when you need a summary or a follow-up based on the discussion.',
            },
          ],
        },
        {
          kind: 'example',
          heading: 'Example question',
          text: 'What did we agree about the training dates in this call? Include the source so I can check the answer.',
        },
        {
          kind: 'text',
          heading: 'Use the transcript as evidence',
          paragraphs: [
            'Read the surrounding exchange when a decision matters. Transcripts can mishear names or technical terms, so replay the recording if the wording looks uncertain.',
          ],
        },
        {
          kind: 'note',
          heading: 'Access follows the call',
          text: 'The transcript is part of the saved call. Sharing a meeting link for guests does not automatically make the saved transcript public.',
        },
      ],
      links: [
        {
          label: 'Call transcripts',
          href: 'https://docs.macro.com/product/calls',
        },
        {
          label: 'Searching across Macro',
          href: 'https://docs.macro.com/product/search',
        },
      ],
    },
    {
      title: 'Start with the summary',
      summary: 'Review the main points before reading the full conversation.',
      intro:
        'After the call, Macro generates a summary alongside the saved recording and transcript. Use it to get oriented, then go back to the source when a decision needs a closer look.',
      sections: [
        {
          kind: 'steps',
          heading: 'Catch up efficiently',
          items: [
            {
              title: 'Read the overview',
              text: 'Start with the summary to understand the topics discussed and the main outcomes.',
            },
            {
              title: 'Check the details that affect your work',
              text: 'Open the transcript for dates, names, or commitments you need to rely on. Replay the relevant moment if the wording is unclear.',
            },
            {
              title: 'Turn decisions into follow-up',
              text: 'Update the plan or create tasks for the actions the team agreed to. A summary alone does not assign the work.',
            },
          ],
        },
        {
          kind: 'facts',
          heading: 'A summary is useful for',
          items: [
            {
              title: 'Returning to a project',
              text: 'Refresh your memory before the next meeting.',
            },
            {
              title: 'Catching up after an absence',
              text: 'Understand the discussion before asking the team to repeat it.',
            },
            {
              title: 'Preparing a follow-up',
              text: 'Give an agent the saved call and ask for a draft that reflects the agreed decisions.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Keep the source available',
          text: 'An AI summary is a condensed interpretation of the call. The transcript and recording remain the place to check what was actually said, especially when the summary leaves out a qualification.',
        },
      ],
      links: [
        {
          label: 'Call summaries',
          href: 'https://docs.macro.com/product/calls',
        },
        {
          label: 'Agent follow-up',
          href: 'https://docs.macro.com/product/agents',
        },
      ],
    },
    {
      title: 'Share with a teammate',
      summary: 'Give someone a way to catch up on the meeting.',
      intro:
        'Share the saved call when a teammate needs the recording, transcript, or summary. They can catch up on the discussion and open the supporting work without asking everyone to repeat the meeting.',
      sections: [
        {
          kind: 'facts',
          heading: 'Check the call’s audience',
          items: [
            {
              title: 'Team sharing',
              text: 'When enabled, members of the creator’s team can open the saved call and find it in Calls and search.',
            },
            {
              title: 'Participants',
              text: 'Signed-in participants keep direct access to their saved call, even when broader team sharing is disabled.',
            },
            {
              title: 'Guests',
              text: 'Joining through a guest meeting link does not automatically provide anonymous access to the saved recording.',
            },
          ],
        },
        {
          kind: 'steps',
          heading: 'Make the handoff useful',
          items: [
            {
              title: 'Review access',
              text: 'Check Share with team or the saved call’s sharing controls. Channel calls default to team sharing; confirm the setting for the specific call.',
            },
            {
              title: 'Send the reference',
              text: 'Share the call with a short note explaining what the teammate should read or watch.',
            },
            {
              title: 'Name the next step',
              text: 'Mention the task or document they should work on after catching up.',
            },
          ],
        },
        {
          kind: 'note',
          heading: 'Private means more than absent from a channel',
          text: 'If a call should not be visible to the wider team, check the actual saved-call access settings. The list of live participants alone does not determine its later audience.',
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
