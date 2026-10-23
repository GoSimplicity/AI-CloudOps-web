import { defineConfig } from '@vben/vite-config';
import type { ProxyOptions } from 'vite';
import path from 'path'; // 引入 path 模块

// 浏览器与 Vite 同源，上游无需对本地开发端口再次执行 CORS 校验
// 只处理 HTTP 代理事件，WebSocket 保留原有来源约束
const configureHttpProxy: NonNullable<ProxyOptions['configure']> = (proxy) => {
  proxy.on('proxyReq', (request) => request.removeHeader('origin'));
};

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        host: '127.0.0.1',
        proxy: {
          '/api/v1': {
            changeOrigin: true,
            configure: configureHttpProxy,
            target: process.env.VITE_PROXY_TARGET || 'http://localhost:8889',
            ws: true,
          },
          '/api': {
            changeOrigin: true,
            configure: configureHttpProxy,
            rewrite: (path) => path.replace(/^\/api/, ''),
            target: `${process.env.VITE_PROXY_TARGET || 'http://localhost:8889'}/api`,
            ws: true,
          },
        },
      },
      resolve: {
        alias: {
          '#': path.resolve(__dirname, 'src'),
        },
      },
    },
  };
});
