import { Dialog } from '@kobalte/core/dialog';
import X from '@phosphor/x.svg';
import { createSignal, For, Show } from 'solid-js';
import type { HomepageFeatureDetail } from '../core/homepage-feature-details';
import './homepage-feature-details.css';

/** One quiet, accessible side panel for the details in a product section. */
export function HomepageFeatureDetails(props: {
  group: string;
  details: readonly HomepageFeatureDetail[];
}) {
  const [active, setActive] = createSignal<HomepageFeatureDetail>();
  const [open, setOpen] = createSignal(false);
  let opener: HTMLButtonElement | undefined;
  let closeButton: HTMLButtonElement | undefined;

  return (
    <>
      <div class="homepage-feature-details workspace-demo">
        <p>What you can do</p>
        <div class="homepage-feature-detail-grid">
          <For each={props.details}>
            {(detail) => (
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={(event) => {
                  opener = event.currentTarget;
                  setActive(detail);
                  setOpen(true);
                }}
              >
                {detail.title}
                <span aria-hidden="true">+</span>
              </button>
            )}
          </For>
        </div>
      </div>
      <Dialog open={open()} onOpenChange={setOpen} modal>
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
              <span>{props.group}</span>
              <Dialog.CloseButton
                ref={closeButton}
                aria-label="Close feature details"
              >
                <X aria-hidden="true" />
              </Dialog.CloseButton>
            </header>
            <Show when={active()}>
              {(detail) => (
                <div class="homepage-detail-body">
                  <Dialog.Title class="homepage-detail-title">
                    {detail().title}
                  </Dialog.Title>
                  <Dialog.Description class="homepage-detail-lead">
                    {detail().text}
                  </Dialog.Description>
                  <p class="homepage-detail-explanation">{detail().body}</p>
                  <div class="homepage-detail-example">
                    <p>For example</p>
                    <blockquote>{detail().example}</blockquote>
                  </div>
                </div>
              )}
            </Show>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
