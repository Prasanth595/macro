// Source: origin/main@2452ad7f73, apps/web/src/index.css elevation-shadow/elevated
// and components/ui/components/Button.tsx. Adapted to lab tokens, not product layers.
// The finish replaces resting variant borders; pressed-state borders stay explicit.
export const raisedButtonStyles = [
  'border-transparent shadow-button-raised',
  'not-data-disabled:active:shadow-none aria-pressed:shadow-none aria-expanded:shadow-none',
].join(' ');

// Continuous face shading and contact shadow only; no reflective inset rim.
export const gradientRaisedButtonStyles = [
  'border-transparent shadow-button',
  'button-gradient-raised',
  'not-data-disabled:active:bg-none aria-pressed:bg-none aria-expanded:bg-none',
  'not-data-disabled:active:shadow-none aria-pressed:shadow-none aria-expanded:shadow-none',
].join(' ');
