import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const port = process.env.SAVED_VIEWS_TEST_PORT ?? '3008';
export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  testMatch: 'saved-views.browser.e2e.ts',
  workers: 1,
  use: {
    baseURL: `http://localhost:${port}`,
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: {
    command: `bunx vite --config src/features/tasks-view/browser-test/saved-views.vite.config.ts --port ${port} --strictPort`,
    cwd: fileURLToPath(new URL('../../../../', import.meta.url)),
    url: `http://localhost:${port}`,
    env: { MACRO_DEV_HTTPS: 'false' },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
