// Reuse shared elevation with Button edge colors on desktop and glass on touch.
// State variants flatten the shared finish without moving the control.
export const raisedButtonStyles = [
  'not-touch:button-elevated touch:glass',
  'not-touch:not-data-disabled:active:shadow-none not-touch:aria-pressed:shadow-none not-touch:aria-expanded:shadow-none',
].join(' ');
