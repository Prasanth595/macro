import Building from '@phosphor/building-office.svg';
import CaretDown from '@phosphor/caret-down.svg';
import Table from '@phosphor/table.svg';
import Users from '@phosphor/users.svg';
import { Button, Dropdown } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { WorkspaceView } from '../../core/dummy-workspace';
import {
  type HomepagePersonId,
  homepagePeople,
} from '../../core/homepage-demo-people';
import { type DealStage, dealStages } from '../../core/workspace-fixtures';
import { createDummyWorkspace } from '../../primitives/createDummyWorkspace';
import { ViewSidebar } from '../DemoViewSidebar';
import { ViewShell } from '../DemoWorkspaceChrome';
import { DocumentShareSheet } from '../documents/DocumentShareSheet';
import { SearchBar } from '../email/frozen/SearchBar';
import { StageIcon } from '../workspace/CompanyRecord';
import { WorkspaceCompanies } from '../workspace/WorkspaceCompanies';
import { WorkspaceDocuments } from '../workspace/WorkspaceDocuments';
import { WorkspaceEmail } from '../workspace/WorkspaceEmail';
import './homepage-scenes.css';

type Deal = {
  companyId: string;
  stage: DealStage;
  owner: HomepagePersonId;
  revenue: string;
};
const owners = ['julia', 'jacob', 'valentina', 'teo'] as const;

/** Website-owned presentation from CRM's records, pipeline sidebar and database toolbar. */
export default function CrmPipelineScene() {
  const w = createDummyWorkspace('crm');
  const [tab, setTab] = createSignal('pipeline');
  const [query, setQuery] = createSignal('');
  const [board, setBoard] = createSignal(false);
  const [share, setShare] = createSignal(false);
  const [linked, setLinked] = createSignal<{
    view: WorkspaceView;
    id: string;
  }>();
  // Pipeline fields belong to the deal, independently of the company record.
  const [deals, setDeals] = createStore<Deal[]>(
    [...w.data.companies]
      .sort((a, b) => Number(b.id === 'meadow') - Number(a.id === 'meadow'))
      .slice(0, 10)
      .map((company, index) => ({
        companyId: company.id,
        stage: (
          [
            'Qualified',
            'Demo',
            'Trial',
            'Negotiation',
            'Customer',
            'Lead',
          ] as const
        )[index % 6],
        owner: owners[index % owners.length],
        revenue: ['24000', '18000', '36000', '12000', '48000', '9000'][
          index % 6
        ],
      }))
  );
  const company = (id: string) =>
    w.data.companies.find((item) => item.id === id)!;
  const shownDeals = () =>
    deals.filter((deal) =>
      company(deal.companyId).name.toLowerCase().includes(query().toLowerCase())
    );
  const shownCompanies = () =>
    w.data.companies.filter((item) =>
      `${item.name} ${item.domain}`
        .toLowerCase()
        .includes(query().toLowerCase())
    );
  const navigate = (next: string) => {
    setTab(next);
    setQuery('');
    w.open('crm');
    setLinked(undefined);
  };
  const openCompany = (id: string) => {
    w.setCompanyFilter(
      tab() === 'pipeline' ? 'Sales pipeline' : 'All companies'
    );
    w.open('crm', id);
  };
  const linkedWorkspace = {
    ...w,
    selected: () => linked()?.id,
    view: (): WorkspaceView => linked()?.view ?? 'crm',
    contentView: (): WorkspaceView => linked()?.view ?? 'crm',
    backToCollection: () => setLinked(undefined),
  };
  const stageCell = (deal: Deal) => (
    <Dropdown modal={false}>
      <Dropdown.Trigger
        variant="plain"
        size="sm"
        aria-label={`Stage for ${company(deal.companyId).name}`}
      >
        <StageIcon stage={deal.stage} />
        <span>{deal.stage}</span>
        <CaretDown class="size-3" />
      </Dropdown.Trigger>
      <Dropdown.Content portalScope="local">
        <Dropdown.Group>
          <For each={dealStages.filter((stage) => stage !== 'No stage')}>
            {(stage) => (
              <Dropdown.Item
                onSelect={() =>
                  setDeals(
                    (item) => item.companyId === deal.companyId,
                    'stage',
                    stage
                  )
                }
              >
                <StageIcon stage={stage} />
                {stage}
              </Dropdown.Item>
            )}
          </For>
        </Dropdown.Group>
      </Dropdown.Content>
    </Dropdown>
  );
  const ownerCell = (deal: Deal) => (
    <Dropdown modal={false}>
      <Dropdown.Trigger
        variant="plain"
        size="sm"
        aria-label={`Owner for ${company(deal.companyId).name}`}
      >
        <img
          class="size-5 rounded-full"
          src={homepagePeople[deal.owner].photo}
          alt=""
        />
        {homepagePeople[deal.owner].name}
      </Dropdown.Trigger>
      <Dropdown.Content portalScope="local">
        <Dropdown.Group>
          <For each={owners}>
            {(owner) => (
              <Dropdown.Item
                onSelect={() =>
                  setDeals(
                    (item) => item.companyId === deal.companyId,
                    'owner',
                    owner
                  )
                }
              >
                {homepagePeople[owner].name}
              </Dropdown.Item>
            )}
          </For>
        </Dropdown.Group>
      </Dropdown.Content>
    </Dropdown>
  );
  const revenueCell = (deal: Deal) => (
    <input
      class="homepage-crm-value"
      aria-label={`Revenue for ${company(deal.companyId).name}`}
      inputMode="decimal"
      value={deal.revenue}
      onChange={(event) => {
        const value = event.currentTarget.value.replace(/[$,\s]/g, '');
        if (value === '' || /^\d+(\.\d{0,2})?$/.test(value))
          setDeals(
            (item) => item.companyId === deal.companyId,
            'revenue',
            value
          );
        else event.currentTarget.value = deal.revenue;
      }}
    />
  );
  return (
    <div class="dummy-workspace homepage-crm-scene portal-scope">
      <aside class="homepage-crm-sidebar">
        <ViewSidebar.Root aria-label="CRM navigation">
          <ViewSidebar.Header>
            <ViewSidebar.Title>Customers</ViewSidebar.Title>
          </ViewSidebar.Header>
          <ViewSidebar.Content>
            <section>
              <p class="homepage-crm-section-label">Records</p>
              <ViewSidebar.Nav>
                <ViewSidebar.Item
                  active={tab() === 'companies'}
                  onClick={() => navigate('companies')}
                >
                  <Building class="size-4" />
                  Companies
                </ViewSidebar.Item>
                <ViewSidebar.Item
                  active={tab() === 'contacts'}
                  onClick={() => navigate('contacts')}
                >
                  <Users class="size-4" />
                  Contacts
                </ViewSidebar.Item>
              </ViewSidebar.Nav>
            </section>
            <section>
              <p class="homepage-crm-section-label">Pipelines</p>
              <ViewSidebar.Nav>
                <ViewSidebar.Item
                  active={tab() === 'pipeline'}
                  onClick={() => navigate('pipeline')}
                >
                  <Table class="size-4" />
                  <span class="flex-1">Sales pipeline</span>
                  <span class="text-xs text-ink-extra-muted">Team</span>
                </ViewSidebar.Item>
              </ViewSidebar.Nav>
            </section>
            <section>
              <p class="homepage-crm-section-label">Lists</p>
              <ViewSidebar.Nav>
                <ViewSidebar.Item
                  active={tab() === 'customers'}
                  onClick={() => navigate('customers')}
                >
                  <Users class="size-4" />
                  Customers
                </ViewSidebar.Item>
              </ViewSidebar.Nav>
            </section>
          </ViewSidebar.Content>
        </ViewSidebar.Root>
      </aside>
      <main class="dummy-main homepage-crm-main">
        <Show
          when={!linked()}
          fallback={
            <>
              <ViewShell.TopBar>
                <Button
                  variant="plain"
                  size="sm"
                  onClick={() => setLinked(undefined)}
                >
                  Back to customer
                </Button>
              </ViewShell.TopBar>
              <Show
                when={linked()?.view === 'email'}
                fallback={<WorkspaceDocuments workspace={linkedWorkspace} />}
              >
                <WorkspaceEmail
                  workspace={linkedWorkspace}
                  tab="all"
                  account="all"
                />
              </Show>
            </>
          }
        >
          <Show
            when={!w.selected()}
            fallback={
              <WorkspaceCompanies
                workspace={w}
                onOpenItem={(view, id) => setLinked({ view, id })}
              />
            }
          >
            <ViewShell.TopBar>
              <h1 class="text-sm font-semibold flex-1">
                {tab() === 'pipeline'
                  ? 'Sales pipeline'
                  : tab() === 'contacts'
                    ? 'Contacts'
                    : tab() === 'customers'
                      ? 'Customers'
                      : 'All companies'}
              </h1>
              <Show when={tab() === 'pipeline'}>
                <Button
                  variant="plain"
                  size="sm"
                  onClick={() => setShare(true)}
                >
                  Share
                </Button>
              </Show>
            </ViewShell.TopBar>
            <Show
              when={tab() === 'pipeline'}
              fallback={
                <div class="homepage-crm-search">
                  <SearchBar
                    label="Search records"
                    placeholder="Search records"
                    value={query()}
                    onValueChange={setQuery}
                  />
                </div>
              }
            >
              <div class="homepage-crm-toolbar">
                <div class="flex items-center gap-1" aria-label="Views">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={!board()}
                    onClick={() => setBoard(false)}
                  >
                    All records
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={board()}
                    onClick={() => setBoard(true)}
                  >
                    By stage
                  </Button>
                </div>
              </div>
            </Show>
            <div class="dummy-scroll">
              <Show
                when={tab() === 'pipeline'}
                fallback={
                  <Show
                    when={tab() === 'contacts'}
                    fallback={
                      <table class="homepage-crm-table">
                        <thead>
                          <tr>
                            <th>Customer</th>
                            <th>Stage</th>
                            <th>Owner</th>
                            <th>Revenue</th>
                            <th>Last Interaction</th>
                          </tr>
                        </thead>
                        <tbody>
                          <For
                            each={shownCompanies().filter(
                              (item) =>
                                tab() !== 'customers' ||
                                item.stage === 'Customer'
                            )}
                          >
                            {(item) => (
                              <tr>
                                <td>
                                  <button onClick={() => openCompany(item.id)}>
                                    <Building class="size-4" />
                                    <span>
                                      {item.name}
                                      <small>{item.domain}</small>
                                    </span>
                                  </button>
                                </td>
                                <td>
                                  <StageIcon stage={item.stage} /> {item.stage}
                                </td>
                                <td>
                                  {item.owner &&
                                    homepagePeople[item.owner].name}
                                </td>
                                <td>
                                  {item.revenue ? `$${item.revenue}` : ''}
                                </td>
                                <td>{item.updated}</td>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    }
                  >
                    <table class="homepage-crm-table">
                      <thead>
                        <tr>
                          <th>Contact</th>
                          <th>Email</th>
                          <th>Company</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={shownCompanies()}>
                          {(item) => (
                            <For each={item.contacts}>
                              {(contact) => (
                                <tr>
                                  <td>{contact.name}</td>
                                  <td>{contact.email}</td>
                                  <td>
                                    <button
                                      onClick={() => openCompany(item.id)}
                                    >
                                      {item.name}
                                    </button>
                                  </td>
                                </tr>
                              )}
                            </For>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </Show>
                }
              >
                <Show
                  when={board()}
                  fallback={
                    <table
                      class="homepage-crm-table"
                      aria-label="Sales pipeline"
                    >
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Stage</th>
                          <th>Owner</th>
                          <th>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={shownDeals()}>
                          {(deal) => (
                            <tr>
                              <td>
                                <button
                                  onClick={() => openCompany(deal.companyId)}
                                >
                                  <Building class="size-4" />
                                  <span>
                                    {company(deal.companyId).name}
                                    <small>
                                      {company(deal.companyId).domain}
                                    </small>
                                  </span>
                                </button>
                              </td>
                              <td>{stageCell(deal)}</td>
                              <td>{ownerCell(deal)}</td>
                              <td>{revenueCell(deal)}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  }
                >
                  <div class="homepage-pipeline-board">
                    <For
                      each={dealStages.filter(
                        (stage) =>
                          stage !== 'No stage' &&
                          shownDeals().some((deal) => deal.stage === stage)
                      )}
                    >
                      {(stage) => (
                        <section>
                          <header>
                            <StageIcon stage={stage} />
                            {stage}
                            <span>
                              {
                                shownDeals().filter(
                                  (deal) => deal.stage === stage
                                ).length
                              }
                            </span>
                          </header>
                          <For
                            each={shownDeals().filter(
                              (deal) => deal.stage === stage
                            )}
                          >
                            {(deal) => (
                              <article>
                                <button
                                  class="homepage-pipeline-company"
                                  onClick={() => openCompany(deal.companyId)}
                                >
                                  <Building class="size-4" />
                                  {company(deal.companyId).name}
                                </button>
                                {stageCell(deal)}
                                <div class="flex items-center justify-between">
                                  {ownerCell(deal)}
                                  <span>
                                    $
                                    {Number(deal.revenue || 0).toLocaleString(
                                      'en-US'
                                    )}
                                  </span>
                                </div>
                              </article>
                            )}
                          </For>
                        </section>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
            </div>
          </Show>
        </Show>
      </main>

      <DocumentShareSheet
        open={share()}
        title="Sales pipeline"
        entityLabel="pipeline"
        onClose={() => setShare(false)}
      />
    </div>
  );
}
