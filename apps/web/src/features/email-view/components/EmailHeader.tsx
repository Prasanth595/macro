import {
  useViewControlHotkeys,
  ViewBreadcrumbs,
} from '@app/components/view-shell';
import {
  ListHeader,
  ListHeaderSearch,
} from '@app/components/view-shell/ListHeader';
import { ViewCreateButton } from '@app/components/view-shell/ViewCreateButton';
import { useSplitLayout } from '@components/app/split-layout/layout';
import { useSplitPanelOrThrow } from '@components/app/split-layout/layoutUtils';
import { tourTarget } from '@ui/components/Tour';
import { createSignal, Show } from 'solid-js';
import { composeEmail } from '../compose-email';
import { EMAIL_TABS } from '../constants';
import { useEmailView } from '../email-view-context';
import { EMAIL_TOUR } from '../tour';
import { EmailControls } from './EmailControls';

export type EmailHeaderProps = {
  /** Restores list focus when Escape leaves the search field. */
  onSearchEscape?: () => void;
  tabOnly?: boolean;
};

export function EmailViewBreadcrumbItem() {
  const { state } = useEmailView();
  const tabTitle = () =>
    EMAIL_TABS.find((tab) => tab.id === state.tab)?.label ?? 'Email';

  return (
    <ViewBreadcrumbs.Item
      value="email-view"
      metadata={{ type: 'email-view' }}
      order={0}
    >
      {(item) => (
        <ViewBreadcrumbs.Button
          class="shrink-0 rounded-md hover:bg-hover"
          isActive={item.isActive()}
          onClick={item.onSelect}
        >
          <span class="truncate @max-[720px]/view-shell:hidden">
            {tabTitle()}
          </span>
          <span class="hidden @max-[720px]/view-shell:inline">Email</span>
        </ViewBreadcrumbs.Button>
      )}
    </ViewBreadcrumbs.Item>
  );
}

export function EmailHeader(props: EmailHeaderProps) {
  const panel = useSplitPanelOrThrow();
  const { openWithSplit } = useSplitLayout();
  const { state, setState } = useEmailView();
  const [filterOpen, setFilterOpen] = createSignal(false);
  let focusSearch: (() => void) | undefined;
  const searchTarget = tourTarget(EMAIL_TOUR.search);
  const selectedTabLabel = () =>
    EMAIL_TABS.find((tab) => tab.id === state.tab)?.label ?? 'Email';

  // The view's control hotkeys are registered once, here, for the split scope.
  useViewControlHotkeys({
    scopeId: panel.splitHotkeyScope,
    enabled: panel.isPanelActive,
    search: {
      description: 'Search email',
      condition: () => state.tab !== 'scheduled' && state.tab !== 'reminders',
      run: () => {
        focusSearch?.();
        return true;
      },
    },
    filter: {
      description: 'Filter email',
      condition: () => state.tab !== 'scheduled',
      run: () => {
        setFilterOpen(true);
        return true;
      },
    },
  });

  return (
    <ListHeader
      title={
        <Show
          when={props.tabOnly}
          fallback={<ViewBreadcrumbs.Outlet aria-label="Email location" />}
        >
          <h2 class="truncate px-1 text-sm font-medium text-ink">
            {selectedTabLabel()}
          </h2>
        </Show>
      }
    >
      <Show when={state.tab !== 'scheduled'}>
        <EmailControls
          filterOpen={filterOpen()}
          onFilterOpenChange={setFilterOpen}
        />
      </Show>
      <ViewCreateButton
        aria-label="New email"
        onClick={() => composeEmail(openWithSplit, state.inboxIds)}
      />
      <Show when={state.tab !== 'reminders' && state.tab !== 'scheduled'}>
        <ListHeaderSearch
          ref={searchTarget}
          label="Search email"
          value={state.search}
          onValueChange={(search) => setState('search', search)}
          onEscape={props.onSearchEscape}
          registerFocus={(focus) => {
            focusSearch = focus;
          }}
        />
      </Show>
    </ListHeader>
  );
}
