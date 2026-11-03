// @vitest-environment node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { it } from 'vitest';

import { vueNonNullAssertion } from '../src/rules/vue-non-null-assertion';

const require = createRequire(import.meta.url);
const { ESLint } = require('eslint');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const ruleId = 'cloudops/no-sfc-non-null-assertion';
const eslint = new ESLint({ cwd: root });
const filePath = 'apps/web-antd/src/views/sfc-boundary-fixture.vue';

for (const fixture of [
  {
    count: 1,
    name: 'typed script assertion',
    source:
      '<script setup lang="ts">const user: { name: string } | undefined = undefined; console.log(user!.name);</script><template><div /></template>',
  },
  {
    count: 1,
    name: 'template interpolation assertion',
    source:
      '<script setup lang="ts">const user: { name: string } | undefined = undefined;</script><template>{{ user!.name }}</template>',
  },
  {
    count: 1,
    name: 'template handler assertion',
    source:
      '<script setup lang="ts">const user: { name: string } | undefined = undefined; const run = (name: string) => name;</script><template><button @click="run(user!.name)">Run</button></template>',
  },
  {
    count: 2,
    name: 'script and template assertions together',
    source:
      '<script setup lang="ts">const user: { name: string } | undefined = undefined; console.log(user!.name);</script><template>{{ user!.name }}</template>',
  },
  {
    count: 0,
    name: 'explicit existence checks and optional access',
    source:
      '<script setup lang="ts">const user: { name: string } | undefined = undefined; if (user) console.log(user.name);</script><template><div v-if="user">{{ user.name }}</div><div>{{ user?.name }}</div></template>',
  },
  {
    count: 0,
    name: 'logical negation stays valid',
    source:
      '<script setup lang="ts">const ready = false; const hidden = !ready;</script><template>{{ !hidden }}</template>',
  },
]) {
  it(`checks ${fixture.name} through the actual Vue parser`, async () => {
    const results = await eslint.lintText(fixture.source, { filePath });
    assert.equal(results.length, 1);
    assert.equal(results[0].fatalErrorCount, 0);
    const messages = results[0].messages.filter(
      (message: { ruleId: string }) => message.ruleId === ruleId,
    );
    assert.equal(messages.length, fixture.count);
    assert.ok(
      messages.every((message: { severity: number }) => message.severity === 2),
    );
  });
}

const expressionPrelude =
  '<script setup lang="ts">const value = {} as { name: string }; const list = [value]; const run = (name: string) => name;</script>';
for (const fixture of [
  {
    count: 1,
    name: 'v-for source',
    template: '<div v-for="item in list!">{{ item }}</div>',
  },
  {
    count: 2,
    name: 'dynamic directive argument and value',
    template: '<div :[value!.name]="value!.name" />',
  },
  {
    count: 1,
    name: 'slot default value',
    template: '<Child v-slot="{ item = value!.name }">{{ item }}</Child>',
  },
  {
    count: 1,
    name: 'v-model target',
    template: '<Child v-model="value!.name" />',
  },
  {
    count: 2,
    name: 'multiple event statements',
    template: '<button @click="run(value!.name); run(value!.name)" />',
  },
  { count: 2, name: 'nested assertions', template: '{{ value!!.name }}' },
  { count: 0, name: 'double logical negation', template: '{{ !!value }}' },
  {
    count: 0,
    name: 'literal text comments and v-pre',
    template:
      '<div v-pre>{{ value!.name }}</div><!-- value! --><div title="value!.name" />',
  },
]) {
  it(`checks ${fixture.name} with the unmodified root configuration`, async () => {
    const [result] = await eslint.lintText(
      `${expressionPrelude}<template>${fixture.template}</template>`,
      { filePath },
    );
    assert.equal(result.fatalErrorCount, 0);
    const messages = result.messages.filter(
      (message: { ruleId: string }) => message.ruleId === ruleId,
    );
    assert.equal(messages.length, fixture.count);
    assert.ok(
      messages.every(
        (message: { fix?: unknown; suggestions?: unknown }) =>
          message.fix === undefined && message.suggestions === undefined,
      ),
    );
  });
}

it('checks both script blocks and TSX through the root factory', async () => {
  for (const source of [
    '<script lang="ts">const first = value!;</script><script setup lang="ts">const second = value!;</script><template>{{ value! }}</template>',
    '<script setup lang="tsx">const value = source!; const element = <div>{value!}</div>;</script><template>{{ value! }}</template>',
  ]) {
    const [result] = await eslint.lintText(source, { filePath });
    assert.equal(result.fatalErrorCount, 0);
    assert.equal(
      result.messages.filter(
        (message: { ruleId: string }) => message.ruleId === ruleId,
      ).length,
      3,
    );
  }
  assert.equal(vueNonNullAssertion.meta?.fixable, undefined);
});

for (const [index, source] of [
  '<script setup lang="ts">const value = {};</script><template lang="pug">div {{ value!.name }}</template>',
  '<script setup lang="ts">const value = {};</script><template lang="md">{{ value!.name }}</template>',
  '<template src="private-external-template-sentinel.html" />',
  '<template src="" />',
  '<template src />',
  '<script lang="ts" src="private-external-script-sentinel.ts"></script><template><div /></template>',
  '<script lang="ts" src=""></script><template><div /></template>',
  '<script lang="ts" src></script><template><div /></template>',
].entries()) {
  it(`fails closed on unsupported SFC source fixture ${index + 1}`, async () => {
    await assert.rejects(
      () => eslint.lintText(source, { filePath }),
      TypeError,
    );
  });
}

it('fails closed when script parsing is explicitly disabled despite existing Vue services', async () => {
  const disabled = new ESLint({
    cwd: root,
    overrideConfig: {
      files: ['**/*.vue'],
      languageOptions: { parserOptions: { parser: false } },
    },
  });
  await assert.rejects(
    () =>
      disabled.lintText(
        '<script setup lang="ts">const value = source!;</script><template><div /></template>',
        { filePath },
      ),
    TypeError,
  );
});

it('fails closed on an expression parser failure without rejecting valid Vue self-closing HTML', async () => {
  const brokenTemplateParser = new ESLint({
    cwd: root,
    overrideConfig: {
      files: ['**/*.vue'],
      languageOptions: { parserOptions: { parser: 'espree' } },
    },
  });
  await assert.rejects(
    () =>
      brokenTemplateParser.lintText(
        '<script setup lang="ts">const value = {};</script><template>{{ value!.name }}</template>',
        { filePath },
      ),
    TypeError,
  );
  const [result] = await eslint.lintText('<template><div /></template>', {
    filePath,
  });
  assert.equal(result.fatalErrorCount, 0);
  assert.equal(
    result.messages.filter(
      (message: { ruleId: string }) => message.ruleId === ruleId,
    ).length,
    0,
  );
});

it('fails closed when the configured parser does not provide Vue services', async () => {
  const missingServices = new ESLint({
    cwd: root,
    overrideConfig: {
      files: ['**/*.vue'],
      plugins: {
        cloudops: {
          rules: { 'no-sfc-non-null-assertion': vueNonNullAssertion },
        },
      },
      rules: { [ruleId]: 'error' },
    },
    overrideConfigFile: true,
  });
  await assert.rejects(
    () => missingServices.lintText('const value = true;', { filePath }),
    TypeError,
  );
});
