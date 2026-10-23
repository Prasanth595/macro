import { useSplitLayout } from '@components/app/split-layout/layout';
import type { SplitContent } from '@components/app/split-layout/layoutManager';
import { useMacroMentionLinkResolver } from '@components/app/split-layout/split-router/mention-links';
import { buildChatEditor } from '@core/component/AI/component/input/buildChatEditor';
import {
  ChatInputProvider,
  useChatInputContext,
} from '@core/component/AI/context';
import { useGetChatAttachmentInfo } from '@core/component/AI/signal/attachment';
import { createMentionAttachmentCallbacks } from '@core/component/AI/signal/mention-attachment-callbacks';
import { useUserId } from '@core/context/user';
import { createSignal, Show } from 'solid-js';
import { openEntityInSplitFromUnifiedList } from '../next-soup/utils';
import { createInputActions } from './actions';
import { DraftEditor } from './components/draft-editor';
import type { CommandInputSession } from './context/command-input';
import { emptyDraft, fieldsSchema } from './core/input';
import { createInferenceSource } from './inference';
import {
  createUniversalInput,
  type UniversalInputController,
} from './primitives/universal-input';
import { TaskFields } from './task-fields';
import { SearchDraft } from './views/search-draft';
import { UniversalComposer } from './views/universal-composer';

function InputContent(props: {
  userId: string;
  navigate: (content: SplitContent) => void;
  command: CommandInputSession;
}) {
  const command = props.command;
  const chat = useChatInputContext();
  const [state, setState] = createSignal<UniversalInputController>();
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
    {
      navigate: props.navigate,
      onNoteTagsChange: (value) => state()?.edit('noteTags', value),
      submitSurface: 'other',
    }
  );
  const controller = createUniversalInput({
    ...createInferenceSource(actions.taskDefinitions),
    initialDraft: { ...emptyDraft(), text: command.text },
    ...actions,
    onSubmitted: () => {
      state()?.result()?.open?.();
      command.onComplete();
    },
  });
  setState(controller);
  return (
    <UniversalComposer
      state={controller}
      layout={command.layout}
      actions={{ ...actions, resolveAppLink }}
      noteTags={actions.noteTags.composerTags}
      search={(scopeId) => (
        <SearchDraft
          state={controller}
          actions={actions}
          scopeId={scopeId}
          canHandleKeyboard={() => !editor.controls.isInlineMenuOpen()}
          onOpen={(entity, newSplit, location) => {
            void openEntityInSplitFromUnifiedList(entity, {
              openInNewSplit: newSplit,
              location,
              referredFrom: 'kommand-menu',
            });
            command.onNavigate();
          }}
        />
      )}
      editor={
        <DraftEditor
          config={editor}
          text={controller.draft().text}
          disabled={controller.sending()}
          onChange={(text) => {
            if (controller.sending()) return;
            controller.setText(text);
            command.onTextChange(text);
          }}
          initialSelection={command.selection}
          onSubmit={() => void controller.submit()}
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

/** A transient Command K session with host-owned navigation. */
export function CommandUniversalInput(props: CommandInputSession) {
  const userId = useUserId();
  const { openWithSplit } = useSplitLayout();
  return (
    <ChatInputProvider>
      <Show when={userId()} keyed>
        {(id) => (
          <InputContent
            userId={id}
            command={props}
            navigate={(content) => {
              props.onNavigate();
              openWithSplit(content, { referredFrom: 'kommand-menu' });
            }}
          />
        )}
      </Show>
    </ChatInputProvider>
  );
}
