import process from 'node:process';

import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  testDir: './tests/e2e',
  timeout: 60_000,
  use: {
    baseURL:
      process.env.CLOUDOPS_WEB_URL ||
      (process.env.CLOUDOPS_PREVIEW === 'true'
        ? 'http://127.0.0.1:5668'
        : 'http://127.0.0.1:5667'),
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    screenshot: 'off',
    trace: 'off',
  },
  webServer:
    process.env.CLOUDOPS_PREVIEW === 'true'
      ? {
          command:
            'pnpm -F @vben/web-antd exec vite preview --host 127.0.0.1 --port 5668 --strictPort',
          reuseExistingServer: !process.env.CI,
          url: 'http://127.0.0.1:5668',
        }
      : undefined,
  workers: 1,
});
