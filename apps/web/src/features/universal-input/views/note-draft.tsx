import { InlineTagsPill } from '@property/tags';
import { createSignal, Show } from 'solid-js';
import { DocumentFields } from '../../document-composer/components/document-fields';
import {
  createDocumentEditor,
  type DocumentComposerTags,
} from '../../document-composer/primitives/create-document-editor';
import type { InputDisplay } from '../context/capabilities';
import type { UniversalInputController } from '../primitives/universal-input';

export type DocumentTags = DocumentComposerTags;

export function NoteDraft(props: {
  state: UniversalInputController;
  actions: InputDisplay;
  tags?: DocumentTags;
}) {
  const s = props.state;
  const [container, setContainer] = createSignal<HTMLDivElement>();
  const editor = createDocumentEditor({
    resolveAppLink: props.actions.resolveAppLink,
    tags: props.tags,
    onChange: (value) => {
      if (value !== s.fields().body) s.edit('body', value);
    },
  }).onEnter((event) => {
    if (
      !(event.metaKey || event.ctrlKey) ||
      event.isComposing ||
      editor.controls.isInlineMenuOpen()
    )
      return false;
    void s.submit();
    return true;
  });
  return (
    <div ref={setContainer} tabIndex={-1} class="min-w-0">
      <DocumentFields
        title={s.fields().title}
        onTitleChange={(title) => s.edit('title', title)}
        editor={editor}
        value={s.fields().body}
        disabled={s.sending()}
        bodyLabel="Note body"
        containerRef={container}
        onSubmit={() => void s.submit()}
        portalScope="local"
        onTagSelected={
          props.tags
            ? (tag) => {
                void props.tags?.applyTag(tag.scope, tag.optionId);
              }
            : undefined
        }
      />
      <Show when={props.tags}>
        {(tags) => <InlineTagsPill docTags={tags()} showPlaceholder />}
      </Show>
    </div>
  );
}
