import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const directory = fileURLToPath(new URL('.', import.meta.url));
const webDirectory = fileURLToPath(new URL('../../../../', import.meta.url));
const localURL = `http://127.0.0.1:${process.env.CANVAS_BROWSER_PORT ?? 3027}`;

export default defineConfig({
  testDir: directory,
  testMatch: '*.browser.e2e.ts',
  outputDir: `${directory}/test-results`,
  reporter: 'line',
  use: { baseURL: localURL },
  webServer: {
    command:
      'bunx vite --config src/features/block-canvas/browser-test/vite.config.ts',
    cwd: webDirectory,
    url: localURL,
    reuseExistingServer: true,
    timeout: 90_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        },
      },
    },
  ],
});
