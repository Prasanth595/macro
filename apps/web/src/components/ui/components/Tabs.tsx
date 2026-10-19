import {
  SegmentedControl as KSegmentedControl,
  type SegmentedControlRootProps,
} from '@kobalte/core/segmented-control';
import { For, type JSX, Show, splitProps } from 'solid-js';
import { cn } from '../utils/classname';

export type TabItem = {
  value: string;
  label: string | (() => JSX.Element);
};

export type TabsProps = {
  list: TabItem[];
  value?: string;
  defaultValue?: string;
  class?: string;
  itemClass?: string;
  labelClass?: string;
  fullWidth?: boolean;
  variant?: 'pill' | 'segmented' | 'plain';
} & Omit<SegmentedControlRootProps, 'defaultValue'>;

/**
 * Compact single-choice navigation. The default pill slides behind the active
 * item; segmented tabs share a flat track, while plain tabs have only a quiet
 * selected fill without an outer frame.
 */
export const Tabs = (props: TabsProps) => {
  const [local, rootProps] = splitProps(props, [
    'list',
    'value',
    'defaultValue',
    'disabled',
    'class',
    'itemClass',
    'labelClass',
    'fullWidth',
    'variant',
  ]);
  const segmented = () => local.variant === 'segmented';
  const plain = () => local.variant === 'plain';

  return (
    <KSegmentedControl
      value={local.value}
      defaultValue={local.defaultValue ?? local.list[0]?.value}
      disabled={local.disabled}
      {...rootProps}
      class={cn(
        'relative inline-flex h-8 items-center',
        segmented() &&
          'h-9 rounded-full border border-edge-button bg-transparent p-px',
        local.fullWidth && 'flex w-full',
        local.class
      )}
    >
      <Show when={!segmented() && !plain()}>
        <KSegmentedControl.Indicator class="pointer-events-none absolute top-0 left-0 z-0 rounded-full border border-edge-frame bg-active transition-[transform,width,height] duration-50 motion-reduce:transition-none" />
      </Show>
      <For each={local.list}>
        {(item) => (
          <KSegmentedControl.Item
            value={item.value}
            disabled={local.disabled}
            class={cn(
              'relative z-1 inline-flex h-full min-w-0 items-center',
              'has-focus-visible:ring-2 has-focus-visible:ring-inset has-focus-visible:ring-edge-focus data-disabled:pointer-events-none data-disabled:opacity-50',
              segmented()
                ? 'justify-center rounded-full border border-transparent data-checked:border-edge-button data-checked:bg-control'
                : plain()
                  ? 'rounded-full data-checked:bg-control'
                  : 'rounded-full',
              local.fullWidth && 'flex-1',
              local.itemClass
            )}
          >
            <KSegmentedControl.ItemInput class="pointer-events-none absolute inset-0" />
            <KSegmentedControl.ItemLabel
              class={cn(
                'flex items-center font-medium select-none text-ink-extra-muted hover:text-ink data-checked:text-ink transition-colors duration-120 motion-reduce:transition-none',
                plain()
                  ? 'h-8 rounded-full px-2 text-sm'
                  : segmented()
                    ? 'h-full rounded-full px-1.5 text-sm'
                    : 'h-8 rounded-full px-4 text-xs',
                local.fullWidth && 'w-full justify-center',
                local.labelClass
              )}
            >
              {typeof item.label === 'function' ? item.label() : item.label}
            </KSegmentedControl.ItemLabel>
          </KSegmentedControl.Item>
        )}
      </For>
    </KSegmentedControl>
  );
};
