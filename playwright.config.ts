import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: process.env.CLOUDOPS_WEB_URL || 'http://127.0.0.1:5667',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    trace: 'off',
    screenshot: 'off',
  },
});
