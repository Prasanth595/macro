import { createSignal, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { buildConfig } from '../../../builder/MarkdownConfigBuilder';
import { MarkdownShell } from '../../../builder/MarkdownShell';

function Fixture() {
  const [mounted, setMounted] = createSignal(false);
  const [touch, setTouch] = createSignal(false);
  const [autofocus] = createSignal(false);
  const [connections, setConnections] = createSignal(0);
  const [retiredReads, setRetiredReads] = createSignal(0);
  let reads = 0;
  const isTouch = () => {
    reads += 1;
    return touch();
  };
  const changeInput = () => {
    const before = reads;
    setTouch((value) => !value);
    setRetiredReads(reads - before);
  };
  return (
    <main style={{ padding: '24px', 'max-width': '600px' }}>
      <h1>Editor cleanup regression</h1>
      <button onClick={() => setMounted((value) => !value)}>
        {mounted() ? 'Close editor' : 'Open editor'}
      </button>
      <button onClick={changeInput}>Change input modality</button>
      <p>
        Connected editors:{' '}
        <output data-testid="connections">{connections()}</output>
      </p>
      <p>
        Retired editor reads:{' '}
        <output data-testid="retired-reads">{retiredReads()}</output>
      </p>
      <Show when={mounted()}>
        <MarkdownShell
          config={buildConfig('plain-text')}
          ariaLabel="Test message"
          initialValue="Draft body"
          autofocus={!isTouch() && autofocus()}
          onConnect={() => setConnections((count) => count + 1)}
        />
      </Show>
    </main>
  );
}

render(() => <Fixture />, document.getElementById('root')!);
