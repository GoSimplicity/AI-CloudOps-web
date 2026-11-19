import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { hasOfflineIcon, Icon } from '@vben/icons';

import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

const iconifyHosts = [
  'api.iconify.design',
  'api.simplesvg.com',
  'api.unisvg.com',
];

describe('iconify 离线图标', () => {
  it('已登记图标可见，未登记图标用默认图标，且不请求外部图标接口', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(hasOfflineIcon('lucide:user')).toBe(true);
    expect(hasOfflineIcon('carbon:checkmark')).toBe(true);
    expect(hasOfflineIcon('carbon:user-off')).toBe(true);

    const known = mount(Icon, { props: { icon: 'lucide:user' } });
    expect(known.html()).toContain('<svg');
    const unassigned = mount(Icon, { props: { icon: 'carbon:user-off' } });
    expect(unassigned.html()).toContain('<svg');
    expect(unassigned.html()).not.toContain('data-offline-fallback');

    const unknown = mount(Icon, {
      props: { icon: 'missing:not-registered' },
    });
    expect(unknown.html()).toContain('data-offline-fallback');

    await Promise.resolve();
    const requested = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(
      requested.filter((url) =>
        iconifyHosts.some((host) => url.includes(host)),
      ),
    ).toEqual([]);

    vi.unstubAllGlobals();
  });

  it('产品代码不引用在线 Iconify 入口或外部图标域名', () => {
    const roots = ['apps', 'packages', 'internal'];
    const hits: string[] = [];
    const visit = (path: string) => {
      for (const entry of readdirSync(path)) {
        if (entry === 'node_modules' || entry === 'dist') continue;
        const fullPath = join(path, entry);
        if (statSync(fullPath).isDirectory()) {
          visit(fullPath);
          continue;
        }
        if (
          !['.html', '.js', '.mjs', '.ts', '.tsx', '.vue'].some((extension) =>
            entry.endsWith(extension),
          )
        ) {
          continue;
        }
        if (fullPath.endsWith('offline-icons.test.ts')) continue;
        const text = readFileSync(fullPath, 'utf8');
        if (text.includes("from '@iconify/vue'")) hits.push(fullPath);
        for (const host of iconifyHosts) {
          if (text.includes(host)) hits.push(`${fullPath} ${host}`);
        }
      }
    };
    const unregistered: string[] = [];
    const iconName =
      /["']((?:ant-design|carbon|fluent-mdl2|lucide|material-symbols|mdi|tabler):[\da-z-]+)["']/g;
    const visitIcons = (path: string) => {
      for (const entry of readdirSync(path)) {
        if (entry === 'node_modules' || entry === 'dist' || entry === 'offline')
          continue;
        const fullPath = join(path, entry);
        if (statSync(fullPath).isDirectory()) {
          visitIcons(fullPath);
          continue;
        }
        if (
          !['.ts', '.tsx', '.vue'].some((extension) =>
            entry.endsWith(extension),
          )
        )
          continue;
        if (fullPath.endsWith('offline-icons.test.ts')) continue;
        const source = readFileSync(fullPath, 'utf8');
        for (const match of source.matchAll(iconName)) {
          const name = match[1] ?? '';
          if (!hasOfflineIcon(name)) {
            unregistered.push(`${fullPath} ${name}`);
          }
        }
      }
    };
    for (const root of roots) visitIcons(root);
    for (const root of roots) visit(root);
    expect(hits).toEqual([]);
    expect(unregistered).toEqual([]);
  });

  it('源码里的字符串图标名都已离线登记', () => {
    const roots = ['apps/web-antd/src', 'packages'];
    const iconAssignment =
      /(?:icon|createiconifyicon)\s*[(:=]\s*["']([\da-z-]+:[\da-z-]+)["']/gi;
    const iconLiteral =
      /["']((?:ant-design|carbon|fluent-mdl2|lucide|material-symbols|mdi|tabler)[/:][\da-z-]+)["']/gi;
    const missing = new Set<string>();
    const visit = (path: string) => {
      for (const entry of readdirSync(path)) {
        if (entry === 'node_modules' || entry === 'dist' || entry === 'offline')
          continue;
        const fullPath = join(path, entry);
        if (statSync(fullPath).isDirectory()) {
          visit(fullPath);
          continue;
        }
        if (entry.endsWith('.test.ts')) continue;
        if (
          !['.js', '.ts', '.tsx', '.vue'].some((extension) =>
            entry.endsWith(extension),
          )
        ) {
          continue;
        }
        const source = readFileSync(fullPath, 'utf8');
        const names = new Set<string>();
        for (const match of source.matchAll(iconAssignment)) {
          const name = match[1] ?? '';
          if (!name.startsWith('svg:')) names.add(name);
        }
        for (const match of source.matchAll(iconLiteral)) {
          names.add((match[1] ?? '').replace('/', ':'));
        }
        for (const name of names) {
          if (!hasOfflineIcon(name)) missing.add(name);
        }
      }
    };
    for (const root of roots) visit(root);
    expect([...missing].sort()).toEqual([]);
  });
});
