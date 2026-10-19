import { UserIcon } from '@core/component/UserIcon';
import { getDisplayName, idToEmail, tryMacroId } from '@core/user';
import { useSplitNavigationHandler } from '@core/util/useSplitNavigationHandler';
import IconX from '@phosphor/x.svg';
import type { ChannelParticipant } from '@queries/channel/types';
import { Badge, Button, Item } from '@ui';
import { cn } from '@ui/utils/classname';
import { Show } from 'solid-js';

export function ParticipantsListItem(props: {
  participant: ChannelParticipant;
  currentUserId?: string;
  editable: boolean;
  compact?: boolean;
  onClick: (event: MouseEvent) => void | Promise<void>;
  onRemove: () => void;
}) {
  const canRemove = () =>
    props.editable &&
    props.currentUserId !== props.participant.user_id &&
    props.participant.role !== 'owner';

  const displayName = () =>
    getDisplayName(tryMacroId(props.participant.user_id), {
      emailFallback: 'local-part',
    }) || idToEmail(props.participant.user_id);

  const navigationHandlers = useSplitNavigationHandler<HTMLAnchorElement>(
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await props.onClick(event);
    }
  );

  return (
    <div class="group/participant relative">
      <a
        {...navigationHandlers}
        role="link"
        tabIndex={0}
        aria-label={`Message ${displayName()}`}
        class="block rounded-xl hover:bg-hover focus-visible:outline-2 focus-visible:outline-edge"
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          event.currentTarget.click();
        }}
      >
        <Item
          size={props.compact ? 'sm' : undefined}
          class={props.editable ? 'pr-12' : undefined}
        >
          <UserIcon
            id={props.participant.user_id}
            size={props.compact ? 'sm' : 'lg'}
            isDeleted={false}
            suppressClick
            showTooltip={false}
          />
          <Item.Content class={props.compact ? 'gap-0' : undefined}>
            <Item.Title class="truncate">{displayName()}</Item.Title>
            <Item.Description
              class={cn('truncate', props.compact && 'text-xs')}
            >
              {idToEmail(props.participant.user_id)}
            </Item.Description>
          </Item.Content>
          <Item.Actions>
            <Show
              when={props.compact}
              fallback={
                <Badge variant="outline" size="sm">
                  {
                    { owner: 'Owner', admin: 'Admin', member: 'Member' }[
                      props.participant.role
                    ]
                  }
                </Badge>
              }
            >
              <span class="text-xs text-ink-muted">
                {props.participant.role === 'owner'
                  ? 'Owner'
                  : props.participant.role === 'admin'
                    ? 'Admin'
                    : ''}
              </span>
            </Show>
          </Item.Actions>
        </Item>
      </a>
      <Show when={props.editable && (!props.compact || canRemove())}>
        <div
          class={cn(
            'absolute right-4 top-1/2 -translate-y-1/2',
            props.compact &&
              'opacity-0 group-hover/participant:opacity-100 group-focus-within/participant:opacity-100'
          )}
        >
          <Button
            label={
              canRemove() ? 'Remove participant' : 'Cannot remove participant'
            }
            size="icon-sm"
            disabled={!canRemove()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!canRemove()) return;
              props.onRemove();
            }}
          >
            <IconX />
          </Button>
        </div>
      </Show>
    </div>
  );
}
