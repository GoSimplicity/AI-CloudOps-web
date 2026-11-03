import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

const apiRoot = new URL('../../apps/web-antd/src/api/core/', import.meta.url);
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return files(file);
    if (/(?<!\.test)\.ts$/.test(file)) return [file];
    return [];
  });
}
export function routeInventory() {
  const routes = [];
  for (const file of files(apiRoot.pathname)) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
      ) {
        const method = node.expression.name.text.toUpperCase();
        const client = node.expression.expression.getText(source);
        if (
          ['baseRequestClient', 'requestClient', 'requestClientAIOps'].includes(
            client,
          ) &&
          ['DELETE', 'GET', 'PATCH', 'POST', 'PUT'].includes(method)
        ) {
          const argument = node.arguments[0];
          let route;
          if (
            argument &&
            (ts.isStringLiteral(argument) ||
              ts.isNoSubstitutionTemplateLiteral(argument))
          )
            route = argument.text;
          else if (argument && ts.isTemplateExpression(argument))
            route =
              argument.head.text +
              argument.templateSpans
                .map((span) => `:value${span.literal.text}`)
                .join('');
          if (route?.startsWith('/'))
            routes.push({
              file: path.relative(apiRoot.pathname, file),
              method,
              route: `${client === 'requestClientAIOps' ? '/api/v1' : '/api'}${route}`,
            });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return routes;
}
export function matchesRoute(template, actual) {
  const escaped = template
    .split(':value')
    .map((part) => part.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`))
    .join('[^/]+');
  return new RegExp(`^${escaped}$`).test(actual);
}
