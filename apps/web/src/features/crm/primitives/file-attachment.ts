import { catchToResult } from '@core/util/result';
import { Telemetry } from '@macro-inc/observability';
import { createSignal } from 'solid-js';
import type { FileTypesSource } from '../context/file-types';
import type { CrmRecordTarget } from '../core/record';

/** One dialog session retains a successfully created file through later failures. */
export function createFileAttachment(
  source: Pick<
    FileTypesSource,
    'create' | 'attach' | 'classify' | 'sessionKey'
  >,
  record: CrmRecordTarget
) {
  const session = source.sessionKey();
  const assertSession = () => {
    if (!session || source.sessionKey() !== session)
      throw new Error('The signed-in user or team changed.');
  };
  const [createdId, setCreatedId] = createSignal<string>();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal('');
  async function save(input: {
    name: string;
    documentId?: string;
    typeId: string | null;
  }) {
    if (pending()) return false;
    setPending(true);
    setError('');
    const result = await catchToResult(() =>
      Telemetry.span('crm.file.save', async (span) => {
        span.setAttr('crm.record.id', record.id);
        span.setAttr('crm.record.type', record.type);
        assertSession();
        let id = input.documentId ?? createdId();
        if (!id) {
          id = await source.create(input.name);
          setCreatedId(id);
        }
        assertSession();
        span.setAttr('document.id', id);
        await source.attach(id, record);
        assertSession();
        // Selecting no type on an existing file preserves its current classification.
        if (input.typeId) await source.classify(id, input.typeId);
      })
    );
    setPending(false);
    if (result.isErr()) {
      setError(
        source.sessionKey() !== session
          ? 'Your account or team changed. Close this dialog and reopen it in the original team to finish.'
          : createdId()
            ? 'The file was created, but attaching it or saving its type failed. Retry to finish with the same file.'
            : 'Could not attach this file or save its type. Check that you can edit the file, then retry.'
      );
      return false;
    }
    return true;
  }
  return { createdId, pending, error, save };
}
