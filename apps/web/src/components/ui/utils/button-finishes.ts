// Raised edge and contact shadow use the app's scoped Button tokens.
// The finish replaces resting variant borders; pressed-state borders stay explicit.
export const raisedButtonStyles = [
  'border-transparent shadow-button-raised',
  'not-data-disabled:active:shadow-none aria-pressed:shadow-none aria-expanded:shadow-none',
].join(' ');
