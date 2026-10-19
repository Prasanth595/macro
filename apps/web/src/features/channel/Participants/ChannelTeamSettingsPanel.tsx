import { Card } from '@ui';
import { ChannelTeamSettingsFields } from '../components/channel-team-settings-fields';

export function ChannelTeamSettingsPanel(props: {
  isTeamChannel: boolean;
  autoJoinTeam: boolean;
  canConvertToTeam: boolean;
  conversionUnavailableReason?: string;
  disabled: boolean;
  onConvertToTeam: () => void;
  onAutoJoinTeamChange: (enabled: boolean) => void;
}) {
  return (
    <section>
      <Card>
        <Card.Header>
          <Card.Title>Team access</Card.Title>
        </Card.Header>
        <Card.Body>
          <ChannelTeamSettingsFields
            isTeamChannel={props.isTeamChannel}
            autoJoinTeam={props.autoJoinTeam}
            canChangeChannelType={
              !props.isTeamChannel && props.canConvertToTeam
            }
            conversionUnavailableReason={props.conversionUnavailableReason}
            disabled={props.disabled}
            onTeamChannelChange={(checked) =>
              checked && props.onConvertToTeam()
            }
            onAutoJoinTeamChange={props.onAutoJoinTeamChange}
          />
        </Card.Body>
      </Card>
    </section>
  );
}
