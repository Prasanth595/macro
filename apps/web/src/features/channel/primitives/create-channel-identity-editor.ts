import { type Accessor, createSignal, onCleanup } from 'solid-js';
import { imageFileError } from '../../image-editor/core/image-file';
import type {
  ChannelIdentityTeamControls,
  ChannelIdentityWriter,
  ChannelTeamSettings,
  ChannelTeamSettingsPatch,
} from '../core/channel-identity';

export function createChannelIdentityEditor(options: {
  name: string;
  canEdit: Accessor<boolean>;
  writer: ChannelIdentityWriter;
  teamControls?: Accessor<ChannelIdentityTeamControls | undefined>;
  onClose: () => void;
}) {
  const [name, setName] = createSignal(options.name);
  const [savedName, setSavedName] = createSignal(options.name);
  // Undefined leaves the picture unchanged; null explicitly clears it.
  const [picture, setPicture] = createSignal<File | null>();
  const [teamDraft, setTeamDraft] = createSignal<ChannelTeamSettings>();
  const [savedTeam, setSavedTeam] = createSignal<ChannelTeamSettings>();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });

  const teamBaseline = () => savedTeam() ?? options.teamControls?.()?.settings;
  const teamSettings = () => teamDraft() ?? teamBaseline();
  const teamChanges = (): ChannelTeamSettingsPatch | undefined => {
    const baseline = teamBaseline();
    const next = teamSettings();
    if (!baseline || !next) return;
    const convertToTeam = !baseline.isTeamChannel && next.isTeamChannel;
    const autoJoinChanged = baseline.autoJoinTeam !== next.autoJoinTeam;
    if (!convertToTeam && !autoJoinChanged) return;
    return {
      convertToTeam,
      autoJoinTeam:
        convertToTeam || autoJoinChanged ? next.autoJoinTeam : undefined,
    };
  };
  const canSaveTeam = (changes = teamChanges()) => {
    if (!changes) return true;
    const controls = options.teamControls?.();
    return (
      !!controls?.canManage && (!changes.convertToTeam || controls.canConvert)
    );
  };
  const dirty = () =>
    name().trim() !== savedName() || picture() !== undefined || !!teamChanges();
  const canSave = () =>
    options.canEdit() &&
    !pending() &&
    name().trim().length > 0 &&
    dirty() &&
    canSaveTeam();

  function changeName(value: string) {
    if (pending() || !options.canEdit()) return;
    setName(value);
    setError(undefined);
  }

  function changePicture(file: File | null) {
    if (pending() || !options.canEdit()) return;
    const validationError = file ? imageFileError(file) : undefined;
    setError(validationError);
    if (!validationError) setPicture(file);
  }

  function changeTeamChannel(enabled: boolean) {
    const controls = options.teamControls?.();
    const current = teamSettings();
    if (
      pending() ||
      !options.canEdit() ||
      !controls?.canManage ||
      !controls.canConvert ||
      teamBaseline()?.isTeamChannel ||
      !current
    )
      return;
    if (!savedTeam()) setSavedTeam(teamBaseline());
    setTeamDraft({
      isTeamChannel: enabled,
      autoJoinTeam: enabled && current.autoJoinTeam,
    });
    setError(undefined);
  }

  function changeAutoJoinTeam(enabled: boolean) {
    const current = teamSettings();
    if (
      pending() ||
      !options.canEdit() ||
      !options.teamControls?.()?.canManage ||
      !current?.isTeamChannel
    )
      return;
    if (!savedTeam()) setSavedTeam(teamBaseline());
    setTeamDraft({ ...current, autoJoinTeam: enabled });
    setError(undefined);
  }

  function discardTeamChanges() {
    if (pending()) return;
    setTeamDraft(undefined);
    setSavedTeam(undefined);
    setError(undefined);
  }

  function close() {
    if (!pending()) options.onClose();
  }

  function failSave(message: string) {
    if (!disposed) {
      setError(message);
      setPending(false);
    }
    return false;
  }

  async function save() {
    if (!canSave()) return;
    const nextPicture = picture();
    const nextName = name().trim();
    const nameChanged = nextName !== savedName();
    const nextTeam = teamSettings();
    const nextTeamChanges = teamChanges();
    const teamControls = options.teamControls?.();
    setPending(true);
    setError(undefined);
    let pictureSaved = false;

    // A submitted save belongs to this channel even if its editor unmounts.
    // Complete the captured changes, but never update a replacement editor.
    if (nextPicture !== undefined) {
      const result = await options.writer.savePicture(nextPicture);
      if (result.isErr()) {
        return failSave(
          'Could not save the channel picture. Your changes are still here. Try again.'
        );
      }
      if (!disposed) setPicture(undefined);
      pictureSaved = true;
    }

    if (nameChanged) {
      if (!disposed && !options.canEdit()) {
        return failSave(
          pictureSaved
            ? 'The picture was saved, but you no longer have permission to change the channel name.'
            : 'You no longer have permission to edit this channel.'
        );
      }
      const result = await options.writer.saveName(nextName);
      if (result.isErr()) {
        return failSave(
          pictureSaved
            ? 'The picture was saved, but the channel name was not. Try saving again.'
            : 'Could not save the channel name. Your changes are still here. Try again.'
        );
      }
      if (!disposed) setSavedName(nextName);
    }

    if (nextTeamChanges && teamControls) {
      if (!disposed && (!options.canEdit() || !canSaveTeam(nextTeamChanges))) {
        return failSave(
          'You no longer have permission to change the team settings.'
        );
      }
      const result = await teamControls.save(nextTeamChanges);
      if (result.isErr()) {
        return failSave(
          pictureSaved || nameChanged
            ? 'Some changes were saved, but the team settings were not. Try saving again.'
            : 'Could not save the team settings. Your changes are still here. Try again.'
        );
      }
      if (!disposed) {
        setSavedTeam(nextTeam);
        setTeamDraft(undefined);
      }
    }

    if (!disposed) {
      setPending(false);
      options.onClose();
    }
    return true;
  }

  return {
    name,
    picture,
    pending,
    error,
    dirty,
    canSave,
    teamSettings,
    teamChanges,
    canSaveTeam,
    discardTeamChanges,
    changeTeamChannel,
    changeAutoJoinTeam,
    changeName,
    changePicture,
    close,
    save,
  };
}
