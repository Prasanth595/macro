import { TabsInset } from '@core/component/TabsInset';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import GitMergeIcon from '@phosphor/git-merge.svg';
import GitPullRequestIcon from '@phosphor/git-pull-request.svg';
import StackIcon from '@phosphor/stack.svg';
import { Tabs } from '@ui';
import { type Component, Show } from 'solid-js';
import { match } from 'ts-pattern';
import type { ReviewsStatusTabId } from '../reviews-types';

const STATUS_TABS: {
  value: ReviewsStatusTabId;
  label: string;
  icon: Component<{ class?: string }>;
}[] = [
  { value: 'open', label: 'Open', icon: GitPullRequestIcon },
  { value: 'closed', label: 'Closed', icon: GitMergeIcon },
  { value: 'all', label: 'All', icon: StackIcon },
];

/** Open, Closed (closed and merged), or All pull requests, as a toggle. */
export function ReviewsStatusTabs(props: {
  value: ReviewsStatusTabId | undefined;
  onChange: (value: ReviewsStatusTabId) => void;
  class?: string;
}) {
  const tabProps = {
    'aria-label': 'Pull request status',
    get list() {
      return STATUS_TABS.map((tab) => ({
        value: tab.value,
        label: () => (
          <>
            <tab.icon class="size-3.5 shrink-0" aria-hidden="true" />
            {tab.label}
          </>
        ),
      }));
    },
    get value() {
      return props.value ?? '';
    },
    onChange: (value: string) =>
      match(value)
        .with('open', 'closed', 'all', (status) => props.onChange(status))
        .otherwise(() => undefined),
  };
  return (
    <Show
      when={isTouchDevice()}
      fallback={
        <Tabs
          {...tabProps}
          variant="segmented"
          class={props.class}
          labelClass="gap-1.5 px-3"
        />
      }
    >
      <TabsInset
        {...tabProps}
        list={tabProps.list.map((tab) => ({ ...tab, label: tab.label() }))}
        fullWidth
        class={props.class ?? 'h-auto'}
        labelClass="gap-1.5 py-1.5"
      />
    </Show>
  );
}
