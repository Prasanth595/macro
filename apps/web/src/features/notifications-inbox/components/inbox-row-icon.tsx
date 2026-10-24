import ArrowBendUpLeftIcon from '@phosphor/arrow-bend-up-left.svg';
import AtIcon from '@phosphor/at.svg';
import CalendarBlankIcon from '@phosphor/calendar-blank.svg';
import ChatCircleIcon from '@phosphor/chat-circle.svg';
import ChatsCircleIcon from '@phosphor/chats-circle.svg';
import CheckSquareIcon from '@phosphor/check-square.svg';
import EnvelopeIcon from '@phosphor/envelope.svg';
import GitPullRequestIcon from '@phosphor/git-pull-request.svg';
import LockKeyIcon from '@phosphor/lock-key.svg';
import LockKeyOpenIcon from '@phosphor/lock-key-open.svg';
import RobotIcon from '@phosphor/robot.svg';
import SparkleIcon from '@phosphor/sparkle.svg';
import UserPlusIcon from '@phosphor/user-plus.svg';
import { Dynamic } from 'solid-js/web';
import { match } from 'ts-pattern';
import type { InboxRowType } from '../core/inbox-row';

const iconFor = (type: InboxRowType) =>
  match(type)
    .with('ai_suggestion', () => SparkleIcon)
    .with('agent', () => RobotIcon)
    .with('email', () => EnvelopeIcon)
    .with('channel_mention', 'discussion_mention', () => AtIcon)
    .with('channel_thread', 'discussion_thread', () => ArrowBendUpLeftIcon)
    .with('channel_messages', () => ChatsCircleIcon)
    .with('discussion_messages', () => ChatCircleIcon)
    .with('task', () => CheckSquareIcon)
    .with('pull_request', () => GitPullRequestIcon)
    .with('calendar_event', () => CalendarBlankIcon)
    .with('calendar_join_request', () => UserPlusIcon)
    .with('access_requested', () => LockKeyIcon)
    .with('access_granted', () => LockKeyOpenIcon)
    .exhaustive();

/** The glyph for a kind of notification: reply, mention, task, email… */
export function InboxRowIcon(props: { type: InboxRowType; class?: string }) {
  return (
    <Dynamic
      component={iconFor(props.type)}
      class={props.class}
      aria-hidden="true"
    />
  );
}
