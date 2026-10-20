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
      { feature: 'Video calls', macro: true, competitor: true },
      { feature: 'Recording playback', macro: true, competitor: true },
      {
        feature: 'Transcripts and AI summaries',
        macro: true,
        competitor: true,
      },
      {
        feature: 'Capture notes from other meeting apps',
        macro: false,
        competitor: false,
      },
    ],
    sources: [
      'https://docs.macro.com/product/calls',
      'https://docs.macro.com/product/agents',
      'https://support.google.com/meet/answer/9308681',
      'https://support.google.com/meet/answer/14754931',
      'https://support.google.com/meet/answer/16024610',
    ],
  },
  {
    id: 'granola',
    question: 'How does Macro compare with Granola?',
    competitor: 'Granola',
    rows: [
      { feature: 'Video calls', macro: true, competitor: false },
      { feature: 'Recording playback', macro: true, competitor: false },
      {
        feature: 'Transcripts and AI summaries',
        macro: true,
        competitor: true,
      },
      {
        feature: 'Capture notes from other meeting apps',
        macro: false,
        competitor: true,
      },
    ],
    sources: [
      'https://docs.granola.ai/help-center/feature-requests',
      'https://www.granola.ai/security',
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
