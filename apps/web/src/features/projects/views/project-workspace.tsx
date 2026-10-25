import { SidePanel } from '@components/app/side-panel';
import { EntityMetadata } from '@components/app/side-panel/EntityMetadata';
import { InlineTitleEditor } from '@core/component/InlineTitleEditor';
import { fireAndForget } from '@core/util/fireAndForget';
import { PropertyValuePill } from '@property/component/PropertyValuePill';
import type { PropertySaveFn } from '@property/core/context';
import type { Property } from '@property/types';
import { createSignal, For, type JSX, Match, Show, Switch } from 'solid-js';
import type { ProjectDetail, ProjectSection } from '../core/project';

export type WorkspaceProject = Pick<
  ProjectDetail,
  'id' | 'name' | 'ownerId' | 'updatedAt'
> &
  Partial<Pick<ProjectDetail, 'createdAt'>>;

/** Present only when the viewer may change the project; without it every control is read-only. */
export type ProjectEditor = {
  rename(name: string): Promise<void>;
  saveProperty: PropertySaveFn;
};

/**
 * Project content inside the same detail layout used by tasks. It knows
 * nothing about who is viewing; hosts fill the account-backed parts.
 */
export function ProjectWorkspace(props: {
  project: WorkspaceProject;
  /** Status, Priority, Assignees and Due date, in composer order. */
  properties: readonly Property[];
  section: ProjectSection;
  editor?: ProjectEditor;
  onRefresh?(): void;
  refreshFailed?: boolean;
  /** Draws the side panel's Properties section, when the host has one. */
  propertiesPanel?: () => JSX.Element;
  description: JSX.Element;
  discussion: JSX.Element;
  tasks: JSX.Element;
}) {
  const [error, setError] = createSignal<string>();
  const run = async (action: () => Promise<void>) => {
    setError(undefined);
    try {
      await action();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not save project.'
      );
    }
  };

  return (
    <SidePanel.Layout headerToggle={false} floating defaultOpen={false}>
      <SidePanel.Footer>
        <EntityMetadata
          ownerId={props.project.ownerId}
          createdAt={props.project.createdAt}
          updatedAt={props.project.updatedAt}
        />
      </SidePanel.Footer>
      <Show when={props.propertiesPanel}>
        {(panel) => (
          <SidePanel.Section
            id="properties"
            title="Properties"
            defaultOpen
            order={1}
          >
            {panel()()}
          </SidePanel.Section>
        )}
      </Show>
      <div class="flex size-full min-h-0 min-w-0 flex-col overflow-hidden">
        <Show when={error()}>
          {(message) => (
            <p role="alert" class="px-6 py-2 text-sm text-failure">
              {message()}
            </p>
          )}
        </Show>
        <Show when={props.refreshFailed}>
          <p role="status" class="px-6 py-2 text-sm text-ink-muted">
            Could not refresh this project.
          </p>
        </Show>
        <div class="min-h-0 flex-1">
          <Switch>
            <Match when={props.section === 'overview'}>
              <div class="h-full overflow-y-auto px-6 pb-8 pt-12 touch:pt-6">
                <div class="mx-auto max-w-3xl">
                  <Show
                    when={props.editor}
                    fallback={
                      <h1 class="text-2xl font-semibold">
                        {props.project.name}
                      </h1>
                    }
                  >
                    {(editor) => (
                      <InlineTitleEditor
                        value={props.project.name}
                        placeholder="Project name"
                        ariaLabel="Project name"
                        class="w-full text-2xl"
                        onRename={(name) =>
                          fireAndForget(
                            run(() => editor().rename(name)),
                            'projects'
                          )
                        }
                      />
                    )}
                  </Show>
                  <div
                    class="mb-6 mt-3 flex flex-wrap items-center gap-2"
                    aria-label="Project properties"
                  >
                    <For each={props.properties}>
                      {(property) => (
                        <PropertyValuePill
                          property={property}
                          canEdit={props.editor !== undefined}
                          onSave={props.editor?.saveProperty}
                          onRefresh={props.onRefresh}
                          entitySelfFilter={{
                            blockId: props.project.id,
                            entityType: 'INITIATIVE',
                          }}
                        />
                      )}
                    </For>
                  </div>
                  <div aria-label="Project description">
                    {props.description}
                  </div>
                  {props.discussion}
                </div>
              </div>
            </Match>
            <Match when={props.section === 'tasks'}>{props.tasks}</Match>
          </Switch>
        </div>
      </div>
    </SidePanel.Layout>
  );
}
