import { Dialog } from '@kobalte/core/dialog';
import X from '@phosphor/x.svg';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { DEMO_BOOKING_URL } from '../core/navigation';
import { createFrameEscape } from '../primitives/createFrameEscape';
import './demo-booking-dialog.css';

// The booking page allows framing from its own origin only.
const BOOKING_PATH = new URL(DEMO_BOOKING_URL).pathname;

/**
 * A refused frame (booking paths that do not allow framing yet, or an app copy
 * cached before they did) holds a browser error page. Hand the visitor to the
 * booking page itself rather than leave them in front of it.
 */
const leaveIfRefused = (frame: HTMLIFrameElement) => {
  let shown = false;
  try {
    shown = frame.contentWindow?.location.pathname.startsWith('/app/') === true;
  } catch {
    // The error page is cross-origin, so reading its location throws.
  }
  if (!shown) window.open(DEMO_BOOKING_URL, '_self');
};

/**
 * Books a demo without leaving the page. Demo links stay ordinary links to the
 * booking page: a plain click on any of them opens this dialog, and everything
 * else (a new-tab click, no script) follows the link.
 */
export function DemoBookingDialog() {
  const [open, setOpen] = createSignal(false);
  const [loaded, setLoaded] = createSignal(false);
  let opener: HTMLAnchorElement | undefined;
  const frameEscape = createFrameEscape(() => changeOpen(false));
  const changeOpen = (value: boolean) => {
    if (!value) frameEscape.release();
    setLoaded(false);
    setOpen(value);
  };

  onMount(() => {
    const openFromLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest('a');
      if (link?.href !== DEMO_BOOKING_URL) return;
      event.preventDefault();
      opener = link;
      changeOpen(true);
    };
    document.addEventListener('click', openFromLink);
    onCleanup(() => document.removeEventListener('click', openFromLink));
  });

  return (
    <Dialog open={open()} onOpenChange={changeOpen} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="demo-booking-overlay" />
        <Dialog.Content
          class="demo-booking-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener?.focus({ preventScroll: true });
          }}
        >
          <header class="demo-booking-titlebar">
            <Dialog.Title>Talk to us</Dialog.Title>
            <Dialog.CloseButton class="demo-booking-close" aria-label="Close">
              <X />
            </Dialog.CloseButton>
          </header>
          <div class="demo-booking-frame-wrap">
            <Show when={!loaded()}>
              <div class="demo-booking-loading" role="status">
                Loading…
              </div>
            </Show>
            <Show when={open()}>
              <iframe
                src={BOOKING_PATH}
                title="Book a demo"
                class="demo-booking-frame"
                onLoad={(event) => {
                  frameEscape.watch(event.currentTarget);
                  setLoaded(true);
                  leaveIfRefused(event.currentTarget);
                }}
              />
            </Show>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
