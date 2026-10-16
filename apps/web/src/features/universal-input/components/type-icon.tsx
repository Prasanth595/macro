import Calendar from '@phosphor/calendar-blank.svg';
import Message from '@phosphor/chat-circle.svg';
import Task from '@phosphor/check-square.svg';
import Email from '@phosphor/envelope.svg';
import Search from '@phosphor/magnifying-glass.svg';
import Note from '@phosphor/note.svg';
import Sparkle from '@phosphor/sparkle.svg';
import { Dynamic } from 'solid-js/web';
import type { Intent } from '../core/input';

const icons = {
  ai: Sparkle,
  search: Search,
  note: Note,
  task: Task,
  email: Email,
  message: Message,
  calendar: Calendar,
};

export function TypeIcon(props: {
  intent: Intent | undefined;
  class?: string;
}) {
  return (
    <Dynamic
      component={icons[props.intent ?? 'ai']}
      class={props.class}
      aria-hidden="true"
    />
  );
}
