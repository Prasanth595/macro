import '@app/index.css';
import { applyTheme } from '@app/features/theme/utils/themeUtils';
import { createSignal, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { RoutineSuggestionsCard } from '../components/routine-suggestions-card';
import { RoutineSuggestionsDialog } from '../components/routine-suggestions-dialog';
import {
  decodeRoutineSuggestions,
  type RoutineSuggestionsResult,
} from '../core/suggestions';
import { createSuggestionActions } from '../primitives/suggestion-actions';
import {
  SuggestionRows,
  suggestionListView,
} from '../views/suggestion-list-view';

// The real card, modal, and rows over a fixed projection result. Creating a
// routine records the draft instead of calling the server; the first create
// fails once so the retry path can be exercised.
const RESULT: RoutineSuggestionsResult = {
  suggestions: [
    {
      surface: 'email',
      title: 'Tag invoices and receipts',
      summary: 'Labels every invoice and receipt as Finance when it arrives.',
      reason: 'Stripe and AWS bill you every month',
      instructions:
        'When an email is an invoice or a receipt, label it Finance and archive it. Note the vendor, amount, and due date in the Finance expenses document.',
      icon: 'tag',
      notify: false,
      trigger: {
        kind: 'event',
        event: 'email.message_received',
        condition: 'Is this email an invoice or a receipt?',
      },
    },
    {
      surface: 'email',
      title: 'Alert me about Acme',
      summary: 'Tells you right away when anyone from Acme writes in.',
      reason: 'Acme is your largest open deal',
      instructions:
        'When an email comes from someone at Acme or mentions the Acme renewal, summarize it in two sentences and draft a reply for me to review.',
      icon: 'bell',
      notify: true,
      trigger: {
        kind: 'event',
        event: 'email.message_received',
        condition: 'Is this email from Acme or about the Acme renewal?',
      },
    },
    {
      surface: 'email',
      title: 'Morning inbox digest',
      summary: 'A short list of what needs you, every weekday morning.',
      reason: 'You get 80+ emails a day',
      instructions:
        'Every weekday morning, list the emails from the last day that need my reply, ranked by urgency, with a one-line summary each.',
      icon: 'mail',
      notify: true,
      trigger: {
        kind: 'schedule',
        frequency: 'week',
        time: '08:30',
        weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      },
    },
  ],
};

const suggestions = decodeRoutineSuggestions(RESULT, 'America/New_York');
const [created, setCreated] = createSignal<string[]>([]);
let failNext = true;

function Fixture() {
  const [open, setOpen] = createSignal(false);
  const [dismissed, setDismissed] = createSignal(false);
  const actions = createSuggestionActions({
    target: () => ({ kind: 'model', model: 'fixture/model' }),
    existingRoutines: () => [],
    async create(draft) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (failNext) {
        failNext = false;
        throw new Error('The server is busy.');
      }
      setCreated((names) => [...names, draft.name]);
      return `routine-${created().length}`;
    },
    customize: (draft) =>
      setCreated((names) => [...names, `edit:${draft.name}`]),
  });
  return (
    <main class="flex min-h-screen bg-page">
      <aside
        class="flex w-64 shrink-0 flex-col gap-3 bg-panel px-2 py-3"
        aria-label="Email sidebar"
      >
        <p class="px-2 text-sm font-semibold text-ink">Email</p>
        <Show when={!dismissed()}>
          <RoutineSuggestionsCard
            teaser={suggestions[0]?.title ?? ''}
            more={suggestions.length - 1}
            onOpen={() => setOpen(true)}
            onDismiss={() => setDismissed(true)}
          />
        </Show>
        <p class="px-2 text-sm text-ink-muted">Inbox</p>
      </aside>
      <output aria-label="Created routines" class="p-6 text-xs text-ink-muted">
        {created().join(' | ')}
      </output>
      <RoutineSuggestionsDialog
        open={open()}
        onOpenChange={setOpen}
        title="Routines for Email"
        refreshing={false}
        onRefresh={() => {}}
        onSeeAll={() => setOpen(false)}
      >
        <SuggestionRows
          view={suggestionListView({
            suggestions,
            generating: false,
            failed: false,
          })}
          actions={actions}
          emptyLabel="No email routines to suggest yet."
          onRetry={() => {}}
          onOpenRoutine={() => setOpen(false)}
        />
      </RoutineSuggestionsDialog>
    </main>
  );
}

applyTheme(
  new URLSearchParams(location.search).get('theme') === 'dark'
    ? 'Macro Dark'
    : 'Macro Light'
);
const root = document.getElementById('root');
if (root) render(() => <Fixture />, root);
