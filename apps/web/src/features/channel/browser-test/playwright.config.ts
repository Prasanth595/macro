import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const webDirectory = fileURLToPath(new URL('../../../../', import.meta.url));
const port = process.env.CHANNEL_OPEN_BROWSER_PORT ?? '3058';

/**
 * Mounts the real channel surface through the app's own Vite config, with
 * every backend request answered by the test.
 */
export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  testMatch: '*.app.e2e.ts',
  outputDir: fileURLToPath(new URL('./test-results', import.meta.url)),
  // The first page load on a fresh checkout pre-bundles the app's dependencies.
  timeout: 240_000,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: `http://localhost:${port}`,
    // Trace snapshots add layouts to the measured window.
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `MACRO_DEV_HTTPS=false bunx vite --port ${port} --strictPort`,
    cwd: webDirectory,
    url: `http://localhost:${port}/app/`,
    reuseExistingServer: true,
    timeout: 90_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        },
      },
    },
  ],
});
