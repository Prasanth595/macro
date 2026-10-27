import type { JSX } from 'solid-js';
import { SettingsSection } from '../primitives';

/** A titled section of the agent edit form. */
export function AgentFormSection(props: {
  title: string;
  description: string;
  actions?: JSX.Element;
  expanded?: boolean;
  children: JSX.Element;
}) {
  return (
    <SettingsSection
      title={props.title}
      description={props.description}
      actions={props.actions}
      expanded={props.expanded}
    >
      <div class="pt-2">{props.children}</div>
    </SettingsSection>
  );
}

/** A titled group inside the Advanced section, split by a hairline. */
export function AdvancedGroup(props: {
  title: string;
  description: string;
  children: JSX.Element;
}) {
  return (
    <section class="mt-4 border-t border-ink/[0.06] pt-4">
      <h3 class="text-xs font-medium text-ink">{props.title}</h3>
      <p class="mt-0.5 text-xs text-ink-muted">{props.description}</p>
      <div class="mt-2">{props.children}</div>
    </section>
  );
}
