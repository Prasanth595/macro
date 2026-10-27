export type OutlineFinish = 'default' | 'glass-outline';

/** Transparent border layers only; the owning control keeps its fill and focus treatment. */
export const outlineReflectionStyles = [
  'relative',
  "before:pointer-events-none before:absolute before:-inset-px before:rounded-[inherit] before:border before:border-button-outline-highlight before:button-outline-reflection-top before:content-['']",
  "after:pointer-events-none after:absolute after:-inset-px after:rounded-[inherit] after:border after:border-button-outline-highlight after:button-outline-reflection-bottom after:opacity-50 after:content-['']",
].join(' ');
