import {
  ListFilterDropdown,
  type ListFilterGroup,
} from '@app/components/view-shell';
import { match } from 'ts-pattern';
import {
  INBOX_CATEGORIES,
  type InboxCategory,
  type InboxStatus,
} from '../core/inbox-filters';
import type { InboxRowType } from '../core/inbox-row';
import { InboxRowIcon } from './inbox-row-icon';

const categoryLabel = (category: InboxCategory) =>
  match(category)
    .with('mentions', () => 'Mentions')
    .with('replies', () => 'Replies')
    .with('messages', () => 'Messages')
    .with('comments', () => 'Comments')
    .with('email', () => 'Email')
    .with('tasks', () => 'Tasks')
    .with('pull_requests', () => 'Pull requests')
    .with('calendar', () => 'Calendar')
    .with('access', () => 'Access requests')
    .with('agents', () => 'Agents')
    .with('ai_suggestions', () => 'AI suggestions')
    .exhaustive();

/** The glyph a category's rows show. */
const categoryRowType = (category: InboxCategory): InboxRowType =>
  match(category)
    .with('mentions', () => 'channel_mention' as const)
    .with('replies', () => 'channel_thread' as const)
    .with('messages', () => 'channel_messages' as const)
    .with('comments', () => 'discussion_messages' as const)
    .with('email', () => 'email' as const)
    .with('tasks', () => 'task' as const)
    .with('pull_requests', () => 'pull_request' as const)
    .with('calendar', () => 'calendar_event' as const)
    .with('access', () => 'access_requested' as const)
    .with('agents', () => 'agent' as const)
    .with('ai_suggestions', () => 'ai_suggestion' as const)
    .exhaustive();

type GroupId = 'status' | 'type';
type OptionId = InboxStatus | InboxCategory;

const GROUPS: ListFilterGroup<GroupId, OptionId>[] = [
  {
    id: 'status',
    label: 'Status',
    selectionMode: 'single',
    defaultOptionId: 'all',
    options: [
      { id: 'unread', label: 'Unread' },
      { id: 'read', label: 'Read' },
      { id: 'all', label: 'All' },
    ],
  },
  {
    id: 'type',
    label: 'Type',
    options: INBOX_CATEGORIES.map((category) => ({
      id: category,
      label: categoryLabel(category),
      icon: () => (
        <InboxRowIcon
          type={categoryRowType(category)}
          class="size-4 text-ink-muted"
        />
      ),
    })),
  },
];

const isStatus = (id: OptionId): id is InboxStatus =>
  id === 'all' || id === 'unread' || id === 'read';

/**
 * Filter notifications by read state and by kind. Kinds are checkboxes that
 * start checked; unchecking hides that kind.
 */
export function InboxFilterMenu(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: InboxStatus;
  isShown: (category: InboxCategory) => boolean;
  activeCount: number;
  onStatusChange: (status: InboxStatus) => void;
  onShownChange: (category: InboxCategory, shown: boolean) => void;
  onReset: () => void;
}) {
  return (
    <ListFilterDropdown
      label="Filter notifications"
      groups={GROUPS}
      open={props.open}
      onOpenChange={props.onOpenChange}
      activeCount={props.activeCount}
      isSelected={(group, option) =>
        group === 'status'
          ? props.status === option
          : !isStatus(option) && props.isShown(option)
      }
      isGroupActive={(group) =>
        group === 'status'
          ? props.status !== 'all'
          : INBOX_CATEGORIES.some((category) => !props.isShown(category))
      }
      onSelectionChange={(group, option, selected) => {
        if (isStatus(option)) {
          if (group === 'status') props.onStatusChange(option);
          return;
        }
        props.onShownChange(option, selected);
      }}
      onClear={props.onReset}
      clearLabel="Reset filters"
    />
  );
}
