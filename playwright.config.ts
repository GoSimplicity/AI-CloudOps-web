import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: process.env.CLOUDOPS_PREVIEW === 'true' ? {
    command: 'pnpm -F @vben/web-antd exec vite preview --host 127.0.0.1 --port 5668 --strictPort',
    url: 'http://127.0.0.1:5668',
    reuseExistingServer: !process.env.CI,
  } : undefined,
  timeout: 60_000,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: process.env.CLOUDOPS_WEB_URL || (process.env.CLOUDOPS_PREVIEW === 'true' ? 'http://127.0.0.1:5668' : 'http://127.0.0.1:5667'),
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    trace: 'off',
    screenshot: 'off',
  },
});
