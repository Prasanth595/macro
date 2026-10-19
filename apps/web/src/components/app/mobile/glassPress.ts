import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { isPlatform } from '@core/util/platform';

const GROUP =
  '[data-mobile-dock-island], [data-header-island], [data-slot="button-group"].glass';
const CONTROL =
  'button, a, [role="button"], [role="tab"], [data-header-island]';
const INPUT = '[data-glass-input], [data-input] [data-composer-collapsed]';
const DISABLED = ':disabled, [data-disabled], [aria-disabled="true"]';

/** Round controls grow 28%; wide surfaces expand their paint by up to 6px per edge. */
export function glassPressGeometry(width: number, height: number) {
  const outset = Math.min(6, width * 0.15, height * 0.15);
  return {
    outset,
    round: width <= height * 1.15,
    scale: 1.28,
  };
}

/**
 * Animate native iOS glass/island controls, channel inputs and enclosing groups,
 * including controls rendered through portals. CSS owns the persistent paint
 * layers and their release transitions; controls own action timing.
 */
export function installGlassPress() {
  let pressed:
    | { element: HTMLElement; pointerId: number; bounds: DOMRect }
    | undefined;
  const release = () => {
    if (!pressed) return;
    pressed.element.removeAttribute('data-glass-press');
    // Keep the last tap geometry for the fading shimmer. These values belong
    // to the element, so removing it needs no timer or retained reference.
    pressed = undefined;
  };
  const down = (event: PointerEvent) => {
    if (
      !isPlatform('ios') ||
      !isTouchDevice() ||
      !event.isPrimary ||
      event.button !== 0
    )
      return;
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLElement>(CONTROL);
    if (event.target.closest(DISABLED)) return;
    const input = event.target.closest<HTMLElement>(INPUT);
    const element =
      input ??
      control?.closest<HTMLElement>(GROUP) ??
      (control?.matches('.glass, .island, [class~="touch:island"]')
        ? control
        : undefined);
    if (!element) return;
    release();
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    if (!width || !height) return;
    const geometry = glassPressGeometry(width, height);
    element.style.setProperty('--press-outset', `${geometry.outset}px`);
    element.style.setProperty('--press-scale', String(geometry.scale));
    // Convert the tap into local coordinates, including a partially scaled
    // round control when a second press interrupts its release.
    element.style.setProperty(
      '--press-x',
      `${Math.max(0, Math.min(width, ((event.clientX - bounds.left) * width) / bounds.width))}px`
    );
    element.style.setProperty(
      '--press-y',
      `${Math.max(0, Math.min(height, ((event.clientY - bounds.top) * height) / bounds.height))}px`
    );
    element.style.setProperty(
      '--press-shimmer-size',
      `${Math.max(140, Math.min(320, height * 4))}px`
    );
    // Editors keep their text and caret still, even when a long draft is taller
    // than the input is wide. Only the enclosing paint should expand.
    element.setAttribute(
      'data-glass-press',
      !input && geometry.round ? 'round' : 'wide'
    );
    pressed = { element, pointerId: event.pointerId, bounds };
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId === pressed?.pointerId) release();
  };
  const move = (event: PointerEvent) => {
    if (event.pointerId !== pressed?.pointerId || !pressed) return;
    const { bounds } = pressed;
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      release();
  };
  document.addEventListener('pointerdown', down, true);
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', up, true);
  document.addEventListener('pointermove', move, true);
  window.addEventListener('blur', release);
  return () => {
    release();
    document.removeEventListener('pointerdown', down, true);
    document.removeEventListener('pointerup', up, true);
    document.removeEventListener('pointercancel', up, true);
    document.removeEventListener('pointermove', move, true);
    window.removeEventListener('blur', release);
  };
}
