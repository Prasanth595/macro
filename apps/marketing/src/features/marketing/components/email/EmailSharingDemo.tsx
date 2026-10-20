import Envelope from '@phosphor/envelope.svg';
import Hash from '@phosphor/hash.svg';
import PaperPlane from '@phosphor/paper-plane-tilt.svg';
import X from '@phosphor/x.svg';
import { Button } from '@ui';
import { createSignal, Show } from 'solid-js';
import { meetingEmail, meetingReply } from '../../core/email-demo-story';
import { homepagePeople } from '../../core/homepage-demo-people';
import { createEmailWalkthrough } from '../../primitives/createEmailWalkthrough';
import { DocMention } from '../documents/DocMention';
import { HomepageConversation } from '../HomepageConversation';
import { ChannelComposer } from './frozen/ChannelComposer';
import { EmailShell } from './frozen/EmailShell';
import { EmailThread } from './frozen/EmailThread';
import './email-feature-demos.css';
import './email-demos.css';
import './email-sharing-stage.css';

const phaseDuration = [1800, 800, 1000, 1000, 1300, 450, 2600];

// The Share form's markup/classes come from TopBar/ShareButton.tsx and
// ForwardToChannel.tsx. The animation changes fixture state only; it never
// invokes share permissions, sends messages, or mounts a live app context.
function ShareForm(props: {
  phase: number;
  advance: () => void;
  cancel: () => void;
}) {
  return (
    <div class="mail-share-scrim">
      <div
        class="mail-share-form"
        role="group"
        aria-label="Share email preview"
      >
        <header class="px-4 flex h-12 items-center gap-1.5 text-sm font-medium">
          <span class="shrink-0">Share:</span>
          <Envelope class="size-4 shrink-0" />
          <span class="truncate">Thursday demo</span>
          <Button
            variant="plain"
            size="icon-sm"
            class="ml-auto"
            aria-label="Close share preview"
            onClick={props.cancel}
          >
            <X />
          </Button>
        </header>
        <div class="flex items-center pr-2">
          <div class="min-w-0 flex-1 min-h-11 mail-recipient-input">
            <Show
              when={props.phase >= 3}
              fallback={
                <span class="text-ink-placeholder">
                  To:{' '}
                  <span class="text-ink">
                    {props.phase >= 2 ? 'launch' : ''}
                  </span>
                  <span class="mail-typing-caret" />
                </span>
              }
            >
              <span class="mail-recipient-chip">
                <Hash class="size-4" />
                launch
              </span>
            </Show>
          </div>
        </div>
        <Show when={props.phase === 2}>
          <button
            type="button"
            class="mail-recipient-option"
            onClick={props.advance}
          >
            <Hash class="size-4" />
            <span>launch</span>
            <span class="ml-auto text-xs text-ink-muted">Channel</span>
          </button>
        </Show>
        <div class="grow shrink min-h-0 flex flex-col w-full border-t border-edge-muted">
          <div class="grow shrink min-h-20 px-4 py-1.5 w-full text-sm">
            <Show
              when={props.phase >= 4}
              fallback={
                <span class="text-ink-placeholder">Optional message</span>
              }
            >
              Here’s the email for Thursday.
            </Show>
          </div>
          <div class="shrink-0 flex w-full items-center px-4 py-4 gap-3 flex-wrap">
            <div class="flex flex-auto items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                class="text-ink-extra-muted"
                onClick={props.cancel}
              >
                Cancel
              </Button>
              <Button
                variant={props.phase >= 3 ? 'accent' : 'ghost'}
                depth={3}
                class="mail-share-submit rounded-lg border-0"
                disabled={props.phase < 3}
                onClick={props.advance}
                data-active={props.phase === 5}
              >
                <PaperPlane class="size-4" />
                Share<kbd class="text-[10px] opacity-60">⌘ ↵</kbd>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelResult(props: {
  shared: boolean;
  updated: boolean;
  onOpen: () => void;
}) {
  const [messages, setMessages] = createSignal<string[]>([]);
  return (
    <div class="mail-channel">
      <header class="flex h-12 items-center gap-2 px-4 text-sm">
        <Hash class="size-4" />
        <span>launch</span>
        <div class="ml-auto flex -space-x-1">
          <img
            class="size-5 rounded-full"
            src={homepagePeople.jacob.photo}
            alt="Jacob"
          />
          <img
            class="size-5 rounded-full"
            src={homepagePeople.julia.photo}
            alt="Julia"
          />
        </div>
      </header>
      <div class="mail-channel-messages">
        <HomepageConversation
          messages={[
            {
              person: 'julia',
              text: 'What does Valentina need before Thursday?',
            },
            ...(props.shared
              ? [
                  {
                    person: 'jacob' as const,
                    text: (
                      <>
                        Here’s the email for Thursday:{' '}
                        <button
                          type="button"
                          class="mail-shared-thread"
                          onClick={props.onOpen}
                          aria-label="Open shared email: Thursday demo"
                        >
                          <DocMention
                            item={{ kind: 'email', label: 'Thursday demo' }}
                          />
                        </button>
                      </>
                    ),
                  },
                ]
              : []),
            ...(props.updated
              ? [
                  {
                    person: 'julia' as const,
                    text: 'I’ll send the setup guide before the call.',
                  },
                ]
              : []),
            ...messages().map((text) => ({ person: 'jacob' as const, text })),
          ]}
        />
      </div>
      <div class="mail-channel-composer">
        <ChannelComposer
          onSend={(message) => setMessages([...messages(), message])}
        />
      </div>
    </div>
  );
}

export function EmailSharingDemo(props: { onClose?: () => void } = {}) {
  const [phase, setPhase] = createSignal(0);
  const [opened, setOpened] = createSignal(false);
  let root!: HTMLDivElement;
  const playback = createEmailWalkthrough({
    root: () => root,
    steps: 7,
    visibilityThreshold: 0.45,
    delay: (step) => phaseDuration[step - 1],
    reset: () => {
      setPhase(0);
      setOpened(false);
    },
    reduced: () => setPhase(7),
    advance: (step) => {
      setPhase(step);
      if (step === 7)
        queueMicrotask(() => {
          const body = root.querySelector<HTMLElement>(
            '.mail-sharing-email > .mail-thread > .mail-thread-body'
          );
          body?.scrollTo({
            top: body.scrollHeight,
            behavior: playback.reducedMotion() ? 'instant' : 'smooth',
          });
        });
    },
  });
  const manual = (next: number) => {
    playback.pause();
    setPhase(next);
    setOpened(false);
  };
  return (
    <div
      ref={root}
      class="mail-sharing-demo email-feature-demo"
      data-phase={phase()}
      onPointerDown={playback.pause}
      onFocusIn={playback.pause}
    >
      <div
        class="mail-sharing-stage"
        data-result={phase() >= 6 && !opened()}
        data-opened={opened()}
      >
        <EmailShell showRail={false} label="Share a live email with your team">
          <div class="mail-sharing-splits">
            <section class="mail-sharing-email" aria-label="Customer email">
              <EmailThread
                email={meetingEmail}
                hideReply
                onBack={opened() ? () => setOpened(false) : undefined}
                onShare={() => manual(2)}
                sharing={phase() === 0 && playback.playing()}
              >
                <Show when={phase() >= 7}>
                  <EmailThread
                    email={{
                      ...meetingEmail,
                      id: 'follow-up',
                      time: 'Just now',
                      body: meetingReply,
                    }}
                    hideHeader
                    hideSubject
                    hideReply
                  />
                </Show>
              </EmailThread>
              <Show when={phase() >= 1 && phase() <= 5}>
                <ShareForm
                  phase={phase()}
                  advance={() => manual(phase() < 3 ? 3 : 6)}
                  cancel={() => manual(0)}
                />
              </Show>
            </section>
            <section class="mail-sharing-chat" aria-label="Team conversation">
              <ChannelResult
                shared={phase() >= 6}
                updated={phase() >= 7}
                onOpen={() => {
                  playback.pause();
                  setOpened(true);
                }}
              />
            </section>
          </div>
        </EmailShell>
      </div>
      <Show when={props.onClose}>
        <div class="mail-demo-controls">
          <Button variant="plain" size="sm" onClick={props.onClose}>
            Back to inbox
          </Button>
        </div>
      </Show>
    </div>
  );
}
