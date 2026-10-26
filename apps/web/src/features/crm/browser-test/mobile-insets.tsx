import '@app/index.css';
import { EntityDetailTopBar } from '@app/components/entity-detail/EntityDetailTopBar';
import { ViewBreadcrumbs, ViewShell } from '@app/components/view-shell';
import { AnalyticsContextProvider } from '@app/lib/analytics/analytics-context';
import { PosthogProvider } from '@app/lib/analytics/posthog';
import { SidePanel } from '@components/app/side-panel';
import { HeaderIsland } from '@components/app/split-layout/components/HeaderIsland';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import InfoIcon from '@phosphor/info.svg';
import LinkIcon from '@phosphor/link.svg';
import { Button } from '@ui';
import { createSignal, For, Match, Switch } from 'solid-js';
import { render } from 'solid-js/web';
import { CrmMobileTabs } from '../components/crm-mobile-tabs';
import { RecordOverview } from '../components/record-overview';
import { RecordSection } from '../components/record-section';
import { RecordTabs } from '../components/record-tabs';
import {
  COMPANY_SECTIONS,
  CONTACT_SECTIONS,
  type CrmRecordSection,
} from '../core/record';

// Production layout components with local content; no account or backend writes.
const params = new URLSearchParams(location.search);
const surface = params.get('surface') ?? 'company';
const safeTop = Number(params.get('safe') ?? 47);
const headerHeight = ['company', 'contact', 'reviews'].includes(surface)
  ? 45
  : 0;
document.documentElement.dataset.touchDevice = String(isTouchDevice());

function Fixture() {
  const [tab, setTab] = createSignal('active');
  const [search, setSearch] = createSignal('');
  const [section, setSection] = createSignal<CrmRecordSection>('overview');
  return (
    <main
      class="relative flex h-dvh flex-col bg-panel text-ink"
      style={{
        '--safe-top': `${safeTop}px`,
        '--mobile-content-inset-top': `${safeTop + headerHeight}px`,
        '--mobile-content-inset-bottom': '80px',
      }}
    >
      <Switch>
        <Match when={surface === 'crm' || surface === 'reviews'}>
          <ViewShell.Header>
            <CrmMobileTabs
              active={tab()}
              pipelines={[{ id: 'sales', name: 'Sales' }]}
              lists={[]}
              onNavigate={setTab}
            />
          </ViewShell.Header>
          <div class="min-h-0 flex-1 overflow-auto touch:[--mobile-content-inset-top:0px]">
            <p>Selected: {tab()}</p>
          </div>
        </Match>
        <Match when={surface === 'project'}>
          <SidePanel.Root defaultOpen={false}>
            <ViewBreadcrumbs.Root value="project" onChange={() => {}}>
              <EntityDetailTopBar
                navigation={
                  <Button onClick={() => setSection('tasks')}>
                    Project tasks
                  </Button>
                }
              />
            </ViewBreadcrumbs.Root>
          </SidePanel.Root>
          <p>Selected: {section()}</p>
        </Match>
        <Match when={surface === 'company' || surface === 'contact'}>
          <nav
            aria-label="Record navigation"
            class="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3 touch:top-(--safe-top) touch:h-11.25 touch:pointer-events-none not-touch:hidden"
          >
            <HeaderIsland class="px-0">
              <Button size="icon-lg" aria-label="Back">
                ←
              </Button>
            </HeaderIsland>
            <div class="min-w-0">
              <RecordTabs
                sections={
                  surface === 'company' ? COMPANY_SECTIONS : CONTACT_SECTIONS
                }
                value={section()}
                onChange={setSection}
                compact
              />
            </div>
            <HeaderIsland class="ml-auto">
              <Button variant="ghost" size="icon-md" aria-label="Copy link">
                <LinkIcon class="size-4 touch:size-5" />
              </Button>
            </HeaderIsland>
            <HeaderIsland class="px-0">
              <Button size="icon-lg" aria-label="Information">
                <InfoIcon />
              </Button>
            </HeaderIsland>
          </nav>
          <Switch>
            <Match when={section() === 'overview'}>
              <RecordOverview>
                <h1>
                  {surface === 'company' ? 'Acme company' : 'Maya contact'}
                </h1>
                <For each={Array.from({ length: 35 }, (_, i) => i)}>
                  {(index) => <p>Discussion item {index}</p>}
                </For>
                <Button>Last action</Button>
              </RecordOverview>
            </Match>
            <Match when={section() !== 'overview'}>
              <RecordSection
                title={section() === 'files' ? 'Files' : section()}
                search={search()}
                onSearchChange={setSearch}
              >
                <p>{search() ? `Searching: ${search()}` : 'No files yet.'}</p>
                <For each={Array.from({ length: 35 }, (_, i) => i)}>
                  {(index) => <p>Record item {index}</p>}
                </For>
                <Button>Last record action</Button>
              </RecordSection>
            </Match>
          </Switch>
        </Match>
      </Switch>
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-0 top-0 bg-panel/80 touch:h-(--safe-top)"
      />
    </main>
  );
}
const root = document.getElementById('root');
if (root)
  render(
    () => (
      <AnalyticsContextProvider>
        <PosthogProvider>
          <Fixture />
        </PosthogProvider>
      </AnalyticsContextProvider>
    ),
    root
  );
