import { fileURLToPath } from 'node:url';
import tailwind from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import solidSvg from 'vite-plugin-solid-svg';
import tsconfigPaths from 'vite-tsconfig-paths';

const directory = fileURLToPath(new URL('.', import.meta.url));
const webDirectory = fileURLToPath(new URL('../../../../', import.meta.url));
const workspaceDirectory = fileURLToPath(
  new URL('../../../../../../', import.meta.url)
);

export default defineConfig({
  root: directory,
  cacheDir: `${directory}/.vite`,
  plugins: [
    {
      name: 'home-mode-test-adapters',
      enforce: 'pre',
      resolveId(source, importer) {
        // Keep the app-wide entity-search menu outside this composer fixture.
        // The real shared editors, formatting tools and recipient controls run here.
        if (
          (importer?.endsWith('/component/core/MarkdownTextarea.tsx') &&
            ['../menu/MentionsMenu', '../menu/SnippetsMenu'].includes(
              source
            )) ||
          (importer?.endsWith('/builder/MarkdownShell.tsx') &&
            [
              '../component/menu/MentionsMenu',
              '../component/menu/SnippetsMenu',
            ].includes(source))
        )
          return `${directory}/mention-menu-fixture.tsx`;
        if (
          source === '@app/lib/analytics/posthog' &&
          importer?.endsWith('/component/menu/ActionsMenu.tsx')
        )
          return `${directory}/feature-flags-fixture.ts`;
        if (
          source === '@app/lib/analytics/posthog' &&
          [
            '/command/useCommandItems.ts',
            '/command/project-items.ts',
            '/command/CommandItem.tsx',
            '/command/CommandMenu.tsx',
            '/command/open-command-result.ts',
          ].some((path) => importer?.endsWith(path))
        )
          return `${directory}/feature-flags-fixture.ts`;
        if (
          (importer?.endsWith('/command/command-search.ts') &&
            [
              '@app/features/crm/record-adapter',
              '@queries/storage/databases',
            ].includes(source)) ||
          (importer?.endsWith('/command/open-command-result.ts') &&
            source === '@components/app/split-layout/layout')
        )
          return `${directory}/search-app-fixture.ts`;
        if (
          importer?.endsWith('/command/CommandMenu.tsx') &&
          [
            '@components/app/split-layout/layout',
            '@app/lib/analytics/analytics-context',
            '@app/features/crm/record-adapter',
            '@queries/storage/databases',
          ].includes(source)
        )
          return `${directory}/search-app-fixture.ts`;
        const homeEntry = importer?.endsWith(
          '/home/components/HomeChatStart.tsx'
        );
        const standardView = importer?.endsWith(
          '/home/views/standard-home-composer.tsx'
        );
        if (
          (homeEntry &&
            [
              '@app/components/view-shell',
              '@app/lib/analytics/posthog',
              '@core/component/AI/component/DragDrop',
              '@core/component/AI/context',
              '@core/context/user',
              '../../universal-input/universal-input',
            ].includes(source)) ||
          (standardView &&
            [
              '../home-chat-input',
              '../components/home-recommended-actions',
            ].includes(source))
        )
          return `${directory}/home-mode-wiring.tsx`;
      },
    },
    solidPlugin(),
    solidSvg({ defaultAsComponent: true }),
    tsconfigPaths({ projects: [`${webDirectory}/tsconfig.json`] }),
    tailwind(),
  ],
  resolve: {
    dedupe: ['solid-js'],
    alias: {
      'loro-crdt': 'loro-crdt/base64',
    },
  },
  server: {
    host: '127.0.0.1',
    port: 3007,
    strictPort: true,
    fs: { allow: [workspaceDirectory] },
  },
  build: {
    target: 'esnext',
    outDir: `${directory}/.dist`,
    emptyOutDir: true,
  },
});
