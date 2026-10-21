import '@app/index.css';
import { PromoCard } from '@app/features/sidebar-promotion/components/promo-card';
import { applyTheme } from '@app/features/theme/utils/themeUtils';
import FileCsvIcon from '@phosphor/file-csv.svg';
import FileZipIcon from '@phosphor/file-zip.svg';
import FolderIcon from '@phosphor/folder.svg';
import UploadIcon from '@phosphor/upload-simple.svg';
import type { ImportState } from '@service-cognition/import';
import { createSignal, For } from 'solid-js';
import { render } from 'solid-js/web';
import { ConnectorImportProvider } from '../context/connector-import-context';
import type { ConnectorImportContext } from '../context/contracts';
import { agentFlowMessage } from '../core/agent-handoff';
import { IMPORT_CATEGORIES } from '../core/catalog';
import type { ImportCategory } from '../core/providers';
import { ConnectorImportDialog } from '../views/import-dialog';

// The real card and dialog over an in-memory pipeline: connecting succeeds
// at once, Slack discovery stages two channels, and accepted channels import.
const now = '2026-10-12T00:00:00Z';
const [connected, setConnected] = createSignal<ReadonlySet<string>>(
  new Set(['dropbox'])
);
const [state, setState] = createSignal<ImportState>({ runs: [], entities: [] });
const [handoff, setHandoff] = createSignal('');

function channel(id: string, name: string, purpose: string) {
  return {
    id,
    user_id: 'fixture',
    source: 'slack' as const,
    kind: 'channel' as const,
    foreign_id: id,
    status: 'staged' as const,
    initiator: 'manual' as const,
    metadata: { name, purpose, member_count: 12 },
    created_at: now,
    updated_at: now,
  };
}

const context: ConnectorImportContext = {
  createConnections: () => ({ connected, ready: () => true }),
  createImportState: () => ({ state, ready: () => true }),
  connect: async (app) => {
    setConnected((previous) => new Set([...previous, app.appSlug]));
    return 'connected';
  },
  discover: async (source) => {
    setState({
      runs: [{ source, status: 'running', updated_at: now }],
      entities: [],
    });
    setTimeout(
      () =>
        setState({
          runs: [{ source, status: 'ready', updated_at: now }],
          entities: [
            channel('c1', 'general', 'Company-wide announcements'),
            channel('c2', 'eng', 'Engineering discussion'),
          ],
        }),
      400
    );
  },
  runImport: async (ids) => {
    const flip = (status: 'importing' | 'imported') =>
      setState((previous) => ({
        ...previous,
        entities: previous.entities.map((entity) =>
          ids.includes(entity.id)
            ? {
                ...entity,
                status,
                ...(status === 'imported'
                  ? { entity_id: `doc-${entity.id}`, entity_type: 'md' }
                  : {}),
              }
            : entity
        ),
      }));
    flip('importing');
    setTimeout(() => flip('imported'), 400);
  },
  startAgentImport: async (value) => {
    setHandoff(value.input);
  },
  startAgentFlow: async (flow) => {
    setHandoff(agentFlowMessage(flow));
  },
  entityHref: (entity) => `#${entity.type}/${entity.id}`,
};

function Sidebar(props: { category: ImportCategory }) {
  const [open, setOpen] = createSignal(false);
  const [hidden, setHidden] = createSignal(false);
  const config = IMPORT_CATEGORIES[props.category];
  return (
    <aside
      class="flex h-[440px] w-64 flex-col bg-panel px-2 py-3"
      aria-label={`${props.category} sidebar`}
    >
      <p class="px-2 text-sm font-semibold text-ink">{config.action}</p>
      <div class="mt-auto">
        {hidden() ? null : (
          <PromoCard
            logos={config.providers}
            headline={config.headline}
            pitch={config.pitch}
            action={{ label: config.action, onClick: () => setOpen(true) }}
            dismissLabel={`Dismiss ${config.action.toLowerCase()}`}
            onDismiss={() => setHidden(true)}
          />
        )}
      </div>
      <ConnectorImportDialog
        config={config}
        open={open()}
        onOpenChange={setOpen}
        onImported={() => setHidden(true)}
        alternatives={(() => {
          const alternative =
            props.category === 'crm'
              ? {
                  icon: FileCsvIcon,
                  label: 'Upload a CSV',
                  description: 'Import companies from a spreadsheet export.',
                  onSelect: () => {},
                }
              : props.category === 'channels'
                ? {
                    icon: FileZipIcon,
                    label: 'Import with history',
                    description:
                      'Upload a Slack export from a workspace owner or admin.',
                    onSelect: () => setHandoff('Slack export upload'),
                  }
                : undefined;
          return alternative
            ? [alternative]
            : props.category === 'files'
              ? [
                  {
                    icon: UploadIcon,
                    label: 'Upload files',
                    description: 'Choose files from this computer.',
                    onSelect: () => setHandoff('Upload files'),
                  },
                  {
                    icon: FolderIcon,
                    label: 'Upload a folder',
                    description: 'Bring over a folder and everything in it.',
                    onSelect: () => setHandoff('Upload a folder'),
                  },
                ]
              : undefined;
        })()}
      />
    </aside>
  );
}

function Fixture() {
  return (
    <ConnectorImportProvider context={context}>
      <main class="flex min-h-screen gap-6 bg-page p-6">
        <For each={['files', 'tasks', 'crm', 'channels'] as const}>
          {(category) => <Sidebar category={category} />}
        </For>
        <output aria-label="Agent handoff" class="text-xs text-ink-muted">
          {handoff()}
        </output>
      </main>
    </ConnectorImportProvider>
  );
}

// Apply dark explicitly too: `dark-mode:` styles key off the theme attribute.
applyTheme(
  new URLSearchParams(location.search).get('theme') === 'light'
    ? 'Macro Light'
    : 'Macro Dark'
);
const root = document.getElementById('root');
if (root) render(() => <Fixture />, root);
