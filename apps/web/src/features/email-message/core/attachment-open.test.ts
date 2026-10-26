import { expect, it } from 'vitest';
import { isDocxAttachment, planAttachmentOpen } from './attachment-open';

it('recognizes a Word attachment by type or name', () => {
  expect(isDocxAttachment('Notes.DOCX', 'application/octet-stream')).toBe(true);
  expect(
    isDocxAttachment(
      'Notes.bin',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ).toBe(true);
  expect(isDocxAttachment('Agenda.pdf', 'application/pdf')).toBe(false);
});

it('opens a Word attachment directly until a copy or live edits exist', () => {
  expect(
    planAttachmentOpen({ isDocx: true, copies: [], hasLiveCopy: false })
  ).toEqual({ kind: 'open-original' });
  expect(
    planAttachmentOpen({
      isDocx: false,
      copies: [{ documentId: 'saved', name: 'Notes' }],
      hasLiveCopy: true,
    })
  ).toEqual({ kind: 'open-original' });
});

it('asks which file to open once the attachment has been edited', () => {
  expect(
    planAttachmentOpen({ isDocx: true, copies: [], hasLiveCopy: true })
  ).toEqual({ kind: 'choose', copies: [], includeCurrent: true });

  const copies = [{ documentId: 'saved', name: 'Notes' }];
  expect(
    planAttachmentOpen({ isDocx: true, copies, hasLiveCopy: true })
  ).toEqual({ kind: 'choose', copies, includeCurrent: false });
});
