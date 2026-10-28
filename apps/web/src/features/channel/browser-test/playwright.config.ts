import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const port = process.env.MESSAGE_AGENT_TEST_PORT ?? '3494';
export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  testMatch: '*.browser.e2e.ts',
  workers: 1,
  timeout: 120_000,
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command: `MACRO_DEV_HTTPS=false bunx vite --config src/features/channel/browser-test/vite.config.ts --port ${port} --strictPort`,
    cwd: fileURLToPath(new URL('../../../../', import.meta.url)),
    url: `http://localhost:${port}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
