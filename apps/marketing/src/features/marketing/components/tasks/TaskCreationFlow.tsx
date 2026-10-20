import { createSignal, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { WorkspaceTask } from '../../core/dummy-workspace';
import { createDemoPointer } from '../../primitives/createDemoPointer';
import { createProductWalkthrough } from '../../primitives/createProductWalkthrough';
import { DemoCursor } from '../DemoCursor';
import { ProductDemo } from '../product/ProductPage';
import { TaskComposer } from '../workspace/frozen/TaskComposer';
import { WorkspaceChannel } from '../workspace/WorkspaceChannel';
import { TaskProjectView } from './TaskProjectView';
import {
  createTaskProject,
  REQUEST_CONTEXT,
  REQUEST_TASK,
} from './taskProject';
import './task-creation-flow.css';

/** One request becomes an owned task, then a completed link in the plan. */
export function TaskCreationFlow() {
  let root!: HTMLDivElement;
  let frame!: HTMLDivElement;
  const w = createTaskProject('messages');
  w.setData('tasks', []);
  w.setData('channels', 0, 'messages', 1, 'taskId', undefined);
  const [phase, setPhase] = createSignal(0);
  const [automatic, setAutomatic] = createSignal(true);
  const [taskId, setTaskId] = createSignal<string>();
  const [target, setTarget] = createSignal<string>();
  const [clicking, setClicking] = createSignal(false);
  const [priorityOpen, setPriorityOpen] = createSignal(false);
  const [statusOpen, setStatusOpen] = createSignal(false);
  const [draft, setDraft] = createStore<WorkspaceTask>({
    id: 'task-draft',
    title: REQUEST_TASK,
    description: '',
    owner: 'julia',
    creator: 'jacob',
    priority: 'Medium',
    status: 'Not Started',
    channel: 'sales',
    tags: [],
    steps: [],
    comments: [],
  });
  const create = () => {
    let id = taskId();
    if (!id) {
      id = 'proposal';
      w.setData('tasks', [
        { ...draft, id, description: REQUEST_CONTEXT, tags: ['Customers'] },
      ]);
      w.setData('channels', 0, 'messages', 1, 'taskId', id);
      setTaskId(id);
    }
    w.updateTask(id, {
      title: draft.title,
      owner: draft.owner,
      priority: draft.priority,
      status: draft.status,
    });
    w.open('tasks', id);
    setPhase(4);
  };
  const finish = () => {
    if (!taskId()) create();
    w.updateTask(taskId()!, {
      status: 'Completed',
      description: 'Proposal ready: scope, pricing, and a delivery timeline.',
    });
    setPhase(6);
  };
  const updateDraft = (patch: Partial<WorkspaceTask>) => setDraft(patch);
  const openComposer = () => setPhase(2);
  const approach = (selector: string) => {
    setClicking(false);
    setTarget(selector);
  };
  const click = (run: () => void) => {
    setClicking(true);
    run();
  };
  const revealRequest = () => {
    const log = frame.querySelector<HTMLElement>('[role="log"]');
    log?.scrollTo({ top: 0, behavior: 'smooth' });
    setPhase(1);
  };
  // Delays are reading/movement time BEFORE the named action.
  const actions = [
    { delay: 1400, run: revealRequest },
    {
      delay: 650,
      run: () => approach('[data-hovered=true] [aria-label="Task"]'),
    },
    { delay: 650, run: () => click(openComposer) },
    { delay: 900, run: () => approach('[aria-label="Change priority"]') },
    { delay: 650, run: () => click(() => setPriorityOpen(true)) },
    {
      delay: 450,
      run: () => approach('[data-demo-property-value="priority:High"]'),
    },
    {
      delay: 650,
      run: () =>
        click(() => {
          updateDraft({ priority: 'High' });
          setPriorityOpen(false);
        }),
    },
    { delay: 650, run: () => approach('[data-task-submit]') },
    { delay: 650, run: () => click(create) },
    { delay: 2200, run: () => approach('[aria-label="Change status"]') },
    { delay: 650, run: () => click(() => setStatusOpen(true)) },
    {
      delay: 450,
      run: () => approach('[data-demo-property-value="status:In Progress"]'),
    },
    {
      delay: 650,
      run: () =>
        click(() => {
          w.updateTask(taskId()!, {
            status: 'In Progress',
            description: 'Adding pricing and delivery dates to the proposal.',
          });
          setStatusOpen(false);
          setPhase(5);
        }),
    },
    { delay: 2500, run: () => approach('[aria-label="Change status"]') },
    { delay: 650, run: () => click(() => setStatusOpen(true)) },
    {
      delay: 450,
      run: () => approach('[data-demo-property-value="status:Completed"]'),
    },
    {
      delay: 650,
      run: () =>
        click(() => {
          setStatusOpen(false);
          finish();
        }),
    },
    { delay: 2400, run: () => approach('.task-plan-link') },
    {
      delay: 650,
      run: () =>
        click(() => {
          w.open('documents', 'customer-brief');
          setPhase(7);
        }),
    },
  ];
  const playback = createProductWalkthrough({
    root: () => root,
    steps: actions.length,
    reset: () => {},
    reduced: () => {
      finish();
      setAutomatic(false);
    },
    onTakeover: () => setAutomatic(false),
    delay: (step) => actions[step - 1].delay,
    advance: (step) => actions[step - 1].run(),
  });
  const pause = () => {
    setAutomatic(false);
    playback.pause();
  };
  const pointer = createDemoPointer({
    frame: () => frame,
    target,
    active: automatic,
  });
  return (
    <div ref={root} class="task-creation-flow">
      <div
        ref={frame}
        class="task-flow-frame"
        role="group"
        aria-label="Task walkthrough"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && phase() >= 2 && phase() < 4) {
            pause();
            setPhase(0);
          }
          if (
            (event.metaKey || event.ctrlKey) &&
            event.key === 'Enter' &&
            phase() >= 2 &&
            phase() < 4 &&
            draft.title.trim()
          ) {
            event.preventDefault();
            pause();
            create();
          }
        }}
      >
        <ProductDemo
          label="Follow a request from message to completion"
          onInteract={pause}
          height={560}
          mobileHeight={620}
        >
          <Show
            when={phase() < 4}
            fallback={
              <TaskProjectView
                workspace={w}
                statusPlayback={{
                  open: statusOpen(),
                  onOpenChange: setStatusOpen,
                  automatic: automatic(),
                }}
              />
            }
          >
            <WorkspaceChannel
              workspace={w}
              hoveredMessage={phase() === 1 ? 'proposal-request' : undefined}
              onTaskMessage={(message) => {
                pause();
                setDraft(
                  'title',
                  message.id === 'proposal-request'
                    ? REQUEST_TASK
                    : message.body
                );
                openComposer();
              }}
            />
            <Show when={phase() >= 2}>
              <div class="task-flow-popover">
                <TaskComposer
                  draft={draft}
                  sourceChannel="sales"
                  update={updateDraft}
                  priorityPlayback={{
                    open: priorityOpen(),
                    onOpenChange: setPriorityOpen,
                    automatic: automatic(),
                  }}
                  submit={() => {
                    pause();
                    create();
                  }}
                  close={() => {
                    pause();
                    setPhase(0);
                  }}
                />
              </div>
            </Show>
          </Show>
        </ProductDemo>
        <Show when={automatic() && pointer()}>
          {(p) => (
            <DemoCursor
              class="task-flow-pointer"
              clicking={clicking()}
              style={{ transform: `translate(${p().x}px, ${p().y}px)` }}
            />
          )}
        </Show>
      </div>
    </div>
  );
}
