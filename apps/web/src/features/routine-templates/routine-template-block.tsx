/**
 * App-facing entry for the `routine-template` block. It reads the block id
 * once and hands it to the feature (FE-34).
 */
import { useBlockId } from '@core/block';
import { RoutineTemplatePage } from './routine-template-page';

export function RoutineTemplateBlock() {
  return <RoutineTemplatePage templateId={useBlockId()} />;
}
