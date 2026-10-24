import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MonitorScrapeJob from './MonitorScrapeJob.vue';

// FE-02：本文件验证业务行为，按「有按钮权限」渲染；权限判断本身见 utils/permission/*.test.ts
vi.mock('#/utils/permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/utils/permission')>()),
  usePermission: () => ({ can: () => true, hasPerm: () => true }),
}));

const client = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
let wrapper: VueWrapper | undefined;
let record: Record<string, unknown>;
beforeEach(() => {
  vi.clearAllMocks();
  record = {
    id: 7,
    name: '凭据任务',
    pool_id: 3,
    enable: 1,
    service_discovery_type: 2,
    metrics_path: '/metrics',
    scheme: 'https',
    scrape_interval: 15,
    scrape_timeout: 5,
    refresh_interval: 30,
    port: 9100,
    has_bearer_token: true,
    bearer_token_file: '',
    tls_ca_content: 'public CA',
    relabel_configs_yaml_string: '[]',
    tags: ['test'],
    tree_node_ids: ['8'],
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  const style = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    style(element),
  );
  client.get.mockImplementation((path: string) => {
    if (path === '/monitor/scrape_jobs/list')
      return Promise.resolve({ items: [record], total: 1 });
    if (path.includes('/scrape_jobs/detail/')) return Promise.resolve(record);
    if (path === '/monitor/scrape_pools/list')
      return Promise.resolve({ items: [{ id: 3, name: '测试池' }], total: 1 });
    return Promise.resolve({ items: [], total: 0 });
  });
  client.put.mockResolvedValue({});
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function start(edit = true) {
  wrapper = mount(MonitorScrapeJob, {
    attachTo: document.body,
    global: { plugins: [Antd], stubs: { Icon: true } },
  });
  await flushPromises();
  if (edit) {
    await wrapper
      .findAll('button')
      .find((item) => item.text().replace(/\s/g, '') === '编辑')!
      .trigger('click');
    await flushPromises();
  }
}
async function action(value: string) {
  const input = document.querySelector<HTMLInputElement>(
    `input[type="radio"][value="${value}"]`,
  );
  expect(input).not.toBeNull();
  await new DOMWrapper(input!).setValue(true);
}
async function fill(placeholder: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(
    `input[placeholder="${placeholder}"]`,
  );
  expect(input).not.toBeNull();
  await new DOMWrapper(input!).setValue(value);
}
async function footer(save = true) {
  const pattern = save ? /^(确定|保存|OK)$/ : /^(取消|Cancel)$/;
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>('.ant-modal-footer button'),
  ].find((item) => pattern.test(item.textContent?.replace(/\s/g, '') || ''))!;
  expect(button).toBeDefined();
  button.click();
  await flushPromises();
}
function payload() {
  return client.put.mock.calls.at(-1)![1];
}

describe('采集任务凭据更新合同', () => {
  it('默认保留只省略bearer_token，不回传脱敏占位或空字符串', async () => {
    await start();
    await footer();
    expect(client.put).toHaveBeenCalledTimes(1);
    expect(payload()).not.toHaveProperty('bearer_token');
    expect(payload()).not.toHaveProperty('has_bearer_token');
    expect(payload().bearer_token_file).toBe('');
  });

  it('显式清除才传空字符串', async () => {
    await start();
    await action('clear');
    await footer();
    expect(payload().bearer_token).toBe('');
  });

  it('替换使用新输入，文件认证切到Token必须清空文件字段', async () => {
    record.has_bearer_token = false;
    record.bearer_token_file = '/run/token';
    await start();
    await action('replace');
    await fill('请输入新的Bearer Token', 'offline-new-token');
    await footer();
    expect(client.put).not.toHaveBeenCalled();
    await fill('请输入Bearer Token文件路径', '');
    await footer();
    expect(payload()).toEqual(
      expect.objectContaining({
        bearer_token: 'offline-new-token',
        bearer_token_file: '',
      }),
    );
  });

  it('已有Token切到文件需显式清除，默认保留不静默删除', async () => {
    await start();
    await fill('请输入Bearer Token文件路径', '/run/next-token');
    await footer();
    expect(client.put).not.toHaveBeenCalled();
    await action('clear');
    await footer();
    expect(payload()).toEqual(
      expect.objectContaining({
        bearer_token: '',
        bearer_token_file: '/run/next-token',
      }),
    );
  });

  it('替换空值拒绝保存，取消不调用写API', async () => {
    await start();
    await action('replace');
    await footer();
    expect(client.put).not.toHaveBeenCalled();
    await fill('请输入新的Bearer Token', 'offline-cancelled-token');
    await footer(false);
    expect(client.put).not.toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalled();
  });

  it('详情只显示配置状态，旧服务残留原文也不填入编辑框', async () => {
    record.bearer_token = 'legacy-value-must-not-copy';
    await start(false);
    await wrapper!
      .findAll('button')
      .find((item) => item.text().replace(/\s/g, '') === '查看')!
      .trigger('click');
    await flushPromises();
    expect(document.querySelector('.ant-modal-body')?.textContent).toContain(
      '已配置',
    );
    expect(document.body.textContent).not.toContain(
      'legacy-value-must-not-copy',
    );
    const edit = [
      ...document.querySelectorAll<HTMLButtonElement>('.ant-modal-body button'),
    ].find((item) => item.textContent?.replace(/\s/g, '') === '编辑')!;
    edit.click();
    await flushPromises();
    expect(
      [
        ...document.querySelectorAll<HTMLInputElement>('.ant-modal-body input'),
      ].some((item) => item.value === 'legacy-value-must-not-copy'),
    ).toBe(false);
    await footer();
    expect(payload()).not.toHaveProperty('bearer_token');
  });

  it('切换启停状态保留Token文件和其他配置，不发送Token原文', async () => {
    record.has_bearer_token = false;
    record.bearer_token_file = '/run/token';
    await start(false);
    await wrapper!
      .findAll('button')
      .find((item) => item.text().includes('更多'))!
      .trigger('mouseenter');
    await new Promise((resolve) => setTimeout(resolve, 180));
    await flushPromises();
    const menu = [
      ...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item'),
    ].find((item) => item.textContent?.includes('禁用'))!;
    expect(menu).toBeDefined();
    menu.click();
    await flushPromises();
    expect(payload()).toEqual(
      expect.objectContaining({
        bearer_token_file: '/run/token',
        tls_ca_content: 'public CA',
        relabel_configs_yaml_string: '[]',
        tree_node_ids: ['8'],
        tags: ['test'],
      }),
    );
    expect(payload()).not.toHaveProperty('bearer_token');
  });
});
