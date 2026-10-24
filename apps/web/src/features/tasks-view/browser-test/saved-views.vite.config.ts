import { defineConfig, mergeConfig } from 'vite';
import { createAppViteConfig } from '../../../../vite.base';

export default defineConfig((environment) =>
  mergeConfig(createAppViteConfig()(environment), {
    optimizeDeps: {
      entries: ['src/features/tasks-view/browser-test/saved-views.html'],
    },
  })
);
