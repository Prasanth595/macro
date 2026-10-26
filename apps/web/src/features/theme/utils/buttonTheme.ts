import Color from 'colorjs.io';
import type { ResolvedThemeColors } from './resolvedThemeColors';

const SRGB_LINEAR_THRESHOLD = 0.04045;
const SRGB_LINEAR_DIVISOR = 12.92;
const SRGB_OFFSET = 0.055;
const SRGB_SCALE = 1.055;
const SRGB_EXPONENT = 2.4;
const DARK_INK_LUMINANCE_THRESHOLD = 0.179;
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
const BLACK = 'oklch(0 0 0)';
const WHITE = 'oklch(1 0 0)';

function linearize(channel: number): number {
  const clamped = Math.max(0, Math.min(1, channel));
  if (clamped <= SRGB_LINEAR_THRESHOLD) return clamped / SRGB_LINEAR_DIVISOR;
  return ((clamped + SRGB_OFFSET) / SRGB_SCALE) ** SRGB_EXPONENT;
}

/** Derived presentation only. Never writes back to authored or saved themes. */
export function buttonThemeVars(colors: ResolvedThemeColors): Record<string, string> {
  const accent = colors.accent;
  const rgb = new Color('oklch', [accent.l, accent.c, accent.h], accent.alpha)
    .toGamut({ space: 'srgb' })
    .to('srgb');
  const luminance = rgb.coords.reduce(
    (sum, channel, index) => sum + linearize(channel) * LUMINANCE_WEIGHTS[index],
    0
  );
  const useDarkInk = luminance > DARK_INK_LUMINANCE_THRESHOLD;
  const light = colors['surface-0'].l > colors['content-0'].l;
  const neutral = light ? BLACK : WHITE;
  const neutralFill = (opacity: number) =>
    `oklch(${light ? '0' : '1'} 0 0 / ${opacity}%)`;
  const statusFill = (token: 'failure' | 'success', opacity: number) =>
    `oklch(from var(--color-${token}) l c h / ${opacity}%)`;
  const accentStateMix = useDarkInk ? WHITE : BLACK;

  return {
    '--button-primary-bg': `color-mix(in oklch, ${neutral} 90%, var(--color-panel))`,
    '--button-primary-hover': 'color-mix(in srgb, var(--button-primary-bg) 82%, var(--color-panel))',
    '--button-primary-pressed': 'color-mix(in srgb, var(--button-primary-bg) 72%, var(--color-panel))',
    '--button-primary-ink': 'var(--color-page)',
    '--button-focus': 'var(--color-edge-focus, var(--color-accent))',
    '--button-border': neutralFill(12),
    '--button-secondary-bg': neutralFill(8),
    '--button-secondary-hover': neutralFill(12),
    '--button-secondary-pressed': neutralFill(16),
    '--button-outline-hover': neutralFill(8),
    '--button-outline-pressed': neutralFill(light ? 8 : 10),
    '--button-tertiary-bg': 'transparent',
    '--button-tertiary-hover': neutralFill(light ? 8 : 10),
    '--button-tertiary-pressed': neutralFill(light ? 12 : 14),
    '--button-accent-ink': useDarkInk ? BLACK : WHITE,
    '--button-accent-hover': `color-mix(in srgb, var(--color-accent) 82%, ${accentStateMix})`,
    '--button-accent-pressed': `color-mix(in srgb, var(--color-accent) 72%, ${accentStateMix})`,
    '--button-danger-bg': statusFill('failure', light ? 20 : 10),
    '--button-danger-hover': statusFill('failure', light ? 26 : 16),
    '--button-danger-pressed': statusFill('failure', light ? 32 : 22),
    '--button-success-bg': statusFill('success', light ? 20 : 8),
    '--button-success-hover': statusFill('success', light ? 26 : 16),
    '--button-success-pressed': statusFill('success', light ? 32 : 22),
    '--button-shadow': `0 1px 2px oklch(0 0 0 / ${light ? 8 : 20}%)`,
    '--button-raised-shadow': light
      ? 'inset 0 1px 0 oklch(1 0 0 / 14%), 0 1px 2px oklch(0 0 0 / 8%)'
      : '0 0 0 0.4px oklch(0 0 0 / 16%), inset 0 0.4px 0 oklch(1 0 0 / 4.8%), inset 0 0 0 0.4px oklch(1 0 0 / 3.2%), 0 1px 2px oklch(0 0 0 / 6%)',
    '--button-outline-highlight': `oklch(1 0 0 / ${light ? 75 : 28}%)`,
    '--button-gradient-raised': `linear-gradient(180deg, transparent, oklch(0 0 0 / ${light ? 8 : 12}%))`,
  };
}
