import { ProjectAttachment } from '@app/features/projects/project-attachment';
import { useFeatureFlag } from '@app/lib/analytics/posthog';
import {
  type MediaItem,
  mapMediaItems,
  partitionAttachments,
} from '@channel/Media/media-items';
import { ItemPreview } from '@core/component/ItemPreview';
import { enableRoutineTemplates } from '@core/constant/featureFlags';
import { lazyNamed } from '@core/util/lazyNamed';
import { stringToItemType } from '@service-storage/client';
import { cn } from '@ui';
import { createMemo, For, Match, Show, Suspense, Switch } from 'solid-js';
import { useMessage } from './context';
import { MediaPreview } from './MediaPreview';

const RoutineTemplateAttachment = lazyNamed(
  () => import('@app/features/routine-templates/template-attachment'),
  'RoutineTemplateAttachment'
);

type AttachmentsProps = {
  class?: string;
};

export function Attachments(props: AttachmentsProps) {
  const message = useMessage();
  const templates = useFeatureFlag(enableRoutineTemplates);
  const buckets = createMemo(() =>
    partitionAttachments(message().attachments ?? [])
  );
  const mediaItems = createMemo<MediaItem[]>((previous = []) =>
    mapMediaItems(buckets().mediaAttachments, previous)
  );
  const hasAttachments = createMemo(
    () =>
      buckets().mediaAttachments.length > 0 ||
      buckets().documentAttachments.length > 0
  );
  const shouldRender = createMemo(
    () => hasAttachments() && !message().deleted_at
  );

  return (
    <Show when={shouldRender()}>
      <div class={cn('mb-2', props.class)} data-message-attachments>
        <Show when={mediaItems().length > 0}>
          <MediaPreview items={mediaItems()} />
        </Show>

        <Show when={buckets().documentAttachments.length > 0}>
          <div class="flex flex-row mt-2 gap-2 flex-wrap max-w-full">
            <For each={buckets().documentAttachments}>
              {(attachment) => (
                <Switch
                  fallback={
                    <ItemPreview
                      id={attachment.entity_id}
                      type={stringToItemType(attachment.entity_type)}
                    />
                  }
                >
                  <Match when={attachment.entity_type === 'initiative'}>
                    <ProjectAttachment id={attachment.entity_id} />
                  </Match>
                  <Match
                    when={
                      attachment.entity_type === 'routine_template' &&
                      templates().enabled
                    }
                  >
                    <Suspense
                      fallback={
                        <div class="h-40 w-full max-w-120 rounded-xl border border-edge-muted" />
                      }
                    >
                      <RoutineTemplateAttachment id={attachment.entity_id} />
                    </Suspense>
                  </Match>
                </Switch>
              )}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  );
}
