import { Show } from 'solid-js';
import { HomeComposerLayout } from '../components/home-composer-layout';
import { HomeRecommendedActions } from '../components/home-recommended-actions';
import { HomeChatInput } from '../home-chat-input';

/** Home's established agent or classic chat layout, including suggestions. */
export function StandardHomeComposer(props: {
  agents: boolean;
  hasTopBar: boolean;
}) {
  return (
    <HomeComposerLayout
      agents={props.agents}
      hasTopBar={props.hasTopBar}
      header={
        <Show when={!props.agents}>
          <h1 class="mb-6 min-h-0 min-w-0 self-end text-center text-2xl font-normal leading-[42px] text-ink">
            What should we get done in Macro?
          </h1>
        </Show>
      }
      footer={<HomeRecommendedActions />}
    >
      <HomeChatInput
        variant="default"
        placeholder="Type @ to reference / for skills"
        autoFocusOnMount={false}
      />
    </HomeComposerLayout>
  );
}
