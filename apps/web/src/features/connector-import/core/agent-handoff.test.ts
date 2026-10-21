import { describe, expect, it } from 'vitest';
import { agentFlowMessage, agentImportHandoff } from './agent-handoff';
import { IMPORT_CATEGORIES } from './catalog';

describe('agent import handoff', () => {
  it('asks before creating and never writes back to the source', () => {
    const crm = IMPORT_CATEGORIES.crm;
    const hubspot = crm.providers.find((p) => p.appSlug === 'hubspot')!;
    const handoff = agentImportHandoff(crm, hubspot);
    expect(handoff.input).toBe(
      'Import my most recent companies and contacts from HubSpot into the Macro CRM.'
    );
    expect(handoff.instructions).toContain('ask which ones to bring over');
    expect(handoff.instructions).toContain('CreateCompany');
    expect(handoff.instructions).toContain('never edit or delete');
  });

  it('creates tasks as task documents', () => {
    const tasks = IMPORT_CATEGORIES.tasks;
    const jira = tasks.providers.find((p) => p.appSlug === 'jira')!;
    expect(agentImportHandoff(tasks, jira).instructions).toContain(
      'isTask true'
    );
  });
});

describe('agent flows', () => {
  it('opens the Notion workspace import with its first prompt', () => {
    expect(agentFlowMessage('notion-workspace')).toBe(
      'Import my Notion workspace into Macro.'
    );
  });
});

describe('import catalog', () => {
  it('gives every category unique providers led by a native or agent-flow source where one exists', () => {
    for (const config of Object.values(IMPORT_CATEGORIES)) {
      const slugs = config.providers.map((p) => p.appSlug);
      expect(new Set(slugs).size).toBe(slugs.length);
      const lead = config.providers.findIndex((p) => p.native || p.agentFlow);
      expect(lead === -1 || lead === 0).toBe(true);
    }
  });

  it('runs Notion through the agent flow and keeps Slack native', () => {
    const notion = IMPORT_CATEGORIES.files.providers.find(
      (p) => p.appSlug === 'notion'
    );
    const linear = IMPORT_CATEGORIES.tasks.providers.find(
      (p) => p.appSlug === 'linear'
    );
    const slack = IMPORT_CATEGORIES.channels.providers.find(
      (p) => p.appSlug === 'slack'
    );
    expect(notion).toMatchObject({ agentFlow: 'notion-workspace' });
    expect(notion?.native).toBeUndefined();
    expect(linear?.native).toBeUndefined();
    expect(linear?.agentFlow).toBeUndefined();
    expect(slack?.native).toBe('slack');
  });
});
