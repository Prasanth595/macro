import { type JSX, Show } from 'solid-js';

/** Shared placement keeps Home's input anchored when switching composer modes. */
export function HomeComposerLayout(props: {
  agents: boolean;
  hasTopBar: boolean;
  header?: JSX.Element;
  children: JSX.Element;
  footer?: JSX.Element;
}) {
  return (
    <div
      class={
        props.agents
          ? 'flex h-full min-h-0 min-w-0 flex-col'
          : 'h-full min-h-0 min-w-0'
      }
    >
      <Show when={props.agents && !props.hasTopBar}>
        <div
          class="h-12 shrink-0"
          aria-hidden="true"
          data-home-composer-topbar-align=""
        />
      </Show>
      <div
        class={
          props.agents
            ? 'mx-auto grid min-h-64 min-w-0 w-full max-w-180 flex-1 grid-cols-1 grid-rows-[max(0px,calc(40%-60px))_auto_1fr] pt-6 pb-16'
            : 'mx-auto grid h-full min-h-64 min-w-0 w-full max-w-180 grid-cols-1 grid-rows-[1fr_auto_1fr] pb-16'
        }
        data-home-composer-align={props.agents ? 'agents' : 'legacy'}
      >
        <div class="self-end">{props.header}</div>
        {props.children}
        <div class="min-h-0 min-w-0 pb-8">{props.footer}</div>
      </div>
    </div>
  );
}
