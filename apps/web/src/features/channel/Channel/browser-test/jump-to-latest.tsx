import '@app/index.css';
import { FloatRegions } from '@components/app/mobile/float-regions/float-region-state';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { ScrollToBottomOverlay } from '../ScrollToBottomOverlay';

// The production overlay above a stand-in composer; no account or backend.
// `platform=ios` turns on the native iOS press styles, as the iOS app does.
const params = new URLSearchParams(location.search);
document.documentElement.dataset.platform = params.get('platform') ?? 'web';
document.documentElement.dataset.touchDevice = String(isTouchDevice());

const composerHeight = 120;
FloatRegions.setHostHeight(composerHeight);

function Fixture() {
  const [jumps, setJumps] = createSignal<string[]>([]);
  return (
    <main class="relative h-dvh overflow-hidden bg-panel text-ink">
      <ScrollToBottomOverlay
        scrollState={() => ({
          didInitialScroll: true,
          isNearBottom: false,
          isScrollingDown: false,
          distanceFromTop: 400,
          distanceFromBottom: 2000,
          viewportSize: 700,
        })}
        onScrollToBottom={(behavior = 'auto') =>
          setJumps((list) => [...list, behavior])
        }
      />
      <div
        data-testid="composer"
        class="absolute inset-x-0 bottom-0"
        style={{ height: `${composerHeight}px` }}
      />
      <output aria-label="Jumps">{jumps().join(',')}</output>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Fixture root missing');
render(() => <Fixture />, root);
