import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { Tooltip as KTooltip } from '@kobalte/core/tooltip';
import { mergeRefs } from '@solid-primitives/refs';
import {
  createContext,
  createEffect,
  createSignal,
  on,
  onCleanup,
  Show,
  splitProps,
  useContext,
  type Accessor,
  type ComponentProps,
} from 'solid-js';
import { Surface } from './Surface';
import { tooltipClasses } from './Tooltip';
import { tooltipsEnabled } from '../signals/signals';
import { cn } from '../utils/classname';

// Keep product tooltip presentation and policy while making the button itself
// the trigger. No debug scope, lab portal host, or extra focusable wrapper.
const TooltipContext = createContext<{
  visible: Accessor<boolean>;
  setTrigger: (element: HTMLElement) => void;
}>();

type RootProps = ComponentProps<typeof KTooltip>;

function Root(props: RootProps) {
  const [local, rest] = splitProps(props, [
    'children', 'disabled', 'open', 'defaultOpen', 'onOpenChange', 'placement',
  ]);
  const [open, setOpen] = createSignal(local.defaultOpen ?? false);
  const [trigger, setTrigger] = createSignal<HTMLElement>();
  const enabled = () =>
    import.meta.env.MODE !== 'test' && !local.disabled &&
    !isTouchDevice() && tooltipsEnabled();
  const visible = () => enabled() && (local.open ?? open());
  const changeOpen = (value: boolean) => {
    const next = value && enabled();
    setOpen(next);
    local.onOpenChange?.(next);
  };

  createEffect(on([visible, trigger], ([isOpen, element]) => {
    if (!isOpen || !element) return;
    const closeIfDetached = () => {
      if (!element.ownerDocument.body.contains(element) || !element.getClientRects().length) {
        changeOpen(false);
      }
    };
    closeIfDetached();
    const observer = new MutationObserver(closeIfDetached);
    observer.observe(element.ownerDocument.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style'],
      childList: true,
      subtree: true,
    });
    onCleanup(() => observer.disconnect());
  }));

  return (
    <TooltipContext.Provider value={{ visible, setTrigger: (element) => { setTrigger(element); } }}>
      <KTooltip
        {...rest}
        open={visible()}
        onOpenChange={changeOpen}
        disabled={!enabled()}
        placement={local.placement ?? 'bottom'}
        ignoreSafeArea
        overflowPadding={16}
        fitViewport
        openDelay={400}
        closeDelay={0}
        flip
        gutter={4}
      >
        {local.children}
      </KTooltip>
    </TooltipContext.Provider>
  );
}

function Trigger(props: ComponentProps<typeof KTooltip.Trigger>) {
  const context = useContext(TooltipContext);
  const [local, rest] = splitProps(props, ['ref']);
  return <KTooltip.Trigger {...rest} ref={mergeRefs(local.ref, context?.setTrigger)} />;
}

function TooltipPortal(props: ComponentProps<typeof KTooltip.Portal>) {
  return <KTooltip.Portal {...props} />;
}

function Content(props: ComponentProps<typeof KTooltip.Content>) {
  const context = useContext(TooltipContext);
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <Show when={context?.visible()}>
      <KTooltip.Content {...rest} class={cn('z-tool-tip max-w-[calc(100vw-32px)]', local.class)}>
        <Surface class={tooltipClasses()} depth={3}>
          {local.children}
        </Surface>
      </KTooltip.Content>
    </Show>
  );
}

export const Tooltip = { Root, Trigger, Portal: TooltipPortal, Content };
