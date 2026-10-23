import type { InputLayout } from './capabilities';

/** A Command K session owns its transient text, layout and dismissal. */
export interface CommandInputSession {
  text: string;
  layout: InputLayout;
  selection: { start: number; end: number };
  onTextChange(text: string): void;
  onComplete(): void;
  onNavigate(): void;
}
