import { type Accessor, createSignal, onCleanup } from 'solid-js';
import type { ChannelIdentityWriter } from '../core/channel-identity';
import { channelPictureFileError } from '../core/channel-picture';

export function createChannelIdentityEditor(options: {
  name: string;
  canEdit: Accessor<boolean>;
  writer: ChannelIdentityWriter;
  onClose: () => void;
}) {
  const [name, setName] = createSignal(options.name);
  const [savedName, setSavedName] = createSignal(options.name);
  // Undefined leaves the picture unchanged; null explicitly clears it.
  const [picture, setPicture] = createSignal<File | null>();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });

  const dirty = () => name().trim() !== savedName() || picture() !== undefined;
  const canSave = () =>
    options.canEdit() && !pending() && name().trim().length > 0 && dirty();

  function changeName(value: string) {
    if (pending() || !options.canEdit()) return;
    setName(value);
    setError(undefined);
  }

  function changePicture(file: File | null) {
    if (pending() || !options.canEdit()) return;
    const validationError = file ? channelPictureFileError(file) : undefined;
    setError(validationError);
    if (!validationError) setPicture(file);
  }

  function close() {
    if (!pending()) options.onClose();
  }

  async function save() {
    if (!canSave()) return;
    setPending(true);
    setError(undefined);
    const nextPicture = picture();
    let pictureSaved = false;

    if (nextPicture !== undefined) {
      const result = await options.writer.savePicture(nextPicture);
      if (disposed) return;
      if (result.isErr()) {
        setError(
          'Could not save the channel picture. Your changes are still here. Try again.'
        );
        setPending(false);
        return;
      }
      setPicture(undefined);
      pictureSaved = true;
    }

    if (!options.canEdit()) {
      setError(
        pictureSaved
          ? 'The picture was saved, but you no longer have permission to change the channel name.'
          : 'You no longer have permission to edit this channel.'
      );
      setPending(false);
      return;
    }

    const nextName = name().trim();
    if (nextName !== savedName()) {
      const result = await options.writer.saveName(nextName);
      if (disposed) return;
      if (result.isErr()) {
        setError(
          pictureSaved
            ? 'The picture was saved, but the channel name was not. Try saving again.'
            : 'Could not save the channel name. Your changes are still here. Try again.'
        );
        setPending(false);
        return;
      }
      setSavedName(nextName);
    }

    setPending(false);
    options.onClose();
  }

  return {
    name,
    picture,
    pending,
    error,
    dirty,
    canSave,
    changeName,
    changePicture,
    close,
    save,
  };
}
