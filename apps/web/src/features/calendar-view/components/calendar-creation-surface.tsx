import { MobileDrawer } from '@components/app/mobile/MobileDrawer';
import { useHotkeyDOMScope } from '@core/hotkey/hotkeys';
import { isMobile } from '@core/mobile/isMobile';
import { Dialog as KobalteDialog } from '@kobalte/core/dialog';
import { Popover } from '@kobalte/core/popover';
import SidebarIcon from '@phosphor/sidebar-simple.svg';
import CloseIcon from '@phosphor/x.svg';
import { createElementSize } from '@solid-primitives/resize-observer';
import { Button, Layer } from '@ui';
import { type JSX, Show } from 'solid-js';
import type { CalendarCreationDraft } from '../primitives/create-calendar-creation';

export function CalendarCreationSurface(props: {
  boundary: HTMLElement;
  draft: CalendarCreationDraft;
  surface: 'popover' | 'sidebar';
  pending: boolean;
  onClose: () => void;
  onMoveToSidebar: () => void;
  children: JSX.Element;
}) {
  const header = () => (
    <div class="order-first flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-3">
      <h2 class="text-xs font-medium text-ink-muted">New event</h2>
      <div class="flex items-center gap-1">
        <Show when={!isMobile() && props.surface === 'popover'}>
          <Button
            type="button"
            label="Move to sidebar"
            variant="ghost"
            size="icon-sm"
            onClick={props.onMoveToSidebar}
          >
            <SidebarIcon class="size-4" />
          </Button>
        </Show>
        <Show when={!isMobile()}>
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
        </Show>
      </div>
    </div>
  );

  return (
    <Show
      when={isMobile()}
      fallback={
        <Show
          when={props.surface === 'popover'}
          fallback={
            // The shared Dialog wrapper is modal; the sidebar must leave the grid interactive.
            <KobalteDialog
              open
              modal={false}
              onOpenChange={(open) => !open && props.onClose()}
            >
              <Layer depth={3}>
                <KobalteDialog.Content
                  as="aside"
                  aria-label="New event"
                  class="portal-scope z-20 flex h-full min-h-0 w-[min(25rem,100%)] shrink-0 flex-col border-l border-edge-muted bg-panel text-ink outline-none"
                  onInteractOutside={(event) => event.preventDefault()}
                  onCloseAutoFocus={(event) => event.preventDefault()}
                >
                  <KobalteDialog.Title class="sr-only">
                    New event
                  </KobalteDialog.Title>
                  <CreationFormBody>{props.children}</CreationFormBody>
                  {header()}
                </KobalteDialog.Content>
              </Layer>
            </KobalteDialog>
          }
        >
          <CreationPopover
            boundary={props.boundary}
            draft={props.draft}
            onClose={props.onClose}
          >
            <CreationFormBody>{props.children}</CreationFormBody>
            {header()}
          </CreationPopover>
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
            aria-label="New event"
          >
            <MobileDrawer.Handle />
            <MobileDrawer.Title class="sr-only">New event</MobileDrawer.Title>
            <MobileDrawer.ScrollBody>
              <CreationFormBody>{props.children}</CreationFormBody>
            </MobileDrawer.ScrollBody>
          </MobileDrawer.Content>
        </MobileDrawer.Portal>
      </MobileDrawer>
    </Show>
  );
}

function CreationFormBody(props: { children: JSX.Element }) {
  const [attachHotkeys] = useHotkeyDOMScope('event-composer', true);
  return (
    <div ref={attachHotkeys} class="flex min-h-0 flex-1 flex-col px-4 pb-4">
      {props.children}
    </div>
  );
}

function CreationPopover(props: {
  boundary: HTMLElement;
  draft: CalendarCreationDraft;
  onClose: () => void;
  children: JSX.Element;
}) {
  const size = createElementSize(() => props.boundary);
  // A stationary anchor survives scroll, date navigation, and recycled grid pages.
  const bounds = props.boundary.getBoundingClientRect();
  const origin = props.draft.anchor;
  const left = () =>
    Math.max(
      8,
      Math.min((origin?.x ?? bounds.x) - bounds.x, (size.width ?? 0) - 8)
    );
  const top = () =>
    Math.max(
      8,
      Math.min((origin?.y ?? bounds.y) - bounds.y, (size.height ?? 0) - 8)
    );
  let anchor: HTMLSpanElement | undefined;
  return (
    <>
      <span
        ref={anchor}
        aria-hidden="true"
        class="pointer-events-none absolute"
        style={{
          left: `${left()}px`,
          top: `${top()}px`,
          width: `${origin?.width ?? 0}px`,
          height: '1px',
        }}
      />
      <Popover
        open
        modal={false}
        anchorRef={() => anchor}
        boundary={() => props.boundary}
        placement="right-start"
        gutter={8}
        flip
        slide
        overlap
        fitViewport
        onOpenChange={(open) => !open && props.onClose()}
      >
        <Popover.Portal mount={props.boundary}>
          <Layer depth={3}>
            <Popover.Content
              class="portal-scope z-modal flex w-[min(25rem,var(--kb-popper-content-available-width,25rem))] min-w-0 flex-col overflow-hidden rounded-xl border border-edge-muted glass bg-menu-glass text-ink outline-none"
              style={{
                'max-height': `${Math.max(0, (size.height ?? 560) - 16)}px`,
              }}
              onInteractOutside={(event) => event.preventDefault()}
              onFocusOutside={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <Popover.Title class="sr-only">New event</Popover.Title>
              {props.children}
            </Popover.Content>
          </Layer>
        </Popover.Portal>
      </Popover>
    </>
  );
}
