import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { pathToFileURL } from 'node:url';

import { createFixtures } from './fixtures.mjs';
import { matchesRoute } from './inventory.mjs';

const routes = JSON.parse(
  readFileSync(new URL('local-go-routes.json', import.meta.url), 'utf8'),
);
const forbidden =
  /(?:^|\/)(?:terminal|exec|execute|trigger|enable|test|test-send|send|send-manual|manual-send|sync|reveal|refresh|connection|available-regions|discover)(?:\/|$)/i;
export function mayProxy(method, pathname) {
  if (
    !pathname.startsWith('/api/') ||
    pathname.startsWith('/api/v1/') ||
    forbidden.test(pathname)
  )
    return false;
  if (
    pathname.startsWith('/api/k8s/') ||
    pathname.startsWith('/api/system/') ||
    pathname.startsWith('/api/tree/cloud/') ||
    /^\/api\/workorder\/notification\/inbox(?:\/|$)/.test(pathname)
  )
    return false;
  if (/^\/api\/tree\/(?:ecs|vpc|security_group)(?:\/|$)/.test(pathname))
    return false;
  if (
    method !== 'GET' &&
    !/^\/api\/(?:user|role|api|tree\/(?:local|node))(?:\/|$)/.test(pathname)
  )
    return false;
  return routes.some(
    (route) =>
      route.method === method &&
      /^(?:system|tree|prometheus|workorder|cron)\//.test(route.file) &&
      matchesRoute(route.route, pathname),
  );
}
function json(response, status, data) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-cloudops-demo': 'simulated',
  });
  response.end(JSON.stringify(data));
}
export function createDemoServer({
  goPort = 8889,
  proxyRequest = http.request,
} = {}) {
  if (!Number.isSafeInteger(goPort) || goPort < 1 || goPort > 65_535)
    throw new Error('Invalid local Go port');
  const demoResponse = createFixtures();
  const server = http.createServer(async (request, response) => {
    try {
      // Reject encoded separators/dot traversal before URL normalization.
      const raw = request.url ?? '/';
      if (
        /%(?:2f|5c|2e|00)|\\|(?:^|\/)\.\.(?:\/|\?|$)/i.test(raw) ||
        !raw.startsWith('/') ||
        raw.startsWith('//')
      ) {
        json(response, 400, {
          code: 400,
          data: null,
          message: '演示模式拒绝无效路径',
        });
        return;
      }
      const url = new URL(raw, 'http://127.0.0.1');
      const method = request.method ?? 'GET';
      if (url.pathname === '/__demo/health' && method === 'GET') {
        json(response, 200, {
          code: 0,
          data: { external_io: false, mode: 'demo', source: 'simulated' },
          message: '本地演示',
        });
        return;
      }
      if (mayProxy(method, url.pathname)) {
        // Fixed loopback destination; no incoming Host, URL or env can choose an upstream.
        const headers = { ...request.headers, host: `127.0.0.1:${goPort}` };
        delete headers.origin;
        delete headers.connection;
        const upstream = proxyRequest(
          {
            headers,
            hostname: '127.0.0.1',
            method,
            path: raw,
            port: goPort,
            timeout: 10_000,
          },
          (incoming) => {
            response.writeHead(incoming.statusCode ?? 502, {
              ...incoming.headers,
              'x-cloudops-demo': 'local-go',
            });
            incoming.pipe(response);
          },
        );
        upstream.on('timeout', () => upstream.destroy());
        upstream.on('error', () => {
          if (response.headersSent) {
            response.end();
          } else {
            json(response, 502, {
              code: 502,
              data: null,
              message: '本地 Go 服务未就绪',
            });
          }
        });
        request.pipe(upstream);
        return;
      }
      let body = '';
      for await (const chunk of request) {
        body += chunk.toString();
        if (Buffer.byteLength(body) > 1024 * 1024) {
          json(response, 413, {
            code: 413,
            data: null,
            message: '演示请求过大',
          });
          return;
        }
      }
      let payload;
      try {
        payload = body ? JSON.parse(body) : {};
      } catch {
        json(response, 400, {
          code: 400,
          data: null,
          message: '演示接口要求 JSON',
        });
        return;
      }
      const result = demoResponse(method, url, payload);
      if (
        typeof result === 'string' &&
        request.headers.accept?.includes('text/event-stream') &&
        url.pathname.endsWith('/logs')
      ) {
        response.writeHead(200, {
          'cache-control': 'no-store',
          'content-type': 'text/event-stream; charset=utf-8',
          'x-cloudops-demo': 'simulated',
        });
        response.end(`event: message\ndata: ${result}\n\ndata: [DONE]\n\n`);
        return;
      }
      if (result === undefined) {
        json(response, 403, {
          code: 403,
          data: null,
          message: '本地演示模式不支持此操作，不会连接外部系统',
        });
      } else {
        json(response, 200, {
          code: 0,
          data: result,
          message: '本地演示合成数据',
        });
      }
    } catch {
      if (response.headersSent) {
        response.end();
      } else {
        json(response, 500, {
          code: 500,
          data: null,
          message: '本地演示请求处理失败',
        });
      }
    }
  });
  server.on('upgrade', (_request, socket) =>
    socket.end(
      'HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n演示模式不连接终端',
    ),
  );
  return server;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const port = Number(process.env.CLOUDOPS_DEMO_PORT ?? 18_089);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535)
    throw new Error('Invalid demo port');
  createDemoServer().listen(port, '127.0.0.1', () =>
    process.stdout.write(
      `Local demo API: http://127.0.0.1:${port} (simulated; external operations blocked)\n`,
    ),
  );
}
