import { createSignal, type JSX } from 'solid-js';
import { UniversalInputFixture } from './fixture';

const params = new URLSearchParams(window.location.search);
export const [allowed, setAllowed] = createSignal(params.has('eligible'));
export const [identity, setIdentity] = createSignal('alice');
export const [mounts, setMounts] = createSignal(0);

/** Test adapters for Home's app-owned dependencies; the rollout view is real. */
export function useFeatureFlag(flag: { key: string }) {
  return () => ({
    enabled:
      flag.key === 'enable-universal-input' ? allowed() : !params.has('legacy'),
    loading: false,
  });
}
export const useUserId = () => identity;
export const useViewShell = () => ({
  aside: { isCollapsed: () => params.has('collapsed'), isOverlay: () => false },
});
export const ViewShell = {
  TopBar: (props: { children?: JSX.Element }) => (
    <header class="flex h-12 shrink-0 items-center">{props.children}</header>
  ),
};
export const ViewSidebar = {
  Title: (props: { children?: JSX.Element }) => <span>{props.children}</span>,
};
export const ChatInputProvider = (props: { children?: JSX.Element }) =>
  props.children;
export const DragDropWrapper = (props: {
  children?: JSX.Element;
  class?: string;
}) => <div class={props.class}>{props.children}</div>;
export const HomeRecommendedActions = () => <p>Usual Home suggestions</p>;
export function HomeChatInput() {
  return (
    <textarea
      aria-label="Usual Home input"
      class="min-h-16 w-full rounded-xl border border-edge-muted bg-panel p-4"
    />
  );
}
export function UniversalInput() {
  setMounts((value) => value + 1);
  return <UniversalInputFixture embedded />;
}
