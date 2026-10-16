import '@fontsource-variable/inter';
import '../../../index.css';
import { render } from 'solid-js/web';
import { HomeChatStart } from '../../home/components/HomeChatStart';
import { identity, mounts, setAllowed, setIdentity } from './home-mode-wiring';

render(
  () => (
    <main class="min-h-screen bg-page p-8 text-ink">
      <div class="flex gap-3">
        <button onClick={() => setAllowed(true)}>Grant access</button>
        <button onClick={() => setAllowed(false)}>Revoke access</button>
        <button
          onClick={() =>
            setIdentity((value) => (value === 'alice' ? 'bob' : 'alice'))
          }
        >
          Switch user
        </button>
        <output data-testid="identity">{identity()}</output>
        <output data-testid="universal-mounts">{mounts()}</output>
      </div>
      <div
        class="mx-auto flex h-[900px] max-w-180 flex-col"
        data-split-id="fixture"
      >
        <HomeChatStart />
      </div>
    </main>
  ),
  document.getElementById('root')!
);
