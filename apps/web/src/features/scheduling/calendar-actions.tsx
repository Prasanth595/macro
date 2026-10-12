import { ShowFeatureFlag } from '@app/lib/analytics/posthog';
import { useNavigate } from '@app/lib/split-router';
import { bookingLinksRoute } from '@app/routes/routes';
import { toast } from '@core/component/Toast/Toast';
import { enableCalendarScheduling } from '@core/constant/featureFlags';
import { useUserId } from '@core/context/user';
import { writeClipboardData } from '@core/util/dataTransfer';
import { getWebOrigin } from '@core/util/webOrigin';
import ArrowSquareOutIcon from '@phosphor/arrow-square-out.svg';
import LinkIcon from '@phosphor/link.svg';
import { Button } from '@ui';
import { Suspense } from 'solid-js';
import { useSchedulingProfileQuery } from './queries/source';

function Actions() {
  const user = useUserId();
  const navigate = useNavigate();
  const source = useSchedulingProfileQuery(() => ({
    id: user() ?? 'me',
    name: 'Personal',
    canEdit: true,
  }));
  const copy = async () => {
    const profile = source.isSuccess ? source.data : undefined;
    if (!profile?.revision || !profile.eventTypes.some((e) => e.enabled)) {
      navigate({ route: bookingLinksRoute });
      return;
    }
    if (
      await writeClipboardData({
        'text/plain': `${getWebOrigin()}/app/book/${encodeURIComponent(profile.id)}`,
      })
    )
      toast.success('Booking link copied');
    else toast.failure('Could not copy booking link');
  };
  return (
    <div class="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        label="Copy booking link"
        disabled={source.isPending}
        onClick={() => void copy()}
      >
        <LinkIcon class="size-3.5" />
        <span class="hidden lg:inline">Booking link</span>
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        label="Manage booking links"
        onClick={() => navigate({ route: bookingLinksRoute })}
      >
        <ArrowSquareOutIcon class="size-3.5" />
      </Button>
    </div>
  );
}
export function CalendarSchedulingActions() {
  return (
    <ShowFeatureFlag flag={enableCalendarScheduling}>
      <Suspense>
        <Actions />
      </Suspense>
    </ShowFeatureFlag>
  );
}
