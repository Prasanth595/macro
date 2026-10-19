import { Dialog } from '@kobalte/core/dialog';
import CaretRight from '@phosphor/caret-right.svg';
import X from '@phosphor/x.svg';
import { createSignal, For, Show } from 'solid-js';
import './product-feature-details.css';

export type ProductFeatureDetail = { title: string; text: string };

/** Details open above the page without resizing or remounting its demo. */
export function ProductFeatureDetails(props: {
  section: string;
  details: readonly ProductFeatureDetail[];
}) {
  const [active, setActive] = createSignal<ProductFeatureDetail>();
  let opener: HTMLButtonElement | undefined;
  let closeButton: HTMLButtonElement | undefined;

  return (
    <>
      <div class="product-feature-details">
        <p>What you can do</p>
        <div class="product-feature-detail-links">
          <For each={props.details}>
            {(detail) => (
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={(event) => {
                  opener = event.currentTarget;
                  setActive(detail);
                }}
              >
                {detail.title}
                <CaretRight aria-hidden="true" />
              </button>
            )}
          </For>
        </div>
      </div>
      <Dialog
        open={!!active()}
        onOpenChange={(open) => {
          if (!open) setActive(undefined);
        }}
        modal
      >
        <Dialog.Portal>
          <Dialog.Overlay class="product-detail-backdrop" />
          <div class="product-detail-positioner">
            <Dialog.Content
              class="product-detail-modal"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                closeButton?.focus();
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (opener?.isConnected) opener.focus();
              }}
            >
              <Dialog.CloseButton
                ref={closeButton}
                class="product-detail-close"
                aria-label="Close feature details"
              >
                <X aria-hidden="true" />
              </Dialog.CloseButton>
              <p class="product-detail-context">{props.section}</p>
              <Show when={active()}>
                {(detail) => (
                  <>
                    <Dialog.Title class="product-detail-title">
                      {detail().title}
                    </Dialog.Title>
                    <Dialog.Description class="product-detail-text">
                      {detail().text}
                    </Dialog.Description>
                  </>
                )}
              </Show>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
