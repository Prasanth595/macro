/** Internal experiments require both their PostHog rollout and a Macro account. */
export function experimentalFeaturesAvailable(
  email: string | undefined,
  enabled: boolean
): boolean {
  return enabled && !!email?.trim().toLowerCase().endsWith('@macro.com');
}
