import { Button } from '@ui/components/Button';
import { Checkbox } from '@ui/components/Checkbox';
import { Show } from 'solid-js';
import { useChannelIdentityContext } from '../context/channel-identity-context';

export function ChannelIdentityTeamFields() {
  const { form, canEdit, teamControls } = useChannelIdentityContext();
  const canConvert = () =>
    !teamControls?.()?.settings.isTeamChannel && !!teamControls?.()?.canConvert;
  const disabled = () =>
    !canEdit() || form.pending() || !teamControls?.()?.canManage;

  return (
    <Show
      when={
        teamControls?.()?.canManage || form.teamChanges()
          ? form.teamSettings()
          : undefined
      }
    >
      {(settings) => (
        <section class="flex flex-col gap-4" aria-label="Team access">
          <div>
            <Checkbox
              name="isTeamChannel"
              checked={settings().isTeamChannel}
              disabled={disabled() || !canConvert()}
              onChange={form.changeTeamChannel}
            >
              <Checkbox.Control />
              <Checkbox.Label>Team channel</Checkbox.Label>
            </Checkbox>
            <p class="mt-1 text-xs text-ink-muted">
              {settings().isTeamChannel
                ? canConvert()
                  ? 'This channel will belong to your team after saving. Conversion cannot be undone.'
                  : 'This channel belongs to your team.'
                : (teamControls?.()?.conversionUnavailableReason ??
                  'Convert this channel into a team channel. This cannot be undone.')}
            </p>
          </div>
          <Show when={settings().isTeamChannel}>
            <div>
              <Checkbox
                name="autoJoinTeam"
                checked={settings().autoJoinTeam}
                disabled={disabled()}
                onChange={form.changeAutoJoinTeam}
              >
                <Checkbox.Control />
                <Checkbox.Label>Team auto-join</Checkbox.Label>
              </Checkbox>
              <p class="mt-1 text-xs text-ink-muted">
                Add current and future team members to this channel
                automatically.
              </p>
            </div>
          </Show>
          <Show when={form.teamChanges() && !form.canSaveTeam()}>
            <p class="text-xs text-ink-muted">
              Team settings can no longer be saved. Discard them to save your
              other changes.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={form.pending()}
              onClick={form.discardTeamChanges}
            >
              Discard team changes
            </Button>
          </Show>
        </section>
      )}
    </Show>
  );
}
