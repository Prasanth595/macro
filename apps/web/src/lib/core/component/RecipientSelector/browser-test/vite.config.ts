import { fileURLToPath } from 'node:url';
import tailwind from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import svg from 'vite-plugin-solid-svg';
import paths from 'vite-tsconfig-paths';

const directory = fileURLToPath(new URL('.', import.meta.url));
const web = fileURLToPath(new URL('../../../../../../', import.meta.url));
const workspace = fileURLToPath(
  new URL('../../../../../../../../', import.meta.url)
);

export default defineConfig({
  root: directory,
  plugins: [
    solid(),
    svg({ defaultAsComponent: true }),
    paths({ projects: [`${web}/tsconfig.json`] }),
    tailwind(),
  ],
  resolve: {
    dedupe: ['solid-js'],
    alias: ['@core/context/user', '@core/user/dmActivity'].map((find) => ({
      find,
      replacement: `${directory}/preview-data.ts`,
    })),
  },
  server: {
    host: '0.0.0.0',
    strictPort: true,
    watch: { usePolling: true, interval: 1000 },
    fs: { allow: [workspace] },
  },
});
