import { defineDoc } from '@app/features/ui-gallery/types';
import { createSignal } from 'solid-js';
import { type CalendarRange, RangeCalendar } from './Calendar';

// #region demo:basic
function BasicDemo() {
  const [range, setRange] = createSignal<CalendarRange>({
    from: null,
    to: null,
  });
  const format = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const label = () => {
    const { from, to } = range();
    if (from && to) return `${format.format(from)} – ${format.format(to)}`;
    return from ? 'Pick an end day' : 'Pick a start day';
  };
  return (
    <div class="flex w-64 flex-col gap-2">
      <RangeCalendar value={range()} onValueChange={setRange} fixedWeeks />
      <span class="text-sm text-ink-muted">{label()}</span>
    </div>
  );
}
// #endregion

export default defineDoc({
  name: 'RangeCalendar',
  category: 'Inputs',
  description:
    'A calendar that picks a range of days: the first day picked starts it, the second ends it, in either order. The days between form one band with the ends as circles. Arrow keys move between days; Enter or Space picks. Pass `onPickDay` to decide which end a day sets, and `previewPick` to draw the band a hovered day would make.',
  status: 'stable',
  exports: ['RangeCalendar'],
  import: "import { RangeCalendar } from '@ui';",
  guidelines: {
    do: [
      'Show which end the next pick sets, and both ends once picked.',
      'Supply the calendar’s accessible name from the surrounding field.',
    ],
    dont: ['Use for a single day; use Calendar or DatePicker.'],
  },
  demos: [
    {
      id: 'basic',
      title: 'Pick a range',
      description:
        'Picking a third day starts a new range. Values are local days; time-zone conversion belongs to the caller.',
      render: BasicDemo,
    },
  ],
});
