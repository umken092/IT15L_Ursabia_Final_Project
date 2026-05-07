import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://cmnetwork.runasp.net';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /persistence\.spec\.ts/,
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/persistence', open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
