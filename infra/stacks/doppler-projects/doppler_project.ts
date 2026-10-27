import * as pulumi from '@pulumi/pulumi';
import * as doppler from '@pulumiverse/doppler';
import {
  DOPPLER_SECRETS_MANAGER_INTEGRATION_ID,
  SECRETS_MANAGER_REGION,
} from './consts';

/** A value per deployed config: Doppler's `dev` and `prd`. */
export type DeployedValue = { dev: string; prd: string };

type Args = {
  /**
   * Keys this stack owns in `dev` and `prd`. Values may be Doppler references
   * (`${global_databases.dev.DATABASE_URL}`). Leave out keys set by hand or
   * written by the service's own stack.
   */
  secrets?: Record<string, DeployedValue>;
};

export class DopplerProject extends pulumi.ComponentResource {
  public project: doppler.Project;

  constructor(
    name: string,
    args: Args,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super(`my:components:DopplerProject:${name}`, name, {}, opts);

    this.project = new doppler.Project(
      `${name}-project`,
      {
        name,
        description: `${name.replaceAll('-', ' ')} config`,
      },
      { parent: this }
    );

    new doppler.Environment(
      'local-environment',
      {
        project: this.project.name,
        slug: 'lcl',
        name: 'local',
        personalConfigs: true,
      },
      { parent: this }
    );

    const devEnvironment = new doppler.Environment(
      'dev-environment',
      {
        project: this.project.name,
        slug: 'dev',
        name: 'dev',
        personalConfigs: false,
      },
      { parent: this }
    );

    const devSync = new doppler.secretssync.AwsSecretsManager(
      'dev-sync',
      {
        integration: DOPPLER_SECRETS_MANAGER_INTEGRATION_ID,
        project: this.project.name,
        config: devEnvironment.slug,
        region: SECRETS_MANAGER_REGION,
        path: `/doppler-sync/${name}/dev`,
        tags: {
          env: 'dev',
        },
      },
      { parent: this }
    );

    const prodEnvironment = new doppler.Environment(
      'prod-environment',
      {
        project: this.project.name,
        slug: 'prd',
        name: 'prod',
        personalConfigs: false,
      },
      { parent: this }
    );

    const prodSync = new doppler.secretssync.AwsSecretsManager(
      'prod-sync',
      {
        integration: DOPPLER_SECRETS_MANAGER_INTEGRATION_ID,
        project: this.project.name,
        config: prodEnvironment.slug,
        region: SECRETS_MANAGER_REGION,
        path: `/doppler-sync/${name}/prod`,
        tags: {
          env: 'prod',
        },
      },
      { parent: this }
    );

    for (const [key, value] of Object.entries(args.secrets ?? {})) {
      for (const [config, environment, sync] of [
        ['dev', devEnvironment, devSync],
        ['prd', prodEnvironment, prodSync],
      ] as const) {
        new doppler.Secret(
          `${config}-${key}`,
          {
            project: this.project.name,
            config: environment.slug,
            name: key,
            value: value[config],
          },
          { parent: this, dependsOn: [sync] }
        );
      }
    }
  }
}
