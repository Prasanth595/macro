import { cleanup, render, within } from '@solidjs/testing-library';
import { afterEach, expect, it } from 'vitest';
import { setViewportWidth } from '../../../../app/utils/utilBreakpoint';
import {
  emailComparisons,
  taskComparisons,
} from '../../core/feature-comparisons';
import { CrmComparison } from '../crm/CrmComparison';
import { FeatureComparisons } from './FeatureComparisons';

afterEach(cleanup);

it('shows one table with all email competitors with a heading and no disclosure', () => {
  setViewportWidth(1440);
  const view = render(() => (
    <FeatureComparisons
      title="Compare Email Clients"
      comparisons={emailComparisons}
    />
  ));
  const table = view.getByRole('region', { name: 'Compare Macro' });
  expect(view.container.querySelector('details')).toBeNull();
  expect(
    view.getByRole('heading', { name: 'Compare Email Clients', level: 2 })
  ).toBeTruthy();
  expect(within(table).getByText('Superhuman Mail')).toBeTruthy();
  expect(within(table).getByText('Gmail')).toBeTruthy();
  expect(within(table).getAllByText('Keyboard shortcuts')).toHaveLength(1);
  expect(
    within(table).getAllByRole('img', { name: 'Yes' }).length
  ).toBeGreaterThan(0);
  expect(
    within(table).getAllByRole('img', { name: 'No' }).length
  ).toBeGreaterThan(0);
});

it('combines Linear and Jira in one mobile-scrollable table', () => {
  setViewportWidth(390);
  const view = render(() => (
    <FeatureComparisons
      title="Compare Task Managers"
      comparisons={taskComparisons}
    />
  ));
  const table = view.getByRole('region', { name: 'Compare Macro' });
  expect(within(table).getByText('Linear')).toBeTruthy();
  expect(within(table).getByText('Jira')).toBeTruthy();
  expect(table.tabIndex).toBe(0);
  expect(table.style.overflowX).toBe('auto');
  expect(view.container.querySelector('#compare-linear')).toBeTruthy();
  expect(view.container.querySelector('#compare-jira')).toBeTruthy();
});

it('credits shared CRM capabilities and competitors’ dedicated reporting', () => {
  setViewportWidth(390);
  const view = render(() => <CrmComparison />);
  expect(
    view.getByRole('heading', { name: 'Compare CRMs', level: 2 })
  ).toBeTruthy();
  const table = view.getByRole('region', { name: 'Compare Macro' });
  expect(view.container.querySelector('details')).toBeNull();
  expect(within(table).getByText('Features')).toBeTruthy();
  expect(table.querySelector('[title$="logo placeholder"]')).toBeNull();
  for (const label of ['Macro', 'Salesforce', 'HubSpot', 'Attio']) {
    expect(within(table).getByText(label)).toBeTruthy();
  }
  const contacts = within(table).getByText('Company and contact records');
  let cell = contacts.nextElementSibling;
  for (let index = 0; index < 4; index++) {
    expect(cell?.querySelector('[aria-label="Yes"]')).toBeTruthy();
    cell = cell?.nextElementSibling ?? null;
  }
  const reports = within(table).getByText('Sales reporting');
  cell = reports.nextElementSibling;
  expect(
    cell
      ?.querySelector('[aria-label="Partial"]')
      ?.getAttribute('aria-description')
  ).toContain('no dedicated sales reporting dashboard');
  for (let index = 0; index < 3; index++) {
    cell = cell?.nextElementSibling ?? null;
    expect(cell?.querySelector('[aria-label="Yes"]')).toBeTruthy();
  }
  expect(view.getByText('Partial / via connected tools')).toBeTruthy();
  expect(view.queryByText('Not included')).toBeNull();
  expect(table.tabIndex).toBe(0);
  expect(table.style.overflowX).toBe('auto');
  expect(view.queryByText(/Includes paid features/)).toBeNull();
});
