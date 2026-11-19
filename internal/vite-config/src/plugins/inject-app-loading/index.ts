import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readPackageJSON } from '@vben/node-utils';

import { type PluginOption } from 'vite';

/**
 * 用于生成将loading样式注入到项目中
 * 为多app提供loading样式，无需在每个 app -> index.html单独引入
 */
async function viteInjectAppLoadingPlugin(
  isBuild: boolean,
  env: Record<string, any> = {},
  loadingTemplate = 'loading.html',
): Promise<PluginOption | undefined> {
  const loadingHtml = await getLoadingRawByHtmlTemplate(loadingTemplate);
  const { version } = await readPackageJSON(process.cwd());
  const envRaw = isBuild ? 'prod' : 'dev';
  const cacheName = `'${env.VITE_APP_NAMESPACE}-${version}-${envRaw}-preferences-theme'`;

  // 获取缓存的主题
  // 保证黑暗主题下，刷新页面时，loading也是黑暗主题
  const themeSource = `var theme = localStorage.getItem(${cacheName});
  document.documentElement.classList.toggle('dark', /dark/.test(theme));
`;
  const themeFileName = `jse/app-loading-theme-${createHash('sha256')
    .update(themeSource)
    .digest('hex')
    .slice(0, 8)}.js`;
  const base =
    typeof env.VITE_BASE === 'string' && env.VITE_BASE ? env.VITE_BASE : '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const injectScript = isBuild
    ? `
  <script src="${normalizedBase}${themeFileName}" data-app-loading="inject-js"></script>
`
    : `
  <script data-app-loading="inject-js">
  ${themeSource}</script>
`;

  if (!loadingHtml) {
    return;
  }

  return {
    enforce: 'pre',
    generateBundle() {
      if (!isBuild) return;
      this.emitFile({
        fileName: themeFileName,
        source: themeSource,
        type: 'asset',
      });
    },
    name: 'vite:inject-app-loading',
    transformIndexHtml: {
      handler(html) {
        const re = /<body\s*>/;
        html = html.replace(re, `<body>${injectScript}${loadingHtml}`);
        return html;
      },
      order: 'pre',
    },
  };
}

/**
 * 用于获取loading的html模板
 */
async function getLoadingRawByHtmlTemplate(loadingTemplate: string) {
  // 支持在app内自定义loading模板，模版参考default-loading.html即可
  let appLoadingPath = join(process.cwd(), loadingTemplate);

  if (!fs.existsSync(appLoadingPath)) {
    const __dirname = fileURLToPath(new URL('.', import.meta.url));
    appLoadingPath = join(__dirname, './default-loading.html');
  }

  return await fsp.readFile(appLoadingPath, 'utf8');
}

export { viteInjectAppLoadingPlugin };
