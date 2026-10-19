import { Dialog } from '@kobalte/core/dialog';
import ArrowLeft from '@phosphor/arrow-left.svg';
import ArrowRight from '@phosphor/arrow-right.svg';
import X from '@phosphor/x.svg';
import { createSignal, createUniqueId, For, Show } from 'solid-js';
import { isEmbeddedProductPage } from './productPagePreview';
import './product-feature-details.css';

export type ProductFeatureDetail = {
  title: string;
  summary: string;
  text: string;
};

/** Standalone drawer; inside the homepage drawer, reuse its whole viewport. */
export function ProductFeatureDetails(props: {
  section: string;
  details: readonly ProductFeatureDetail[];
}) {
  const embedded = isEmbeddedProductPage();
  const [active, setActive] = createSignal<ProductFeatureDetail>();
  let opener: HTMLButtonElement | undefined;
  let closeButton: HTMLButtonElement | undefined;

  return (
    <>
      <div class="product-feature-details">
        <div class="product-feature-detail-links">
          <For each={props.details}>
            {(detail) => {
              const id = createUniqueId();
              return (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-labelledby={`${id}-title`}
                  aria-describedby={`${id}-summary`}
                  onClick={(event) => {
                    opener = event.currentTarget;
                    setActive(detail);
                  }}
                >
                  <span class="product-feature-card-title" id={`${id}-title`}>
                    {detail.title}
                    <ArrowRight aria-hidden="true" />
                  </span>
                  <span
                    class="product-feature-card-summary"
                    id={`${id}-summary`}
                  >
                    {detail.summary}
                  </span>
                </button>
              );
            }}
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
          <Show when={!embedded}>
            <Dialog.Overlay class="product-detail-backdrop" />
          </Show>
          <div
            class="product-detail-positioner"
            data-embedded={embedded ? 'true' : undefined}
          >
            <Dialog.Content
              class="product-detail-panel"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                closeButton?.focus();
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (opener?.isConnected) opener.focus({ preventScroll: true });
              }}
            >
              <Dialog.CloseButton
                ref={closeButton}
                class={
                  embedded ? 'product-detail-back' : 'product-detail-close'
                }
                aria-label={
                  embedded ? 'Back to product page' : 'Close feature details'
                }
              >
                <Show when={embedded} fallback={<X aria-hidden="true" />}>
                  <ArrowLeft aria-hidden="true" /> Back
                </Show>
              </Dialog.CloseButton>
              <div class="product-detail-body">
                <p class="product-detail-context">{props.section}</p>
                <Show when={active()}>
                  {(detail) => (
                    <>
                      <Dialog.Title class="product-detail-title">
                        {detail().title}
                      </Dialog.Title>
                      <p class="product-detail-lead">{detail().summary}</p>
                      <Dialog.Description class="product-detail-text">
                        {detail().text}
                      </Dialog.Description>
                    </>
                  )}
                </Show>
              </div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
