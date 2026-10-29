import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import CloudResourceManager from './CloudResourceManager.vue';
import { getTreeNodeCloudResourcesApi } from '#/api/core/tree/tree_cloud';
import { downloadCsv } from '#/utils/export-csv';
import { markRequestLayerNotice } from '#/utils/permission/request-notice';

vi.mock('#/utils/export-csv', () => ({ downloadCsv: vi.fn() }));

const permissions = vi.hoisted(() => ({ check: vi.fn((_code: string) => true) }));

// FE-02：权限匹配细节在 utils/permission/*.test.ts 中验证
vi.mock('#/utils/permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/utils/permission')>()),
  usePermission: () => ({ can: permissions.check, hasPerm: permissions.check }),
}));

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
  permissions.check.mockReturnValue(true);
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
          { ...account(8), name: '腾讯账户', provider: 2 },
          { ...account(11), name: 'AWS账户', provider: 3 },
          { ...account(12), name: 'Azure账户', provider: 5 },
          { ...account(13), name: '华为账户', provider: 4 },
          { ...account(14), name: 'GCP账户', provider: 6 },
          { ...account(15), name: 'AWS临时账户', provider: 3, credential_type: 'temporary' },
          { ...account(9), name: '已禁用账户', status: 2 },
        ],
        total: 7,
      });
    if (path.startsWith('/tree/cloud/account/') && path.endsWith('/detail'))
      {
      const id = Number(path.split('/').at(-2));
      const value = account(id);
      return Promise.resolve({ ...value, credential_type: id === 15 ? 'temporary' : 'long_term', provider: id === 8 ? 2 : id === 11 || id === 15 ? 3 : id === 12 ? 5 : id === 13 ? 4 : id === 14 ? 6 : 1,
        regions: id === 13 ? value.regions.map((region) => ({ ...region, project_id: 'project-test' })) : value.regions });
    }
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
  it.each(['/api/tree/cloud/sync', '/api/tree/cloud/account/list', '/api/tree/cloud/account/:id/detail'])(
    '缺少 %s 权限时不开放同步入口', async (missing) => {
      permissions.check.mockImplementation((code: string) => code !== missing);
      await start();
      expect(wrapper!.find('[aria-label="同步资源"]').exists()).toBe(false);
      if (missing === '/api/tree/cloud/account/list') {
        expect(client.get.mock.calls.some((call) => call[0] === '/tree/cloud/account/list')).toBe(false);
      }
      expect(client.post).not.toHaveBeenCalled();
    },
  );
  it('地域请求期间撤销权限会丢弃迟到结果并关闭同步入口', async () => {
    const allowed = ref(true);
    permissions.check.mockImplementation((code: string) =>
      code !== '/api/tree/cloud/account/:id/detail' || allowed.value,
    );
    const late = Promise.withResolvers<unknown>();
    const original = client.get.getMockImplementation()!;
    client.get.mockImplementation((path: string, ...rest: unknown[]) =>
      path === '/tree/cloud/account/7/detail' ? late.promise : original(path, ...rest),
    );
    await open();
    allowed.value = false;
    await flushPromises();
    late.resolve(account());
    await flushPromises();
    expect(wrapper!.find('[aria-label="同步资源"]').exists()).toBe(false);
    expect(document.querySelector('.cloud-sync-form')?.textContent ?? '').not.toContain('杭州');
    expect(client.post).not.toHaveBeenCalled();
  });
  it('展示真实币种并将缺失费用标为未知', async () => {
    const original = client.get.getMockImplementation()!;
    client.get.mockImplementation((path: string, ...rest: unknown[]) =>
      path === '/tree/cloud/list'
        ? Promise.resolve({ items: [
            { ...resource, name: '有费用', monthly_cost: 12.5, currency: 'USD' },
            { ...resource, id: 2, name: '费用未知', monthly_cost: 0, currency: 'USD' },
          ], total: 2 })
        : original(path, ...rest),
    );
    await start();
    const rows = wrapper!.findAll('tbody tr.ant-table-row');
    expect(rows[0]!.text()).toContain('USD');
    expect(rows[0]!.text()).not.toContain('¥');
    expect(rows[1]!.text()).toContain('未知');
  });
  it('导出不将未知资源数据当成零成本', async () => {
    await start();
    const instance = wrapper!.vm as unknown as { $: { setupState: { handleExportCurrent: () => void } } };
    instance.$.setupState.handleExportCurrent();
    await flushPromises();
    expect(downloadCsv).toHaveBeenCalledOnce();
    const rows = vi.mocked(downloadCsv).mock.calls[0]![1];
    const costIndex = rows[0]!.indexOf('月成本');
    expect(rows[1]![costIndex]).toBe('未知');
  });
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
  it.each([{ name: '腾讯账户', id: 8 }, { name: 'AWS账户', id: 11 }])(
    '$name 可选择已授权地域并同步',
    async ({ name, id }) => {
      await open();
      await select('cloud-sync-account', name);
      expect(client.get).toHaveBeenCalledWith(`/tree/cloud/account/${id}/detail`);
      await select('cloud-sync-regions', '深圳');
      await button('开始同步', '.ant-modal-footer button');
      expect(client.post).toHaveBeenCalledWith('/tree/cloud/sync', expect.objectContaining({
        cloud_account_id: id, cloud_account_region_ids: [41], resource_types: [1], sync_mode: 'incremental',
      }));
    },
  );
  it('AWS 临时凭据可选择经过事务保护的全量同步', async () => {
    await open();
    await select('cloud-sync-account', 'AWS临时账户');
    await select('cloud-sync-regions', '深圳');
    const radio = document.querySelector<HTMLInputElement>('.cloud-sync-form input[type="radio"][value="full"]');
    expect(radio?.disabled).toBe(false);
    radio!.click();
    await flushPromises();
    await button('开始同步', '.ant-modal-footer button');
    expect(client.post).toHaveBeenCalledWith('/tree/cloud/sync', expect.objectContaining({
      cloud_account_id: 15, cloud_account_region_ids: [41], sync_mode: 'full',
    }));
  });
  it('华为云仅允许指定一个地域和实例UUID的增量同步', async () => {
    await open();
    await select('cloud-sync-account', '华为账户');
    await button('开始同步', '.ant-modal-footer button');
    expect(client.post).not.toHaveBeenCalled();
    await select('cloud-sync-regions', '深圳');
    const input = document.querySelector<HTMLInputElement>('#cloud-sync-instance-ids')!;
    expect(input).toBeTruthy();
    await new DOMWrapper(input).setValue('12345678-1234-1234-1234-123456789abc');
    await flushPromises();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true });
    Object.defineProperty(enter, 'which', { value: 13 });
    input.dispatchEvent(enter);
    await flushPromises();
    await button('开始同步', '.ant-modal-footer button');
    expect(client.post).toHaveBeenCalledWith('/tree/cloud/sync', expect.objectContaining({
      cloud_account_id: 13, cloud_account_region_ids: [41], sync_mode: 'incremental',
      instance_ids: ['12345678-1234-1234-1234-123456789abc'],
    }));
  });
  it.each([
    { name: 'Azure账户', id: 12, instance: '12345678-1234-1234-1234-123456789abc' },
    { name: 'GCP账户', id: 14, instance: '1234567890123456789' },
  ])('$name 仅允许指定地域和实例的增量同步', async ({ name, id, instance }) => {
    await open();
    await select('cloud-sync-account', name);
    await button('开始同步', '.ant-modal-footer button');
    expect(client.post).not.toHaveBeenCalled();
    await select('cloud-sync-regions', '深圳');
    const input = document.querySelector<HTMLInputElement>('#cloud-sync-instance-ids')!;
    await new DOMWrapper(input).setValue(instance);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true });
    Object.defineProperty(enter, 'which', { value: 13 });
    input.dispatchEvent(enter);
    await flushPromises();
    await button('开始同步', '.ant-modal-footer button');
    expect(client.post).toHaveBeenCalledWith('/tree/cloud/sync', expect.objectContaining({
      cloud_account_id: id, cloud_account_region_ids: [41], sync_mode: 'incremental', instance_ids: [instance],
    }));
  });
  it('部分成功时保留地域结果和历史编号供核对', async () => {
    client.post.mockResolvedValueOnce({ status: 'partial', total_count: 1, new_count: 1, update_count: 0, delete_count: 0, failed_count: 1,
      regions: [{ region_id: 41, region: '深圳', status: 'failed', history_id: 22, retry_safe: true }] });
    await open();
    await button('开始同步', '.ant-modal-footer button');
    expect(document.querySelector('[aria-label="地域同步结果"]')?.textContent).toContain('深圳：失败');
    expect(document.querySelector('[aria-label="地域同步结果"]')?.textContent).toContain('22');
  });
  it('地域审计不可用时展示结果并阻止直接重试', async () => {
    client.post.mockResolvedValueOnce({ status: 'failed', total_count: 0, new_count: 0, update_count: 0, delete_count: 0, failed_count: 1,
      regions: [{ region_id: 41, region: '深圳', status: 'failed', error_category: 'audit_unavailable', retry_safe: false }] });
    await open();
    await button('开始同步', '.ant-modal-footer button');
    expect(document.querySelector('[aria-label="地域同步结果"]')?.textContent).toContain('不可直接重试');
    expect(document.querySelector<HTMLButtonElement>('.ant-modal-footer .ant-btn-primary')?.disabled).toBe(true);
  });
  it('结果未知时保留提示并禁止直接重复提交', async () => {
    client.post.mockResolvedValueOnce({ status: 'unknown', total_count: 0, new_count: 0, update_count: 0, delete_count: 0, failed_count: 0 });
    await open();
    await button('开始同步', '.ant-modal-footer button');
    expect(document.querySelector('.cloud-sync-form')?.textContent).toContain('结果不确定');
    expect(document.querySelector<HTMLButtonElement>('.ant-modal-footer .ant-btn-primary')?.disabled).toBe(true);
    expect(client.post).toHaveBeenCalledTimes(1);
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
      '同步结果不确定',
    );
    expect(document.querySelector('.cloud-sync-form')?.textContent).toContain(
      '北京',
    );
    await button('取消', '.ant-modal-footer button');
  });
  it.each([
    ['HTTP 500', 'http-error:内部服务器错误'],
    ['HTTP 409', 'http-error:数据已变化，请刷新后重试'],
  ])('incr3 P3-4：%s 请求层已提示时，用同一 key 换成带「检查同步历史」引导的文案，只一条', async (_label, key) => {
    const error = Object.assign(new Error('Request failed'), { response: { status: 500 } });
    markRequestLayerNotice(error, key);
    client.post.mockRejectedValue(error);
    await open();
    await select('cloud-sync-regions', '北京');
    const spy = vi.spyOn(message, 'error');
    await button('开始同步', '.ant-modal-footer button');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({
      content: '同步结果不确定，请先核对资源和同步历史',
      key,
    });
  });
  it.each([
    Object.assign(new Error('Error 403'), { [Symbol.for('ai-cloudops.permissionDenied')]: true }),
    Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' }),
  ])('权限或取消错误不覆盖请求提示，且中断后禁止直接重试', async (error) => {
    await open();
    await select('cloud-sync-regions', '北京');
    const spy = vi.spyOn(message, 'error');
    client.post.mockRejectedValueOnce(error);
    await button('开始同步', '.ant-modal-footer button');
    expect(spy).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLButtonElement>('.ant-modal-footer .ant-btn-primary')?.disabled).toBe(true);
  });
  it('未知请求错误提示先核对，禁止直接重试', async () => {
    await open();
    await select('cloud-sync-regions', '北京');
    const spy = vi.spyOn(message, 'error');
    client.post.mockRejectedValueOnce(new Error('fixture'));
    await button('开始同步', '.ant-modal-footer button');
    expect(spy).toHaveBeenCalledWith('同步结果不确定，请先核对资源和同步历史');
    expect(document.querySelector<HTMLButtonElement>('.ant-modal-footer .ant-btn-primary')?.disabled).toBe(true);
  });
  it('不支持的云厂商及非ECS存量只读，开放腾讯和AWS同步账户', async () => {
    const original = client.get.getMockImplementation()!;
    client.get.mockImplementation((path: string, ...rest: unknown[]) =>
      path === '/tree/cloud/list'
        ? Promise.resolve({
            items: [
              {
                ...resource,
                name: '未知厂商存量资源',
                cloud_account_id: 99,
                cloud_account: { id: 99, provider: 99 },
              },
              { ...resource, id: 2, name: '阿里存量RDS', resource_type: 2 },
            ],
            total: 2,
          })
        : original(path, ...rest),
    );
    await open();
    const row = wrapper!.find('tbody tr.ant-table-row');
    expect(row.text()).toContain('未知厂商存量资源');
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
    expect(options.some((label) => label?.includes('腾讯'))).toBe(true);
    expect(options.some((label) => label?.includes('AWS'))).toBe(true);
    expect(options.some((label) => label?.includes('华为'))).toBe(true);
    expect(options.some((label) => label?.includes('Azure'))).toBe(true);
    expect(options.some((label) => label?.includes('GCP'))).toBe(true);
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
