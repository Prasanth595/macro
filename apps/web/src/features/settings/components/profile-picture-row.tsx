import { UserIcon } from '@core/component/UserIcon';
import { useProfilePictureUrl } from '@core/signal/profilePicture';
import PencilIcon from '@phosphor/pencil-simple.svg';
import UploadIcon from '@phosphor/upload-simple.svg';
import { Button } from '@ui/components/Button';
import { createSignal, lazy, Show, Suspense } from 'solid-js';
import { SettingsRow } from '../primitives';

const ProfilePictureSession = lazy(() => import('../profile-picture-session'));

export function ProfilePictureRow(props: { userId: string }) {
  const [pictureUrl] = useProfilePictureUrl(props.userId);
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <SettingsRow label="Profile Picture">
        <div class="flex w-80 max-w-[55cqw] min-w-0 items-center justify-start text-left">
          <Button
            variant="ghost"
            label={
              pictureUrl() ? 'Edit profile picture' : 'Upload profile picture'
            }
            class="group/profile-picture relative size-12 shrink-0 rounded-full border-edge p-0"
            onClick={() => setOpen(true)}
          >
            <Show when={pictureUrl()} fallback={<UploadIcon class="size-5" />}>
              <span class="size-full overflow-hidden rounded-full">
                <UserIcon
                  id={props.userId}
                  isDeleted={false}
                  size="fill"
                  suppressClick
                  showTooltip={false}
                  class="bg-transparent"
                />
              </span>
              <span class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-overlay text-ink opacity-0 transition-opacity not-touch:group-hover/profile-picture:opacity-100 group-focus-visible/profile-picture:opacity-100 touch:opacity-100">
                <PencilIcon class="size-5" />
              </span>
            </Show>
          </Button>
        </div>
      </SettingsRow>
      <Suspense>
        <Show when={open() ? props.userId : undefined} keyed>
          {(userId) => (
            <ProfilePictureSession
              userId={userId}
              onClose={() => setOpen(false)}
            />
          )}
        </Show>
      </Suspense>
    </>
  );
}
