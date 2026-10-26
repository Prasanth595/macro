import '@app/index.css';
import { Button } from '@ui';
import { createSignal, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { RecordPanel } from '../../database/components/record-panel';
import {
  LinkedRowPicker,
  LinkedRowPreview,
  LinkedRowsSection,
  type RowPickerProps,
  type RowPickerTable,
} from '../components/linked-rows';
import { RecordOverview } from '../components/record-overview';
import type { RowLinksSource } from '../context/row-links';
import type { LinkedRowGroup } from '../core/row-links';

const columns: LinkedRowGroup['columns'] = [
  {
    id: 'name',
    name: 'Invoice',
    dataType: 'STRING',
    isMultiSelect: false,
    options: [],
    writable: false,
  },
  {
    id: 'items',
    name: 'Line items',
    dataType: 'ENTITY',
    isMultiSelect: true,
    options: [],
    writable: false,
    relation: {
      databaseId: 'billing',
      tableId: 'items',
      labels: { 'line-1': 'Hosting', 'line-2': 'Support' },
    },
  },
];

function Fixture() {
  const [links, setLinks] = createSignal<Record<string, string[]>>({
    company: ['first'],
    deal: [],
  });
  const [name, setName] = createSignal('Invoice 42');
  const [available, setAvailable] = createSignal(true);
  const [failed, setFailed] = createSignal(false);
  const [deal, setDeal] = createSignal(false);
  const [opened, setOpened] = createSignal('');
  const rows = () => [
    { rowId: 'first', cells: { name: name(), items: '["line-1","line-2"]' } },
    { rowId: 'second', cells: { name: 'Invoice 43', items: '["line-2"]' } },
  ];
  const group = (): LinkedRowGroup => ({
    databaseId: 'billing',
    databaseName: 'Billing',
    tableId: 'invoices',
    tableName: 'Invoices',
    columns,
    rows: rows(),
  });
  const source = (target: string): RowLinksSource => ({
    state: () =>
      failed()
        ? { kind: 'error' }
        : {
            kind: 'ready',
            groups:
              available() && links()[target].length
                ? [
                    {
                      ...group(),
                      rows: rows().filter((row) =>
                        links()[target].includes(row.rowId)
                      ),
                    },
                  ]
                : [],
          },
    refresh: async () => {
      setFailed(false);
    },
    link: async (reference) => {
      setLinks((current) => ({
        ...current,
        [target]: [...new Set([...current[target], reference.rowId])],
      }));
    },
    unlink: async (rowId) => {
      setLinks((current) => ({
        ...current,
        [target]: current[target].filter((id) => id !== rowId),
      }));
    },
  });
  function Picker(props: RowPickerProps) {
    const [selected, setSelected] = createSignal<RowPickerTable>();
    return (
      <LinkedRowPicker
        {...props}
        tables={[
          {
            databaseId: 'billing',
            tableId: 'invoices',
            name: 'Billing / Invoices',
          },
        ]}
        selected={selected()}
        onSelectTable={setSelected}
        rows={rows().map((row) => ({ id: row.rowId, name: row.cells.name }))}
        loading={false}
        retry={async () => {}}
      />
    );
  }
  const section = (target: string) => (
    <LinkedRowsSection
      source={source(target)}
      canEdit
      Picker={Picker}
      openRow={(ref) => setOpened(ref.rowId)}
      renderPreview={(group, row) => (
        <LinkedRowPreview columns={group.columns} row={row} />
      )}
    />
  );
  return (
    <main class="h-dvh bg-canvas-base text-ink">
      <div class="flex flex-wrap gap-2 p-3">
        <Button onClick={() => setDeal(true)}>Open deal</Button>
        <Button onClick={() => setName('Invoice 42 paid')}>
          Rename source
        </Button>
        <Button onClick={() => setAvailable(false)}>Revoke source</Button>
        <Button onClick={() => setFailed(true)}>Fail refresh</Button>
        <span role="status">Opened: {opened()}</span>
      </div>
      <RecordOverview>
        <h1 class="text-xl font-medium">Acme</h1>
        {section('company')}
      </RecordOverview>
      <Show when={deal()}>
        <RecordPanel
          row={{ rowId: 'deal', cells: { name: 'Acme renewal' } }}
          tableName="Renewals"
          columns={columns.slice(0, 1)}
          canEdit
          pending={false}
          onRetry={() => {}}
          position={0}
          total={1}
          renderCell={() => <span>Acme renewal</span>}
          onClose={() => setDeal(false)}
          onNavigate={() => {}}
          onRequestDelete={() => {}}
          details={<div class="mt-4">{section('deal')}</div>}
        />
      </Show>
    </main>
  );
}
render(() => <Fixture />, document.getElementById('root')!);
