// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import ts from 'typescript';
import { expect, it } from 'vitest';

it('rejects a long adversarial notification domain within an isolated budget', () => {
  const source = readFileSync(
    new URL(
      '../../apps/web-antd/src/utils/notification-email.ts',
      import.meta.url,
    ),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2015,
    },
  }).outputText;
  const sandbox = { exports: {}, input: `a@${'.'.repeat(100_000)} b` };
  const result = runInNewContext(
    `${compiled}\nexports.isBasicNotificationEmail(input);`,
    sandbox,
    { timeout: 1000 },
  );
  expect(result).toBe(false);
});
