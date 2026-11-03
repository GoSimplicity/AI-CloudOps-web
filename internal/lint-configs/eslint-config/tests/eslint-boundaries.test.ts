// @vitest-environment node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { it } from 'vitest';

import {
  inspectBoundaryResults,
  protectedRuleIds,
  runBoundaryCheck,
} from '../../../../scripts/check-eslint-boundaries.mjs';

const require = createRequire(import.meta.url);
const { ESLint } = require('eslint');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const filename = resolve(root, 'apps/web-antd/src/lint-boundary-fixture.ts');
const eslint = new ESLint({ cwd: root });

it('keeps all four cleared rule categories enabled in the real configuration', async () => {
  // The current JS/TS block delegates no-undef to typing; Vue retains this rule.
  // The TypeScript strict rule block does not apply to .vue files.
  for (const rule of protectedRuleIds) {
    const ruleFile =
      rule === 'no-undef' ? filename.replace(/\.ts$/, '.vue') : filename;
    const config = await eslint.calculateConfigForFile(ruleFile);
    assert.equal(config.rules[rule][0], 2);
  }
});

it('passes clean source through the actual root configuration', async () => {
  const results = await eslint.lintText('export const ready = true;\n', {
    filePath: filename,
  });
  const report = await runBoundaryCheck(async () => results);
  assert.equal(report.exitCode, 0);
  assert.equal(report.fileCount, 1);
  assert.equal(report.fatalCount, 0);
  assert.deepEqual(report.violations, []);
});

for (const fixture of [
  {
    rule: '@typescript-eslint/no-non-null-assertion',
    source:
      'export function get(value: string | undefined) { return value!; }\n',
  },
  {
    rule: 'no-empty',
    source: 'export function run(enabled: boolean) { if (enabled) {} }\n',
  },
  {
    rule: 'no-undef',
    source:
      '<script setup lang="ts">const value = missingFixtureValue;</script><template>{{ value }}</template>',
  },
  {
    rule: 'no-unsafe-finally',
    source:
      'export function run() { try { return true; } finally { throw new Error("cleanup"); } }\n',
  },
]) {
  it(`rejects ${fixture.rule} regressions despite other retained lint debt`, async () => {
    const results = await eslint.lintText(fixture.source, {
      filePath:
        fixture.rule === 'no-undef'
          ? filename.replace(/\.ts$/, '.vue')
          : filename,
    });
    const report = await runBoundaryCheck(async () => results);
    assert.equal(report.exitCode, 1);
    assert.equal(report.fatalCount, 0);
    assert.ok(report.violations.some((entry) => entry.ruleId === fixture.rule));
  });
}

it('also protects undefined runtime references inside actual Vue script parsing', async () => {
  const results = await eslint.lintText(
    '<script setup lang="ts">\nconst value = missingFixtureValue;\n</script>\n<template>{{ value }}</template>\n',
    { filePath: filename.replace(/\.ts$/, '.vue') },
  );
  const report = inspectBoundaryResults(results);
  assert.equal(report.exitCode, 1);
  assert.equal(report.fatalCount, 0);
  assert.ok(report.violations.some((entry) => entry.ruleId === 'no-undef'));
});

it('reports remaining unrelated lint errors without treating them as cleared-rule failures', async () => {
  const results = await eslint.lintText(
    'export const keys = { z: true, a: false };\n',
    {
      filePath: filename,
    },
  );
  assert.ok(
    results.some((result) =>
      result.messages.some(
        (message) => message.ruleId === 'perfectionist/sort-objects',
      ),
    ),
  );
  const report = inspectBoundaryResults(results);
  assert.equal(report.exitCode, 0);
  assert.ok(report.errorCount > 0);
  assert.equal(report.violations.length, 0);
});

it('fails closed on a real parser error without disclosing parser source text', async () => {
  const results = await eslint.lintText('export const privateSentinel = ;\n', {
    filePath: filename,
  });
  assert.ok(results.some((result) => result.fatalErrorCount > 0));
  const report = await runBoundaryCheck(async () => results);
  assert.equal(report.exitCode, 2);
  assert.ok(report.fatalCount > 0);
  assert.equal(JSON.stringify(report).includes('privateSentinel'), false);
});

it('fails closed when the lint tool cannot complete without returning its error text', async () => {
  const report = await runBoundaryCheck(async () => {
    throw new Error('private-tool-error-sentinel');
  });
  assert.equal(report.exitCode, 2);
  assert.equal(report.fatalCount, 1);
  assert.equal(
    JSON.stringify(report).includes('private-tool-error-sentinel'),
    false,
  );
});

it('fails closed instead of accepting a scan with no files', () => {
  const report = inspectBoundaryResults([]);
  assert.equal(report.exitCode, 2);
  assert.equal(report.fileCount, 0);
});

it('fails closed on the real no-configuration or ignored-file diagnostic', async () => {
  const results = await eslint.lintText('export const ready = true;\n', {
    filePath: resolve(root, 'dist/lint-boundary-fixture.ts'),
  });
  assert.ok(
    results.some((result) =>
      result.messages.some((message) => message.ruleId === null),
    ),
  );
  const report = inspectBoundaryResults(results);
  assert.equal(report.exitCode, 2);
  assert.ok(report.fatalCount > 0);
});

it('fails closed on an actual missing ESLint configuration file', async () => {
  const brokenLinter = new ESLint({
    cwd: root,
    overrideConfigFile: resolve(
      root,
      'internal/lint-configs/eslint-config/tests/private-missing-config-sentinel.cjs',
    ),
  });
  const report = await runBoundaryCheck(() =>
    brokenLinter.lintText('export const ready = true;\n', {
      filePath: filename,
    }),
  );
  assert.equal(report.exitCode, 2);
  assert.equal(report.fatalCount, 1);
  assert.equal(
    JSON.stringify(report).includes('private-missing-config-sentinel'),
    false,
  );
});
