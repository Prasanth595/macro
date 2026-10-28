import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const directory = fileURLToPath(new URL('.', import.meta.url));
const web = fileURLToPath(new URL('../../../../../../', import.meta.url));
const port = process.env.RECIPIENT_BROWSER_PORT ?? '3199';

export default defineConfig({
  testDir: directory,
  testMatch: '*.browser.e2e.ts',
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'phone',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command: `bunx vite --config src/lib/core/component/RecipientSelector/browser-test/vite.config.ts --port ${port}`,
    cwd: web,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
