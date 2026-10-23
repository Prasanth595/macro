import type {
  BoundValue,
  ExtractedTemplate,
  FillTemplateResponse,
  SharePermissionV2,
  TemplateDraft,
  TemplateView,
  UpdateSharePermissionRequestV2,
} from '../../../generated/scheduled-action/types.gen';
import { unwrap } from '../../utils';
import type { MacroClient } from '../../utils/client';
import { MacroEntity } from '../entity';
import { Routine } from '../routines/routine';
import { User } from '../users/user';

/** A value for each template variable, keyed by variable key. */
export type TemplateBindings = Record<string, BoundValue>;

/**
 * A shareable snapshot of a routine with its person-specific values pulled
 * out into variables. Activating one creates the caller's own routine.
 */
export class RoutineTemplate extends MacroEntity<TemplateView> {
  /** Construct a lazy template handle. */
  static byId(client: MacroClient, id: string): RoutineTemplate {
    return new RoutineTemplate(client, id);
  }

  protected async fetch(): Promise<TemplateView> {
    return unwrap(
      await this.client.scheduledAction.getRoutineTemplate({
        path: { id: this.id },
      }),
    );
  }

  /** Template name. */
  readonly name = this.field('name');

  /** What the template does, for the person activating it. */
  readonly description = this.field('description');

  /** Named slots each activator fills in, or fixed for everyone. */
  readonly variables = this.field('variables');

  /** How many routines were activated from this template. */
  readonly activationCount = this.field('activation_count');

  /** The person who shared the template. */
  readonly owner = this.mappedField('owner', (id) =>
    User.byId(this.client, id),
  );

  /** Routines the caller activated from this template. */
  readonly yourActivations = this.mappedField('your_activations', (ids) =>
    ids.map((id) => Routine.byId(this.client, id)),
  );

  /** Overwrite the snapshot. Requires ownership. */
  async update(draft: TemplateDraft): Promise<void> {
    await this.mutate((c) =>
      c.scheduledAction.updateRoutineTemplate({
        path: { id: this.id },
        body: { draft },
      }),
    );
  }

  /** Delete the template. Routines activated from it are unaffected. */
  async delete(): Promise<void> {
    await this.mutate((c) =>
      c.scheduledAction.deleteRoutineTemplate({ path: { id: this.id } }),
    );
  }

  /**
   * Propose values from the caller's own workspace, validated against their
   * access. Nothing is saved.
   */
  async fill(options?: {
    instruction?: string;
    current?: TemplateBindings;
  }): Promise<FillTemplateResponse> {
    return unwrap(
      await this.client.scheduledAction.fillRoutineTemplate({
        path: { id: this.id },
        body: {
          instruction: options?.instruction,
          current: options?.current ?? {},
        },
      }),
    );
  }

  /** Create the caller's own routine from this template. */
  async activate(options: {
    bindings: TemplateBindings;
    name?: string;
  }): Promise<Routine> {
    return Routine.from(
      this.client,
      unwrap(
        await this.client.scheduledAction.activateRoutineTemplate({
          path: { id: this.id },
          body: { bindings: options.bindings, name: options.name },
        }),
      ),
    );
  }

  /** Read the template's channel grants. Requires ownership. */
  async sharePermissions(): Promise<SharePermissionV2> {
    return unwrap(
      await this.client.scheduledAction.getRoutineTemplatePermissions({
        path: { id: this.id },
      }),
    );
  }

  /** Share with channels for viewing. Requires ownership. */
  updateSharePermissions(
    request: UpdateSharePermissionRequestV2,
  ): Promise<SharePermissionV2> {
    return this.mutate((c) =>
      c.scheduledAction.updateRoutineTemplatePermissions({
        path: { id: this.id },
        body: request,
      }),
    );
  }
}

/** Templates made from routines. */
export class RoutineTemplateNamespace {
  constructor(private readonly client: MacroClient) {}

  /** Construct a lazy template handle. */
  byId(id: string): RoutineTemplate {
    return RoutineTemplate.byId(this.client, id);
  }

  /**
   * Draft a template from a routine the caller owns, with the caller's own
   * values for each variable. Nothing is saved.
   */
  async extract(routine: Routine): Promise<ExtractedTemplate> {
    return unwrap(
      await this.client.scheduledAction.extractRoutineTemplate({
        body: { source_action_id: routine.id },
      }),
    );
  }

  /** Save a draft as a template of `routine`. */
  async create(
    routine: Routine,
    draft: TemplateDraft,
  ): Promise<RoutineTemplate> {
    const created = unwrap(
      await this.client.scheduledAction.createRoutineTemplate({
        body: { source_action_id: routine.id, draft },
      }),
    );
    return RoutineTemplate.byId(this.client, created.id);
  }
}
