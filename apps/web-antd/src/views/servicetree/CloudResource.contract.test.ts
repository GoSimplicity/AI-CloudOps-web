import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CloudResourceManager from './CloudResourceManager.vue';
import { getTreeNodeCloudResourcesApi } from '#/api/core/tree/tree_cloud';

const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const account = (id = 7) => ({
  id,
  name: id === 7 ? '主阿里账户' : '第二阿里账户',
  provider: 1,
  status: 1,
  regions:
    id === 7
      ? [
          {
            id: 21,
            region: 'cn-hangzhou',
            region_name: '杭州',
            status: 1,
            is_default: true,
          },
          { id: 22, region: 'cn-shanghai', region_name: '上海', status: 2 },
          { id: 23, region: 'cn-beijing', region_name: '北京', status: 1 },
        ]
      : [
          {
            id: 41,
            region: 'cn-shenzhen',
            region_name: '深圳',
            status: 1,
            is_default: true,
          },
        ],
});
const resource = {
  id: 1,
  name: '已有资源',
  resource_type: 1,
  status: 1,
  cloud_account_id: 7,
  cloud_account: { id: 7, provider: 1 },
  tags: [],
  tree_nodes: [],
  cpu: 1,
  memory: 1,
  disk: 1,
  monthly_cost: 0,
  currency: 'CNY',
  port: 22,
  auth_mode: 1,
};
let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.resetAllMocks();
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
    if (path === '/tree/cloud/list')
      return Promise.resolve({ items: [resource], total: 30 });
    if (path === '/tree/cloud/account/list')
      return Promise.resolve({
        items: [
          account(),
          account(10),
          { ...account(8), name: '腾讯存量', provider: 2 },
          { ...account(9), name: '已禁用账户', status: 2 },
        ],
        total: 4,
      });
    if (path.startsWith('/tree/cloud/account/') && path.endsWith('/detail'))
      return Promise.resolve(account(Number(path.split('/').at(-2))));
    return Promise.resolve({ items: [], total: 0 });
  });
  client.post.mockResolvedValue({
    total_count: 3,
    new_count: 1,
    update_count: 2,
    delete_count: 0,
    failed_count: 0,
    failed_instances: [],
    sync_time: '2026-10-23T00:00:00Z',
  });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  Modal.destroyAll();
  message.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function start() {
  wrapper = mount(CloudResourceManager, {
    attachTo: document.body,
    global: { plugins: [Antd] },
  });
  await flushPromises();
}
async function button(text: string, selector = 'button') {
  const target = [
    ...document.querySelectorAll<HTMLButtonElement>(selector),
  ].find((element) => element.textContent?.replace(/\s/g, '') === text);
  expect(target).toBeDefined();
  target!.click();
  await flushPromises();
}
async function open() {
  await start();
  await button('同步资源');
  await flushPromises();
}
async function select(id: string, label: string) {
  const input = document.getElementById(id);
  expect(input).not.toBeNull();
  await new DOMWrapper(input!.closest('.ant-select')!)
    .find('.ant-select-selector')
    .trigger('mousedown');
  await flushPromises();
  const option = [
    ...document.querySelectorAll<HTMLElement>(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
    ),
  ].find((element) => element.textContent?.includes(label));
  expect(option).toBeDefined();
  option!.click();
  await flushPromises();
}
describe('云资源真实控件合同', () => {
  it('普通资源分页使用size，节点资源专用分页才使用page_size', async () => {
    await start();
    await wrapper!.find('.ant-pagination-item-2 a').trigger('click');
    await flushPromises();
    const params = client.get.mock.calls
      .filter((call) => call[0] === '/tree/cloud/list')
      .at(-1)![1].params;
    expect(params).toEqual(expect.objectContaining({ page: 2, size: 10 }));
    expect(params).not.toHaveProperty('page_size');
    await getTreeNodeCloudResourcesApi(3, { page: 2, page_size: 20 });
    expect(client.get).toHaveBeenLastCalledWith('/tree/cloud/3/node', {
      params: { page: 2, page_size: 20 },
    });
  });
  it('同步使用新鲜地域记录ID和数值ECS，默认增量，确认前及取消不写API', async () => {
    await open();
    expect(client.get).toHaveBeenCalledWith('/tree/cloud/account/7/detail');
    expect(client.post).not.toHaveBeenCalled();
    const ecs = document.querySelector<HTMLInputElement>(
      '.ant-modal input[type="checkbox"][value="1"]',
    );
    expect(ecs?.checked).toBe(true);
    const rds = document.querySelector<HTMLInputElement>(
      '.ant-modal input[type="checkbox"][value="2"]',
    );
    expect(rds?.disabled).toBe(true);
    await select('cloud-sync-regions', '北京');
    await button('开始同步', '.ant-modal-footer button');
    expect(client.post).toHaveBeenCalledWith(
      '/tree/cloud/sync',
      expect.objectContaining({
        cloud_account_id: 7,
        cloud_account_region_ids: [23],
        resource_types: [1],
        sync_mode: 'incremental',
      }),
    );
    expect(client.post.mock.calls[0]![1]).not.toHaveProperty('regions');
    expect(
      client.get.mock.calls.every(
        (call) => !String(call[0]).includes('available-regions'),
      ),
    ).toBe(true);
  });
  it('同步取消不发送请求，迟到的旧账户地域不能污染新账户', async () => {
    const late = Promise.withResolvers<unknown>();
    const original = client.get.getMockImplementation()!;
    client.get.mockImplementation((path: string, ...rest: unknown[]) =>
      path === '/tree/cloud/account/7/detail'
        ? late.promise
        : original(path, ...rest),
    );
    await open();
    await select('cloud-sync-account', '第二阿里账户');
    await select('cloud-sync-regions', '深圳');
    late.resolve(account());
    await flushPromises();
    expect(
      document.querySelector('.cloud-sync-form')?.textContent,
    ).not.toContain('杭州');
    await button('取消', '.ant-modal-footer button');
    expect(client.post).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
  });
  it('部分失败显示部分完成，缺失计数不伪造全0成功', async () => {
    client.post.mockResolvedValue({
      total_count: 3,
      new_count: 1,
      update_count: 1,
      delete_count: 0,
      failed_count: 1,
      failed_instances: ['fixture'],
    });
    await open();
    await button('开始同步', '.ant-modal-footer button');
    expect(
      document.querySelector('.ant-message-warning')?.textContent,
    ).toContain('部分完成');
    client.post.mockResolvedValue({});
    await button('同步资源');
    await flushPromises();
    await button('开始同步', '.ant-modal-footer button');
    expect(document.querySelector('.ant-message-error')?.textContent).toContain(
      '结果',
    );
  });
  it('读取地域失败阻止同步，可重试恢复且不发送停用地域', async () => {
    const original = client.get.getMockImplementation()!;
    let fail = true;
    client.get.mockImplementation((path: string, ...rest: unknown[]) =>
      path === '/tree/cloud/account/7/detail' && fail
        ? Promise.reject(new Error('fixture'))
        : original(path, ...rest),
    );
    await open();
    expect(
      document.querySelector('.cloud-sync-form .ant-alert-error')?.textContent,
    ).toContain('读取账户地域失败');
    const submit = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.ant-modal-footer button',
      ),
    ].find((element) => element.textContent?.replace(/\s/g, '') === '开始同步');
    expect(submit?.disabled).toBe(true);
    expect(client.post).not.toHaveBeenCalled();
    fail = false;
    await button('重试读取地域');
    await new DOMWrapper(
      document.getElementById('cloud-sync-regions')!.closest('.ant-select')!,
    )
      .find('.ant-select-selector')
      .trigger('mousedown');
    await flushPromises();
    expect(
      [...document.querySelectorAll('.ant-select-item-option')].some(
        (element) => element.textContent?.includes('上海'),
      ),
    ).toBe(false);
    await button('开始同步', '.ant-modal-footer button');
    expect(client.post.mock.calls[0]![1].cloud_account_region_ids).toEqual([]);
  });
  it('提交期间冻结表单、重复确认只写一次，失败保留选择', async () => {
    const pending = Promise.withResolvers<unknown>();
    client.post.mockReturnValue(pending.promise);
    await open();
    await select('cloud-sync-regions', '北京');
    await button('开始同步', '.ant-modal-footer button');
    await button('开始同步', '.ant-modal-footer button');
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(
      document.querySelector<HTMLInputElement>('#cloud-sync-account')?.disabled,
    ).toBe(true);
    pending.reject(new Error('fixture'));
    await flushPromises();
    expect(document.querySelector('.ant-message-error')?.textContent).toContain(
      '同步失败',
    );
    expect(document.querySelector('.cloud-sync-form')?.textContent).toContain(
      '北京',
    );
    await button('取消', '.ant-modal-footer button');
  });
  it('非阿里云及非ECS存量只读，不开放不支持的同步账户', async () => {
    const original = client.get.getMockImplementation()!;
    client.get.mockImplementation((path: string, ...rest: unknown[]) =>
      path === '/tree/cloud/list'
        ? Promise.resolve({
            items: [
              {
                ...resource,
                name: '腾讯存量资源',
                cloud_account_id: 8,
                cloud_account: { id: 8, provider: 2 },
              },
              { ...resource, id: 2, name: '阿里存量RDS', resource_type: 2 },
            ],
            total: 2,
          })
        : original(path, ...rest),
    );
    await open();
    const row = wrapper!.find('tbody tr.ant-table-row');
    expect(row.text()).toContain('腾讯存量资源');
    expect(
      row
        .findAll('button')
        .filter((button) => button.attributes('disabled') !== undefined).length,
    ).toBeGreaterThanOrEqual(3);
    const rds = wrapper!
      .findAll('tbody tr.ant-table-row')
      .find((row) => row.text().includes('阿里存量RDS'));
    expect(rds).toBeDefined();
    expect(
      rds!
        .findAll('button')
        .filter((button) => button.attributes('disabled') !== undefined).length,
    ).toBeGreaterThanOrEqual(2);
    await new DOMWrapper(
      document.getElementById('cloud-sync-account')!.closest('.ant-select')!,
    )
      .find('.ant-select-selector')
      .trigger('mousedown');
    await flushPromises();
    const options = [
      ...document.querySelectorAll('.ant-select-item-option'),
    ].map((element) => element.textContent);
    expect(options.some((label) => label?.includes('腾讯'))).toBe(false);
    expect(options.some((label) => label?.includes('禁用'))).toBe(false);
    await button('取消', '.ant-modal-footer button');
    expect(client.post).not.toHaveBeenCalled();
  });
  it('账户列表读取失败展示重试，不误报需要创建账户', async () => {
    const original = client.get.getMockImplementation()!;
    let fail = true;
    client.get.mockImplementation((path: string, ...rest: unknown[]) =>
      path === '/tree/cloud/account/list' && fail
        ? Promise.reject(new Error('fixture'))
        : original(path, ...rest),
    );
    await start();
    expect(wrapper!.text()).toContain('读取云账户失败');
    await button('同步资源');
    expect(document.querySelector('.ant-modal')).toBeNull();
    expect(
      document.querySelector('.ant-message-warning')?.textContent,
    ).toContain('重试读取');
    fail = false;
    await button('重试读取账户');
    await button('同步资源');
    expect(document.getElementById('cloud-sync-regions')).not.toBeNull();
    expect(client.post).not.toHaveBeenCalled();
  });
});
