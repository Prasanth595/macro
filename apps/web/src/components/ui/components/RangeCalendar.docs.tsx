import { defineDoc } from '@app/features/ui-gallery/types';
import { createSignal } from 'solid-js';
import { type CalendarRange, RangeCalendar } from './Calendar';

// #region demo:range
function RangeDemo() {
  const [range, setRange] = createSignal<CalendarRange>({
    from: new Date(2030, 9, 30),
    to: new Date(2030, 10, 2),
  });
  return (
    <div class="w-full max-w-2xl rounded-2xl border border-edge bg-menu-glass p-4 glass">
      <RangeCalendar
        required
        fixedWeeks
        value={range()}
        onValueChange={setRange}
      />
      <div class="mt-4 border-t border-edge-muted pt-3">
        <span class="block text-xxs font-medium text-ink-muted">
          Selected range
        </span>
        <p class="mt-1 text-sm text-ink">
          {range().from?.toLocaleDateString() ?? 'Select a start date'} →{' '}
          {range().to?.toLocaleDateString() ?? 'Select an end date'}
        </p>
      </div>
    </div>
  );
}
// #endregion

export default defineDoc({
  name: 'RangeCalendar',
  category: 'Inputs',
  status: 'stable',
  description:
    'Connected month grids with shared range selection and keyboard navigation.',
  exports: ['RangeCalendar'],
  import: "import { RangeCalendar } from '@ui';",
  demos: [
    {
      id: 'range',
      title: 'Two connected months',
      render: RangeDemo,
      fill: true,
    },
  ],
});
