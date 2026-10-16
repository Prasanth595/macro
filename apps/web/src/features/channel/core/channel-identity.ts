import type { Result } from 'neverthrow';

export type ChannelIdentitySaveError = { kind: 'picture' | 'name' };

export type ChannelIdentityWriter = {
  savePicture: (
    file: File | null
  ) => Promise<Result<void, ChannelIdentitySaveError>>;
  saveName: (name: string) => Promise<Result<void, ChannelIdentitySaveError>>;
};
