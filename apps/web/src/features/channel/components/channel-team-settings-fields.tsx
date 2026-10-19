import { ToggleSwitch } from '@ui';
import { Show } from 'solid-js';

export function ChannelTeamSettingsFields(props: {
  isTeamChannel: boolean;
  autoJoinTeam: boolean;
  canChangeChannelType: boolean;
  conversionUnavailableReason?: string;
  disabled: boolean;
  onTeamChannelChange: (enabled: boolean) => void;
  onAutoJoinTeamChange: (enabled: boolean) => void;
}) {
  return (
    <section class="flex flex-col gap-4" aria-label="Team access">
      <div>
        <ToggleSwitch
          checked={props.isTeamChannel}
          disabled={props.disabled || !props.canChangeChannelType}
          onChange={props.onTeamChannelChange}
          label="Team channel"
        />
        <p class="mt-1 text-xs text-ink-muted">
          {props.isTeamChannel
            ? props.canChangeChannelType
              ? 'This channel will belong to your team after saving. Conversion cannot be undone.'
              : 'This channel belongs to your team.'
            : (props.conversionUnavailableReason ??
              'Convert this channel into a team channel. This cannot be undone.')}
        </p>
      </div>
      <Show when={props.isTeamChannel}>
        <div>
          <ToggleSwitch
            checked={props.autoJoinTeam}
            disabled={props.disabled}
            onChange={props.onAutoJoinTeamChange}
            label="Team auto-join"
          />
          <p class="mt-1 text-xs text-ink-muted">
            Add current and future team members to this channel automatically.
          </p>
        </div>
      </Show>
    </section>
  );
}
