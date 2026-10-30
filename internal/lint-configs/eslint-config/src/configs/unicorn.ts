import type { Linter } from 'eslint';

import { interopDefault } from '../util';

export async function unicorn(): Promise<Linter.Config[]> {
  const [pluginUnicorn] = await Promise.all([
    interopDefault(import('eslint-plugin-unicorn')),
  ] as const);

  return [
    {
      plugins: {
        unicorn: pluginUnicorn,
      },
      rules: {
        ...pluginUnicorn.configs.recommended.rules,

        'unicorn/consistent-destructuring': 'off',
        'unicorn/consistent-function-scoping': 'off',
        // Unicorn 55 delegates to ESLint's core rule without its default options.
        // Pass the unchanged default terms explicitly for ESLint >= 9.15.
        // https://github.com/sindresorhus/eslint-plugin-unicorn/issues/2496
        'unicorn/expiring-todo-comments': [
          'error',
          { terms: ['todo', 'fixme', 'xxx'] },
        ],
        'unicorn/filename-case': 'off',
        'unicorn/import-style': 'off',
        'unicorn/no-array-for-each': 'off',
        'unicorn/no-null': 'off',
        'unicorn/prefer-at': 'off',
        'unicorn/prefer-dom-node-text-content': 'off',
        'unicorn/prefer-export-from': ['error', { ignoreUsedVariables: true }],
        'unicorn/prefer-top-level-await': 'off',
        'unicorn/prevent-abbreviations': 'off',
      },
    },
    {
      files: [
        'scripts/**/*.?([cm])[jt]s?(x)',
        'internal/**/*.?([cm])[jt]s?(x)',
      ],
      rules: {
        'unicorn/no-process-exit': 'off',
      },
    },
  ];
}
