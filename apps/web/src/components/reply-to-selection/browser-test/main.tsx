import { render } from 'solid-js/web';
import '../../../index.css';
import { DiffView } from '@app/components/diff-view';
import {
  SAMPLE_FILES,
  SAMPLE_PATCH,
} from '@app/components/diff-view/debug/fixtures';
import { createSignal } from 'solid-js';
import { ReplyToSelection } from '../ReplyToSelection';

const root = document.getElementById('root');
if (!root) throw new Error('Fixture root missing');
const [quote, setQuote] = createSignal('');
const [container, setContainer] = createSignal<HTMLDivElement>();
render(
  () => (
    <main class="flex flex-col gap-4 p-4">
      <div ref={setContainer} class="flex flex-col gap-4">
        <p>
          <span data-transcript>The cart total now comes from one helper.</span>
        </p>
        <div class="h-[600px] overflow-hidden">
          <DiffView.Root
            files={SAMPLE_FILES.slice(0, 1)}
            patch={SAMPLE_PATCH}
            diffStyle="unified"
          >
            <DiffView.Stack />
          </DiffView.Root>
        </div>
      </div>
      <ReplyToSelection container={container()} onReply={setQuote} />
      <output aria-label="Quote" class="whitespace-pre-wrap">
        {quote()}
      </output>
    </main>
  ),
  root
);
