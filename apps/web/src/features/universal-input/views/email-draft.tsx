import { MarkdownTextarea } from '@core/component/LexicalMarkdown/component/core/MarkdownTextarea';
import { createMemo, onCleanup } from 'solid-js';
import { ComposeFieldRow } from '../../email-compose/components/compose-field-row';
import { ComposeRecipientInput } from '../../email-compose/components/compose-recipient-input';
import { ComposeSubjectField } from '../../email-compose/components/compose-subject-field';
import { FromInboxSelector } from '../../email-compose/components/from-inbox-selector';
import type { InputDisplay } from '../context/capabilities';
import type { UniversalInputController } from '../primitives/universal-input';
import {
  composerRecipientOptions,
  composerRecipients,
  recipientAddresses,
} from '../queries/composer-recipients';

/** Email's actual controls, with draft ownership and inference supplied by the session. */
export function EmailDraft(props: {
  state: UniversalInputController;
  actions: InputDisplay;
}) {
  const s = props.state;
  const a = props.actions;
  const options = createMemo(() => composerRecipientOptions(a.people()));
  const selected = createMemo(() =>
    composerRecipients(s.fields().recipients, a.people())
  );
  onCleanup(() => a.captureEmailEditor?.(undefined));
  return (
    <div>
      <ComposeFieldRow label="From">
        <FromInboxSelector
          pill
          class="w-fit max-w-full"
          links={a.inboxes()}
          activeInboxId={a.selectedInbox(s.fields())?.id}
          onSelect={(id) => s.edit('inboxId', id)}
          disabled={s.sending()}
        />
      </ComposeFieldRow>
      <ComposeFieldRow label="To">
        <ComposeRecipientInput
          options={options}
          selectedOptions={selected()}
          setSelectedOptions={(next) =>
            s.edit('recipients', recipientAddresses(next))
          }
          inputRef={(element) => element.setAttribute('aria-label', 'To')}
          focusOnMount={false}
          disabled={s.sending()}
          includeSelf
          placeholder="Macro users or email addresses"
        />
      </ComposeFieldRow>
      <ComposeSubjectField
        value={s.fields().subject}
        onChange={(value) => s.edit('subject', value)}
        disabled={s.sending()}
      />
      <div class="py-4">
        <MarkdownTextarea
          value={s.fields().body}
          editable={() => !s.sending()}
          onChange={(value) => {
            if (value !== s.fields().body) s.edit('body', value);
          }}
          captureEditor={a.captureEmailEditor}
          placeholder="Outgoing message"
          floatingFormatMenu
          autoLinkMatchMode="common-tlds"
          portalScope="local"
          domRef={(element) =>
            element.setAttribute('aria-label', 'Outgoing message')
          }
          class="h-auto min-h-28 text-base text-ink [&>[contenteditable]]:min-h-28"
          onEnter={(event) => {
            if (!(event.metaKey || event.ctrlKey) || event.isComposing)
              return false;
            void s.submit();
            return true;
          }}
        />
      </div>
    </div>
  );
}
