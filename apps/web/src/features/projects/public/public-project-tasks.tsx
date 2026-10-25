import { blockNameToDefaultFile } from '@core/constant/allBlocks';
import { PropertyValuePill } from '@property/component/PropertyValuePill';
import { hasValue } from '@property/utils';
import { EmptyStatePanel } from '@ui';
import { For, Show } from 'solid-js';
import type { PublicTask } from './public-project';

/** A project's visible tasks, read-only; each opens on its own. */
export function PublicProjectTasks(props: {
  tasks: readonly PublicTask[];
  onOpenTask(taskId: string): void;
}) {
  return (
    <Show
      when={props.tasks.length > 0}
      fallback={
        <EmptyStatePanel
          centered
          title="No tasks"
          description="Tasks you can see in this project appear here."
        />
      }
    >
      <ul
        aria-label="Project tasks"
        class="h-full divide-y divide-edge-muted overflow-y-auto px-4 py-2"
      >
        <For each={props.tasks}>
          {(task) => (
            <li class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
              <button
                type="button"
                class="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                onClick={() => props.onOpenTask(task.id)}
              >
                {task.name || blockNameToDefaultFile('task')}
              </button>
              <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                <For each={task.properties.filter(hasValue)}>
                  {(property) => (
                    <PropertyValuePill property={property} canEdit={false} />
                  )}
                </For>
              </div>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}
