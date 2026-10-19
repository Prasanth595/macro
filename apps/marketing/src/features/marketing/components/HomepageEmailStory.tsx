import { createSignal, lazy, Show, Suspense } from 'solid-js';
import type { WorkspaceComment } from '../core/dummy-workspace';
import { createDummyWorkspace } from '../primitives/createDummyWorkspace';
import { createProductWalkthrough } from '../primitives/createProductWalkthrough';
import { ChannelWorkSurface } from './channels/ChannelWorkSurface';
import { DemoMention } from './DemoMention';
import { HomepageMention } from './HomepageMention';
import { ProductDemo } from './product/ProductPage';
import './channels/channel-stories.css';
import './workspace/dummy-workspace.css';
import './email/email-demos.css';

const Composer = lazy(() => import('./HomepageEmailCompose'));
const messages: WorkspaceComment[] = [
  {
    id: 'follow-up-question',
    person: 'julia',
    body: 'Can you send Valentina the demo follow-up?',
    time: '10:24 AM',
  },
  {
    id: 'follow-up-request',
    person: 'jacob',
    body: '@Macro draft Valentina’s follow-up from the demo call. Link the sales PDF and rollout plan. Cc Julia.',
    time: '10:25 AM',
  },
  {
    id: 'follow-up-draft',
    person: 'claude',
    body: 'Here’s a draft based on the call.',
    time: '10:25 AM',
  },
];

/** Uses the same channel and app composer as the Channels and Email pages. */
export function HomepageEmailStory() {
  let root!: HTMLElement;
  const w = createDummyWorkspace('messages');
  w.setChannel('launch');
  w.setData('channels', (channel) => channel.id === 'launch', 'messages', []);
  const [step, setStep] = createSignal(0);
  const reveal = (next: number) => {
    setStep(next);
    w.setData(
      'channels',
      (channel) => channel.id === 'launch',
      'messages',
      (current) => [
        ...current,
        ...messages
          .slice(0, next)
          .filter(
            (message) => !current.some((existing) => existing.id === message.id)
          )
          .map((message) => ({ ...message })),
      ]
    );
  };
  const playback = createProductWalkthrough({
    root: () => root,
    visibilityThreshold: 0.25,
    steps: 3,
    delay: (next) => (next === 1 ? 200 : next === 2 ? 1200 : 1000),
    advance: reveal,
    reset: () => {},
    reduced: () => reveal(3),
  });
  const finish = () => {
    playback.pause();
    if (step() < 3) reveal(3);
  };
  return (
    <section
      ref={root}
      class="homepage-email-workspace"
      aria-label="Launch channel"
      data-step={step()}
      onPointerDown={finish}
      onFocusIn={finish}
    >
      <ProductDemo
        label="Draft a customer follow-up in a channel"
        height={780}
        mobileHeight={740}
      >
        <ChannelWorkSurface
          workspace={w}
          renderMessageBody={(message) =>
            message.id === 'follow-up-request' ? (
              <>
                <DemoMention
                  item={{ id: 'macro', label: 'Macro', kind: 'person' }}
                />{' '}
                draft Valentina’s follow-up from{' '}
                <HomepageMention
                  kind="call"
                  label="Demo call transcript"
                  description="The customer call, including rollout questions and next steps."
                  href="#email"
                />
                . Link the sales PDF and rollout plan. Cc Julia.
              </>
            ) : undefined
          }
          renderMessageDetails={(message) => (
            <Show when={message.id === 'follow-up-draft'}>
              <div class="homepage-inline-email-draft">
                <Suspense>
                  <Composer appChrome />
                </Suspense>
              </div>
            </Show>
          )}
        />
      </ProductDemo>
    </section>
  );
}
