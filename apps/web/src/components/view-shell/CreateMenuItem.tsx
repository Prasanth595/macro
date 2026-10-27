import { cn, Dropdown } from '@ui';
import {
  type Component,
  type ComponentProps,
  createUniqueId,
  splitProps,
} from 'solid-js';

/** Creation choices with a concise explanation of when to use each one. */
export function CreateMenuItem(
  props: ComponentProps<typeof Dropdown.Item> & {
    icon: Component<{ class?: string }>;
    title: string;
    description: string;
    /** Title and description share one row. The description truncates instead of wrapping. */
    singleLine?: boolean;
  }
) {
  const [local, rest] = splitProps(props, [
    'icon',
    'title',
    'description',
    'class',
    'singleLine',
  ]);
  const descriptionId = createUniqueId();
  return (
    <Dropdown.Item
      {...rest}
      aria-label={local.title}
      aria-describedby={descriptionId}
      class={cn(
        local.singleLine ? 'gap-3' : 'items-start gap-3 py-3',
        local.class
      )}
    >
      <local.icon
        class={cn('size-5 shrink-0', !local.singleLine && 'mt-0.5')}
      />
      <span
        class={cn(
          'flex min-w-0',
          local.singleLine ? 'flex-1 items-center gap-3' : 'flex-col gap-1'
        )}
      >
        <span class={cn(local.singleLine && 'shrink-0')}>{local.title}</span>
        <span
          id={descriptionId}
          class={cn(
            'font-[family-name:Inter_Variable,sans-serif] text-xs font-normal',
            local.singleLine
              ? 'min-w-0 truncate text-ink-placeholder'
              : 'whitespace-normal text-ink-extra-muted'
          )}
        >
          {local.description}
        </span>
      </span>
    </Dropdown.Item>
  );
}
