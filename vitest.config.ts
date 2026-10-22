import Vue from '@vitejs/plugin-vue';
import VueJsx from '@vitejs/plugin-vue-jsx';
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  plugins: [Vue(), VueJsx()],
  resolve: {
    alias: {
      '#': path.resolve(__dirname, './apps/web-antd/src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts', 'internal/**/*.test.ts'],
  },
});
