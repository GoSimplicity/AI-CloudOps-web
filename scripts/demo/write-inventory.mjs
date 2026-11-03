import fs from 'node:fs';

import { createFixtures } from './fixtures.mjs';
import { routeInventory } from './inventory.mjs';
import { resources } from './k8s.mjs';
import { mayProxy } from './server.mjs';

const routes = routeInventory();
const fixture = createFixtures();
const body = {
  content: '演示文档',
  file_name: 'demo.md',
  namespace: 'demo',
  question: '演示问题',
  records: [],
  title: '演示',
};
const inventory = routes.map((entry) => {
  let example = entry.route;
  const kind = /^\/api\/k8s\/([_a-z]+)\//.exec(example)?.[1];
  const row = resources[kind]?.[0];
  let values = [
    '9001',
    ...(row?.namespace ? [row.namespace] : []),
    row?.name ?? 'demo',
  ];
  if (kind === 'clusters') values = ['9001', 'demo'];
  if (!kind) values = ['demo-session'];
  if (example.startsWith('/api/workorder/notification/inbox/'))
    values = ['9801'];
  if (example.startsWith('/api/tree/cloud/account/region/')) values = ['9201'];
  else if (example.startsWith('/api/tree/cloud/account/')) values = ['9101'];
  else if (example.startsWith('/api/tree/cloud/managed/detail/'))
    values = ['9401'];
  else if (example.startsWith('/api/tree/cloud/managed/operations/'))
    values = ['simulated-rds-operation'];
  else if (example.startsWith('/api/tree/cloud/')) values = ['9301'];
  if (kind === 'yaml_template') values = ['9001', '9701'];
  if (kind === 'yaml_task') values = ['9001', '9702'];
  if (example.startsWith('/api/v1/autofix/workflow/operations/'))
    values = ['00000000-0000-4000-8000-000000000001'];
  if (example.startsWith('/api/v1/autofix/workflow/plans/'))
    values = ['00000000-0000-4000-8000-000000000002'];
  if (entry.route.includes('/node/:value/pods'))
    values = ['9001', 'demo-node-1'];
  example = example.replaceAll(':value', () => values.shift() ?? 'web');
  let treatment = 'explicitly-rejected';
  if (mayProxy(entry.method, example)) treatment = 'local-go';
  else if (
    fixture(entry.method, new URL(example, 'http://127.0.0.1'), body) !==
    undefined
  )
    treatment = 'simulated';
  return { ...entry, example, treatment };
});
fs.writeFileSync(
  new URL('route-inventory.json', import.meta.url),
  `${JSON.stringify(inventory, null, 2)}\n`,
);
const counts = Object.fromEntries(
  ['local-go', 'simulated', 'explicitly-rejected'].map((kind) => [
    kind,
    inventory.filter((route) => route.treatment === kind).length,
  ]),
);
process.stdout.write(
  `${JSON.stringify({ total: inventory.length, ...counts })}\n`,
);
