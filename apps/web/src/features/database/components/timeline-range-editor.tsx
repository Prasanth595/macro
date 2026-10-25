import { fireAndForget } from '@core/util/fireAndForget';
import { PropertyDateRangeSelector } from '@property/editors/selectors/PropertyDateRangeSelector';
import { Dropdown } from '@ui/components/Dropdown';
import { createSignal } from 'solid-js';
import { type CellTimeRange, toCellTimeRange } from '../core/cell-date-range';
import type { DatabaseCellValue } from '../core/database-view';

/**
 * A record's time range picked beside its bar, as the grid's range cell
 * picks it. Each complete range saves as it is chosen.
 */
export function TimelineRangeEditor(props: {
  label: string;
  range: CellTimeRange | undefined;
  /** Where the picker opens: the bar's box when it was asked for. */
  anchor: DOMRect;
  onWrite: (value: DatabaseCellValue) => Promise<boolean>;
  /** Called once the picker has closed, to hand focus back. */
  onClose: () => void;
}) {
  const [open, setOpen] = createSignal(true);
  return (
    <Dropdown
      open={open()}
      onOpenChange={setOpen}
      getAnchorRect={() => props.anchor}
      placement="bottom-start"
    >
      <Dropdown.Content
        class="flex max-h-96 w-70 flex-col overflow-hidden p-0 text-sm"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          props.onClose();
        }}
      >
        <PropertyDateRangeSelector
          label={props.label}
          selectedRange={props.range ?? null}
          onSelectRange={(range) =>
            fireAndForget(
              props.onWrite(range ? toCellTimeRange(range) : null),
              'database'
            )
          }
          onClose={() => setOpen(false)}
        />
      </Dropdown.Content>
    </Dropdown>
  );
}
