import { ChatWithAgentButton } from '@app/features/chat/ChatWithAgentButton';
import {
  ResponsiveBlockToolbar,
  ResponsivePermissionsBadge,
} from '@components/app/ResponsiveBlockToolbar';
import type { FileOperation } from '@components/app/split-layout/components/SplitFileMenu';
import {
  SplitHeaderLeft,
  SplitHeaderRight,
} from '@components/app/split-layout/components/SplitHeader';
import { BlockItemSplitLabel } from '@components/app/split-layout/components/SplitLabel';
import { useSplitLayout } from '@components/app/split-layout/layout';
import { useBlockId } from '@core/block';
import { DocumentBlockContainer } from '@core/component/DocumentBlockContainer';
import { BlockLiveIndicators } from '@core/component/LiveIndicators';
import { toast } from '@core/component/Toast/Toast';
import {
  getShareDrawerRecipientInput,
  ShareTrigger,
} from '@core/component/TopBar/ShareButton';
import { useShareModal } from '@core/component/TopBar/shareModal';
import { useUserId } from '@core/context/user';
import { blockDataSignal } from '@core/internal/BlockLoader';
import { EntityDiscussion } from '@core/messages/EntityDiscussion';
import { blockMetadataSignal } from '@core/signal/load';
import {
  useCanComment,
  useCanEdit,
  useGetPermissions,
  useIsDocumentOwner,
} from '@core/signal/permissions';
import { getDisplayName, tryMacroId } from '@core/user';
import { useBlockDocumentName } from '@core/util/currentBlockDocumentName';
import { fireAndForget } from '@core/util/fireAndForget';
import { downloadFile } from '@filesystem/download';
import IconShared from '@icon/share.svg';
import DownloadIcon from '@phosphor/download-simple.svg';
import {
  emailAttachmentForDocumentOptions,
  saveEditedAttachmentCopy,
} from '@queries/email/attachment-copies';
import { useMessageRootsQuery } from '@queries/messages/document-messages';
import { useQuery } from '@tanstack/solid-query';
import { Badge, Button, Dialog, Panel } from '@ui';
import {
  createMemo,
  createSignal,
  Match,
  onMount,
  Show,
  Switch,
} from 'solid-js';
import type { DocxBlockData } from './definition';
import type { DocxEditor } from './primitives/create-docx-editor';
import {
  buildDocxSeed,
  connectDocxSync,
  docxSyncExists,
  fetchOriginalDocx,
  initializeDocxSync,
} from './queries/docx-document';
import { createDocxSession } from './queries/docx-session';
import { DocxCommentMargin, DocxDetachedComments } from './views/DocxComments';
import { DocxEditorView } from './views/DocxEditorView';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function displayName(userId: string | undefined) {
  return getDisplayName(tryMacroId(userId ?? ''), {
    emailFallback: 'local-part',
  });
}

/** Production composition of the collaborative DOCX editor. */
export default function DocxBlock(props: { share?: string }) {
  const documentId = useBlockId();
  const name = useBlockDocumentName('Document');
  const canEdit = useCanEdit();
  const { replaceSplit } = useSplitLayout();
  const attachment = useQuery(() =>
    emailAttachmentForDocumentOptions(documentId)
  );
  const attachmentId = () =>
    attachment.isSuccess ? attachment.data : undefined;
  const locked = () => !!attachmentId();
  const [editor, setEditor] = createSignal<DocxEditor>();
  const [saveOpen, setSaveOpen] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const canComment = useCanComment();
  const isOwner = useIsDocumentOwner();
  const userId = useUserId();
  const permissions = useGetPermissions();
  const openShare = useShareModal(() => ({
    id: documentId,
    blockAlias: 'write',
    itemType: 'document',
    name: name() ?? '',
    userPermissions: permissions(),
    owner: blockMetadataSignal()?.owner,
  }));
  onMount(() => {
    if (props.share === 'true') openShare();
  });
  const data = () => {
    const value = blockDataSignal.get() as
      | (DocxBlockData & { __block?: string })
      | undefined;
    return value?.__block === 'write' && 'documentMetadata' in value
      ? value
      : undefined;
  };
  const fileName = () => {
    const base = name() || 'Document';
    return /\.docx$/i.test(base) ? base : `${base}.docx`;
  };
  const parent = () => ({ type: 'document' as const, id: documentId });
  const roots = useMessageRootsQuery(parent);
  // Gated: reading a pending query's data would suspend and blank the editor.
  const rootThreads = () => (roots.isSuccess ? (roots.data ?? []) : []);
  const reportError = (error: unknown) => {
    console.error('DOCX editor error', error);
    toast.failure(
      error instanceof Error ? error.message : 'Something went wrong'
    );
  };
  const downloadBytes = (bytes: Uint8Array) =>
    downloadFile(
      new Blob([bytes.slice().buffer], { type: DOCX_MIME }),
      fileName()
    );
  const download = () => {
    const current = editor();
    if (!current) {
      toast.failure('The document is still opening.');
      return;
    }
    fireAndForget(
      current
        .idle()
        .then(() => current.save())
        .then(downloadBytes)
        .catch((error: unknown) => {
          console.error(error);
          toast.failure('Failed to download file');
        }),
      'docx-download'
    );
  };
  const saveCopy = async () => {
    const id = attachmentId();
    const current = editor();
    if (!id || saving()) return;
    if (!current) {
      toast.failure('The document is still opening.');
      return;
    }
    setSaving(true);
    try {
      const bytes = await current.idle().then(() => current.save());
      const savedId = await saveEditedAttachmentCopy(id, bytes, fileName());
      setSaveOpen(false);
      replaceSplit({ content: { type: 'write', id: savedId } });
    } catch (error) {
      console.error(error);
      toast.failure('Failed to save a copy to Drive. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const ops: FileOperation[] = [
    { op: 'rename' },
    { op: 'copy' },
    { op: 'moveToProject' },
    {
      group: 'file',
      label: 'Download .docx',
      icon: DownloadIcon,
      action: download,
    },
    { op: 'delete' },
  ];

  return (
    <DocumentBlockContainer>
      <div class="flex size-full min-h-0 min-w-0 flex-col overflow-hidden">
        <SplitHeaderLeft>
          <BlockItemSplitLabel
            trailingBadges={
              <Badge variant="outline" size="xs">
                Beta
              </Badge>
            }
          />
        </SplitHeaderLeft>
        <SplitHeaderRight>
          <BlockLiveIndicators />
        </SplitHeaderRight>
        <SplitHeaderRight>
          <div class="order-[999] flex items-center">
            <ChatWithAgentButton
              label="Ask Macro"
              entity={{
                type: 'document',
                id: documentId,
                name: name(),
                fileType: 'docx',
              }}
            />
          </div>
        </SplitHeaderRight>
        <ResponsivePermissionsBadge />
        <ResponsiveBlockToolbar
          id={documentId}
          itemType="document"
          name={name()}
          ops={ops}
          tools={[
            {
              group: 'sharing',
              label: 'Share',
              icon: IconShared,
              action: openShare,
              buttonComponent: () => <ShareTrigger onClick={openShare} />,
              focusTarget: getShareDrawerRecipientInput,
            },
          ]}
        />
        <Show when={locked()}>
          <div class="flex items-center gap-3 border-b border-edge-muted px-4 py-2 text-sm">
            <p class="min-w-0 flex-1 text-ink-muted">
              This file came from an email. Save a copy to your Drive to edit
              it.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={saving()}
              onClick={() => setSaveOpen(true)}
            >
              Save a copy
            </Button>
          </div>
        </Show>
        <Show
          when={attachment.isFetched && data()}
          keyed
          fallback={
            <Show when={!attachment.isFetched}>
              <div class="p-6 text-sm text-ink-muted">Opening document…</div>
            </Show>
          }
        >
          {(loaded) => {
            const session = createDocxSession({
              documentId,
              userId: userId(),
              canEdit,
              canComment,
              exists: () => docxSyncExists(documentId),
              fetchOriginal: () => fetchOriginalDocx(documentId),
              buildSeed: buildDocxSeed,
              initialize: (snapshot) =>
                initializeDocxSync(documentId, snapshot),
              connect: () =>
                connectDocxSync(documentId, loaded.token, loaded.authorization),
            });
            const state = session.state;
            // Remount the editor only when the collaborative document is replaced.
            const target = createMemo(
              () => {
                const current = state();
                if (current.t === 'ready')
                  return { doc: current.doc, original: undefined };
                if (current.t === 'original')
                  return { doc: null, original: current.bytes };
                return undefined;
              },
              undefined,
              {
                equals: (a, b) =>
                  a?.doc === b?.doc && a?.original === b?.original,
              }
            );
            return (
              <Switch>
                <Match when={state().t === 'error'}>
                  <div class="p-6 text-sm text-failure">
                    {(() => {
                      const current = state();
                      return current.t === 'error'
                        ? current.message
                        : 'The document editor could not be loaded.';
                    })()}
                  </div>
                </Match>
                <Match when={!target()}>
                  <div class="p-6 text-sm text-ink-muted">
                    Opening document…
                  </div>
                </Match>
                <Match when={target()} keyed>
                  {({ doc, original }) => (
                    <DocxEditorView
                      doc={doc}
                      original={original}
                      canEdit={!!doc && canEdit() && !locked()}
                      onEditAttempt={() => {
                        if (locked()) setSaveOpen(true);
                      }}
                      onReady={setEditor}
                      canComment={() => !!doc && canComment()}
                      fileName={fileName()}
                      peers={session.peers}
                      displayName={displayName}
                      author={displayName(userId())}
                      documentId={documentId}
                      onSelection={session.setSelection}
                      commentRoots={doc ? rootThreads : undefined}
                      margin={(context) => (
                        <DocxCommentMargin
                          documentId={documentId}
                          comments={context.comments}
                          geometry={context.geometry}
                          selectionTop={context.selectionTop}
                          canComment={() => !!doc && canComment()}
                          isOwner={isOwner}
                          userId={userId}
                        />
                      )}
                      footer={(comments) => (
                        <>
                          <DocxDetachedComments
                            documentId={documentId}
                            threads={comments.detached()}
                            canComment={canComment}
                            isOwner={isOwner}
                          />
                          <EntityDiscussion
                            parent={parent()}
                            canWrite={canComment()}
                            canModerate={isOwner()}
                            link={{ type: 'write', id: documentId }}
                            label="Discussion"
                          />
                        </>
                      )}
                      onDownload={downloadBytes}
                      onError={reportError}
                    />
                  )}
                </Match>
              </Switch>
            );
          }}
        </Show>
        <Dialog
          open={saveOpen()}
          onOpenChange={setSaveOpen}
          position="center"
          class="w-120"
        >
          <Panel depth={2} class="rounded-xl">
            <Panel.Header class="px-6">
              <Dialog.Title class="text-sm font-semibold">
                Save a copy to Drive
              </Dialog.Title>
            </Panel.Header>
            <Panel.Body class="flex flex-col gap-4 px-6 pb-6">
              <Dialog.Description class="text-sm text-ink-muted">
                An email attachment can't be edited. Saving a copy puts{' '}
                {fileName()} in your Drive, with the changes already on this
                file.
              </Dialog.Description>
              <div class="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setSaveOpen(false)}
                  disabled={saving()}
                >
                  Cancel
                </Button>
                <Button
                  disabled={saving()}
                  onClick={() => {
                    fireAndForget(saveCopy(), 'docx-save-copy');
                  }}
                >
                  {saving() ? 'Saving…' : 'Save a copy'}
                </Button>
              </div>
            </Panel.Body>
          </Panel>
        </Dialog>
      </div>
    </DocumentBlockContainer>
  );
}
