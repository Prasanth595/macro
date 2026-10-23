import { createAgentRosterSource } from '@app/features/agents-view/queries/agent-roster-source';
import { modelLabel } from '@core/component/AI/constant/model-label';
import { getDisplayName } from '@core/user/displayName';
import { tryMacroId } from '@core/user/macroId';
import { type TemplateValue, valueLabel } from './core/template';

/** Labels values with live agent, model and people names. */
export function createTemplateLabels() {
  const roster = createAgentRosterSource();
  return (value: TemplateValue) =>
    value.kind === 'user'
      ? getDisplayName(tryMacroId(value.userId)) || valueLabel(value, () => '')
      : valueLabel(value, (target) =>
          target.kind === 'agent'
            ? (roster.roster().find((agent) => agent.botId === target.agentId)
                ?.name ?? 'Agent')
            : modelLabel(target.model)
        );
}
