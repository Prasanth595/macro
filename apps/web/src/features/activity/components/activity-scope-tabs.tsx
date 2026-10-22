import { PillTabs } from '@components/app/mobile/PillTabs';
import { TabsInset } from '@core/component/TabsInset';
import type { ActivityScope } from '../core/event';

const SCOPE_TABS: { value: ActivityScope; label: string }[] = [
  { value: 'mine', label: 'You' },
  { value: 'team', label: 'Team' },
];

/** The You / Team switch, as inset tabs beside the split header title. */
export function ActivityScopeTabs(props: {
  value: ActivityScope;
  onChange: (scope: ActivityScope) => void;
}) {
  return (
    <TabsInset
      aria-label="Whose activity"
      list={SCOPE_TABS}
      value={props.value}
      onChange={(value) => {
        const tab = SCOPE_TABS.find((item) => item.value === value);
        if (tab) props.onChange(tab.value);
      }}
    />
  );
}

/** The same switch as the touch pill strip, under the floating header. */
export function ActivityScopePills(props: {
  value: ActivityScope;
  onChange: (scope: ActivityScope) => void;
}) {
  return (
    <PillTabs
      items={SCOPE_TABS}
      value={props.value}
      onChange={props.onChange}
    />
  );
}
