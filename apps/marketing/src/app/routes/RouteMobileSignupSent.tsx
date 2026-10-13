import { useLocation } from '@solidjs/router';
import { type Component, onMount, Show } from 'solid-js';
import { MobileSignupMark } from '../components/graphics/MobileSignupMark';
import { analytics } from '../utils/utilAnalytic';
import { viewportWidth } from '../utils/utilBreakpoint';
import {
  conversionAlreadyFired,
  MOBILE_WEB_SIGNUP_LEAD_VALUE,
  markConversionFired,
  submittedEmail,
} from '../utils/utilMobileSignup';
import { setPageSeo } from '../utils/utilSeo';

const APP_STORE_URL = 'https://apps.apple.com/us/app/macro-app/id6743133649';

/**
 * Confirmation step of the site's mobile email capture: the visitor has been
 * emailed a link to finish signing up on a computer.
 *
 * This page also owns the ad-platform conversions for the captured lead (Meta
 * Lead + CompleteRegistration, Google Ads `mobile_web_lead`) — they used to
 * fire from the equivalent screen in the app, and the campaigns that optimize
 * against them are unchanged, so the payloads here match what the app sent.
 */
export const RouteMobileSignupSent: Component = () => {
  setPageSeo({
    title: 'Check your email — Macro',
    description: 'We sent you an email to continue onboarding on desktop.',
    path: '/mobile-signup-sent',
    // The tail of the signup flow — never a landing page from search.
    noindex: true,
  });

  const location = useLocation<{ email: string }>();
  const mobile = () => viewportWidth() < 700;

  // Present when the visitor got here by submitting the form (history state
  // survives a refresh; session storage covers a fresh tab in the same session).
  const email = (): string | null => location.state?.email ?? submittedEmail();

  onMount(() => {
    // The email field can stay focused across this route change — force the
    // keyboard down even if blur-before-navigate was skipped somehow.
    (document.activeElement as HTMLElement | null)?.blur?.();

    const captured = email();
    // A direct visit captured nothing, so there is no lead to report.
    if (!captured || conversionAlreadyFired(captured)) return;
    markConversionFired(captured);

    analytics.track('mobile_web_signup_sent_viewed');
    // Fired as both Lead and CompleteRegistration: Meta's Maximize Value
    // campaigns don't support Lead, and an existing custom conversion in a live
    // ad campaign is built on Lead — so both have to keep coming.
    const leadPayload = {
      content_name: 'mobile_web_signup',
      value: MOBILE_WEB_SIGNUP_LEAD_VALUE,
      currency: 'USD',
    };
    analytics.trackMeta('Lead', leadPayload);
    analytics.trackMeta('CompleteRegistration', leadPayload);
    analytics.trackGoogleConversion('mobile_web_lead', {
      value: MOBILE_WEB_SIGNUP_LEAD_VALUE,
      currency: 'USD',
      transaction_id: captured,
    });
  });

  return (
    <section
      style={{
        'align-content': 'center',
        'box-sizing': 'border-box',
        display: 'grid',
        gap: '20px',
        'justify-items': 'center',
        margin: '0 auto',
        'max-width': '420px',
        'min-height': 'calc(100dvh / var(--site-scale, 1))',
        padding: '56px 0 12vh',
        'text-align': 'center',
        width: '100%',
      }}
    >
      <MobileSignupMark />

      <h1
        style={{
          color: 'var(--c0)',
          'font-family': 'display',
          'font-size': mobile() ? 'clamp(28px, 8vw, 36px)' : '36px',
          'font-weight': 'calc(315 + var(--cream-slab-weight-increase, 0))',
          'letter-spacing': '-0.012em',
          'line-height': 1.18,
          margin: '12px 0 0',
          'text-wrap': 'balance',
        }}
      >
        We&rsquo;ve sent you an email to continue onboarding on desktop.
      </h1>

      <p
        style={{
          color: 'var(--c2)',
          'font-family': 'body',
          'font-size': '15px',
          'line-height': 1.5,
          margin: '0 0 12px',
          'max-width': '34ch',
          'text-wrap': 'balance',
        }}
      >
        <Show
          when={email()}
          fallback="Open the link on your computer to finish signing up."
        >
          {(address) => (
            <>
              We emailed{' '}
              <span
                style={{ color: 'var(--c0)', 'overflow-wrap': 'anywhere' }}
              >
                {address()}
              </span>{' '}
              a link. Open it on your computer to finish signing up.
            </>
          )}
        </Show>
      </p>

      <a
        href={APP_STORE_URL}
        class="mobile-signup-submit"
        target="_blank"
        rel="noreferrer"
        onClick={() => {
          analytics.track('app_redirect', {
            page_location: window.location.href,
            button_name: 'mobile_signup_sent_app_store',
          });
        }}
        style={{
          'align-items': 'center',
          'box-sizing': 'border-box',
          display: 'inline-flex',
          height: '46px',
          'justify-content': 'center',
          'line-height': 1,
          'text-decoration': 'none',
          width: '100%',
        }}
      >
        We also have a mobile app
      </a>
    </section>
  );
};
