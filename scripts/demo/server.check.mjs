import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import nodeTest from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

import { matchesRoute, routeInventory } from './inventory.mjs';
import { createDemoServer, mayProxy } from './server.mjs';

async function listening(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
nodeTest(
  'login/profile/RBAC known routes only; external and unknown routes never proxy',
  () => {
    for (const [method, path] of [
      ['POST', '/api/user/login'],
      ['GET', '/api/user/profile'],
      ['GET', '/api/user/permissions'],
      ['GET', '/api/tree/local/list'],
    ])
      assert.equal(mayProxy(method, path), true, path);
    for (const [method, path] of [
      ['GET', '/api/unknown/list'],
      ['POST', '/api/cron/job/7/trigger'],
      ['POST', '/api/cron/job/create'],
      ['GET', '/api/tree/local/terminal/7'],
      ['GET', '/api/tree/ecs/list'],
      ['POST', '/api/tree/ecs/start'],
      ['POST', '/api/tree/cloud/account/7/verify'],
      ['POST', '/api/workorder/notification/events/7/retry'],
      ['POST', '/api/monitor/send_group/update/7'],
      ['GET', '/api/k8s/cluster/list'],
      ['POST', '/api/v1/assistant/query'],
    ])
      assert.equal(mayProxy(method, path), false, path);
    assert.equal(
      matchesRoute('/api/user/:value/delete', '/api/user/7/delete/extra'),
      false,
    );
    assert.ok(routeInventory().length > 300);
  },
);
nodeTest(
  'synthetic modules and rejected paths make zero upstream calls; page/search/IDs stay consistent',
  async () => {
    let calls = 0;
    const server = createDemoServer({
      proxyRequest() {
        calls++;
        throw new Error('Forbidden upstream');
      },
    });
    const base = await listening(server);
    try {
      const get = async (path) => {
        const response = await fetch(base + path);
        return response.json();
      };
      const first = await get('/api/k8s/pod/9001/list?size=2');
      const second = await get('/api/k8s/pod/9001/list?size=2&page=2');
      assert.equal(first.data.total, 3);
      assert.equal(first.data.items.length, 2);
      assert.equal(second.data.items.length, 1);
      assert.notEqual(first.data.items[0].name, second.data.items[0].name);
      const detail = await get(
        `/api/k8s/pod/9001/demo/${second.data.items[0].name}/detail`,
      );
      assert.equal(detail.data.uid, second.data.items[0].uid);
      const missing = await get('/api/k8s/pod/9001/list?search=missing');
      assert.equal(missing.data.total, 0);
      const unknownCluster = await get('/api/k8s/pod/9002/list');
      assert.equal(unknownCluster.code, 403);
      const metrics = await get('/api/system/metrics');
      assert.equal(metrics.data.source, 'simulated');
      for (const path of [
        '/api/unknown',
        '/api/tree/node/update',
        '/api/tree/node/member/remove',
        '/api/tree/local/terminal/7',
        '/api/tree/cloud/account/region/available-regions',
        '/api/k8s/pod/9001/demo/demo-web-1/exec',
        '/api%2fuser/login',
      ]) {
        const rejected = await get(path);
        assert.notEqual(rejected.code, 0);
      }
      const prediction = await fetch(`${base}/api/v1/predict/cpu`, {
        body: JSON.stringify({ current_cpu_percent: 20 }),
        method: 'POST',
      }).then((response) => response.json());
      assert.equal(prediction.data.method, 'simulated');
      assert.ok(prediction.data.predicted_data.length > 1);
      const ready = await get('/api/v1/assistant/ready');
      assert.equal(ready.data.ready, false);
      const workflow = await fetch(`${base}/api/v1/autofix/workflow`, {
        body: '{}',
        method: 'POST',
      }).then((response) => response.json());
      assert.deepEqual(workflow.data.executed_actions, []);
      assert.equal(workflow.data.status, 'blocked');
      assert.equal(calls, 0);
    } finally {
      await close(server);
    }
  },
);
nodeTest(
  'only fixed loopback Go receives login; errors never expose request credentials',
  async () => {
    let received;
    const go = http.createServer(async (request, response) => {
      received = { origin: request.headers.origin, path: request.url };
      for await (const _chunk of request) {
        /* discard synthetic input */
      }
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ code: 0, data: { userId: '1' } }));
    });
    await listening(go);
    const server = createDemoServer({ goPort: go.address().port });
    const base = await listening(server);
    try {
      const result = await fetch(`${base}/api/user/login`, {
        body: JSON.stringify({ username: 'synthetic' }),
        headers: { origin: 'https://untrusted.invalid' },
        method: 'POST',
      });
      const login = await result.json();
      assert.equal(login.data.userId, '1');
      assert.deepEqual(received, {
        origin: undefined,
        path: '/api/user/login',
      });
    } finally {
      await close(server);
      await close(go);
    }
  },
);
nodeTest(
  'sessions are isolated per server instance and local knowledge/query flows keep source labels',
  async () => {
    const a = createDemoServer();
    const b = createDemoServer();
    const baseA = await listening(a);
    const baseB = await listening(b);
    try {
      const query = await fetch(`${baseA}/api/v1/assistant/query`, {
        body: JSON.stringify({ question: 'demo' }),
        method: 'POST',
      }).then((response) => response.json());
      assert.equal(query.data.source, 'simulated');
      const session = await fetch(
        `${baseA}/api/v1/assistant/session/${query.data.session_id}`,
      ).then((response) => response.json());
      assert.equal(session.data.message_count, 2);
      const missingSession = await fetch(
        `${baseB}/api/v1/assistant/session/${query.data.session_id}`,
      );
      assert.equal(missingSession.status, 403);
    } finally {
      await close(a);
      await close(b);
    }
  },
);

nodeTest(
  'all synthetic resource lists/details, local SSE and upgrade refusals use no upstream',
  async () => {
    let calls = 0;
    const server = createDemoServer({
      proxyRequest() {
        calls++;
        throw new Error('Forbidden upstream');
      },
    });
    const base = await listening(server);
    try {
      const kinds = [
        'node',
        'pod',
        'deployment',
        'statefulset',
        'daemonset',
        'service',
        'configmap',
        'secret',
        'ingress',
        'pv',
        'pvc',
        'serviceaccount',
        'role',
        'rolebinding',
        'clusterrolebinding',
      ];
      for (const kind of kinds) {
        const response = await fetch(`${base}/api/k8s/${kind}/9001/list`);
        const body = await response.json();
        assert.equal(body.code, 0, kind);
        assert.ok(body.data.items.length > 0, kind);
        const row = body.data.items[0];
        const prefix = row.namespace ? `${row.namespace}/` : '';
        const detail = await fetch(
          `${base}/api/k8s/${kind}/9001/${prefix}${row.name}/detail`,
        ).then((result) => result.json());
        assert.equal(detail.data.uid, row.uid, kind);
      }
      const namespace = await fetch(
        `${base}/api/k8s/clusters/9001/namespace/demo/detail`,
      ).then((result) => result.json());
      assert.equal(namespace.data.name, 'demo');
      for (const path of [
        '/api/k8s/yaml_template/9001/list',
        '/api/k8s/yaml_template/9001/9701/yaml',
        '/api/k8s/yaml_task/9001/list',
        '/api/k8s/yaml_task/9001/9702/detail',
      ]) {
        const yaml = await fetch(base + path).then((result) => result.json());
        assert.equal(yaml.code, 0);
      }
      const stream = await fetch(
        `${base}/api/k8s/pod/9001/demo/demo-web-1/containers/web/logs`,
        { headers: { Accept: 'text/event-stream' } },
      );
      assert.match(stream.headers.get('content-type'), /text\/event-stream/);
      const text = await stream.text();
      assert.match(text, /SIMULATED/);
      assert.ok(text.includes('[DONE]'));
      for (const path of [
        '/api/v1/assistant/unknown/health',
        '/api/k8s/pod/9001/demo/demo-web-1/unknown/detail',
      ]) {
        const unknown = await fetch(base + path);
        assert.equal(unknown.status, 403);
      }
      const upgraded = await new Promise((resolve, reject) => {
        const request = http.request(`${base}/api/tree/local/terminal/7`, {
          headers: { Connection: 'Upgrade', Upgrade: 'websocket' },
        });
        request.on('response', (response) => {
          response.resume();
          resolve(response.statusCode);
        });
        request.on('error', reject);
        request.end();
      });
      assert.equal(upgraded, 403);
      assert.equal(calls, 0);
    } finally {
      await close(server);
    }
  },
);

nodeTest(
  'cloud inventory is synthetic, credential-free, scoped and read-only with zero Go/SDK calls',
  async () => {
    let calls = 0;
    const server = createDemoServer({
      proxyRequest() {
        calls++;
        throw new Error('Forbidden upstream');
      },
    });
    const base = await listening(server);
    const read = async (path) => {
      const response = await fetch(base + path);
      return response.json();
    };
    try {
      const accounts = await read('/api/tree/cloud/account/list');
      assert.equal(accounts.data.total, 6);
      for (const account of accounts.data.items) {
        assert.equal(account.source, 'simulated');
        assert.equal(account.status, 2);
        assert.equal(account.has_existing_credential, false);
        for (const field of [
          'access_key',
          'secret_key',
          'session_token',
          'provider_credentials',
        ])
          assert.equal(Object.hasOwn(account, field), false);
        const detail = await read(
          `/api/tree/cloud/account/${account.id}/detail`,
        );
        assert.equal(detail.data.id, account.id);
        const regions = await read(
          `/api/tree/cloud/account/region/list?cloud_account_id=${account.id}`,
        );
        assert.equal(regions.data.total, 1);
        assert.equal(regions.data.items[0].id, account.regions[0].id);
      }
      const resource = await read('/api/tree/cloud/list');
      assert.equal(resource.data.items[0].source, 'simulated');
      assert.equal(
        resource.data.items[0].cloud_account_id,
        accounts.data.items[0].id,
      );
      for (const kind of ['rds', 'clb', 'cache']) {
        const managed = await read(
          `/api/tree/cloud/managed/list?cloud_account_id=9101&cloud_account_region_id=9201&kind=${kind}`,
        );
        assert.equal(managed.data.total, 1);
        assert.equal(managed.data.items[0].kind, kind);
        const history = await read(
          `/api/tree/cloud/managed/history?kind=${kind}`,
        );
        assert.equal(history.data.items[0].status, 'cancelled');
      }
      for (const [method, path] of [
        ['GET', '/api/tree/cloud/account/region/available-regions'],
        ['POST', '/api/tree/cloud/sync'],
        ['POST', '/api/tree/cloud/account/9101/verify'],
        ['GET', '/api/tree/cloud/9301/terminal'],
        ['POST', '/api/tree/cloud/managed/sync'],
      ]) {
        const response = await fetch(base + path, { method });
        assert.equal(response.status, 403);
      }
      assert.equal(calls, 0);
    } finally {
      await close(server);
    }
  },
);

nodeTest(
  'Vite demo proxy is serve-only; ordinary development/build retain the configured Go target',
  async () => {
    const file = new URL(
      '../../apps/web-antd/vite.config.mts',
      import.meta.url,
    );
    const source = readFileSync(file, 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText;
    const exports = {};
    const fakeProcess = {
      cwd: () => path.dirname(file.pathname),
      env: { VITE_PROXY_TARGET: 'http://127.0.0.1:18888' },
    };
    const dependencies = {
      '@vben/vite-config': { defineConfig: (callback) => callback },
      'node:process': fakeProcess,
      path,
      vite: { loadEnv: () => ({ VITE_CLOUDOPS_DEMO: 'true' }) },
    };
    new vm.Script(compiled).runInNewContext({
      __dirname: path.dirname(file.pathname),
      exports,
      require: (name) => {
        if (!Object.hasOwn(dependencies, name))
          throw new Error('Unknown local config dependency');
        return dependencies[name];
      },
    });
    for (const [command, mode, expected] of [
      ['serve', 'demo', 'http://127.0.0.1:18089'],
      ['serve', 'development', 'http://127.0.0.1:18888'],
      ['build', 'demo', 'http://127.0.0.1:18888'],
      ['build', 'production', 'http://127.0.0.1:18888'],
    ]) {
      const result = await exports.default({ command, mode });
      assert.equal(result.vite.server.proxy['/api/v1'].target, expected);
      assert.equal(result.vite.server.proxy['/api'].target, `${expected}/api`);
    }
  },
);

nodeTest(
  'Inbox pagination/unread/read state is coherent, memory-only and reset per instance without upstream IO',
  async () => {
    let calls = 0;
    const proxyRequest = () => {
      calls++;
      throw new Error('Inbox must not reach Go');
    };
    const server = createDemoServer({ proxyRequest });
    const reset = createDemoServer({ proxyRequest });
    const base = await listening(server);
    const fresh = await listening(reset);
    const read = async (origin, path) => {
      const response = await fetch(
        `${origin}/api/workorder/notification/inbox${path}`,
      );
      return response.json();
    };
    try {
      assert.equal(mayProxy('GET', '/api/workorder/notification/inbox'), false);
      assert.equal(
        mayProxy('GET', '/api/workorder/notification/inbox/unread'),
        false,
      );
      const first = await read(base, '?page=1&size=2');
      const second = await read(base, '?page=2&size=2');
      assert.equal(first.data.total, 4);
      assert.equal(first.data.items.length, 2);
      assert.equal(second.data.items.length, 2);
      assert.notEqual(first.data.items[0].id, second.data.items[0].id);
      assert.equal(first.data.items[0].instance_id, 0);
      assert.equal(first.data.items[0].source, 'simulated');
      assert.equal(first.data.items[0].read_at, null);
      assert.equal(typeof second.data.items[0].read_at, 'string');
      const count = await read(base, '/unread');
      assert.equal(count.data.unread, 2);
      const filtered = await read(base, '?unread=true');
      assert.equal(filtered.data.total, count.data.unread);
      const mark = await fetch(
        `${base}/api/workorder/notification/inbox/${first.data.items[0].id}/read`,
        { method: 'POST' },
      ).then((response) => response.json());
      assert.equal(mark.data.scope, 'memory-only');
      const after = await read(base, '/unread');
      assert.equal(after.data.unread, 1);
      const remaining = await read(base, '?unread=true');
      assert.equal(remaining.data.total, 1);
      assert.notEqual(remaining.data.items[0].id, first.data.items[0].id);
      await fetch(`${base}/api/workorder/notification/inbox/read-all`, {
        method: 'POST',
      });
      const allRead = await read(base, '/unread');
      assert.equal(allRead.data.unread, 0);
      const resetCount = await read(fresh, '/unread');
      assert.equal(resetCount.data.unread, 2);
      for (const [method, suffix] of [
        ['DELETE', '/9801'],
        ['POST', '/9999/read'],
        ['POST', '/9801/send'],
      ]) {
        const rejected = await fetch(
          `${base}/api/workorder/notification/inbox${suffix}`,
          { method },
        );
        assert.equal(rejected.status, 403);
      }
      assert.equal(calls, 0);
    } finally {
      await close(server);
      await close(reset);
    }
  },
);

nodeTest('unregistered legacy writes never proxy to Go', async () => {
  let upstream = 0;
  const server = createDemoServer({
    proxyRequest: () => {
      upstream += 1;
      throw new Error('Unexpected upstream');
    },
  });
  const base = await listening(server);
  try {
    for (const path of [
      '/api/tree/node/update',
      '/api/tree/node/member/remove',
    ]) {
      assert.equal(mayProxy('POST', path), false);
      const response = await fetch(`${base}${path}`, {
        body: '{}',
        method: 'POST',
      });
      assert.equal(response.status, 403);
    }
    assert.equal(upstream, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
