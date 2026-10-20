import type { FeatureComparison } from '../../core/feature-comparisons';
import { FeatureComparisons } from '../comparisons/FeatureComparisons';

// Availability includes paid plans; Granola complements existing meeting apps.
// Granola explicitly rules out audio/video playback in its feature-request docs.
const comparisons: readonly FeatureComparison[] = [
  {
    id: 'google-meet',
    question: 'How does Macro compare with Google Meet?',
    competitor: 'Google Meet',
    rows: [
      {
        feature: 'Recorded calls with searchable transcripts',
        macro: true,
        competitor: true,
      },
      { feature: 'Ask AI about past meetings', macro: true, competitor: true },
      {
        feature: 'Create tasks and email drafts from a call',
        macro: true,
        competitor: true,
      },
      {
        feature: 'Built-in CRM for customer follow-ups',
        macro: true,
        competitor: 'partial',
        competitorNote:
          'Customer records and pipeline follow-ups use a connected CRM alongside Google Workspace.',
      },
      {
        feature: 'Capture notes in other meeting apps',
        macro: false,
        competitor: false,
      },
    ],
    sources: [
      'https://docs.macro.com/product/calls',
      'https://docs.macro.com/product/agents',
      'https://support.google.com/meet/answer/9308681',
      'https://support.google.com/meet/answer/18481437',
      'https://support.google.com/meet/answer/14754931',
      'https://support.google.com/meet/answer/16024610',
    ],
  },
  {
    id: 'granola',
    question: 'How does Macro compare with Granola?',
    competitor: 'Granola',
    rows: [
      {
        feature: 'Recorded calls with searchable transcripts',
        macro: true,
        competitor: 'partial',
        competitorNote:
          'Granola transcribes meetings and keeps notes, but does not retain audio or video recordings for playback.',
      },
      { feature: 'Ask AI about past meetings', macro: true, competitor: true },
      {
        feature: 'Create tasks and email drafts from a call',
        macro: true,
        competitor: 'partial',
        competitorNote:
          'Granola supplies meeting context through MCP and integrations; tasks and email drafts are created in connected tools.',
      },
      {
        feature: 'Built-in CRM for customer follow-ups',
        macro: true,
        competitor: 'partial',
        competitorNote:
          'Granola sends meeting context to connected CRMs such as Attio and HubSpot; it is not itself a CRM.',
      },
      {
        feature: 'Capture notes in other meeting apps',
        macro: false,
        competitor: true,
      },
    ],
    sources: [
      'https://docs.granola.ai/help-center/feature-requests',
      'https://www.granola.ai/security',
      'https://www.granola.ai/mcp',
      'https://www.granola.ai/integrations',
      'https://docs.granola.ai/help-center/consent-security-privacy/security-privacy-data-faqs',
      'https://docs.granola.ai/help-center/sharing/integrations/mcp',
    ],
  },
];

export function CallsComparison() {
  return (
    <FeatureComparisons
      title="Compare Meeting Tools"
      comparisons={comparisons}
    />
  );
}
