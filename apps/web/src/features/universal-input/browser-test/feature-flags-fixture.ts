/** Deterministic optional editor capabilities; rollout flags use home-mode-wiring. */
export function useFeatureFlag() {
  return () => ({ enabled: false, loading: false });
}
