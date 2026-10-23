import { defineBlock, type ExtractLoadType, LoadErrors } from '@core/block';
import { ok } from 'neverthrow';
import { lazy } from 'solid-js';

export const definition = defineBlock({
  name: 'routine-template',
  description: 'view and activate a shared routine template',
  defaultFilename: 'Routine template',
  component: lazy(async () => ({
    default: (await import('./routine-template-block')).RoutineTemplateBlock,
  })),
  accepted: {},
  async load(source, intent) {
    if (source.type !== 'dss') return LoadErrors.INVALID;
    if (intent === 'preload') return ok({ type: 'preload', origin: source });
    return ok({ templateId: source.id });
  },
  liveTrackingEnabled: false,
  openTrackingEnabled: false,
});

export type RoutineTemplateData = ExtractLoadType<(typeof definition)['load']>;
