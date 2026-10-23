export const useEmail = () => () =>
  new URLSearchParams(window.location.search).has('external')
    ? 'alice@example.com'
    : 'alice@macro.com';
export const useUserId = () => () => 'experimental-fixture';
