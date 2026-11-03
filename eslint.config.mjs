// @ts-check

import { defineConfig } from '@vben/eslint-config';

export default defineConfig([
  {
    // Playwright writes disposable reports here; they are not source files.
    ignores: ['test-results/**'],
  },
]);
