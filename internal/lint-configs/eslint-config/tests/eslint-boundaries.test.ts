// @vitest-environment node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { it } from 'vitest';

import {
  auditBoundaryDirectives,
  inspectBoundaryResults,
  protectedRuleIds,
  runBoundaryCheck,
} from '../../../../scripts/check-eslint-boundaries.mjs';

const require = createRequire(import.meta.url);
const { ESLint } = require('eslint');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const filename = resolve(root, 'apps/web-antd/src/lint-boundary-fixture.ts');
const eslint = new ESLint({ cwd: root });

it('keeps all five cleared rule categories enabled in the real configuration', async () => {
  // The current JS/TS block delegates no-undef to typing; Vue retains this rule.
  // The TypeScript strict rule block does not apply to .vue files.
  for (const rule of protectedRuleIds) {
    const ruleFile =
      rule === 'no-undef' || rule === 'cloudops/no-sfc-non-null-assertion'
        ? filename.replace(/\.ts$/, '.vue')
        : filename;
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
    rule: 'cloudops/no-sfc-non-null-assertion',
    source:
      '<script setup lang="ts">const value = {} as { name: string }; console.warn(value!.name);</script><template>{{ value!.name }}</template>',
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
        fixture.rule === 'no-undef' ||
        fixture.rule === 'cloudops/no-sfc-non-null-assertion'
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

for (const fixture of [
  {
    filename,
    rule: '@typescript-eslint/no-non-null-assertion',
    source:
      '// eslint-disable-next-line @typescript-eslint/no-non-null-assertion\nexport function get(value: string | undefined) { return value!; }\n',
  },
  {
    filename: filename.replace(/\.ts$/, '.vue'),
    rule: 'cloudops/no-sfc-non-null-assertion',
    source:
      '<script setup lang="ts">\n// eslint-disable-next-line cloudops/no-sfc-non-null-assertion -- private-suppression-sentinel\nconst value = source!;\n</script><template><div /></template>',
  },
]) {
  it(`rejects actual suppressed ${fixture.rule} violations without disclosing source or suppression reasons`, async () => {
    const results = await eslint.lintText(fixture.source, {
      filePath: fixture.filename,
    });
    assert.ok(
      results.some((result) =>
        result.suppressedMessages.some(
          (message: { ruleId: string }) => message.ruleId === fixture.rule,
        ),
      ),
    );
    const report = inspectBoundaryResults(results);
    assert.equal(report.exitCode, 1);
    assert.ok(report.violations.some((entry) => entry.ruleId === fixture.rule));
    assert.equal(
      JSON.stringify(report).includes('private-suppression-sentinel'),
      false,
    );
    assert.equal(JSON.stringify(report).includes('source!'), false);
  });
}

it('retains non-protected rule waivers without treating other lint debt as protected failures', async () => {
  const results = await eslint.lintText(
    '// eslint-disable-next-line perfectionist/sort-objects\nexport const keys = { z: true, a: false };\n',
    { filePath: filename },
  );
  assert.ok(
    results.some((result) =>
      result.suppressedMessages.some(
        (message: { ruleId: string }) =>
          message.ruleId === 'perfectionist/sort-objects',
      ),
    ),
  );
  const report = inspectBoundaryResults(results);
  assert.equal(report.exitCode, 0);
  assert.deepEqual(report.violations, []);
});

it('fails closed on unavailable Vue parser services without exposing the tool error text', async () => {
  const missingVue = new ESLint({
    cwd: root,
    overrideConfig: {
      files: ['**/*.vue'],
      languageOptions: { parserOptions: { parser: false } },
    },
  });
  const report = await runBoundaryCheck(() =>
    missingVue.lintText(
      '<script setup lang="ts">const privateSourceSentinel = value!;</script><template><div /></template>',
      { filePath: filename.replace(/\.ts$/, '.vue') },
    ),
  );
  assert.equal(report.exitCode, 2);
  assert.equal(report.fatalCount, 1);
  assert.equal(JSON.stringify(report).includes('privateSourceSentinel'), false);
});

const directiveAudit = new ESLint({
  allowInlineConfig: false,
  cwd: root,
  overrideConfig: {
    files: ['**/*.vue'],
    rules: { 'vue/comment-directive': 'off' },
  },
});

for (const fixture of [
  {
    name: 'Vue template disable directive',
    source:
      '<script setup lang="ts">const value = {} as { name: string };</script><template>\n<!-- eslint-disable-next-line cloudops/no-sfc-non-null-assertion -->\n{{ value!.name }}\n</template>',
  },
  {
    name: 'native inline rule off',
    source:
      '<script setup lang="ts">\n/* eslint cloudops/no-sfc-non-null-assertion: off */\nconst value = {} as { name: string }; console.warn(value!.name);\n</script><template><div /></template>',
  },
  {
    name: 'native global disable',
    source:
      '<script setup lang="ts">\n/* eslint-disable */\nconst value = {} as { name: string }; console.warn(value!.name);\n</script><template><div /></template>',
  },
  {
    name: 'Vue template global disable',
    source:
      '<script setup lang="ts">const value = {} as { name: string };</script><template>\n<!-- eslint-disable -->\n{{ value!.name }}\n</template>',
  },
]) {
  it(`audits protected assertions hidden by ${fixture.name} without changing ordinary totals`, async () => {
    const filePath = filename.replace(/\.ts$/, '.vue');
    const normal = await eslint.lintText(fixture.source, { filePath });
    const report = await runBoundaryCheck(
      async () => normal,
      (results) =>
        auditBoundaryDirectives(
          results,
          async (files) => {
            const results = await Promise.all(
              files.map((filePath: string) =>
                directiveAudit.lintText(fixture.source, { filePath }),
              ),
            );
            return results.flat();
          },
          async () => fixture.source,
        ),
    );
    assert.equal(report.exitCode, 1);
    assert.equal(report.fatalCount, 0);
    assert.equal(report.auditedFileCount, 1);
    assert.equal(
      report.errorCount,
      normal.reduce(
        (sum: number, result: { errorCount: number }) =>
          sum + result.errorCount,
        0,
      ),
    );
    const assertions = report.violations.filter(
      (entry) => entry.ruleId === 'cloudops/no-sfc-non-null-assertion',
    );
    assert.equal(assertions.length, 1);
  });
}

it('keeps unrelated waivers and totals intact when the secondary audit sees more lint debt', async () => {
  const source =
    '// eslint-disable-next-line perfectionist/sort-objects\nexport const keys = { z: true, a: false };\n';
  const normal = await eslint.lintText(source, { filePath: filename });
  const report = await runBoundaryCheck(
    async () => normal,
    (results) =>
      auditBoundaryDirectives(
        results,
        async (files) => {
          const results = await Promise.all(
            files.map((filePath: string) =>
              directiveAudit.lintText(source, { filePath }),
            ),
          );
          return results.flat();
        },
        async () => source,
      ),
  );
  assert.equal(report.exitCode, 0);
  assert.equal(
    report.errorCount,
    normal.reduce(
      (sum: number, result: { errorCount: number }) => sum + result.errorCount,
      0,
    ),
  );
  assert.equal(report.auditedFileCount, 1);
  assert.deepEqual(report.violations, []);
});

it('fails closed on a directive audit read failure without leaking the failure text', async () => {
  const normal = await eslint.lintText('export const ready = true;\n', {
    filePath: filename,
  });
  const report = await runBoundaryCheck(
    async () => normal,
    (results) =>
      auditBoundaryDirectives(
        results,
        async () => [],
        async () => {
          throw new Error('private-audit-read-sentinel');
        },
      ),
  );
  assert.equal(report.exitCode, 2);
  assert.equal(report.fatalCount, 1);
  assert.equal(report.fileCount, 1);
  assert.equal(
    JSON.stringify(report).includes('private-audit-read-sentinel'),
    false,
  );
});

it('does not require a secondary scan when no source contains a directive marker', async () => {
  const normal = await eslint.lintText('export const ready = true;\n', {
    filePath: filename,
  });
  let calls = 0;
  const report = await runBoundaryCheck(
    async () => normal,
    (results) =>
      auditBoundaryDirectives(
        results,
        async () => {
          calls++;
          return [];
        },
        async () => 'export const ready = true;\n',
      ),
  );
  assert.equal(calls, 0);
  assert.equal(report.exitCode, 0);
  assert.equal(report.auditedFileCount, 0);
});

for (const fault of ['empty', 'partial', 'extra', 'duplicate']) {
  it(`fails closed when directive audit coverage is ${fault}`, async () => {
    const first = await eslint.lintText("export const first = 'eslint';\n", {
      filePath: filename,
    });
    const second = await eslint.lintText("export const second = 'eslint';\n", {
      filePath: filename.replace('fixture', 'second-fixture'),
    });
    const normal = [...first, ...second];
    const report = await runBoundaryCheck(
      async () => normal,
      (results) =>
        auditBoundaryDirectives(
          results,
          async () => {
            if (fault === 'empty') return [];
            if (fault === 'partial') return first;
            if (fault === 'duplicate') return [...first, ...first];
            return [
              ...first,
              { ...second[0], filePath: 'private-extra-audit-path-sentinel' },
            ];
          },
          async () => 'eslint',
        ),
    );
    assert.equal(report.exitCode, 2);
    assert.equal(report.fatalCount, 1);
    assert.equal(report.fileCount, 2);
    assert.equal(
      JSON.stringify(report).includes('private-extra-audit-path-sentinel'),
      false,
    );
  });
}
