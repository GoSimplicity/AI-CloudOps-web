import type { Linter } from 'eslint';

import { interopDefault } from '../util';

export async function prettier(): Promise<Linter.Config[]> {
  const [pluginPrettier] = await Promise.all([
    interopDefault(import('eslint-plugin-prettier')),
  ] as const);
  return [
    {
      plugins: {
        prettier: pluginPrettier,
      },
      rules: {
        'prettier/prettier': 'error',
      },
    },
    {
      files: ['**/*.vue'],
      rules: {
        // Prettier owns bracket placement to preserve inline whitespace.
        // The Vue fixer otherwise fights Prettier's already-formatted output.
        'vue/html-closing-bracket-newline': 'off',
      },
    },
  ];
}
