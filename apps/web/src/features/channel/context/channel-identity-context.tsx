import type { ImagePreviewController } from '@app/components/image-editor/create-image-preview';
import { type Accessor, createContext, useContext } from 'solid-js';
import type { ChannelIdentityTeamControls } from '../core/channel-identity';
import type { createChannelIdentityEditor } from '../primitives/create-channel-identity-editor';

export type ChannelIdentityContextValue = {
  channelId: string;
  form: ReturnType<typeof createChannelIdentityEditor>;
  canEdit: Accessor<boolean>;
  pictureLoading: Accessor<boolean>;
  pictureUrl: Accessor<string | undefined>;
  imageFileName: Accessor<string | undefined>;
  teamControls?: Accessor<ChannelIdentityTeamControls | undefined>;
  cropSource: Accessor<File | string | undefined>;
  preview: ImagePreviewController;
  editPicture: () => void;
  selectPicture: (file: File) => void;
  dropPictures: (files: File[]) => void;
  clearPicture: () => void;
  previewPicture: (trigger: HTMLButtonElement) => void;
  returnToDetails: () => void;
  saveImage: (file?: File) => void;
  save: () => Promise<void>;
};

const ChannelIdentityContext = createContext<ChannelIdentityContextValue>();
export const ChannelIdentityProvider = ChannelIdentityContext.Provider;

export function useChannelIdentityContext() {
  const context = useContext(ChannelIdentityContext);
  if (!context) throw new Error('ChannelIdentityProvider is required');
  return context;
}
