import { Dialog } from '@kobalte/core/dialog';
import ArrowUpRight from '@phosphor/arrow-up-right.svg';
import X from '@phosphor/x.svg';
import { createSignal, onCleanup } from 'solid-js';
import { createSitePalette } from '../../setup/sitePalette';
import './homepage-feature-details.css';

/** Keep the homepage in place while the existing product page opens beside it. */
export function HomepageFeatureDetails(props: {
  title: string;
  path: '/email' | '/documents' | '/agents' | '/crm';
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
          aria-label={`Learn more about ${props.title.toLowerCase()}`}
          onClick={() => changeOpen(true)}
        >
          Learn more<span aria-hidden="true">+</span>
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
            <header>
              <Dialog.Title>{props.title}</Dialog.Title>
              <a
                href={props.path}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${props.title.toLowerCase()} page in a new tab`}
                title="Open full page"
              >
                <ArrowUpRight aria-hidden="true" />
              </a>
              <Dialog.CloseButton
                ref={closeButton}
                aria-label="Close product page"
              >
                <X aria-hidden="true" />
              </Dialog.CloseButton>
            </header>
            <Dialog.Description class="sr-only">
              Read the {props.title.toLowerCase()} product page without leaving
              the homepage.
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
