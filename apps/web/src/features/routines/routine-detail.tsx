import { openAgentsPage } from '@app/features/agents-view/primitives/open-page';
import { openBulkEditModal } from '@app/features/entity/bulk-edit/BulkEditEntityModal';
import { useFeatureFlag } from '@app/lib/analytics/posthog';
import { useSplitLayout } from '@components/app/split-layout/layout';
import { useSplitPanelOrThrow } from '@components/app/split-layout/layoutUtils';
import { useHasPaidAccess } from '@core/auth/license';
import { useBlockId } from '@core/block';
import { defaultModelForPlan } from '@core/component/AI/constant';
import { toast } from '@core/component/Toast/Toast';
import { enableRoutineTemplates } from '@core/constant/featureFlags';
import { useUserId } from '@core/context/user';
import { writeClipboardData } from '@core/util/dataTransfer';
import { fireAndForget } from '@core/util/fireAndForget';
import { lazyNamed } from '@core/util/lazyNamed';
import { onMount, Show, Suspense } from 'solid-js';
import { getErrorMessage } from './core/routine-draft';
import {
  createAgentHistoryMetadata,
  createChatHistoryMetadata,
} from './queries/history-metadata';
import { createRoutineDetailSource } from './queries/routine-sources';
import { RoutineExecutionPicker } from './routine-execution-picker';
import { RoutinePromptEditor } from './routine-prompt-editor';
import { RoutineTriggers } from './routine-triggers';
import { RoutineDetailView } from './views/routine-detail';

const RoutineProvenance = lazyNamed(
  () => import('@app/features/routine-templates/routine-provenance'),
  'RoutineProvenance'
);

export function Routine() {
  const scheduleId = useBlockId();
  const layout = useSplitLayout();
  onMount(() => {
    if (scheduleId === 'new') {
      layout.popoverSplit({ type: 'component', id: 'routine-compose' });
      openAgentsPage(layout, 'routines');
    }
  });
  return (
    <Show when={scheduleId !== 'new'}>
      <RoutineDetail scheduleId={scheduleId} />
    </Show>
  );
}

export function RoutineDetail(props: {
  scheduleId: string;
  initialTab?: 'settings' | 'history';
  onBack?: () => void;
  onOpen?: (id: string) => void;
}) {
  const layout = useSplitLayout();
  const panel = useSplitPanelOrThrow();
  const userId = useUserId();
  const hasPaidAccess = useHasPaidAccess();
  const templates = useFeatureFlag(enableRoutineTemplates);
  const back = () =>
    props.onBack ? props.onBack() : openAgentsPage(layout, 'routines');
  const open = (id: string) =>
    props.onOpen
      ? props.onOpen(id)
      : openAgentsPage(layout, 'routines', { routineId: id });
  const source = createRoutineDetailSource(() => props.scheduleId, {
    onError: (title, error) =>
      toast.alert(title, { subtext: getErrorMessage(error) }),
    onDuplicated: (id) => {
      toast.success('Duplicated');
      open(id);
    },
  });
  const remove = () => {
    const entity = source.entity();
    if (!entity || entity.ownerId !== userId()) return;
    openBulkEditModal({
      view: 'delete',
      entities: [entity],
      onFinish: () => {
        toast.success('Deleted');
        back();
      },
      onError: () => toast.failure('Failed to delete'),
    });
  };
  return (
    <RoutineDetailView
      source={source}
      userId={userId}
      defaultModel={defaultModelForPlan(hasPaidAccess())}
      initialTab={props.initialTab}
      onBack={back}
      onDelete={remove}
      onShare={
        templates().enabled
          ? () => {
              const entity = source.entity();
              if (!entity) return;
              fireAndForget(
                shareAsTemplate(props.scheduleId, entity.name),
                'routine-templates'
              );
            }
          : undefined
      }
      banner={
        <Show when={templates().enabled}>
          <Suspense>
            <RoutineProvenance scheduleId={props.scheduleId} />
          </Suspense>
        </Show>
      }
      onRename={(name) => {
        if (!props.onBack) panel.handle.setDisplayName(name);
      }}
      onOpenRun={(resource, newSplit) =>
        layout.openWithSplit(resource, {
          activate: true,
          preferNewSplit: newSplit,
        })
      }
      onCopyPrompt={async (prompt) => {
        if (await writeClipboardData({ 'text/plain': prompt }))
          toast.success('Prompt copied');
        else toast.alert('Could not copy prompt');
      }}
      slots={{
        PromptEditor: RoutinePromptEditor,
        ExecutionPicker: RoutineExecutionPicker,
        Triggers: RoutineTriggers,
        createChatMetadata: createChatHistoryMetadata,
        createAgentMetadata: createAgentHistoryMetadata,
      }}
    />
  );
}

async function shareAsTemplate(routineId: string, routineName: string) {
  const { openShareTemplateDialog } = await import(
    '@app/features/routine-templates/share-template'
  );
  openShareTemplateDialog({ routineId, routineName });
}
