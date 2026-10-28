import type { MacroClient } from '../../utils/client';
import type { Project } from '../projects/project';
import type { SearchOpts } from '../search';
import type { Team } from '../teams/team';
import { type CreatedTask, Task } from './task';

export class TaskNamespace {
  constructor(private readonly client: MacroClient) {}

  /** A handle to a task by document id. Details load on first access. */
  byId(id: string): Task {
    return Task.byId(this.client, id);
  }

  /**
   * Create a task, returning open tasks with nearly the same name in
   * `similarOpenTasks`; check them so the new task is not a duplicate.
   */
  create(opts: {
    name: string;
    markdown?: string;
    project?: Project;
    team?: Team;
    shareWithTeam?: boolean;
  }): Promise<CreatedTask> {
    return Task.create(this.client, opts);
  }

  /**
   * The tasks the GitHub pull request at `url` references, oldest link first.
   */
  forPullRequest(url: string): Promise<Task[]> {
    return Task.forPullRequest(this.client, url);
  }

  /** Search tasks by name and content, most relevant first, auto-paginated. */
  search(query: string, opts?: SearchOpts): AsyncGenerator<Task> {
    return Task.search(this.client, query, opts);
  }
}
