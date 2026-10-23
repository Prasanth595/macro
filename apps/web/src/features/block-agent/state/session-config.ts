import type { SessionConfigOption } from '@service-agent-fold/generated/types';
import { match } from 'ts-pattern';

export type SelectSessionConfigOption = Extract<
  SessionConfigOption,
  { type: 'select' }
>;

/** Find one select by ACP semantic category, with an id fallback for agents
 * that predate categories. */
export function selectConfigOption(
  options: readonly SessionConfigOption[],
  category: string,
  fallbackId: string
): SelectSessionConfigOption | undefined {
  const candidate =
    options.find((option) => option.category === category) ??
    options.find((option) => option.id === fallbackId);
  return candidate?.type === 'select' ? candidate : undefined;
}

export function modelConfigOption(
  options: readonly SessionConfigOption[]
): SelectSessionConfigOption | undefined {
  return selectConfigOption(options, 'model', 'model');
}

export function effortConfigOption(
  options: readonly SessionConfigOption[]
): SelectSessionConfigOption | undefined {
  return selectConfigOption(options, 'thought_level', 'reasoning_effort');
}

/** The in-memory agent's option for what its turns run on. */
export const FUNDING_CONFIG_ID = 'funding';

/** What a session's turns can run on besides Macro's AI allowance: the
 * owner's own provider API key, or their team's. */
export type KeyFunding = 'personal_api_key' | 'team_api_key';

/** Macro's AI allowance, or a provider API key. */
export type SessionFunding = 'macro' | KeyFunding;

/** The funding option, present only when the owner has a usable key. */
export function fundingConfigOption(
  options: readonly SessionConfigOption[]
): SelectSessionConfigOption | undefined {
  const candidate = options.find((option) => option.id === FUNDING_CONFIG_ID);
  return candidate?.type === 'select' ? candidate : undefined;
}

export function isKeyFunding(value: string | undefined): value is KeyFunding {
  return value === 'personal_api_key' || value === 'team_api_key';
}

/** How the composer names what turns run on. */
export function fundingName(funding: SessionFunding): string {
  return match(funding)
    .with('macro', () => 'Macro usage')
    .with('personal_api_key', () => 'your API key')
    .with('team_api_key', () => 'team API usage')
    .exhaustive();
}

/** The key the session's turns run on, or `undefined` on Macro usage. */
export function sessionKeyFunding(
  options: readonly SessionConfigOption[]
): KeyFunding | undefined {
  const current = fundingConfigOption(options)?.currentValue;
  return isKeyFunding(current) ? current : undefined;
}

/** Opaque harness setting selected alongside a model. */
export type EffortSelection = { configId: string; value: string };
export type EffortChoice = EffortSelection & { name: string };

export function effortLabel(
  option: SelectSessionConfigOption | undefined,
  value?: string
) {
  return option?.options.find(
    (choice) => choice.value === (value ?? option.currentValue)
  )?.name;
}
