// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { viteInjectAppLoadingPlugin } from './index';

const env = {
  VITE_APP_NAMESPACE: 'cloudops-web',
  VITE_BASE: '/',
};

function handlerOf(
  plugin: Awaited<ReturnType<typeof viteInjectAppLoadingPlugin>>,
) {
  const hook = plugin?.transformIndexHtml;
  if (!hook || typeof hook === 'function' || !hook.handler) {
    throw new Error('loading 插件没有 HTML 转换');
  }
  return hook.handler;
}

describe('首屏主题脚本', () => {
  it('生产构建把主题脚本放到同源带 hash 的外部文件，HTML 不含内联脚本', async () => {
    const plugin = await viteInjectAppLoadingPlugin(true, env);
    const html = handlerOf(plugin)('<html><body></body></html>');
    expect(typeof html).toBe('string');
    const page = String(html);
    const scripts = page.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.every((tag) => tag.includes(' src="'))).toBe(true);
    expect(
      scripts.some((tag) => tag.includes(' async') || tag.includes(' defer')),
    ).toBe(false);
    const matched = scripts.find((tag) =>
      tag.includes('data-app-loading="inject-js"'),
    );
    const src = matched?.match(/src="([^"]+)"/)?.[1];
    expect(src?.startsWith('/jse/app-loading-theme-')).toBe(true);
    expect(src?.endsWith('.js')).toBe(true);
    expect(page.indexOf('<script')).toBeLessThan(
      page.indexOf('id="__app-loading__"'),
    );

    const emitted: Array<{ fileName?: string; source?: string }> = [];
    const generateBundle = plugin?.generateBundle;
    if (typeof generateBundle !== 'function') {
      throw new TypeError('生产构建没有输出主题脚本');
    }
    generateBundle.call({
      emitFile(file: { fileName?: string; source?: string }) {
        emitted.push(file);
      },
    });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.fileName).toBe(src?.slice(1));
    expect(emitted[0]?.source).toContain("localStorage.getItem('cloudops-web-");
    expect(emitted[0]?.source).toContain("-prod-preferences-theme')");
  });

  it('开发模式仍内联主题脚本，避免改动 HMR', async () => {
    const plugin = await viteInjectAppLoadingPlugin(false, env);
    const html = String(handlerOf(plugin)('<html><body></body></html>'));
    expect(html).toContain('<script data-app-loading="inject-js">');
    expect(html).toContain("-dev-preferences-theme'");
  });
});
