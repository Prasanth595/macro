import { fireAndForget } from '@core/util/fireAndForget';
import ArrowRightIcon from '@icon/system/regular/arrow-right.svg';
import CaretDownIcon from '@icon/system/regular/caret-down.svg';
import ChatIcon from '@icon/system/regular/chat-circle.svg';
import UploadIcon from '@icon/system/regular/upload-simple.svg';
import { Button, cn } from '@ui';
import { createSignal, type JSX, Match, Show, Switch } from 'solid-js';
import { match } from 'ts-pattern';
import { AgentFace } from './components/agent-face';
import { AgentWizard } from './components/agent-wizard';
import { agentFaceLook } from './core/agent-face';
import { SettingsSurface } from './primitives';

export const WIZARD_STEPS = ['name', 'instructions', 'where', 'share'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

/**
 * Creates an agent one question at a time: name, instructions, where it runs,
 * and who can use it, then a ready screen. Each step shows the same fields as
 * the edit form; the rest of Advanced folds under "More options".
 */
export function AgentCreateWizard(props: {
  name: string;
  tag: string;
  avatarUrl?: string;
  pending: boolean;
  busy: boolean;
  uploadingAvatar: boolean;
  canContinue: (step: WizardStep) => boolean;
  fields: Record<WizardStep | 'advanced', () => JSX.Element>;
  advancedSummary: string;
  onUploadAvatar: (file: File | undefined) => Promise<void>;
  onClearAvatar: () => void;
  /** Creates the agent, resolving to its id, or `undefined` when it failed. */
  onCreate: () => Promise<string | undefined>;
  onClose: () => void;
  onMessage?: (agentId: string) => void;
  /** Where connection flows opened from a step mount their UI. */
  contentRef: (element: HTMLDivElement) => void;
}) {
  const [step, setStep] = createSignal<WizardStep>('name');
  const [createdId, setCreatedId] = createSignal<string>();
  const [moreOpen, setMoreOpen] = createSignal(false);
  let avatarInput: HTMLInputElement | undefined;
  const faceSeed = () => props.tag || 'agent';
  const displayName = () => props.name.trim() || 'your agent';
  const stepIndex = () =>
    createdId() ? WIZARD_STEPS.length : WIZARD_STEPS.indexOf(step());

  // Clear the input afterwards so choosing the same file again still uploads.
  const uploadAvatar = async (input: HTMLInputElement) => {
    await props.onUploadAvatar(input.files?.[0]);
    input.value = '';
  };
  const create = async () => {
    const created = await props.onCreate();
    if (created) setCreatedId(created);
  };
  const advance = () => {
    if (createdId()) {
      props.onClose();
      return;
    }
    if (!props.canContinue(step())) return;
    const next = WIZARD_STEPS[WIZARD_STEPS.indexOf(step()) + 1];
    if (next) setStep(next);
    else fireAndForget(create(), 'agent-settings');
  };
  const goBack = () => {
    const previous = WIZARD_STEPS[WIZARD_STEPS.indexOf(step()) - 1];
    return previous && !createdId() ? () => setStep(previous) : undefined;
  };

  const title = () => {
    if (createdId()) return `${displayName()} is ready`;
    return match(step())
      .with('name', () => 'Name your agent')
      .with('instructions', () => `What should ${displayName()} do?`)
      .with('where', () => 'Where should it run?')
      .with('share', () => 'Who can use it?')
      .exhaustive();
  };
  const description = () => {
    if (createdId())
      return `Mention @${props.tag} in a channel, or message it directly.`;
    return match(step())
      .with('name', () => 'This is how it appears in channels and mentions.')
      .with(
        'instructions',
        () =>
          'It reads these at the start of every conversation. You can change them later.'
      )
      .with(
        'where',
        () => 'Pick where it does its work and which model it uses.'
      )
      .with(
        'share',
        () => 'Private agents are yours. Team agents work in shared channels.'
      )
      .exhaustive();
  };

  return (
    <AgentWizard
      label="New agent"
      accent={`var(--color-${agentFaceLook(faceSeed()).color})`}
      step={stepIndex()}
      stepCount={WIZARD_STEPS.length}
      busy={props.busy}
      onBack={goBack()}
      onCancel={createdId() ? undefined : props.onClose}
      onSubmit={advance}
      title={title()}
      description={description()}
      hero={
        <Show
          when={props.avatarUrl}
          fallback={
            <AgentFace
              seed={faceSeed()}
              state={props.pending ? 'thinking' : createdId() ? 'done' : 'idle'}
              followPointer
              class="size-24"
            />
          }
        >
          {(url) => (
            <img
              src={url()}
              alt={`${displayName()} avatar`}
              class="size-24 rounded-[30%] object-cover ring ring-edge-muted"
            />
          )}
        </Show>
      }
      actions={
        <Show
          when={createdId()}
          fallback={
            <Button
              type="submit"
              variant="cta"
              size="xl"
              class="min-w-44"
              disabled={!props.canContinue(step())}
            >
              <Show
                when={step() === 'share'}
                fallback={
                  <>
                    Continue
                    <ArrowRightIcon />
                  </>
                }
              >
                {props.pending ? 'Creating…' : 'Create agent'}
              </Show>
            </Button>
          }
        >
          {(created) => (
            <>
              <Show when={props.onMessage}>
                {(onMessage) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="xl"
                    onClick={() => onMessage()(created())}
                  >
                    <ChatIcon />
                    Message {displayName()}
                  </Button>
                )}
              </Show>
              <Button type="submit" variant="cta" size="xl" class="min-w-44">
                Done
              </Button>
            </>
          )}
        </Show>
      }
    >
      <div class="@container" ref={props.contentRef}>
        <Switch>
          <Match when={createdId()}>{null}</Match>
          <Match when={step() === 'name'}>
            {props.fields.name()}
            <div class="mt-4 flex flex-wrap items-center justify-center gap-1">
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                class="hidden"
                disabled={props.busy}
                onChange={(event) =>
                  fireAndForget(
                    uploadAvatar(event.currentTarget),
                    'agent-settings'
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="md"
                disabled={props.busy}
                onClick={() => avatarInput?.click()}
              >
                <UploadIcon />
                {props.uploadingAvatar
                  ? 'Uploading…'
                  : props.avatarUrl
                    ? 'Change picture'
                    : 'Upload a picture instead'}
              </Button>
              <Show when={props.avatarUrl}>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  disabled={props.busy}
                  onClick={props.onClearAvatar}
                >
                  Use its face
                </Button>
              </Show>
            </div>
          </Match>
          <Match when={step() === 'instructions'}>
            {props.fields.instructions()}
          </Match>
          <Match when={step() === 'where'}>{props.fields.where()}</Match>
          <Match when={step() === 'share'}>
            {props.fields.share()}
            <div class="mt-5 flex flex-col items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="md"
                aria-expanded={moreOpen()}
                aria-controls="agent-advanced"
                onClick={() => setMoreOpen((open) => !open)}
              >
                More options
                <CaretDownIcon
                  class={cn(
                    'transition-transform duration-200',
                    moreOpen() && 'rotate-180'
                  )}
                />
              </Button>
              <p class="text-xs text-ink-muted">{props.advancedSummary}</p>
            </div>
            <Show when={moreOpen()}>
              <SettingsSurface class="mt-3 p-4">
                {props.fields.advanced()}
              </SettingsSurface>
            </Show>
          </Match>
        </Switch>
      </div>
    </AgentWizard>
  );
}
