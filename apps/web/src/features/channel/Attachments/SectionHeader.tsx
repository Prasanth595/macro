import Spinner from '@phosphor-icons/core/bold/spinner-gap-bold.svg?component-solid';
import { Button, cn, Panel } from '@ui';
import {
  type Accessor,
  createContext,
  type JSX,
  Show,
  useContext,
} from 'solid-js';

export const FlatAttachmentSections = createContext(false);

export function AttachmentSection(props: {
  contentClass?: string;
  children: JSX.Element;
  action?: JSX.Element;
  class?: string;
  label: string;
  /** Fill the panel height without scrolling, so a child (e.g. a virtualized
   * list) owns the scroll container instead of `Panel.Body`. */
  fillBody?: boolean;
}) {
  const flat = useContext(FlatAttachmentSections);
  if (flat) {
    return (
      <section class={cn('flex min-h-0 shrink-0 flex-col', props.class)}>
        <header class="flex min-h-10 shrink-0 items-center justify-between gap-2">
          <h3 class="text-xs font-medium text-ink-muted">{props.label}</h3>
          {props.action}
        </header>
        <div
          class={cn(
            'min-h-0 flex-1',
            props.fillBody ? 'flex flex-col' : 'overflow-y-auto',
            props.contentClass
          )}
        >
          {props.children}
        </div>
      </section>
    );
  }
  return (
    <Panel depth={2} class={cn('h-auto shrink-0', props.class)}>
      <Panel.Header class="justify-between px-6">
        <h3 class="text-sm font-medium text-ink">{props.label}</h3>
        <div class="shrink-0">{props.action}</div>
      </Panel.Header>
      <Show
        when={props.fillBody}
        fallback={
          <Panel.Body scroll class={props.contentClass}>
            {props.children}
          </Panel.Body>
        }
      >
        <Panel.Body class={cn('flex flex-col', props.contentClass)}>
          {props.children}
        </Panel.Body>
      </Show>
    </Panel>
  );
}

export function LoadMoreButton(props: {
  onLoadMore: () => void;
  isFetching: Accessor<boolean>;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      depth={4}
      class="justify-self-center mt-2 bg-surface"
      onClick={() => props.onLoadMore()}
      disabled={props.isFetching()}
    >
      <Show
        when={!props.isFetching()}
        fallback={
          <>
            <Spinner class="size-3.5 animate-spin" />
            Loading...
          </>
        }
      >
        Load More
      </Show>
    </Button>
  );
}
