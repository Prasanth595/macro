import type { Component } from 'solid-js';
import { LinkBookDemo } from '../components/buttons/LinkBookDemo';
import { FormMobileSignup } from '../components/forms/FormMobileSignup';
import { MobileSignupMark } from '../components/graphics/MobileSignupMark';
import { viewportWidth } from '../utils/utilBreakpoint';
import { setPageSeo } from '../utils/utilSeo';

/**
 * Email capture for phones, the destination of every phone signup link. It is
 * only the capture: the visitor leaves an email and is sent a link to finish
 * onboarding on desktop.
 */
export const RouteMobileSignup: Component = () => {
  setPageSeo({
    title: 'Start for free — Macro',
    description:
      'Enter your email and we will send you a link to set up Macro on your computer.',
    path: '/mobile-signup',
    // A step inside the signup flow: useful to visitors, not a search result.
    noindex: true,
  });

  const mobile = () => viewportWidth() < 700;

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
          'font-size': mobile() ? 'clamp(34px, 10vw, 44px)' : '44px',
          'font-weight': 'calc(315 + var(--cream-slab-weight-increase, 0))',
          'letter-spacing': '-0.012em',
          'line-height': 1.12,
          margin: '12px 0 0',
        }}
      >
        One app for
        <br />
        all your work.
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
        Macro sets up on your computer. Drop your email and we&rsquo;ll send you
        a link to start.
      </p>

      <FormMobileSignup buttonName="mobile_signup_page" />
      <LinkBookDemo buttonName="mobile_signup_page_book_demo" />
    </section>
  );
};
