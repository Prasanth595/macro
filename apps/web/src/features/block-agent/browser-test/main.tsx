import { For } from 'solid-js';
import { render } from 'solid-js/web';
import { PresentedReviewPart } from '../views/PresentedReviewPart';
import {
  receiveDecision,
  receiveNoop,
  receiveText,
  reviewId,
  session,
} from './session';

const root = document.getElementById('root');
if (!root) throw new Error('Fixture root missing');
render(
  () => (
    <main>
      <h1>Agent session</h1>
      <PresentedReviewPart
        sessionId={session.sessionId()}
        reviewId={reviewId}
      />
      <For each={session.messages()}>
        {(message) => (
          <p data-turn={message.turn}>
            <For each={message.parts}>
              {(part) => (part.kind === 'text' ? part.text : '')}
            </For>
          </p>
        )}
      </For>
      <nav>
        <button type="button" onClick={() => receiveText(0)}>
          Busy output
        </button>
        <button type="button" onClick={receiveDecision}>
          Receive decision
        </button>
        <button type="button" onClick={() => receiveText(1)}>
          Agent reply
        </button>
        <button type="button" onClick={receiveNoop}>
          Silent completion
        </button>
      </nav>
    </main>
  ),
  root
);
