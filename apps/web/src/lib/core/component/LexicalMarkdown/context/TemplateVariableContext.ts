import { createContext, useContext } from 'solid-js';

/** How a template variable chip reads where it is shown. */
export type TemplateVariableChip = {
  label: string;
  /**
   * `variable`: still to be filled; `fixed`: the same for everyone;
   * `filled`: a value chosen for this person; `check`: filled, worth a check.
   */
  tone: 'variable' | 'fixed' | 'filled' | 'check';
};

/**
 * Supplied by surfaces that show routine template instructions, so each
 * `<m-template-variable>` slot can show its label or value. Without it a slot
 * shows its key.
 */
export const TemplateVariableContext =
  createContext<(key: string) => TemplateVariableChip | undefined>();

export function useTemplateVariableChip() {
  return useContext(TemplateVariableContext);
}
