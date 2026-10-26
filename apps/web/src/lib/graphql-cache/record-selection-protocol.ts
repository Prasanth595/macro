/** Bounds shared by explicit record projection and collection membership writes. */
export const MAX_RECORD_SELECTION_PAGE_SIZE = 500;
export const MAX_NORMALIZED_RECORD_KEY_LENGTH = 1024;

/** Non-throwing canonical normalized-record key validation for wire ingress. */
export function isValidNormalizedRecordKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_NORMALIZED_RECORD_KEY_LENGTH &&
    /^[A-Za-z_][A-Za-z0-9_]*:/.test(value)
  );
}
