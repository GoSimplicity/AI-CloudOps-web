// @vitest-environment node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { it } from 'vitest';

const require = createRequire(import.meta.url);
const { ESLint } = require('eslint');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const filename = 'apps/web-antd/src/views/autofix/lint-compat-fixture.ts';
const ruleName = 'unicorn/expiring-todo-comments';
const eslint = new ESLint({ cwd: root });

// These tests load the actual repository
// configuration and installed plugin; no package or rule is patched in memory.
it('repository keeps expiring TODO validation enabled', async () => {
  const config = await eslint.calculateConfigForFile(filename);
  assert.equal(config.rules[ruleName][0], 2);
  assert.deepEqual(config.rules[ruleName][1].terms, ['todo', 'fixme', 'xxx']);
});

for (const fixture of [
  { name: 'empty source', source: '' },
  { name: 'ordinary comment', source: '// An ordinary note.\n' },
  { name: 'future TODO', source: '// TODO [2999-01-01]: revisit later\n' },
]) {
  it(`installed toolchain lints ${fixture.name} without crashing`, async () => {
    const results = await eslint.lintText(fixture.source, {
      filePath: filename,
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].fatalErrorCount, 0);
    assert.deepEqual(
      results[0].messages.filter((message) => message.ruleId === ruleName),
      [],
    );
  });
}

it('expired TODO still produces the original diagnostic', async () => {
  const config = await eslint.calculateConfigForFile(filename);
  const [severity, options = {}] = config.rules[ruleName];
  // Keep the date check deterministic even when executed in a pull-request CI.
  const datedESLint = new ESLint({
    cwd: root,
    overrideConfig: {
      rules: {
        [ruleName]: [
          severity,
          {
            ...options,
            date: '2026-01-01',
            ignoreDatesOnPullRequests: false,
          },
        ],
      },
    },
  });
  const [result] = await datedESLint.lintText(
    '// TODO [2000-01-01]: remove obsolete behavior\n',
    { filePath: filename },
  );
  assert.equal(result.fatalErrorCount, 0);
  assert.equal(
    result.messages.filter(
      (message) =>
        message.ruleId === ruleName &&
        message.messageId === 'unicorn/expiredTodo',
    ).length,
    1,
  );
});
