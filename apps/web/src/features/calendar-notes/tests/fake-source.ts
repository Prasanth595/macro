import { err, ok } from 'neverthrow';
import { createSignal } from 'solid-js';
import type { NotesSource } from '../context/notes-source';
import type { MeetingNote, NoteDocument } from '../core/types';

export function createFakeNotesSource(options: { fail?: boolean } = {}) {
  const documents: NoteDocument[] = [
    { documentId: 'weekly', name: 'Weekly design sync' },
    { documentId: 'roadmap', name: 'Q4 product roadmap' },
    { documentId: 'research', name: 'Customer research · October' },
    { documentId: 'retro', name: 'Team retrospective' },
  ];
  const team = { id: 'design', name: 'Design team' };
  const [notes, setNotes] = createSignal<MeetingNote[]>([]);
  const [fail, setFail] = createSignal(options.fail ?? false);
  const source: NotesSource = {
    notes: () => ({ data: notes(), pending: false }),
    picker: (query) => () => ({
      data: {
        documents: documents.filter((doc) =>
          doc.name.toLowerCase().includes(query().toLowerCase())
        ),
        teams: [team],
      },
      pending: false,
    }),
    retry: async () => {},
    async link(documentId, teamId) {
      if (fail()) {
        setFail(false);
        return err({
          kind: 'link_failed',
          message: 'Couldn’t save this link. Please try again.',
        });
      }
      const document = documents.find((doc) => doc.documentId === documentId);
      if (!document)
        return err({ kind: 'link_failed', message: 'Document not found' });
      setNotes((current) => [
        ...current.filter((note) => note.documentId !== documentId),
        { ...document, team: teamId ? team : undefined, canManage: true },
      ]);
      return ok(undefined);
    },
    async unlink(documentId) {
      setNotes((current) =>
        current.filter((note) => note.documentId !== documentId)
      );
      return ok(undefined);
    },
  };
  return { source, notes };
}
