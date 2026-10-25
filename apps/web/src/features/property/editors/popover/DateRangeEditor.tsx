import { fireAndForget } from '@core/util/fireAndForget';
import { Show } from 'solid-js';
import { useProperty } from '../../core/context';
import type { DateRangeProperty, DateRangeValue } from '../../types';
import { isDateRangeProperty } from '../../utils/typeGuards';
import { PropertyDateRangeSelector } from '../selectors/PropertyDateRangeSelector';
import { EditorPopover } from './EditorPopover';

/** Time range picker popover; saves every complete change, or a clear. */
export function DateRangeEditor() {
  const ctx = useProperty();
  const property = () => {
    const current = ctx.property();
    return isDateRangeProperty(current) ? current : undefined;
  };

  return (
    <Show when={ctx.editorOpen() && property()}>
      {(range) => <DateRangeEditorBody property={range()} />}
    </Show>
  );
}

function DateRangeEditorBody(props: { property: DateRangeProperty }) {
  const ctx = useProperty();

  const commit = async (range: DateRangeValue | null) => {
    try {
      await ctx.onSave?.(props.property, {
        valueType: 'DATE_RANGE',
        value: range,
      });
      ctx.onRefresh?.();
    } catch {
      // mutation onError owns toast
    }
  };

  return (
    <EditorPopover>
      <PropertyDateRangeSelector
        label={props.property.displayName}
        selectedRange={props.property.value}
        onSelectRange={(range) => {
          fireAndForget(commit(range), 'property-editor');
        }}
        onClose={() => ctx.closeEditor()}
      />
    </EditorPopover>
  );
}
