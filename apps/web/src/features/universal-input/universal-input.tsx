import { useMacroMentionLinkResolver } from '@components/app/split-layout/split-router/mention-links';
import { buildChatEditor } from '@core/component/AI/component/input/buildChatEditor';
import { useChatInputContext } from '@core/component/AI/context';
import { useGetChatAttachmentInfo } from '@core/component/AI/signal/attachment';
import { createMentionAttachmentCallbacks } from '@core/component/AI/signal/mention-attachment-callbacks';
import { useUserId } from '@core/context/user';
import { createEffect, createSignal, Show, Suspense } from 'solid-js';
import { createCommandSearch } from '../command/command-search';
import { createCommandResultOpener } from '../command/open-command-result';
import { InlineSearchResults } from '../command/views/inline-search-results';
import { createInputActions } from './actions';
import { DraftEditor } from './components/draft-editor';
import { fieldsSchema } from './core/input';
import { createInferenceSource } from './inference';
import {
  createUniversalInput,
  type UniversalInputController,
} from './primitives/universal-input';
import { TaskFields } from './task-fields';
import { UniversalComposer } from './views/universal-composer';

function InputContent(props: { userId: string }) {
  const chat = useChatInputContext();
  const [state, setState] = createSignal<UniversalInputController>();
  let focus: (() => void) | undefined;
  const { getAttachmentFromMention } = useGetChatAttachmentInfo();
  const resolveAppLink = useMacroMentionLinkResolver();
  const editor = buildChatEditor()
    .withAppLinkResolver(resolveAppLink)
    .withMentions({
      ...createMentionAttachmentCallbacks(
        chat.attachments,
        getAttachmentFromMention
      ),
      block: 'chat',
      showOpenTabs: true,
    });
  const actions = createInputActions(
    () => state()?.fields() ?? fieldsSchema.parse({}),
    props.userId,
    (value) => state()?.edit('noteTags', value)
  );
  const controller = createUniversalInput({
    ...createInferenceSource(props.userId, actions.taskDefinitions),
    ...actions,
    onSubmitted: () => focus?.(),
  });
  setState(controller);
  const search = createCommandSearch(
    () => controller.fields().query,
    () =>
      controller.draft().intent === 'search' &&
      !!controller.fields().query.trim()
  );
  const openResult = createCommandResultOpener('home');
  // Bridge the existing Home suggestion bus into this editor; this is an external input source.
  createEffect(() => {
    const text = chat.pendingDraft();
    if (text == null) return;
    chat.setPendingDraft(null);
    controller.setText(text);
    controller.choose('ai');
    focus?.();
  });
  return (
    <UniversalComposer
      state={controller}
      actions={{ ...actions, resolveAppLink }}
      noteTags={actions.noteTags.composerTags}
      searchResults={(scopeId) => (
        <InlineSearchResults
          scopeId={scopeId}
          query={controller.fields().query}
          source={search}
          onOpen={openResult}
          canHandleKeyboard={() => !editor.controls.isInlineMenuOpen()}
        />
      )}
      editor={
        <DraftEditor
          config={editor}
          text={controller.draft().text}
          disabled={controller.sending()}
          onChange={controller.setText}
          onSubmit={() => void controller.submit()}
          onReset={() => {
            controller.setText('');
            chat.setPendingDraft(null);
            actions.clearAttachments();
          }}
          registerFocus={(callback) => {
            focus = callback;
          }}
        />
      }
      taskFields={
        <Show when={controller.draft().intent === 'task'}>
          <TaskFields
            disabled={controller.sending()}
            values={actions.taskValues(controller.fields()).values}
            value={controller.fields().taskProperties}
            onChange={(value) => controller.edit('taskProperties', value)}
          />
        </Show>
      }
    />
  );
}

export function UniversalInput() {
  const userId = useUserId();
  return (
    <Suspense
      fallback={<div class="min-h-24 rounded-xl border border-edge-muted" />}
    >
      <Show when={userId()} keyed>
        {(id) => <InputContent userId={id} />}
      </Show>
    </Suspense>
  );
}
