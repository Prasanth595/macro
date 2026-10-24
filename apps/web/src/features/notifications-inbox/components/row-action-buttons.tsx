import { Button } from '@ui';
import { For } from 'solid-js';
import { match } from 'ts-pattern';
import type { InboxRowChoice } from '../context/notifications-inbox-context';

const choiceLabel = (choice: InboxRowChoice) =>
  match(choice)
    .with('approve', () => 'Approve')
    .with('deny', () => 'Deny')
    .with('accept', () => 'Accept')
    .with('decline', () => 'Decline')
    .exhaustive();

/**
 * The answers a notification offers, the affirmative first. While one is
 * in flight every answer is disabled and the chosen one says so.
 */
export function RowActionButtons(props: {
  choices: readonly InboxRowChoice[];
  pending: InboxRowChoice | undefined;
  onChoose: (choice: InboxRowChoice) => void;
}) {
  return (
    <For each={props.choices}>
      {(choice, index) => (
        <Button
          size="sm"
          variant={index() === 0 ? 'cta' : 'outline'}
          disabled={props.pending !== undefined}
          aria-busy={props.pending === choice}
          onClick={(event) => {
            event.stopPropagation();
            props.onChoose(choice);
          }}
        >
          {choiceLabel(choice)}
        </Button>
      )}
    </For>
  );
}
