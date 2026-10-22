import { MobileDrawer } from '@components/app/mobile/MobileDrawer';
import { focusPopoverInput } from '@components/app/split-layout/utils/focusPopoverInput';
import { useHotkeyDOMScope } from '@core/hotkey/hotkeys';
import { isMobile } from '@core/mobile/isMobile';
import { Dialog as KobalteDialog } from '@kobalte/core/dialog';
import PopoverIcon from '@phosphor/browsers.svg';
import SidebarIcon from '@phosphor/sidebar.svg';
import CloseIcon from '@phosphor/x.svg';
import { Button, Layer } from '@ui';
import { createSignal, type JSX, Show } from 'solid-js';
import type {
  CalendarEditorDraft,
  CalendarEditorPresentation,
} from '../primitives/create-calendar-editor';
import { createCalendarEditorDrag } from '../primitives/create-calendar-editor-drag';

type CalendarEditorSurfaceProps = {
  boundary: HTMLElement;
  draft: CalendarEditorDraft;
  anchor?: HTMLElement;
  surface: CalendarEditorPresentation;
  pending: boolean;
  onClose: () => void;
  onMoveToSidebar: () => void;
  onMoveToPopover: () => void;
  children: JSX.Element;
};

export function CalendarEditorSurface(props: CalendarEditorSurfaceProps) {
  return (
    <Show when={isMobile()} fallback={<DesktopEditorSurface {...props} />}>
      <MobileDrawer
        open
        side="bottom"
        onOpenChange={(open) => !open && props.onClose()}
        restoreFocus
        onInitialFocus={(event) => event.preventDefault()}
      >
        <MobileDrawer.Portal>
          <MobileDrawer.Overlay />
          <MobileDrawer.Content
            targetHeight={100}
            maxHeight={100}
            aria-label={props.draft.event ? 'Edit event' : 'New event'}
          >
            <MobileDrawer.Handle />
            <MobileDrawer.Title class="sr-only">
              {props.draft.event ? 'Edit event' : 'New event'}
            </MobileDrawer.Title>
            <MobileDrawer.ScrollBody>
              <EditorFormBody>{props.children}</EditorFormBody>
            </MobileDrawer.ScrollBody>
          </MobileDrawer.Content>
        </MobileDrawer.Portal>
      </MobileDrawer>
    </Show>
  );
}

function DesktopEditorSurface(props: CalendarEditorSurfaceProps) {
  const label = () => (props.draft.event ? 'Edit event' : 'New event');
  const [slot, setSlot] = createSignal<HTMLElement>();
  const [panel, setPanel] = createSignal<HTMLElement>();
  const [attachHotkeys] = useHotkeyDOMScope('event-composer', true);
  const drag = createCalendarEditorDrag({
    boundary: props.boundary,
    slot,
    panel,
    anchor: () => props.anchor ?? props.draft.anchor?.element,
    anchorRect: props.draft.anchor?.rect,
    surface: () => props.surface,
    pending: () => props.pending,
    onDropFromSidebar: props.onMoveToPopover,
  });
  const moveToSidebar = () => {
    drag.clearDrop();
    props.onMoveToSidebar();
  };
  const moveToPopover = () => {
    drag.clearDrop();
    props.onMoveToPopover();
  };

  return (
    <KobalteDialog
      open
      modal={false}
      onOpenChange={(open) => !open && props.onClose()}
    >
      {/* Keep the sidebar's layout slot until the actual editor is dropped. */}
      <Show when={drag.reserveSlot()}>
        <div
          ref={setSlot}
          aria-hidden="true"
          data-event-editor-sidebar-slot
          class="m-3 w-[min(25rem,calc(100%-1.5rem))] shrink-0 self-stretch"
        />
      </Show>
      <KobalteDialog.Portal mount={props.boundary}>
        {/* Local menus belong outside the clipped, scrollable editor. */}
        <div class="portal-scope contents">
          <Layer depth={3}>
            {/* Keep the title focusable before asynchronous placement completes. */}
            <KobalteDialog.Content
              ref={setPanel}
              as="aside"
              aria-label={label()}
              data-dragging={drag.dragging() ? '' : undefined}
              class="fixed z-modal flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-edge-muted glass bg-menu-glass text-ink outline-none"
              style={{ opacity: 0, 'pointer-events': 'none' }}
              onOpenAutoFocus={focusEditorTitle}
              onInteractOutside={(event) => event.preventDefault()}
              onFocusOutside={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <KobalteDialog.Title class="sr-only">
                {label()}
              </KobalteDialog.Title>
              <div
                ref={attachHotkeys}
                data-event-editor-header
                class="flex shrink-0 touch-none select-none items-center justify-between gap-1 px-3 pb-1 pt-2"
                classList={{
                  'cursor-grab': !props.pending && !drag.dragging(),
                  'cursor-grabbing': drag.dragging(),
                }}
                onPointerDown={drag.onPointerDown}
                onPointerMove={drag.onPointerMove}
                onPointerUp={drag.onPointerUp}
                onPointerCancel={drag.onPointerCancel}
                onLostPointerCapture={drag.onLostPointerCapture}
              >
                <Show when={props.surface === 'popover'}>
                  <Button
                    type="button"
                    label="Move to sidebar"
                    variant="ghost"
                    size="icon-sm"
                    disabled={props.pending}
                    onClick={moveToSidebar}
                  >
                    <SidebarIcon aria-hidden="true" class="size-4 rotate-180" />
                  </Button>
                </Show>
                <Show when={props.surface === 'sidebar'}>
                  <Button
                    type="button"
                    label="Move to popover"
                    variant="ghost"
                    size="icon-sm"
                    disabled={props.pending}
                    onClick={moveToPopover}
                  >
                    <PopoverIcon aria-hidden="true" class="size-4" />
                  </Button>
                </Show>
                <span
                  aria-hidden="true"
                  title="Drag to move event editor"
                  class="mx-auto h-1 w-7 rounded-full bg-ink/20"
                />
                <Button
                  type="button"
                  label="Close event editor"
                  variant="ghost"
                  size="icon-sm"
                  disabled={props.pending}
                  onClick={props.onClose}
                >
                  <CloseIcon class="size-4" />
                </Button>
              </div>
              <EditorFormBody scroll>{props.children}</EditorFormBody>
            </KobalteDialog.Content>
          </Layer>
        </div>
      </KobalteDialog.Portal>
    </KobalteDialog>
  );
}

function EditorFormBody(props: { children: JSX.Element; scroll?: boolean }) {
  const [attachHotkeys] = useHotkeyDOMScope('event-composer', true);
  return (
    <div
      ref={attachHotkeys}
      class="flex min-h-0 flex-1 flex-col px-4 pb-4"
      classList={{ 'overflow-y-auto': props.scroll }}
    >
      {props.children}
    </div>
  );
}

// Creation starts typing in Title instead of focusing the surface controls.
function focusEditorTitle(event: Event) {
  const container = event.target;
  if (!(container instanceof HTMLElement)) return;
  focusPopoverInput(event, container);
}
