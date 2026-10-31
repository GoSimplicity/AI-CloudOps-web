// @vitest-environment node

import type { ESLint as ESLintInstance } from 'eslint';

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { it } from 'vitest';

import { vue } from '../src/configs/vue';

const require = createRequire(import.meta.url);
const { compile, createSSRApp } = require('vue');

const { ESLint } = require('eslint');
const prettier = require('prettier');
const { parse } = require('vue/compiler-sfc');
const { renderToString } = require('vue/server-renderer');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const filename = resolve(
  root,
  'apps/web-antd/src/layouts/formatter-compat-fixture.vue',
);
const duplicateRule = 'vue/html-closing-bracket-newline';
const prettierRule = 'prettier/prettier';
const rawInline =
  '<template><a aria-label="CloudOps 首页" class="ops-wordmark" href="/">CLOUD<span>OPS</span></a></template>\n';
const eslint = new ESLint({ cwd: root });

async function format(source: string): Promise<string> {
  const options = await prettier.resolveConfig(filename);
  return prettier.format(source, { ...options, filepath: filename });
}

async function lint(linter: ESLintInstance, source: string) {
  const results = await linter.lintText(source, { filePath: filename });
  assert.equal(results.length, 1);
  const result = results[0];
  assert.ok(result);
  assert.equal(result.fatalErrorCount, 0);
  return result;
}

it('repository delegates Vue bracket layout to enforced Prettier only', async () => {
  const config = await eslint.calculateConfigForFile(filename);
  assert.equal(config.rules[duplicateRule][0], 0);
  assert.equal(config.rules[prettierRule][0], 2);
  assert.equal(config.rules['vue/no-use-v-if-with-v-for'][0], 2);
  assert.equal(config.rules['vue/no-v-html'][0], 1);
  assert.equal(config.rules['unicorn/expiring-todo-comments'][0], 2);
  const standaloneVue = await vue();
  const standaloneRule = standaloneVue.find(
    (entry) => entry.rules?.[duplicateRule] !== undefined,
  );
  assert.equal(standaloneRule?.rules?.[duplicateRule], 'error');
});

it('actual legacy Vue rule fix conflicts with already formatted inline content', async () => {
  const formatted = await format(rawInline);
  // Reproduce the former root setting with the installed rule, not a patched plugin.
  const legacy = new ESLint({
    cwd: root,
    overrideConfig: { rules: { [duplicateRule]: 'error' } },
  });
  const result = await lint(legacy, formatted);
  const conflicts = result.messages.filter(
    (message) => message.ruleId === duplicateRule,
  );
  assert.equal(conflicts.length, 2);
  assert.equal(
    result.messages.filter((message) => message.ruleId === prettierRule).length,
    0,
  );
  const fixes = conflicts.flatMap((message) =>
    message.fix ? [message.fix] : [],
  );
  assert.equal(fixes.length, conflicts.length);
  let conflicting = formatted;
  for (const fix of fixes.sort(
    (left, right) => right.range[0] - left.range[0],
  )) {
    conflicting =
      conflicting.slice(0, fix.range[0]) +
      fix.text +
      conflicting.slice(fix.range[1]);
  }
  assert.notEqual(conflicting, formatted);
  assert.equal(await format(conflicting), formatted);
});

it('formatted inline content is a repeatable root ESLint fix point', async () => {
  const formatted = await format(rawInline);
  const fixer = new ESLint({ cwd: root, fix: true });
  const first = await lint(fixer, formatted);
  assert.equal(first.errorCount, 0);
  assert.equal(first.warningCount, 0);
  const output = first.output ?? formatted;
  assert.equal(output, formatted);
  const second = await lint(fixer, output);
  assert.equal(second.errorCount, 0);
  assert.equal(second.warningCount, 0);
  assert.equal(second.output ?? output, formatted);
});

it('noncanonical bracket layout still produces an enforced Prettier error', async () => {
  const formatted = await format(rawInline);
  const noncanonical = formatted.replace('</a\n  >', '</a>');
  assert.notEqual(noncanonical, formatted);
  const result = await lint(eslint, noncanonical);
  assert.ok(
    result.messages.some(
      (message) => message.ruleId === prettierRule && message.severity === 2,
    ),
  );
});

it('unformatted source remains invalid instead of hiding layout debt', async () => {
  const result = await lint(eslint, rawInline);
  assert.ok(
    result.messages.some(
      (message) => message.ruleId === prettierRule && message.severity === 2,
    ),
  );
});

it('inline rendered text and spacing are preserved by the actual Vue renderer', async () => {
  const formatted = await format(rawInline);
  const render = async (source: string) =>
    renderToString(
      createSSRApp({
        render: compile(parse(source).descriptor.template.content),
      }),
    );
  const original = await render(rawInline);
  assert.equal(await render(formatted), original);
  assert.ok(original.includes('CLOUD<span>OPS</span>'));
});

it('vue semantic and HTML safety diagnostics remain active', async () => {
  const semantic = await lint(
    eslint,
    await format(
      '<template><div v-if="true" v-for="item in []" :key="item">{{ item }}</div></template>',
    ),
  );
  assert.ok(
    semantic.messages.some(
      (message) =>
        message.ruleId === 'vue/no-use-v-if-with-v-for' &&
        message.severity === 2,
    ),
  );
  const html = await lint(
    eslint,
    await format('<template><div v-html="value"></div></template>'),
  );
  assert.ok(
    html.messages.some(
      (message) => message.ruleId === 'vue/no-v-html' && message.severity === 1,
    ),
  );
});
