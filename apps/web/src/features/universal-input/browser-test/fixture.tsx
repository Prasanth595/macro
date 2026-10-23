import type { EditorControls } from '@core/component/LexicalMarkdown/builder/types';
import type {
  Bucket,
  ItemForBucket,
  ItemsForBuckets,
  QuickAccessItem,
  QuickAccessList,
  QuickAccessListOptions,
} from '@core/context/quickAccess/types';
import { attachGlobalDOMScope, useHotKeyRoot } from '@core/hotkey/hotkeys';
import { $createUserMentionNode } from '@macro-inc/lexical-core';
import { propertiesKeys } from '@queries/properties/keys';
import type { TagSetResponse } from '@service-properties/generated/schemas/tagSetResponse';
import { ComposerSurface } from '@ui';
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical';
import type { ComponentProps } from 'solid-js';
import { createEffect } from 'solid-js';
import { buildAgentRoster } from '../../agents-view/core/roster';
import { createDocumentComposerTags } from '../../block-md/util/documentComposerProperties';
import { CommandMenu } from '../../command/CommandMenu';
import { CommandState } from '../../command/state';
import { useExperimentalFeatures } from '../../experimental-features/experimental-features';
import { searchNeedsKeywords } from '../../next-soup/core/search-filters';
import { SearchbarInput } from '../../next-soup/soup-view/filters-bar/soup-view-search-bar';
import { parsePropertyDraft } from '../../property/utils/parse-property-draft';
import { ExperimentalFeatures } from '../../settings/ExperimentalFeatures';
import type { InputLayoutParts } from '../context/capabilities';
import { resolveSearchFilters } from '../core/search';
import { composerRecipientOptions } from '../queries/composer-recipients';
import { SearchDraft } from '../views/search-draft';
import { globalSearchRequests } from './global-search-service-fixture';
import {
  openedSearchResult,
  setOpenedSearchResult,
} from './search-app-fixture';
import '@fontsource-variable/inter';
import '../../../index.css';
import { buildConfig } from '@core/component/LexicalMarkdown/builder/MarkdownConfigBuilder';
import { ChannelsContextProvider } from '@core/context/channels';
import { EmailLinksContextProvider } from '@core/context/emailLinks';
import { QuickAccessContextProvider } from '@core/context/quickAccess/context';
import type { QuickAccessContextValue } from '@core/context/quickAccess/types';
import { UserContextProvider } from '@core/context/user';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { createSignal, Show } from 'solid-js';
import { DraftEditor } from '../components/draft-editor';
import type { InputDisplay } from '../context/capabilities';
import type { CommandInputSession } from '../context/command-input';
import {
  emptyDraft,
  type Intent,
  intents,
  type Submission,
} from '../core/input';
import { resolveRecipients } from '../core/recipients';
import { createUniversalInput } from '../primitives/universal-input';
import { UniversalComposer } from '../views/universal-composer';

const [commandSubmissions, setCommandSubmissions] = createSignal<Submission[]>(
  []
);

function FixtureLayout(parts: InputLayoutParts) {
  return (
    <>
      <div class="space-y-3">
        <ComposerSurface as="div" data-testid="universal-input-surface">
          {parts.editor}
        </ComposerSurface>
        {parts.fields}
      </div>
      {parts.result}
    </>
  );
}

function SearchbarFixture() {
  const [query, setQuery] = createSignal('');
  const [changes, setChanges] = createSignal(0);
  let controls: EditorControls | undefined;
  return (
    <div>
      <SearchbarInput
        label="Standalone search"
        value={query()}
        onChange={(value) => {
          setChanges((count) => count + 1);
          setQuery(value);
        }}
        onConnect={(value) => {
          controls = value;
        }}
      />
      <button
        onClick={() => {
          const editor = controls?.getLexical();
          editor?.update(
            () => {
              $getRoot()
                .clear()
                .append(
                  $createParagraphNode().append(
                    $createUserMentionNode({
                      userId: 'macro|julia@macro.com',
                      email: 'julia@macro.com',
                      displayName: 'Julia',
                    }),
                    $createTextNode(' budget')
                  )
                );
              $getRoot().selectEnd();
            },
            { discrete: true }
          );
          controls?.focus();
        }}
      >
        Insert search mention
      </button>
      <button onClick={() => setQuery('externally changed query')}>
        Set external search
      </button>
      <output data-testid="standalone-query">{query()}</output>
      <output data-testid="standalone-query-changes">{changes()}</output>
    </div>
  );
}

function FixtureComposer(
  props: Omit<ComponentProps<typeof UniversalComposer>, 'layout'> & {
    command?: CommandInputSession;
  }
) {
  const tags = createDocumentComposerTags(
    {},
    {
      values: () => parsePropertyDraft(props.state.fields().noteTags),
      onChange: (values) =>
        props.state.edit('noteTags', JSON.stringify(values)),
    }
  );
  return (
    <UniversalComposer
      {...props}
      layout={props.command?.layout ?? FixtureLayout}
      noteTags={tags.composerTags}
      search={(scopeId) => (
        <SearchDraft
          state={props.state}
          actions={props.actions}
          scopeId={scopeId}
          onOpen={(entity, newSplit, location) => {
            setOpenedSearchResult({
              content: {
                type:
                  entity.type === 'document' ? entity.fileType : entity.type,
                id: entity.id,
              },
              options: {
                referredFrom: 'kommand-menu',
                preferNewSplit: newSplit,
                location,
              },
            });
            props.command?.onNavigate();
          }}
        />
      )}
    />
  );
}

/** Real view and controller with deterministic inference and recording-only writes. */
export function UniversalInputFixture(
  props: { embedded?: boolean; command?: CommandInputSession } = {}
) {
  const [searchQueries, setSearchQueries] = createSignal<string[]>([]);
  const records: QuickAccessItem[] = ['Investor update', 'Hiring plan'].map(
    (name, index) => ({
      id: `search-document-${index}`,
      kind: 'entity',
      bucket: 'note',
      searchText: name,
      sortTimestamp: 2 - index,
      timestamps: {},
      data: {
        type: 'document',
        id: `search-document-${index}`,
        name,
        ownerId: 'fixture',
        fileType: 'md',
      },
    })
  );
  records.push({
    id: 'search-agent-session',
    kind: 'entity',
    bucket: 'agent_session',
    searchText: 'How Blowholes Work',
    sortTimestamp: 0,
    timestamps: {},
    data: {
      type: 'agent_session',
      id: 'search-agent-session',
      name: 'How Blowholes Work',
      ownerId: 'fixture',
      botId: 'fixture-agent',
      status: 'idle',
    },
  });

  for (const person of [
    {
      id: 'macro|john@example.com',
      name: 'John Adams',
      email: 'john@example.com',
    },
    {
      id: 'macro|julia@macro.com',
      name: 'Julia Jones',
      email: 'julia@macro.com',
    },
  ])
    records.push({
      id: person.id,
      kind: 'user',
      bucket: 'person',
      data: person,
      searchText: person.name,
      sortTimestamp: 0,
      timestamps: {},
    });
  records.push({
    id: 'sales-channel',
    kind: 'entity',
    bucket: 'channel',
    searchText: 'sales',
    sortTimestamp: 0,
    timestamps: {},
    data: {
      id: 'sales-channel',
      type: 'channel',
      name: 'sales',
      ownerId: 'fixture',
      channelType: 'public',
    },
  });
  records.push({
    id: 'julia-dm',
    kind: 'entity',
    bucket: 'dm',
    searchText: 'Julia direct message',
    sortTimestamp: 0,
    timestamps: {},
    data: {
      id: 'julia-dm',
      type: 'channel',
      name: 'Julia direct message',
      ownerId: 'fixture',
      channelType: 'direct_message',
    },
  });
  function useList(): QuickAccessList;
  function useList<B extends Bucket>(
    bucket: B
  ): QuickAccessList<ItemForBucket<B>>;
  function useList<B extends Bucket[]>(
    ...buckets: B
  ): QuickAccessList<ItemsForBuckets<B>>;
  function useList<const B extends readonly Bucket[]>(
    options: QuickAccessListOptions<B>
  ): QuickAccessList<ItemForBucket<B[number]>>;
  function useList(
    ...args: (Bucket | QuickAccessListOptions)[]
  ): QuickAccessList {
    const first = args[0];
    const options = typeof first === 'object' ? first : undefined;
    const buckets = options?.buckets ?? args;
    const enabled = () => options?.enabled?.() ?? true;
    createEffect(() => {
      const query = options?.searchTerm?.() ?? '';
      if (enabled() && query)
        setSearchQueries((previous) =>
          previous.at(-1) === query ? previous : [...previous, query]
        );
    });
    const items = () =>
      enabled()
        ? records.filter(
            (record) => !buckets.length || buckets.includes(record.bucket)
          )
        : [];
    return {
      items,
      totalCount: () => items().length,
      hasMore: () => false,
      isLoading: () => false,
      isLoadingMore: () => false,
      loadMore: async () => {},
    };
  }
  const quickAccess: QuickAccessContextValue = {
    useList,
    usesRecordSelection: () => false,
    usesSearchProjection: () => false,
    isLoading: () => false,
    refresh: () => {},
    getById: () => undefined,
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } },
  });
  queryClient.setQueryData<TagSetResponse[]>(propertiesKeys.tags.queryKey, [
    {
      scope: 'user',
      definition: {
        id: 'tags',
        scope: 'user',
        user_id: 'fixture',
        displayName: 'Tags',
        dataType: 'TAG',
        isMultiSelect: true,
        isSystem: false,
        isMetadata: false,
      },
      options: [
        {
          id: 'launch',
          propertyDefinitionId: 'tags',
          displayOrder: 0,
          value: { type: 'string', value: 'Launch' },
        },
      ],
    },
  ]);
  const params = new URLSearchParams(window.location.search);
  const experiments = useExperimentalFeatures();
  if (!props.embedded) {
    useHotKeyRoot();
    attachGlobalDOMScope(document.body);
  }
  const classifyDelay = Number(params.get('classify-delay') ?? 80);
  const extractDelay = Number(params.get('extract-delay') ?? 80);
  const [classifications, setClassifications] = createSignal(0);
  const [extractions, setExtractions] = createSignal(0);
  let focus: (() => void) | undefined;
  const [sent, setSent] = createSignal<Submission[]>([]);
  const [savedEmailDrafts, setSavedEmailDrafts] = createSignal<Submission[]>(
    []
  );
  const [googleConnected, setGoogleConnected] = createSignal(
    !new URLSearchParams(window.location.search).has('disconnected')
  );
  const [agentAction, setAgentAction] = createSignal('');
  const [connections, setConnections] = createSignal(0);
  const people = [
    {
      id: 'macro|john@example.com',
      kind: 'user' as const,
      label: 'John Adams',
      email: 'john@example.com',
    },
    {
      id: 'macro|julia@macro.com',
      kind: 'user' as const,
      label: 'Julia Jones',
      email: 'julia@macro.com',
    },
  ];
  const actions: InputDisplay = {
    people: () => people,
    searchChannels: () => [
      { id: 'sales-channel', kind: 'channel', label: 'sales' },
      { id: 'julia-dm', kind: 'channel', label: 'Julia direct message' },
    ],
    destinations: () => [
      ...people,
      { id: 'sales-channel', kind: 'channel', label: 'sales' },
    ],
    messageRecipients: () =>
      composerRecipientOptions(people).filter(
        (option) => option.kind === 'user'
      ),
    recipients: (fields, message = false) =>
      resolveRecipients(fields.recipients, people, !message),
    calendars: () =>
      googleConnected()
        ? [
            {
              id: 'calendar',
              name: 'Personal',
              emailAddress: 'you@example.com',
            },
          ]
        : [],
    selectedCalendar: () =>
      googleConnected() ? { id: 'calendar' } : undefined,
    inboxes: () =>
      googleConnected()
        ? [{ id: 'inbox', email_address: 'you@example.com' }]
        : [],
    selectedInbox: () => (googleConnected() ? { id: 'inbox' } : undefined),
    connectGoogle: async () => {
      setConnections((count) => count + 1);
      setGoogleConnected(true);
    },
    connectingGoogle: () => false,
    roster: () =>
      buildAgentRoster({
        agents: [],
        runtimes: [],
        cursorConnected: false,
        cursorNeedsConnection: true,
      }),
    rosterLoading: () => false,
    connectAgent: (agent) => setAgentAction(`connect:${agent.id}`),
    createAgent: () => setAgentAction('create'),
    agentsEnabled: () => !params.has('legacy'),
    models: () => [
      { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5' },
      { id: 'gpt-5', label: 'GPT-5' },
    ],
    model: () => '',
    attachmentCount: () => 0,
    clearAttachments: () => {},
  };
  const state = createUniversalInput({
    async classify(text, revision) {
      setClassifications((count) => count + 1);
      await new Promise((r) => setTimeout(r, classifyDelay));
      const intent: Intent =
        intents.find((intent) => intent === params.get('classification')) ??
        (text.toLowerCase().startsWith('email')
          ? 'email'
          : text.toLowerCase().startsWith('dm')
            ? 'message'
            : text.toLowerCase().startsWith('notification')
              ? 'task'
              : text.includes('3pm') || text.includes('at 7')
                ? 'calendar'
                : /^(?:find|search|look for)\b/i.test(text)
                  ? 'search'
                  : 'note');
      return {
        revision,
        scores: intents.map((i) => ({
          intent: i,
          score:
            intent === 'task' && i === 'note'
              ? 0.65
              : i === intent
                ? intent === 'task'
                  ? 0.66
                  : 0.98
                : 0.01,
        })),
      };
    },
    async extract(text, intent, revision) {
      setExtractions((count) => count + 1);
      await new Promise((r) => setTimeout(r, extractDelay));
      return {
        revision,
        intent,
        suggestions: {
          title: intent === 'calendar' ? 'Call John' : text,
          body:
            intent === 'email' || intent === 'message' ? 'I’ll be late' : text,
          subject: 'Running late',
          recipients:
            intent === 'email' || intent === 'message' ? ['John'] : [],
          start: text.includes('at 7')
            ? '2026-10-10T19:00'
            : '2026-10-10T15:00',
          end: text.includes('at 7') ? '2026-10-10T20:00' : '2026-10-10T16:00',
          query: text,
          guests: [],
        },
      };
    },
    async submit(input) {
      setSent((s) => [...s, input]);
      if (props.command) setCommandSubmissions((s) => [...s, input]);
      return { message: `${input.intent} completed` };
    },
    async saveEmailDraft(input) {
      setSavedEmailDrafts((drafts) => [...drafts, input]);
      return { message: 'Email draft saved' };
    },
    validateEmailDraft: () =>
      !googleConnected() ? 'Connect Google to continue' : undefined,
    validate: (input) => {
      if (input.intent === 'search') {
        const filters = resolveSearchFilters(
          input.fields.searchFilters,
          actions.people(),
          actions.searchChannels()
        );
        if (filters.unresolved.length)
          return `Choose a specific person or channel for ${filters.unresolved.join(', ')}`;
        if (searchNeedsKeywords(filters.state, input.fields.query))
          return 'Add at least 3 search characters to search by sender or speaker.';
      }
      return !googleConnected() &&
        (input.intent === 'email' || input.intent === 'calendar')
        ? 'Connect Google to continue'
        : undefined;
    },
    onSubmitted: () => (props.command ? props.command.onComplete() : focus?.()),
    initialDraft: props.command
      ? { ...emptyDraft(), text: props.command.text }
      : undefined,
  });
  return (
    <QueryClientProvider client={queryClient}>
      <UserContextProvider>
        <QuickAccessContextProvider value={quickAccess}>
          <EmailLinksContextProvider>
            <ChannelsContextProvider>
              <main
                class={
                  props.command
                    ? 'contents'
                    : props.embedded
                      ? 'min-w-0'
                      : 'min-h-screen bg-page p-12 text-ink'
                }
              >
                <Show when={!props.embedded && params.has('searchbar')}>
                  <SearchbarFixture />
                </Show>
                <Show
                  when={
                    !props.embedded &&
                    params.has('settings') &&
                    experiments.available()
                  }
                >
                  <div class="h-[500px]" data-testid="experimental-settings">
                    <ExperimentalFeatures />
                  </div>
                </Show>
                <Show when={!props.embedded && params.has('command-menu')}>
                  <button onClick={CommandState.open}>Open Command K</button>
                  <CommandMenu />
                  <output data-testid="command-submission-count">
                    {commandSubmissions().length}
                  </output>
                  <output data-testid="last-command-submission">
                    {JSON.stringify(commandSubmissions().at(-1))}
                  </output>
                </Show>
                <div
                  class={props.command ? 'contents' : 'mx-auto max-w-180'}
                  data-split-id="fixture"
                >
                  <FixtureComposer
                    command={props.command}
                    state={state}
                    actions={actions}
                    editor={
                      <DraftEditor
                        config={buildConfig('chat')
                          .withHistory()
                          .withFloatingFormatMenu()}
                        text={state.draft().text}
                        disabled={state.sending()}
                        initialSelection={props.command?.selection}
                        onChange={(text) => {
                          if (state.sending()) return;
                          state.setText(text);
                          props.command?.onTextChange(text);
                        }}
                        onSubmit={() => void state.submit()}
                        registerFocus={(callback) => {
                          focus = callback;
                        }}
                      />
                    }
                    taskFields={<span>Task properties</span>}
                  />
                  <Show when={!props.embedded}>
                    <output data-testid="global-search-requests">
                      {JSON.stringify(globalSearchRequests())}
                    </output>
                    <output data-testid="search-queries">
                      {JSON.stringify(searchQueries())}
                    </output>
                    <output data-testid="opened-search-result">
                      {JSON.stringify(openedSearchResult())}
                    </output>
                    <output data-testid="agent-action">{agentAction()}</output>
                    <output data-testid="submission-count">
                      {sent().length}
                    </output>
                    <output data-testid="email-draft-count">
                      {savedEmailDrafts().length}
                    </output>
                    <pre data-testid="last-email-draft">
                      {JSON.stringify(savedEmailDrafts().at(-1))}
                    </pre>
                    <output data-testid="classification-count">
                      {classifications()}
                    </output>
                    <output data-testid="extraction-count">
                      {extractions()}
                    </output>
                    <output data-testid="connection-count">
                      {connections()}
                    </output>
                    <pre data-testid="last-submission">
                      {JSON.stringify(sent().at(-1))}
                    </pre>
                  </Show>
                </div>
              </main>
            </ChannelsContextProvider>
          </EmailLinksContextProvider>
        </QuickAccessContextProvider>
      </UserContextProvider>
    </QueryClientProvider>
  );
}
