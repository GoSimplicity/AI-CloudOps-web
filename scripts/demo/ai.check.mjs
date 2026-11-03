import assert from 'node:assert/strict';
import { once } from 'node:events';
import nodeTest from 'node:test';

import { aiResponse } from './ai.mjs';
import { createDemoServer } from './server.mjs';

function request(handler, method, path, body = {}) {
  return handler(method, new URL(`http://127.0.0.1/api/v1/rca/${path}`), body);
}
function assertSynthetic(result) {
  assert.equal(result.source, 'simulated');
  assert.ok(Number.isFinite(Date.parse(result.timestamp)));
}
nodeTest(
  'RCA metric catalog matches the production items parser, with synthetic names',
  () => {
    const result = request(aiResponse(), 'GET', 'metrics');
    // This is the unchanged production RCAAnalysis parsing boundary after envelope unwrap.
    const items = result.data?.items || result.items || result || [];
    assert.ok(Array.isArray(items));
    assert.deepEqual(items, ['demo_cpu_usage', 'demo_memory_usage']);
    assert.equal(result.total, items.length);
    assertSynthetic(result);
  },
);
for (const kind of ['metrics', 'events', 'logs']) {
  nodeTest(
    `RCA ${kind} collection keeps the typed data response envelope`,
    () => {
      const body = {
        end_time: '2026-11-03T10:00:00Z',
        namespace: 'demo-app',
        start_time: '2026-11-03T09:00:00Z',
      };
      const result = request(aiResponse(), 'POST', `data/${kind}`, body);
      assertSynthetic(result);
      assert.equal(result.namespace, body.namespace);
      assert.equal(result.start_time, body.start_time);
      assert.equal(result.end_time, body.end_time);
      assert.ok(Array.isArray(result.items));
      assert.equal(result.total, result.items.length);
      assert.ok(result.total > 0);
      assert.equal(result.query_params.source, 'simulated');
      for (const item of result.items) {
        if (kind === 'metrics') {
          assert.equal(item.labels.namespace, body.namespace);
          assert.equal(item.labels.source, 'simulated');
          assert.ok(Array.isArray(item.values));
          assert.ok(
            item.values.every(
              (point) =>
                Date.parse(point.timestamp) >= Date.parse(body.start_time) &&
                Date.parse(point.timestamp) <= Date.parse(body.end_time),
            ),
          );
          assert.ok(
            item.values.every(
              (point) =>
                Number.isFinite(point.value) &&
                Number.isFinite(Date.parse(point.timestamp)),
            ),
          );
        } else {
          assert.ok(Number.isFinite(Date.parse(item.timestamp)));
          assert.match(item.message, /合成数据/);
          if (kind === 'events')
            assert.equal(item.involved_object.namespace, body.namespace);
          else assert.equal(typeof item.pod_name, 'string');
        }
      }
    },
  );
}
nodeTest(
  'RCA requested metric names agree with the catalog for both query and analysis input shapes',
  () => {
    const handler = aiResponse();
    for (const metrics of ['demo_memory_usage', ['demo_memory_usage']]) {
      const result = request(handler, 'POST', 'data/metrics', {
        metrics,
        namespace: 'demo',
      });
      assert.deepEqual(
        result.items.map((item) => item.name),
        ['demo_memory_usage'],
      );
    }
    const absent = request(handler, 'POST', 'data/metrics', {
      metrics: 'not-in-demo',
    });
    assert.deepEqual(absent.items, []);
    assert.equal(absent.total, 0);
  },
);
nodeTest(
  'RCA synthetic source filters match the echoed query, with coherent empty results',
  () => {
    const handler = aiResponse();
    for (const [kind, body] of [
      ['logs', { error_only: true }],
      ['logs', { pod_name: 'not-the-demo-pod' }],
      ['events', { severity: 'critical' }],
    ]) {
      const response = request(handler, 'POST', `data/${kind}`, body);
      assert.deepEqual(response.items, []);
      assert.equal(response.total, 0);
      for (const [key, value] of Object.entries(body))
        assert.equal(response.query_params[key], value);
    }
  },
);
for (const path of ['analyze', 'quick-diagnosis']) {
  nodeTest(
    `RCA ${path} uses a recognized degraded UI state without claiming real execution`,
    () => {
      const result = request(aiResponse(), 'POST', path, {
        namespace: 'demo-app',
        time_window_hours: 2,
      });
      assertSynthetic(result);
      assert.equal(result.namespace, 'demo-app');
      assert.equal(result.status, 'degraded');
      assert.equal(result.collection.status, 'failed');
      assert.equal(result.collection.coverage, null);
      assert.equal(
        result.collection.coverage_basis,
        'not_measured_synthetic_fixture',
      );
      for (const state of Object.values(result.collection.sources)) {
        assert.equal(state.status, 'failed');
        assert.equal(state.count, 0);
        assert.equal(state.succeeded, 0);
        assert.equal(state.failed, 0);
        assert.equal(state.source, 'simulated');
      }
      assert.equal(result.analysis_metadata.real_analysis_performed, false);
      assert.equal(result.analysis_metadata.external_io, false);
      assert.equal(result.analysis_metadata.model_connected, false);
      assert.ok(
        result.recommendations.some((text) => text.includes('合成数据')),
      );
      if (path === 'analyze') {
        assert.equal(result.time_window_hours, 2);
        assert.equal(result.confidence_score, 0);
        assert.ok(Array.isArray(result.root_causes));
        assert.equal(result.root_causes[0].evidence.source, 'simulated');
      } else assert.equal(result.analysis_duration, 0);
    },
  );
}
nodeTest(
  'RCA readiness continues to be false, separate from synthetic result rendering',
  () => {
    const handler = aiResponse();
    const result = request(handler, 'GET', 'ready');
    assert.equal(result.ready, false);
    assert.equal(result.initialized, false);
    assert.equal(result.healthy, false);
    assert.equal(result.source, 'simulated');
  },
);
nodeTest(
  'real HTTP envelope RCA catalog/collection/analysis never call any upstream',
  async () => {
    let calls = 0;
    const server = createDemoServer({
      proxyRequest() {
        calls++;
        throw new Error('RCA must remain local');
      },
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/v1/rca/`;
    try {
      for (const [method, path] of [
        ['GET', 'metrics'],
        ['POST', 'data/metrics'],
        ['POST', 'data/events'],
        ['POST', 'data/logs'],
        ['POST', 'analyze'],
        ['POST', 'quick-diagnosis'],
      ]) {
        const response = await fetch(base + path, {
          method,
          ...(method === 'POST'
            ? {
                body: JSON.stringify({ namespace: 'demo-http' }),
                headers: { 'content-type': 'application/json' },
              }
            : {}),
        });
        const result = await response.json();
        assert.equal(response.status, 200);
        assert.equal(result.code, 0);
        assert.equal(result.data.source, 'simulated');
        if (path === 'metrics') assert.ok(Array.isArray(result.data.items));
        else if (path.startsWith('data/'))
          assert.ok(Array.isArray(result.data.items));
        else assert.equal(result.data.status, 'degraded');
      }
      assert.equal(calls, 0);
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
