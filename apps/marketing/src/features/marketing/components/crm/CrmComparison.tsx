import {
  type ComparisonRow,
  ComparisonTable,
} from '../../../../app/components/sections/ComparisonTable';

import {
  ComparisonMacroLogo,
  FeatureComparisonKey,
} from '../comparisons/FeatureComparisons';

const comparisonRows: ComparisonRow[] = [
  {
    feature: 'Companies and contacts created from your email',
    cells: [true, false, 'partial', 'partial'],
  },
  {
    feature: 'Company descriptions filled in automatically',
    cells: [true, 'partial', true, true],
  },
  {
    feature: 'Threaded discussion on every company',
    cells: [true, 'partial', 'partial', false],
  },
  {
    feature: '@mention companies in docs, tasks, and chat',
    cells: [true, false, false, false],
  },
  {
    feature: 'Emails, calls, files, and tasks on the record',
    cells: [true, 'partial', 'partial', false],
  },
  {
    feature: 'Email, calls, docs, and tasks in the same app',
    cells: [true, 'partial', 'partial', false],
  },
  {
    feature: 'Agents can also read your email, calls, and docs',
    cells: [true, 'partial', 'partial', 'partial'],
  },
  {
    feature: 'One search across email, chat, docs, and customers',
    cells: [true, false, false, false],
  },
  { feature: 'Open source (AGPLv3)', cells: [true, false, false, false] },
];

export function CrmComparison() {
  return (
    <section class="feature-comparisons" aria-label="Compare CRM tools">
      <ComparisonTable
        columns={[
          { label: 'Macro', macro: true, icon: <ComparisonMacroLogo /> },
          { label: 'Salesforce' },
          { label: 'HubSpot' },
          { label: 'Attio' },
        ]}
        rows={comparisonRows}
        mobileCellWidth={100}
        mobileMinWidth={620}
        scrollLabel="Compare Macro"
      />
      <FeatureComparisonKey partial />
      <p class="feature-comparison-note">
        Availability varies by product and plan. See{' '}
        <a href="/pricing">Macro pricing</a> for current plans and limits.
      </p>
    </section>
  );
}
