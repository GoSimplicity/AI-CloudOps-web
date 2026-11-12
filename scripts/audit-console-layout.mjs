// Inventory real route components; comments and inactive files are not route evidence.
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

const root = process.cwd();
const dir = path.join(root, 'apps/web-antd/src/router/routes/modules');
const entries = [];
for (const name of fs.readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
  const file = path.join(dir, name);
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const props = node.properties.filter(ts.isPropertyAssignment);
      const find = (n) => props.find((p) => p.name.getText(source) === n);
      const route = find('path');
      const component = find('component');
      const view = component?.initializer
        .getText(source)
        .match(/import\(["']#\/views\/([^"']+)["']\)/)?.[1];
      if (route && view && ts.isStringLiteral(route.initializer)) {
        const target = path.join(root, 'apps/web-antd/src/views', view);
        const text = fs.existsSync(target)
          ? fs.readFileSync(target, 'utf8')
          : '';
        entries.push({
          inlineStyles: (text.match(/\sstyle=/g) || []).length,
          route: route.initializer.text,
          scopedStyle:
            text.includes('<style scoped') || text.includes(' scoped>'),
          sharedPage: text.includes('<OpsPage '),
          view,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
entries.sort((a, b) => a.route.localeCompare(b.route));
const report = {
  entries,
  migratedShells: entries.filter((e) => e.sharedPage).length,
  routes: entries.length,
};
fs.mkdirSync(path.join(root, 'docs/release'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'docs/release/layout-inventory.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(
  `${report.routes} routed components; ${report.migratedShells} consume OpsPage. This counts structure, not business acceptance.\n`,
);
