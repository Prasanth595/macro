import type { Result } from 'neverthrow';

export type ChannelIdentitySaveError = { kind: 'picture' | 'name' | 'team' };

export type ChannelIdentityWriter = {
  savePicture: (
    file: File | null
  ) => Promise<Result<void, ChannelIdentitySaveError>>;
  saveName: (name: string) => Promise<Result<void, ChannelIdentitySaveError>>;
};

export type ChannelTeamSettings = {
  isTeamChannel: boolean;
  autoJoinTeam: boolean;
};

export type ChannelIdentityFormValues = {
  name: string;
  /** Undefined preserves the picture; null explicitly clears it. */
  picture?: File | null;
  team?: ChannelTeamSettings;
};

export type ChannelTeamSettingsPatch = {
  convertToTeam: boolean;
  autoJoinTeam?: boolean;
};

export type ChannelIdentityTeamControls = {
  settings: ChannelTeamSettings;
  canManage: boolean;
  canConvert: boolean;
  conversionUnavailableReason?: string;
  save: (
    changes: ChannelTeamSettingsPatch
  ) => Promise<Result<void, ChannelIdentitySaveError>>;
};
