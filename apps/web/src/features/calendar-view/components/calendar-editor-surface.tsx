import { MobileDrawer } from '@components/app/mobile/MobileDrawer';
import { focusPopoverInput } from '@components/app/split-layout/utils/focusPopoverInput';
import { useHotkeyDOMScope } from '@core/hotkey/hotkeys';
import { isMobile } from '@core/mobile/isMobile';
import { Dialog as KobalteDialog } from '@kobalte/core/dialog';
import { Popover } from '@kobalte/core/popover';
import SidebarIcon from '@phosphor/sidebar-simple.svg';
import CloseIcon from '@phosphor/x.svg';
import { Button, Layer } from '@ui';
import { type JSX, Show } from 'solid-js';
import type {
  CalendarEditorDraft,
  CalendarEditorPresentation,
} from '../primitives/create-calendar-editor';

export function CalendarEditorSurface(props: {
  boundary: HTMLElement;
  draft: CalendarEditorDraft;
  surface: CalendarEditorPresentation;
  pending: boolean;
  onClose: () => void;
  onMoveToSidebar: () => void;
  children: JSX.Element;
}) {
  const label = () => (props.draft.event ? 'Edit event' : 'New event');
  const Header = () => {
    const [attachHotkeys] = useHotkeyDOMScope('event-composer', true);
    return (
      <Show when={!isMobile()}>
        <div
          ref={attachHotkeys}
          data-event-editor-header
          class="flex shrink-0 items-center justify-end gap-1 px-3 pb-1 pt-2"
        >
          <Show when={props.surface === 'popover'}>
            <Button
              type="button"
              label="Move to sidebar"
              variant="ghost"
              size="icon-sm"
              disabled={props.pending}
              onClick={props.onMoveToSidebar}
            >
              <SidebarIcon class="size-4" />
            </Button>
          </Show>
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
      </Show>
    );
  };

  return (
    <Show
      when={isMobile()}
      fallback={
        <Show
          when={props.surface === 'popover'}
          fallback={
            // The editor sidebar must leave the calendar interactive.
            <KobalteDialog
              open
              modal={false}
              onOpenChange={(open) => !open && props.onClose()}
            >
              <Layer depth={3}>
                <KobalteDialog.Content
                  as="aside"
                  aria-label={label()}
                  class="portal-scope z-20 m-3 flex min-h-0 w-[min(25rem,calc(100%-1.5rem))] shrink-0 flex-col overflow-hidden rounded-xl border border-edge-muted glass bg-menu-glass text-ink outline-none"
                  onOpenAutoFocus={focusEditorTitle}
                  onInteractOutside={(event) => event.preventDefault()}
                  onCloseAutoFocus={(event) => event.preventDefault()}
                >
                  <KobalteDialog.Title class="sr-only">
                    {label()}
                  </KobalteDialog.Title>
                  <Header />
                  <EditorFormBody>{props.children}</EditorFormBody>
                </KobalteDialog.Content>
              </Layer>
            </KobalteDialog>
          }
        >
          <EditorPopover
            boundary={props.boundary}
            draft={props.draft}
            onClose={props.onClose}
          >
            <Header />
            <EditorFormBody>{props.children}</EditorFormBody>
          </EditorPopover>
        </Show>
      }
    >
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
            aria-label={label()}
          >
            <MobileDrawer.Handle />
            <MobileDrawer.Title class="sr-only">{label()}</MobileDrawer.Title>
            <Header />
            <MobileDrawer.ScrollBody>
              <EditorFormBody>{props.children}</EditorFormBody>
            </MobileDrawer.ScrollBody>
          </MobileDrawer.Content>
        </MobileDrawer.Portal>
      </MobileDrawer>
    </Show>
  );
}

function EditorFormBody(props: { children: JSX.Element }) {
  const [attachHotkeys] = useHotkeyDOMScope('event-composer', true);
  return (
    <div ref={attachHotkeys} class="flex min-h-0 flex-1 flex-col px-4 pb-4">
      {props.children}
    </div>
  );
}

function EditorPopover(props: {
  boundary: HTMLElement;
  draft: CalendarEditorDraft;
  onClose: () => void;
  children: JSX.Element;
}) {
  // Calendar-owned positioning survives scrolling and recycled grid pages.
  let anchor: HTMLSpanElement | undefined;
  return (
    <>
      <span
        ref={anchor}
        aria-hidden="true"
        class="pointer-events-none absolute bottom-3 left-1/2 size-0"
      />
      <Popover
        open
        modal={false}
        anchorRef={() => anchor}
        boundary={() => props.boundary}
        placement="top"
        gutter={0}
        flip={false}
        slide
        fitViewport
        overflowPadding={12}
        onOpenChange={(open) => !open && props.onClose()}
      >
        <Popover.Portal mount={props.boundary}>
          <Layer depth={3}>
            <Popover.Content
              class="portal-scope z-modal flex max-h-[var(--kb-popper-content-available-height)] w-[min(25rem,var(--kb-popper-content-available-width,25rem))] min-w-0 flex-col rounded-xl border border-edge-muted glass bg-menu-glass text-ink outline-none"
              onOpenAutoFocus={focusEditorTitle}
              onInteractOutside={(event) => event.preventDefault()}
              onFocusOutside={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <Popover.Title class="sr-only">
                {props.draft.event ? 'Edit event' : 'New event'}
              </Popover.Title>
              {props.children}
            </Popover.Content>
          </Layer>
        </Popover.Portal>
      </Popover>
    </>
  );
}

// Creation starts typing in Title instead of focusing the surface controls.
function focusEditorTitle(event: Event) {
  const container = event.target;
  if (!(container instanceof HTMLElement)) return;
  focusPopoverInput(event, container);
}
