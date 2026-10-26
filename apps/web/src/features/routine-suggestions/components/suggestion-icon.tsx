import BellIcon from '@phosphor/bell.svg';
import CalendarIcon from '@phosphor/calendar-blank.svg';
import ChartIcon from '@phosphor/chart-line-up.svg';
import ChatIcon from '@phosphor/chat-circle.svg';
import CheckSquareIcon from '@phosphor/check-square.svg';
import CodeIcon from '@phosphor/code.svg';
import EnvelopeIcon from '@phosphor/envelope.svg';
import FileTextIcon from '@phosphor/file-text.svg';
import PhoneIcon from '@phosphor/phone.svg';
import SparkleIcon from '@phosphor/sparkle.svg';
import TagIcon from '@phosphor/tag.svg';
import UsersIcon from '@phosphor/users.svg';
import { cn } from '@ui';
import { Dynamic } from 'solid-js/web';
import { match } from 'ts-pattern';
import type { SuggestionIcon as SuggestionIconName } from '../core/suggestions';

function iconFor(name: SuggestionIconName) {
  return match(name)
    .with('mail', () => EnvelopeIcon)
    .with('tag', () => TagIcon)
    .with('bell', () => BellIcon)
    .with('calendar', () => CalendarIcon)
    .with('task', () => CheckSquareIcon)
    .with('document', () => FileTextIcon)
    .with('chart', () => ChartIcon)
    .with('people', () => UsersIcon)
    .with('phone', () => PhoneIcon)
    .with('code', () => CodeIcon)
    .with('chat', () => ChatIcon)
    .with('sparkle', () => SparkleIcon)
    .exhaustive();
}

/** A suggestion's topic icon in a soft violet tile. */
export function SuggestionIcon(props: {
  name: SuggestionIconName;
  class?: string;
}) {
  return (
    <span
      aria-hidden="true"
      class={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-bg text-violet-ink',
        props.class
      )}
    >
      <Dynamic component={iconFor(props.name)} class="size-4" />
    </span>
  );
}
