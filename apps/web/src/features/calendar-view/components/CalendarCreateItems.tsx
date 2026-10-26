import { useQuickCallsFlag } from '@app/features/meetings/use-quick-calls-flag';
import CalendarIcon from '@phosphor/calendar-blank.svg';
import PhoneIcon from '@phosphor/phone.svg';
import { useNavigate } from '@solidjs/router';
import { Dropdown } from '@ui';
import { Show } from 'solid-js';
import { useCalendarEditor } from '../context/calendar-editor-context';

type CreateItemProps = { onSelect?: () => void };

export function CalendarCreateEventItem(props: CreateItemProps) {
  const composer = useCalendarEditor();

  return (
    <Dropdown.Item
      closeOnSelect
      onSelect={() => {
        props.onSelect?.();
        composer.open();
      }}
    >
      <CalendarIcon class="size-4" />
      Event
    </Dropdown.Item>
  );
}

export function CalendarCreateCallItem(props: CreateItemProps) {
  const quickCalls = useQuickCallsFlag();
  const navigate = useNavigate();

  return (
    <Show when={quickCalls().enabled}>
      <Dropdown.Item
        closeOnSelect
        onSelect={() => {
          props.onSelect?.();
          navigate('/meet/new');
        }}
      >
        <PhoneIcon class="size-4" />
        Call
      </Dropdown.Item>
    </Show>
  );
}
