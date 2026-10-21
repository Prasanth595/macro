import type { Result } from 'neverthrow';

export type ProfilePictureWriter = (
  file: File | null
) => Promise<Result<void, string>>;
