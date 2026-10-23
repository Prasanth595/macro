import { invalidateSchedules } from '@app/features/routines/queries/schedules';
import { throwOnErr } from '@core/util/result';
import { queryClient } from '@queries/client';
import { scheduledActionClient } from '@service-scheduled-action/client';
import type { TemplateDraft } from '@service-scheduled-action/generated/schemas';
import { queryOptions, useMutation, useQuery } from '@tanstack/solid-query';
import type { Accessor } from 'solid-js';
import type {
  Bindings,
  FillResult,
  ShareDraft,
  ShareEdits,
} from '../core/template';
import { routineTemplateKeys } from './keys';
import {
  applyShareEdits,
  bindingsFromWire,
  bindingsToWire,
  draftToModel,
  provenanceFromWire,
  templateFromWire,
  valueFromWire,
} from './wire';

// Cached past unmount; closes over the resolved id only.
function templateQueryOptions(templateId: string) {
  return queryOptions({
    queryKey: routineTemplateKeys.detail({ templateId }).queryKey,
    queryFn: async () =>
      templateFromWire(
        await throwOnErr(() =>
          scheduledActionClient.getTemplate({ id: templateId })
        )
      ),
    refetchOnWindowFocus: 'always',
  });
}

export function useRoutineTemplateQuery(templateId: Accessor<string>) {
  return useQuery(() => templateQueryOptions(templateId()));
}

function provenanceQueryOptions(scheduleId: string, enabled: boolean) {
  return queryOptions({
    queryKey: routineTemplateKeys.provenance({ scheduleId }).queryKey,
    enabled,
    queryFn: async () => {
      const { provenance } = await throwOnErr(() =>
        scheduledActionClient.getRoutineProvenance({ scheduleId })
      );
      return provenance ? provenanceFromWire(provenance) : null;
    },
  });
}

/** Where a routine came from; `null` for a routine made by hand. */
export function useRoutineProvenanceQuery(
  scheduleId: Accessor<string>,
  enabled: Accessor<boolean>
) {
  return useQuery(() => provenanceQueryOptions(scheduleId(), enabled()));
}

/**
 * Propose a template for a routine the caller owns. Nothing is saved. The
 * raw draft goes back to `saveTemplate`, so edits keep what the dialog
 * doesn't show.
 */
export async function extractTemplate(
  sourceActionId: string
): Promise<{ share: ShareDraft; draft: TemplateDraft }> {
  const extracted = await throwOnErr(() =>
    scheduledActionClient.extractTemplate({ sourceActionId })
  );
  const share: ShareDraft = {
    template: draftToModel(extracted.draft, {
      id: '',
      owner: '',
      sourceActionId,
    }),
    creatorValues: bindingsFromWire(extracted.creator_values),
    ...(extracted.existing_template_id
      ? { existingTemplateId: extracted.existing_template_id }
      : {}),
  };
  return { share, draft: extracted.draft };
}

/** Save an extracted draft, new or over an existing template. */
export async function saveTemplate(args: {
  sourceActionId: string;
  draft: TemplateDraft;
  edits: ShareEdits;
  existingTemplateId?: string;
}): Promise<string> {
  const draft = applyShareEdits(args.draft, args.edits);
  const saved = await throwOnErr(() =>
    args.existingTemplateId
      ? scheduledActionClient.updateTemplate({
          id: args.existingTemplateId,
          body: { draft },
        })
      : scheduledActionClient.createTemplate({
          source_action_id: args.sourceActionId,
          draft,
        })
  );
  await queryClient.invalidateQueries({
    queryKey: routineTemplateKeys.detail({ templateId: saved.id }).queryKey,
  });
  return saved.id;
}

/** Ask the AI to fill a template from the caller's workspace. */
export async function fillTemplate(args: {
  templateId: string;
  instruction?: string;
  current: Bindings;
}): Promise<FillResult> {
  const filled = await throwOnErr(() =>
    scheduledActionClient.fillTemplate({
      id: args.templateId,
      body: {
        instruction: args.instruction,
        current: bindingsToWire(args.current),
      },
    })
  );
  return {
    rows: filled.variables.map((row) => ({
      key: row.key,
      ...(row.value ? { value: valueFromWire(row.value) } : {}),
      ...(row.reason ? { reason: row.reason } : {}),
      ...(row.problem ? { problem: row.problem } : {}),
      check: row.confidence === 'check',
    })),
    ...(filled.name ? { name: filled.name } : {}),
  };
}

export function useActivateTemplateMutation() {
  return useMutation(() => ({
    mutationFn: async (args: {
      templateId: string;
      bindings: Bindings;
      name?: string;
    }) =>
      throwOnErr(() =>
        scheduledActionClient.activateTemplate({
          id: args.templateId,
          body: { bindings: bindingsToWire(args.bindings), name: args.name },
        })
      ),
    onSuccess: async (_, args) => {
      await Promise.all([
        invalidateSchedules(),
        queryClient.invalidateQueries({
          queryKey: routineTemplateKeys.detail({ templateId: args.templateId })
            .queryKey,
        }),
      ]);
    },
  }));
}

export function useRebindRoutineMutation() {
  return useMutation(() => ({
    mutationFn: async (args: { scheduleId: string; bindings: Bindings }) =>
      throwOnErr(() =>
        scheduledActionClient.rebindRoutine({
          scheduleId: args.scheduleId,
          body: { bindings: bindingsToWire(args.bindings) },
        })
      ),
    onSuccess: async (_, args) => {
      await Promise.all([
        invalidateSchedules(),
        queryClient.invalidateQueries({
          queryKey: routineTemplateKeys.provenance({
            scheduleId: args.scheduleId,
          }).queryKey,
        }),
      ]);
    },
  }));
}

export function useDeleteTemplateMutation() {
  return useMutation(() => ({
    mutationFn: async (templateId: string) =>
      throwOnErr(() =>
        scheduledActionClient.deleteTemplate({ id: templateId })
      ),
    onSuccess: (_, templateId) => {
      queryClient.removeQueries({
        queryKey: routineTemplateKeys.detail({ templateId }).queryKey,
      });
    },
  }));
}
