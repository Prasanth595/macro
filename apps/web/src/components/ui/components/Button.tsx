import type { HotkeyToken } from '@core/hotkey/tokens';
import {
  Button as KobalteButton,
  type ButtonRootProps,
} from '@kobalte/core/button';
import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import {
  For,
  Show,
  splitProps,
  type ComponentProps,
  type JSX,
  type ValidComponent,
} from 'solid-js';
import { Hotkey } from './Hotkey';
import { Tooltip } from './ButtonTooltip';
import { cn } from '../utils/classname';
import { createButtonActivation } from '../utils/button-activation';
import {
  gradientRaisedButtonStyles,
  raisedButtonStyles,
} from '../utils/button-finishes';
import {
  outlineReflectionStyles,
  type OutlineFinish,
} from '../utils/outline-reflection';
import { createVariants, type VariantProps } from '../utils/variants';
const buttonFrames = {
  primary: 'bg-button-primary-bg text-button-primary-ink border-transparent shadow-button',
  secondary: 'bg-button-secondary-bg text-ink border-transparent shadow-button',
  outline: 'bg-transparent text-ink border-button-border bg-none shadow-none',
  ghost: 'bg-button-tertiary-bg text-ink-muted border-transparent bg-none shadow-none',
  accent: 'bg-accent text-button-accent-ink border-transparent shadow-button',
  danger: 'bg-button-danger-bg text-failure border-transparent shadow-button',
  success: 'bg-button-success-bg text-success border-transparent shadow-button',
  link: 'border-transparent bg-transparent text-link shadow-none',
};
// Headless data-expanded can describe surrounding context rather than this action.
const buttonPressedStyles =
  'not-data-disabled:active:bg-none aria-pressed:bg-none aria-expanded:bg-none not-data-disabled:active:shadow-none aria-pressed:shadow-none aria-expanded:shadow-none';

/** Shared recipe for Button and headless controls that own their rendering. */
const buttonStyles = createVariants(
  'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border font-medium select-none transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 data-disabled:cursor-not-allowed data-disabled:opacity-45 focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-button-focus motion-reduce:transition-none forced-colors:focus-visible:outline-current touch:min-h-9 touch:min-w-9',
  {
    variant: {
      primary: cn(
        buttonFrames.primary,
        'not-data-disabled:hover:bg-button-primary-hover not-data-disabled:active:bg-button-primary-pressed aria-pressed:bg-button-primary-pressed aria-pressed:not-data-disabled:hover:bg-button-primary-pressed aria-expanded:bg-button-primary-pressed aria-expanded:not-data-disabled:hover:bg-button-primary-pressed focus-visible:outline-button-primary-ink',
        buttonPressedStyles,
      ),
      secondary: cn(
        buttonFrames.secondary,
        'not-data-disabled:hover:bg-button-secondary-hover not-data-disabled:active:bg-button-secondary-pressed aria-pressed:bg-button-secondary-pressed aria-pressed:not-data-disabled:hover:bg-button-secondary-pressed aria-expanded:bg-button-secondary-pressed aria-expanded:not-data-disabled:hover:bg-button-secondary-pressed',
        buttonPressedStyles,
      ),
      outline: cn(
        buttonFrames.outline,
        'not-data-disabled:hover:bg-button-outline-hover not-data-disabled:active:bg-button-outline-pressed aria-pressed:bg-button-outline-pressed aria-pressed:not-data-disabled:hover:bg-button-outline-pressed aria-expanded:bg-button-outline-pressed aria-expanded:not-data-disabled:hover:bg-button-outline-pressed',
        buttonPressedStyles,
      ),
      ghost: cn(
        buttonFrames.ghost,
        'not-data-disabled:hover:bg-button-tertiary-hover not-data-disabled:hover:text-ink not-data-disabled:active:bg-button-tertiary-pressed not-data-disabled:active:text-ink aria-pressed:bg-button-tertiary-pressed aria-pressed:text-ink aria-pressed:not-data-disabled:hover:bg-button-tertiary-pressed aria-expanded:bg-button-tertiary-pressed aria-expanded:text-ink aria-expanded:not-data-disabled:hover:bg-button-tertiary-pressed',
        buttonPressedStyles,
      ),
      accent: cn(
        buttonFrames.accent,
        'not-data-disabled:hover:bg-button-accent-hover not-data-disabled:active:bg-button-accent-pressed aria-pressed:bg-button-accent-pressed aria-pressed:not-data-disabled:hover:bg-button-accent-pressed aria-expanded:bg-button-accent-pressed aria-expanded:not-data-disabled:hover:bg-button-accent-pressed focus-visible:outline-button-accent-ink',
        buttonPressedStyles,
      ),
      danger: cn(
        buttonFrames.danger,
        'not-data-disabled:hover:bg-button-danger-hover not-data-disabled:active:bg-button-danger-pressed aria-pressed:bg-button-danger-pressed aria-pressed:not-data-disabled:hover:bg-button-danger-pressed aria-expanded:bg-button-danger-pressed aria-expanded:not-data-disabled:hover:bg-button-danger-pressed',
        buttonPressedStyles,
      ),
      success: cn(
        buttonFrames.success,
        'not-data-disabled:hover:bg-button-success-hover not-data-disabled:active:bg-button-success-pressed aria-pressed:bg-button-success-pressed aria-pressed:not-data-disabled:hover:bg-button-success-pressed aria-expanded:bg-button-success-pressed aria-expanded:not-data-disabled:hover:bg-button-success-pressed',
        buttonPressedStyles,
      ),
      link: cn(buttonFrames.link, 'underline-offset-4 not-data-disabled:hover:text-link-hover not-data-disabled:hover:underline'),
    },
    size: {
      xs: 'min-h-6 px-2 py-0.5 text-xs',
      sm: 'min-h-7 px-2 py-0.5 text-sm',
      md: 'min-h-8 px-2 py-0.5 text-base',
      lg: 'min-h-10 px-4 py-1 text-lg',
      xl: 'min-h-12 px-4 py-2 text-xl',
      'icon-xs': 'size-6 min-h-0 shrink-0 aspect-square p-0 text-xs',
      'icon-sm': 'size-7 min-h-0 shrink-0 aspect-square p-0 text-sm',
      'icon-md': 'size-8 min-h-0 shrink-0 aspect-square p-0 text-base',
      'icon-lg': 'size-10 min-h-0 shrink-0 aspect-square p-0 text-lg',
      'icon-xl': 'size-12 min-h-0 shrink-0 aspect-square p-0 text-xl',
    },
  },
  { variant: 'primary', size: 'md' }
);

export type ButtonVariantProps = VariantProps<typeof buttonStyles>;
export type ButtonVariant = NonNullable<ButtonVariantProps['variant']>;
export type ButtonSize = NonNullable<ButtonVariantProps['size']>;
export type ButtonFinish = OutlineFinish | 'raised' | 'gradient-raised';
export type ButtonClassOptions = {
  variant?: ButtonVariant;
  /** Composed rows own their surface states without layering a second button face. */
  appearance?: 'default' | 'bare';
  /** Optional finish; omitted uses the plain variant styling. */
  finish?: ButtonFinish;
  size?: ButtonSize;
  fullWidth?: boolean;
  class?: string;
};


const raisedBorderButtonStyles = cn(
  raisedButtonStyles,
  'not-data-disabled:active:border-button-border aria-pressed:border-button-border aria-expanded:border-button-border'
);

const buttonFinishes: Partial<
  Record<ButtonVariant, Partial<Record<ButtonFinish, string>>>
> = {
  primary: {
    raised: raisedButtonStyles,
    'gradient-raised': gradientRaisedButtonStyles,
  },
  secondary: {
    raised: raisedButtonStyles,
    'gradient-raised': gradientRaisedButtonStyles,
    'glass-outline': cn(
      'border-button-border/50',
      outlineReflectionStyles
    ),
  },
  outline: { raised: raisedBorderButtonStyles },
  accent: {
    raised: raisedButtonStyles,
    'gradient-raised': gradientRaisedButtonStyles,
  },
  danger: {
    raised: raisedButtonStyles,
    'gradient-raised': gradientRaisedButtonStyles,
  },
  success: {
    raised: raisedButtonStyles,
    'gradient-raised': gradientRaisedButtonStyles,
  },
};

/** Non-interactive frame material shared by Button and ButtonGroup. */
export function buttonFrameClasses(
  options: Pick<ButtonClassOptions, 'variant' | 'finish'> = {}
) {
  const { variant = 'primary', finish } = options;
  return cn(buttonFrames[variant], finish && buttonFinishes[variant]?.[finish]);
}

export function buttonClasses(options: ButtonClassOptions = {}) {
  const { variant = 'primary', finish, appearance } = options;
  const isBare = appearance === 'bare';

  return cn(
    buttonStyles({ variant: isBare ? null : variant, size: options.size }),
    isBare && 'border-transparent bg-transparent shadow-none',
    !isBare && finish && buttonFinishes[variant]?.[finish],
    options.fullWidth && 'w-full',
    options.class
  );
}

export const buttonVariants = buttonClasses;

export type ButtonTooltipOptions = {
  content: JSX.Element;
  placement?: ComponentProps<typeof Tooltip.Root>['placement'];
  disabled?: boolean;
  hotkey?: HotkeyToken | HotkeyToken[];
  shortcut?: string | string[];
};
export type ButtonTooltip = string | ButtonTooltipOptions;

function tooltipOptions(
  value: ButtonTooltip | undefined
): ButtonTooltipOptions {
  if (typeof value === 'string' || value === undefined) {
    return { content: value };
  }
  return value;
}

export type ButtonProps<T extends ValidComponent = 'button'> = PolymorphicProps<
  T,
  ButtonRootProps<T> &
    ButtonClassOptions & {
      /** Plain text or tooltip options; accessible naming stays in aria-label. */
      tooltip?: ButtonTooltip;
      loading?: boolean;
      children?: JSX.Element;
    }
>;

/** Actions use Button; navigation uses anchors. Finishes are explicitly opt-in. */
export function Button<T extends ValidComponent = 'button'>(
  props: ButtonProps<T>
) {
  const [local, native] = splitProps(props as ButtonProps, [
    'variant',
    'appearance',
    'finish',
    'size',
    'loading',
    'class',
    'children',
    'disabled',
    'fullWidth',
    'tooltip',
    'tabIndex',
    'onClick',
    'onAuxClick',
    'onKeyDown',
    'onKeyUp',
  ]);
  const variant = () => local.variant ?? 'primary';
  const size = () => local.size ?? 'md';
  const unavailable = () => !!(local.disabled || local.loading);
  const activation = createButtonActivation(unavailable, local);
  const tabIndexProps = () => {
    if (unavailable()) return { tabIndex: -1 };
    if (local.tabIndex === undefined) return {};
    return { tabIndex: local.tabIndex };
  };
  const tooltip = () => tooltipOptions(local.tooltip);
  const tokens = () => {
    const value = tooltip().hotkey;
    return value ? (Array.isArray(value) ? value : [value]) : [];
  };
  const shortcuts = () => {
    const value = tooltip().shortcut;
    return value ? (Array.isArray(value) ? value : [value]) : [];
  };

  const Control = (buttonProps: ComponentProps<typeof KobalteButton>) => {
    return (
      <KobalteButton
        {...buttonProps}
        as={buttonProps.as ?? 'button'}
        data-button=""
        data-slot="button"
        data-size={size()}
        data-variant={variant()}
        data-appearance={local.appearance ?? 'default'}
        disabled={unavailable()}
        {...tabIndexProps()}
        aria-busy={local.loading || buttonProps['aria-busy'] || undefined}
        class={buttonClasses({
          ...local,
          variant: variant(),
          size: size(),
          class: local.class,
        })}
        {...activation}
      >
        <Show when={local.loading !== undefined} fallback={local.children}>
          <span
            class={cn(
              'inline-flex min-w-0 flex-1 items-center [gap:inherit] [justify-content:inherit]',
              local.loading && 'opacity-0'
            )}
          >
            {local.children}
          </span>
        </Show>
        <Show when={local.loading}>
          <span
            aria-hidden="true"
            class="absolute size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          />
        </Show>
      </KobalteButton>
    );
  };

  return (
    <Show when={local.tooltip != null} fallback={<Control {...native} />}>
      <Tooltip.Root
        disabled={tooltip().disabled}
        placement={tooltip().placement}
      >
        <Control
          {...native}
          as={(triggerProps: JSX.ButtonHTMLAttributes<HTMLButtonElement>) => (
            <Tooltip.Trigger {...triggerProps} as={native.as ?? 'button'} />
          )}
        />
        <Tooltip.Portal>
          <Tooltip.Content>
            <div class="flex items-center gap-2">
              <div class="min-w-0">{tooltip().content}</div>
              <For each={tokens()}>
                {(token, index) => (
                  <>
                    <Show when={index() > 0}>
                      <span class="text-ink-muted">then</span>
                    </Show>
                    <Hotkey token={token} theme="subtle" />
                  </>
                )}
              </For>
              <For each={shortcuts()}>
                {(shortcut, index) => (
                  <>
                    <Show when={index() > 0}>
                      <span class="text-ink-muted">then</span>
                    </Show>
                    <Hotkey shortcut={shortcut} theme="subtle" />
                  </>
                )}
              </For>
            </div>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Show>
  );
}
