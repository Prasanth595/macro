import { TabsInset } from '@core/component/TabsInset';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { Tabs } from '@ui';
import { type JSX, Show } from 'solid-js';

/** Consistent desktop view selection, preserving the touch tab treatment. */
export function HeaderViewTabs(props: {
  label: string;
  items: { value: string; label: string | JSX.Element }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Show
      when={!isTouchDevice()}
      fallback={
        <TabsInset
          class="shrink-0 whitespace-nowrap"
          aria-label={props.label}
          list={props.items}
          value={props.value}
          onChange={props.onChange}
        />
      }
    >
      <Tabs
        aria-label={props.label}
        variant="segmented"
        list={props.items.map((item) => ({
          value: item.value,
          label: () => item.label,
        }))}
        value={props.value}
        onChange={props.onChange}
        class="shrink-0 whitespace-nowrap"
        labelClass="px-3"
      />
    </Show>
  );
}
