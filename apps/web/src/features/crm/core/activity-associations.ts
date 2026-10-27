import type { CrmRecordRef, CrmRecordTarget } from './record';

export type ActivityAssociation = CrmRecordRef & {
  /** Email matches explain relevance without claiming a saved property link. */
  match: 'linked' | 'email';
};

export type ActivityAssociationInput = {
  links: CrmRecordTarget[];
  emails: string[];
};

export type ActivityAssociationRecord = CrmRecordRef & {
  email?: string;
};

export function normalizeAssociationEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Only resolved, accessible records become navigation targets. */
export function resolveActivityAssociations(
  input: ActivityAssociationInput,
  records: readonly ActivityAssociationRecord[]
): ActivityAssociation[] {
  const associations: ActivityAssociation[] = [];
  for (const record of records) {
    const linked = input.links.some(
      (link) => link.type === record.type && link.id === record.id
    );
    const emailMatch =
      record.type === 'contact' &&
      !!record.email &&
      input.emails.includes(normalizeAssociationEmail(record.email));
    if (!linked && !emailMatch) continue;
    if (
      associations.some(
        (association) =>
          association.type === record.type && association.id === record.id
      )
    ) {
      continue;
    }
    associations.push({
      type: record.type,
      id: record.id,
      name: record.name,
      match: linked ? 'linked' : 'email',
    });
  }
  return associations.sort(
    (a, b) =>
      Number(a.type === 'contact') - Number(b.type === 'contact') ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id)
  );
}
