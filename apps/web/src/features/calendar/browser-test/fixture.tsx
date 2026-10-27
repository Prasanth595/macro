import '@fontsource-variable/inter';
import '../../../index.css';
import { ToastRegion } from '@core/component/Toast/ToastRegion';
import { Button } from '@ui';
import { createSignal, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { macroDarkTheme } from '../../theme/themes/macro-dark';
import { macroLightTheme } from '../../theme/themes/macro-light';
import { CalendarSyncNotifications } from '../components/CalendarSyncNotifications';
import { calendarSyncIssue } from '../utils/calendar-sync-issue';

const params = new URLSearchParams(location.search);
document.documentElement.dataset.themeLight = String(
  params.get('theme') !== 'dark'
);
const theme = params.get('theme') === 'dark' ? macroDarkTheme : macroLightTheme;
for (const [token, value] of Object.entries(theme.colorTokens)) {
  document.documentElement.style.setProperty(`--color-${token}`, value);
}

function Fixture() {
  const [error, setError] = createSignal<string | undefined>(
    'Google Calendar snapshot could not be fully normalized: Google event private-event has an invalid interval\nTracing spans: account_id=private-account'
  );
  const [second, setSecond] = createSignal(false);
  const [firstView, setFirstView] = createSignal(true);
  const [secondView, setSecondView] = createSignal(false);
  const warnings = () => [
    ...(error()
      ? [
          {
            id: 'calendar-1',
            name: params.has('long')
              ? 'Community events and volunteer coordination for the entire neighborhood'
              : 'Community events',
            emailAddress: params.has('long')
              ? 'community-calendar-coordination@example.test'
              : 'calendar@example.test',
            issue: calendarSyncIssue(error()!),
          },
        ]
      : []),
    ...(second()
      ? [
          {
            id: 'calendar-2',
            name: 'Work',
            emailAddress: 'work@example.test',
            issue: calendarSyncIssue('unavailable'),
          },
        ]
      : []),
  ];

  return (
    <main class="min-h-dvh bg-page p-6 text-ink">
      <h1 class="mb-4 text-lg font-semibold">Calendar sync notices</h1>
      <div class="flex max-w-sm flex-wrap gap-2">
        <Button
          onClick={() =>
            setError(
              'Google Calendar snapshot could not be fully normalized: new retry trace'
            )
          }
        >
          Retry sync
        </Button>
        <Button onClick={() => setError(undefined)}>Recover</Button>
        <Button onClick={() => setError('provider connection unavailable')}>
          Connection issue
        </Button>
        <Button onClick={() => setSecond(true)}>Second calendar</Button>
        <Button onClick={() => setSecondView(true)}>Open second view</Button>
        <Button onClick={() => setFirstView(false)}>Close first view</Button>
        <Button onClick={() => setFirstView(true)}>Open first view</Button>
      </div>
      <ToastRegion />
      <Show when={firstView()}>
        <CalendarSyncNotifications warnings={warnings()} loaded />
      </Show>
      <Show when={secondView()}>
        <CalendarSyncNotifications warnings={warnings()} loaded />
      </Show>
    </main>
  );
}

render(() => <Fixture />, document.getElementById('root')!);
