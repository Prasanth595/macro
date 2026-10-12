export const FEATURE_PAGES = [
  { href: '/email', label: 'Email' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/channels', label: 'Chat' },
  { href: '/documents', label: 'Docs' },
  { href: '/calls', label: 'Calls' },
  { href: '/crm', label: 'CRM' },
  { href: '/agents', label: 'Agents' },
  { href: '/github', label: 'GitHub' },
] as const;

export const RESOURCE_PAGES = [
  {
    href: 'https://www.youtube.com/channel/UCcn-1WTGff0X_RscGVtwljQ',
    label: 'Videos',
  },
  { href: 'https://docs.macro.com', label: 'Documentation' },
  { href: '/migrate', label: 'Migration guide' },
  { href: '/posts', label: 'Blog' },
] as const;

/** Macro team booking link: a live demo with whichever host is free. */
export const DEMO_BOOKING_URL =
  'https://macro.com/app/book/6de4003c-15e4-549f-b5a9-0e930bbf56e4/macro-demo-call';

/** Full document navigation keeps the app and marketing CSS independent. */
export function journeyHref() {
  if (typeof window === 'undefined') return '/app/signup';
  try {
    const active = JSON.parse(
      sessionStorage.getItem('onboarding-flow-step') ?? 'null'
    );
    if (active?.user && active?.step) return '/app/onboarding';
  } catch {
    // An old or unavailable storage record must not prevent navigation.
  }
  return '/app/signup';
}
