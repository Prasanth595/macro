import { Dialog } from '@kobalte/core/dialog';
import CaretRight from '@phosphor/caret-right.svg';
import X from '@phosphor/x.svg';
import { createSignal, onCleanup } from 'solid-js';
import { createSitePalette } from '../../setup/sitePalette';
import './homepage-feature-details.css';

export type ProductPagePath =
  | '/email'
  | '/channels'
  | '/documents'
  | '/tasks'
  | '/agents'
  | '/crm';

/** Keep the homepage in place while the existing product page opens beside it. */
export function HomepageFeatureDetails(props: {
  title: string;
  path: ProductPagePath;
}) {
  const palette = createSitePalette();
  const [open, setOpen] = createSignal(false);
  const [loaded, setLoaded] = createSignal(false);
  let opener!: HTMLButtonElement;
  let closeButton: HTMLButtonElement | undefined;
  let frame: HTMLIFrameElement | undefined;
  let releaseFrame: (() => void) | undefined;
  const changeOpen = (next: boolean) => {
    if (!next) {
      releaseFrame?.();
      releaseFrame = undefined;
    } else setLoaded(false);
    setOpen(next);
  };
  const attachPage = () => {
    if (!open()) return;
    releaseFrame?.();
    releaseFrame = undefined;
    setLoaded(true);
    // Escape inside a same-origin frame does not bubble to the outer dialog.
    let page: Document | null | undefined;
    try {
      page = frame?.contentDocument;
    } catch {
      return;
    }
    if (!page) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        page.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')
      )
        return;
      event.preventDefault();
      changeOpen(false);
    };
    page.addEventListener('keydown', handleEscape);
    releaseFrame = () => page.removeEventListener('keydown', handleEscape);
  };
  onCleanup(() => releaseFrame?.());

  return (
    <>
      <div class="homepage-feature-more workspace-demo">
        <button
          ref={opener}
          type="button"
          aria-haspopup="dialog"
          aria-label={`Learn more about ${props.title}`}
          onClick={() => changeOpen(true)}
        >
          {props.title}
          <CaretRight aria-hidden="true" />
        </button>
      </div>
      <Dialog open={open()} onOpenChange={changeOpen} modal>
        <Dialog.Portal>
          <Dialog.Overlay class="homepage-detail-backdrop" />
          <Dialog.Content
            class="homepage-detail-panel"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              closeButton?.focus();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (opener?.isConnected) opener.focus();
            }}
          >
            <Dialog.Title class="sr-only">{props.title}</Dialog.Title>
            <Dialog.CloseButton
              class="homepage-detail-close"
              ref={closeButton}
              aria-label="Close product page"
            >
              <X aria-hidden="true" />
            </Dialog.CloseButton>
            <Dialog.Description class="sr-only">
              Read the {props.title} product page without leaving the homepage.
            </Dialog.Description>
            <div class="homepage-detail-page" aria-busy={!loaded()}>
              <iframe
                ref={frame}
                title={`${props.title} product page`}
                src={`${props.path}?embed=feature&theme=${palette()}`}
                onLoad={attachPage}
              />
              {!loaded() && <p role="status">Opening page…</p>}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
