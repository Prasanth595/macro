import { cn } from '@ui';

/**
 * The suggested-routines mark: a looping arrow (a routine runs again and
 * again) around a four-point spark (AI wrote it), on a violet-to-pink tile.
 */
export function RoutineSparkGlyph(props: {
  /** `sm` for sidebar rows, `lg` for the modal header. */
  size?: 'sm' | 'md' | 'lg';
  class?: string;
}) {
  return (
    <span
      aria-hidden="true"
      class={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden bg-linear-to-br from-violet-bg via-purple-bg to-pink-bg text-violet-ink ring-1 ring-violet/25 ring-inset',
        props.size === 'lg'
          ? 'size-11 rounded-xl'
          : props.size === 'md'
            ? 'size-8 rounded-lg'
            : 'size-7 rounded-lg',
        props.class
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        class={props.size === 'lg' ? 'size-6' : 'size-4'}
      >
        <path
          d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <path
          d="M19.6 3.6v3.6H16"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M12 7.6c.35 2.25 1.15 3.05 3.4 3.4-2.25.35-3.05 1.15-3.4 3.4-.35-2.25-1.15-3.05-3.4-3.4 2.25-.35 3.05-1.15 3.4-3.4Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
