import { defineConfig, mergeConfig } from 'vite';
import { createAppViteConfig } from '../../../../vite.base';

export default defineConfig((environment) =>
  mergeConfig(createAppViteConfig()(environment), {
    cacheDir: 'node_modules/.vite-saved-views-browser',
    optimizeDeps: {
      entries: ['src/features/tasks-view/browser-test/saved-views.html'],
    },
  })
);
