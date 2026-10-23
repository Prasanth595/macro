import '@fontsource-variable/inter';
import '../../../index.css';
import CalendarIcon from '@phosphor/calendar-blank.svg';
import ClockIcon from '@phosphor/clock.svg';
import VideoCameraIcon from '@phosphor/video-camera.svg';
import { ok } from 'neverthrow';
import { createSignal, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { macroDarkTheme } from '../../theme/themes/macro-dark';
import { macroLightTheme } from '../../theme/themes/macro-light';
import type { DocumentNoteLink } from '../core/types';
import { createFakeNotesSource } from '../tests/fake-source';
import { DocumentNotesView } from '../views/document-notes';
import { MeetingNotesView } from '../views/meeting-notes';

const params = new URLSearchParams(location.search);
document.documentElement.dataset.themeLight = String(
  params.get('theme') !== 'dark'
);
const theme = params.get('theme') === 'dark' ? macroDarkTheme : macroLightTheme;
for (const [token, value] of Object.entries(theme.colorTokens)) {
  document.documentElement.style.setProperty(`--color-${token}`, value);
}

function Fixture() {
  const [links, setLinks] = createSignal<DocumentNoteLink[]>([
    {
      eventId: 'unavailable',
      occurrenceKey: '2026-10-23T14:00:00Z',
      eventTitle: 'Unavailable meeting',
      team: { id: 'design', name: 'Design team' },
    },
  ]);
  if (params.has('document'))
    return (
      <main class="min-h-dvh bg-page px-3 py-10 text-ink">
        <div class="mx-auto max-w-[480px]">
          <h1 class="mb-4 text-lg font-semibold">Share: Weekly design notes</h1>
          <DocumentNotesView
            source={{
              links: () => ({ data: links(), pending: false }),
              retry: async () => {},
              unlink: async () => {
                setLinks([]);
                return ok(undefined);
              },
            }}
          />
          <p class="mt-4 text-sm">Your document is saved.</p>
        </div>
      </main>
    );
  const fake = createFakeNotesSource({ fail: params.has('fail') });
  const [opened, setOpened] = createSignal<string>();
  return (
    <main class="min-h-dvh bg-page px-3 py-10 text-ink sm:p-16">
      <div class="mx-auto w-full max-w-[390px] rounded-2xl border border-edge-muted bg-surface py-5 shadow-lg">
        <div class="px-6 pb-4">
          <div class="mb-4 flex items-center gap-2 text-xs text-ink-muted">
            <CalendarIcon class="size-4 text-accent" />
            Design calendar
          </div>
          <h1 class="text-xl font-semibold tracking-tight">
            Weekly design sync
          </h1>
          <p class="mt-2 flex items-center gap-2 text-sm text-ink-muted">
            <ClockIcon class="size-4" />
            Friday, October 23 · 10:00 – 10:30 AM
          </p>
          <p class="mt-3 flex items-center gap-2 text-sm text-ink-muted">
            <VideoCameraIcon class="size-4" />
            Macro call
          </p>
        </div>
        <MeetingNotesView
          source={fake.source}
          eventTitle="Weekly design sync"
          recurring
          onOpen={(note) => setOpened(note.name)}
          onDialogChange={() => {}}
        />
        <Show when={opened()}>
          <p role="status" class="px-6 text-sm">
            Opened {opened()}
          </p>
        </Show>
        <p class="px-6 pt-2 text-xs text-ink-extra-muted">
          Alex, Sam, and you · 3 guests
        </p>
      </div>
    </main>
  );
}

const root = document.getElementById('root');
if (root) render(() => <Fixture />, root);
