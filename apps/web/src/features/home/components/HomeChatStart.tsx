import {
  useViewShell,
  ViewShell,
  ViewSidebar,
} from '@app/components/view-shell';
import { useFeatureFlag } from '@app/lib/analytics/posthog';
import { rememberBootShell } from '@components/app/boot-shell';
import { DragDropWrapper } from '@core/component/AI/component/DragDrop';
import { ChatInputProvider } from '@core/component/AI/context';
import {
  enableChatV3Agents,
  enableUniversalInput,
} from '@core/constant/featureFlags';
import { useUserId } from '@core/context/user';
import { lazyNamed } from '@core/util/lazyNamed';
import { ToggleSwitch } from '@ui';
import { createEffect, Show, Suspense } from 'solid-js';
import { createHomeComposerMode } from '../primitives/composer-mode';
import { StandardHomeComposer } from '../views/standard-home-composer';
import { HomeComposerLayout } from './home-composer-layout';

const UniversalInput = lazyNamed(
  () => import('../../universal-input/universal-input'),
  'UniversalInput'
);

/** Desktop Home keeps its usual composer unless an eligible user opts in. */
export function HomeChatStart() {
  const shell = useViewShell();
  const access = useFeatureFlag(enableUniversalInput);
  const agents = useFeatureFlag(enableChatV3Agents);
  const available = () => !access().loading && access().enabled;
  const mode = createHomeComposerMode(available, useUserId());
  const showHomeTitle = () =>
    shell.aside.isCollapsed() || shell.aside.isOverlay();
  const hasTopBar = () => showHomeTitle() || available();
  // Remember the actual layout for the next load's HTML boot shell.
  createEffect(() => {
    if (access().loading || agents().loading) return;
    rememberBootShell({
      homeComposer: mode.universal()
        ? 'universal'
        : agents().enabled
          ? 'agents'
          : 'legacy',
    });
  });
  return (
    <ChatInputProvider>
      <Show when={hasTopBar()}>
        <ViewShell.TopBar>
          <Show when={showHomeTitle()}>
            <ViewSidebar.Title>Home</ViewSidebar.Title>
          </Show>
          <Show when={available()}>
            <div class="ml-auto pr-2">
              <ToggleSwitch
                label="God Mode"
                labelClass="text-xs text-ink-muted"
                checked={mode.universal()}
                onChange={mode.setUniversal}
              />
            </div>
          </Show>
        </ViewShell.TopBar>
      </Show>
      <DragDropWrapper class="relative min-h-0 min-w-0 flex-1 overflow-y-auto px-6">
        <Show
          when={mode.universal()}
          fallback={
            <StandardHomeComposer
              agents={agents().enabled}
              hasTopBar={hasTopBar()}
            />
          }
        >
          <HomeComposerLayout agents={agents().enabled} hasTopBar={hasTopBar()}>
            <Suspense fallback={<div class="h-16" />}>
              <UniversalInput />
            </Suspense>
          </HomeComposerLayout>
        </Show>
      </DragDropWrapper>
    </ChatInputProvider>
  );
}
