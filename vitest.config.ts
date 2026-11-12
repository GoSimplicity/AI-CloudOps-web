import path from 'node:path';

import Vue from '@vitejs/plugin-vue';
import VueJsx from '@vitejs/plugin-vue-jsx';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [Vue(), VueJsx()],
  resolve: {
    alias: {
      '#': path.resolve(import.meta.dirname, './apps/web-antd/src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: [
      'apps/**/*.test.ts',
      'packages/**/*.test.ts',
      'internal/**/*.test.ts',
    ],
  },
});
