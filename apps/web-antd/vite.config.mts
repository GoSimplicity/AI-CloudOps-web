import path from 'node:path'; // 引入 path 模块
import process from 'node:process';

import { defineConfig } from '@vben/vite-config';

import { loadEnv, type ProxyOptions } from 'vite';

// 浏览器与 Vite 同源，上游无需对本地开发端口再次执行 CORS 校验
// 只处理 HTTP 代理事件，WebSocket 保留原有来源约束
const configureHttpProxy: NonNullable<ProxyOptions['configure']> = (proxy) => {
  proxy.on('proxyReq', (request) => request.removeHeader('origin'));
};

export default defineConfig(async (environment) => {
  const demo =
    environment?.command === 'serve' &&
    environment.mode === 'demo' &&
    !environment.isPreview &&
    loadEnv(environment.mode, process.cwd(), 'VITE_').VITE_CLOUDOPS_DEMO ===
      'true';
  const proxyTarget = demo
    ? 'http://127.0.0.1:18089'
    : process.env.VITE_PROXY_TARGET || 'http://localhost:8889';
  return {
    application: {},
    vite: {
      resolve: {
        alias: {
          '#': path.resolve(import.meta.dirname, 'src'),
        },
      },
      server: {
        host: '127.0.0.1',
        proxy: {
          // Vite matches these prefixes in insertion order.
          /* eslint-disable perfectionist/sort-objects */
          '/api/v1': {
            changeOrigin: true,
            configure: configureHttpProxy,
            target: proxyTarget,
            ws: true,
          },
          '/api': {
            changeOrigin: true,
            configure: configureHttpProxy,
            rewrite: (path) => path.replace(/^\/api/, ''),
            target: `${proxyTarget}/api`,
            ws: true,
          },
          /* eslint-enable perfectionist/sort-objects */
        },
      },
    },
  };
});
