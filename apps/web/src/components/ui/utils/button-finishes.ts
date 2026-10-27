// Desktop edges keep the Button material; touch reuses the app's glass surface.
// State variants override the device-qualified shadow without moving the control.
export const raisedButtonStyles = [
  'not-touch:border-transparent not-touch:shadow-button-raised touch:glass',
  'not-touch:not-data-disabled:active:shadow-none not-touch:aria-pressed:shadow-none not-touch:aria-expanded:shadow-none',
].join(' ');
