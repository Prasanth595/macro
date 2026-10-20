import { Dialog } from '@kobalte/core/dialog';
import ArrowLeft from '@phosphor/arrow-left.svg';
import ArrowRight from '@phosphor/arrow-right.svg';
import X from '@phosphor/x.svg';
import {
  createSignal,
  createUniqueId,
  For,
  Match,
  Show,
  Switch,
} from 'solid-js';
import type {
  ProductFeatureDetail,
  ProductGuideSection,
} from '../core/product-feature-guide';
import { isEmbeddedProductPage } from './productPagePreview';
import './product-feature-details.css';

export type { ProductFeatureDetail } from '../core/product-feature-guide';

function GuideSection(props: { section: ProductGuideSection }) {
  const headingId = createUniqueId();
  return (
    <section
      class="product-guide-section"
      data-kind={props.section.kind}
      aria-labelledby={headingId}
    >
      <h3 id={headingId}>{props.section.heading}</h3>
      <Switch>
        <Match when={props.section.kind === 'text' && props.section}>
          {(section) => (
            <For each={section().paragraphs}>{(text) => <p>{text}</p>}</For>
          )}
        </Match>
        <Match when={props.section.kind === 'steps' && props.section}>
          {(section) => (
            <ol class="product-guide-steps">
              <For each={section().items}>
                {(item) => (
                  <li>
                    <h4>{item.title}</h4>
                    <p>{item.text}</p>
                  </li>
                )}
              </For>
            </ol>
          )}
        </Match>
        <Match when={props.section.kind === 'facts' && props.section}>
          {(section) => (
            <dl class="product-guide-facts">
              <For each={section().items}>
                {(item) => (
                  <div>
                    <dt>{item.title}</dt>
                    <dd>{item.text}</dd>
                  </div>
                )}
              </For>
            </dl>
          )}
        </Match>
        <Match when={props.section.kind === 'prompt' && props.section}>
          {(section) => <p class="product-guide-prompt">{section().text}</p>}
        </Match>
        <Match when={props.section.kind === 'example' && props.section}>
          {(section) => <blockquote>{section().text}</blockquote>}
        </Match>
        <Match when={props.section.kind === 'note' && props.section}>
          {(section) => <p>{section().text}</p>}
        </Match>
      </Switch>
    </section>
  );
}

/** Standalone drawer; inside the homepage drawer, reuse its whole viewport. */
export function ProductFeatureDetails(props: {
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
              <header class="product-detail-toolbar">
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
              </header>
              <div
                class="product-detail-scroll"
                tabIndex={0}
                role="region"
                aria-label="Feature guide"
              >
                <article class="product-detail-body">
                  <Show when={active()}>
                    {(detail) => (
                      <>
                        <Dialog.Title class="product-detail-title">
                          {detail().title}
                        </Dialog.Title>
                        <Dialog.Description class="product-detail-lead">
                          {detail().intro}
                        </Dialog.Description>
                        <For each={detail().sections}>
                          {(section) => <GuideSection section={section} />}
                        </For>
                        <footer class="product-guide-links">
                          <For each={detail().links}>
                            {(link) => (
                              <a
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {link.label}
                                <ArrowRight aria-hidden="true" />
                              </a>
                            )}
                          </For>
                        </footer>
                      </>
                    )}
                  </Show>
                </article>
              </div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
