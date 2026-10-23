import { parse as parseSfc } from 'vue/compiler-sfc';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const routesDirectory = resolve(
  root,
  'apps/web-antd/src/router/routes/modules',
);
const entries = [];

for (const file of readdirSync(routesDirectory).filter((file) =>
  file.endsWith('.ts'),
)) {
  const source = ts.createSourceFile(
    file,
    readFileSync(resolve(routesDirectory, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const properties = node.properties.filter(ts.isPropertyAssignment);
      const path = properties.find(
        (property) => property.name.getText(source) === 'path',
      );
      const component = properties.find(
        (property) => property.name.getText(source) === 'component',
      );
      if (
        path &&
        component &&
        ts.isStringLiteral(path.initializer) &&
        ts.isArrowFunction(component.initializer)
      ) {
        const body = component.initializer.body;
        if (
          !ts.isCallExpression(body) ||
          body.expression.kind !== ts.SyntaxKind.ImportKeyword ||
          !body.arguments[0] ||
          !ts.isStringLiteral(body.arguments[0])
        ) {
          throw new Error(
            `Unsupported route import in ${file}: ${path.initializer.text}`,
          );
        }
        const view = body.arguments[0].text.replace('#/views/', '');
        const content = readFileSync(
          resolve(root, 'apps/web-antd/src/views', view),
          'utf8',
        );
        const { descriptor, errors } = parseSfc(content);
        if (errors.length || !descriptor.template)
          throw new Error(`Invalid route view: ${view}`);
        // 清单只统计真实模板节点，注释中的旧标记不会计入迁移覆盖
        let sharedPage = false;
        let inlineStyles = 0;
        function inspect(node) {
          if (node.type === 1) {
            if (node.tag === 'OpsPage') sharedPage = true;
            inlineStyles += node.props.filter(
              (prop) =>
                prop.name === 'style' ||
                (prop.name === 'bind' && prop.arg?.content === 'style'),
            ).length;
          }
          for (const child of node.children || []) inspect(child);
        }
        inspect(descriptor.template.ast);
        entries.push({
          route: path.initializer.text,
          view,
          sharedPage,
          inlineStyles,
          scopedStyle: descriptor.styles.some((style) => style.scoped),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
entries.sort((left, right) => left.route.localeCompare(right.route));
const inventory =
  JSON.stringify(
    {
      routes: entries.length,
      migratedShells: entries.filter((entry) => entry.sharedPage).length,
      entries,
    },
    null,
    2,
  ) + '\n';
const target = resolve(root, 'docs/release/layout-inventory.json');
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== inventory)
    throw new Error('页面清单已过期，请运行 pnpm update:layout');
} else {
  writeFileSync(target, inventory);
}
console.log(
  `${entries.length} routes, ${entries.filter((entry) => entry.sharedPage).length} shared page shells`,
);
