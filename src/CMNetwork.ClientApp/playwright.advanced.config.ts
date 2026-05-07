import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://cmnetwork.runasp.net';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /advanced\.(crawl|visual)\.spec\.ts/,
  timeout: 180_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.03,
    },
  },
  fullyParallel: true,
  workers: 3,
  retries: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/advanced', open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
