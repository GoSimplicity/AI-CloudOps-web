import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import nodeTest from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import ts from 'typescript';

const filename = fileURLToPath(
  new URL('../../apps/web-antd/vite.config.mts', import.meta.url),
);
const source = ts.createSourceFile(
  filename,
  readFileSync(filename, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
const statements = source.statements.flatMap((statement) => {
  if (ts.isImportDeclaration(statement)) return [];
  if (ts.isExportAssignment(statement))
    return [
      ts.factory.createExpressionStatement(
        ts.factory.createBinaryExpression(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier('globalThis'),
            'configuration',
          ),
          ts.SyntaxKind.EqualsToken,
          statement.expression,
        ),
      ),
    ];
  return [statement];
});
const code = ts.transpileModule(
  ts.createPrinter().printFile(ts.factory.updateSourceFile(source, statements)),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

for (const test of [
  {
    demo: false,
    environment: { command: 'serve', mode: 'development' },
    flag: 'true',
    name: 'ordinary development',
  },
  {
    demo: true,
    environment: { command: 'serve', mode: 'demo' },
    flag: 'true',
    name: 'explicit development demo',
  },
  {
    demo: false,
    environment: { command: 'serve', mode: 'demo' },
    flag: 'false',
    name: 'demo flag disabled',
  },
  {
    demo: false,
    environment: { command: 'build', mode: 'production' },
    flag: 'true',
    name: 'production build',
  },
  {
    demo: false,
    environment: { command: 'build', mode: 'demo' },
    flag: 'true',
    name: 'demo-named build',
  },
  // Vite preview uses command=serve; this must not activate demo without the UI notice.
  {
    demo: false,
    environment: { command: 'serve', isPreview: true, mode: 'demo' },
    flag: 'true',
    name: 'production preview with demo name',
  },
  {
    demo: false,
    environment: { command: 'serve', isPreview: true, mode: 'production' },
    flag: 'true',
    name: 'ordinary preview',
  },
  {
    demo: false,
    environment: undefined,
    flag: 'true',
    name: 'optional missing environment',
  },
]) {
  nodeTest(`Vite proxy respects ${test.name}`, async () => {
    const upstream = 'http://127.0.0.1:19889';
    const context = {
      __dirname: path.dirname(filename),
      defineConfig: (configuration) => configuration,
      loadEnv: () => ({ VITE_CLOUDOPS_DEMO: test.flag }),
      path,
      process: {
        cwd: () => path.dirname(filename),
        env: { VITE_PROXY_TARGET: upstream },
      },
    };
    vm.runInNewContext(code, context);
    const configuration = await context.configuration(test.environment);
    const target = test.demo ? 'http://127.0.0.1:18089' : upstream;
    assert.equal(configuration.vite.server.host, '127.0.0.1');
    assert.equal(configuration.vite.server.proxy['/api/v1'].target, target);
    assert.equal(
      configuration.vite.server.proxy['/api'].target,
      `${target}/api`,
    );
  });
}
