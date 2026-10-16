import type { ItemMention } from '@core/component/LexicalMarkdown/plugins';
import type { MentionLinkResolver } from '@core/component/LexicalMarkdown/plugins/text-paste/textPastePlugin';
import type { RecipientSelectorProps } from '@core/component/RecipientSelector';
import type { LexicalEditor } from 'lexical';
import type { RosterAgent } from '../../agents-view/core/roster';

import type {
  Draft,
  InputFields,
  Intent,
  Scores,
  Submission,
  SubmissionResult,
  Suggestions,
} from '../core/input';
import type { Recipient } from '../core/recipients';

export type MessageRecipient = RecipientSelectorProps<
  'user' | 'channel'
>['selectedOptions'][number];

/** Options and editor capabilities displayed around the editor, supplied by the application host. */
export interface InputDisplay {
  resolveAppLink?: MentionLinkResolver;
  captureMessageMentions?(read: (() => ItemMention[]) | undefined): void;
  messageRecipients(): ReturnType<
    RecipientSelectorProps<'user' | 'channel'>['options']
  >;
  captureEmailEditor?(editor: LexicalEditor | undefined): void;
  people(): Recipient[];
  destinations(): Recipient[];
  recipients(
    fields: InputFields,
    message?: boolean
  ): { recipients: Recipient[]; unresolved: string[] };
  calendars(): { id: string; name: string; emailAddress: string }[];
  selectedCalendar(fields: InputFields): { id: string } | undefined;
  inboxes(): { id: string; email_address: string }[];
  selectedInbox(fields: InputFields): { id: string } | undefined;
  connectGoogle(): Promise<void>;
  connectingGoogle(): boolean;
  roster(): RosterAgent[];
  rosterLoading(): boolean;
  connectAgent(agent: RosterAgent): void;
  createAgent(): void;
  agentsEnabled(): boolean;
  models(): { id: string; label: string }[];
  model(): string;
  attachmentCount(): number;
  clearAttachments(): void;
}

export interface InputCapabilities {
  classify(
    text: string,
    revision: number
  ): Promise<{ revision: number; scores: Scores }>;
  extract(
    text: string,
    intent: Intent,
    revision: number
  ): Promise<{ revision: number; intent: Intent; suggestions: Suggestions }>;
  submit(input: Submission): Promise<SubmissionResult>;
  saveEmailDraft(input: Submission): Promise<SubmissionResult>;
  validate(input: Submission): string | undefined;
  validateEmailDraft(input: Submission): string | undefined;
  readDraft(): Draft | undefined;
  saveDraft(draft: Draft): void;
  onSubmitted?(): void;
}
