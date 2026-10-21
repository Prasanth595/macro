import { defineBlock, type ExtractLoadType, LoadErrors } from '@core/block';
import { ok } from 'neverthrow';
import { lazy } from 'solid-js';

export const definition = defineBlock({
  name: 'deal',
  description: 'View a CRM deal',
  component: lazy(async () => ({
    default: (await import('./component/DealBlockAdapter')).DealBlockAdapter,
  })),
  liveTrackingEnabled: false,
  async load(source, _intent) {
    if (source.type === 'dss') {
      return ok({ id: source.id });
    }
    return LoadErrors.MISSING;
  },
  accepted: {},
});

export type DealData = ExtractLoadType<(typeof definition)['load']>;
