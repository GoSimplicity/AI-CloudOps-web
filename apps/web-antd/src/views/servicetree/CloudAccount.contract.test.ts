import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CloudAccountManagement from './CloudAccountManagement.vue';
import AccountRegionsEditor from './cloudaccountmanagement/AccountRegionsEditor.vue';

const permissions = vi.hoisted(() => ({ allowed: null as null | string[] }));
// 验证按钮权限以及操作本身
vi.mock('#/utils/permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/utils/permission')>()),
  usePermission: () => ({ can: (key: string) => permissions.allowed === null || permissions.allowed.includes(key), hasPerm: (code: string) => permissions.allowed === null || permissions.allowed.includes(code) }),
}));

const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
let wrapper: VueWrapper | undefined;
let selectedProvider = 1;
const record = () => ({
  id: 7,
  name: '已有账户',
  provider: selectedProvider,
  status: 1,
  regions: [
    {
      id: 21,
      region: 'cn-hangzhou',
      region_name: '杭州',
      is_default: true,
      description: '原描述',
      status: 1,
    },
    {
      id: 22,
      region: 'cn-shanghai',
      region_name: '上海',
      is_default: false,
      description: '保留描述',
      status: 2,
    },
  ],
});
beforeEach(() => {
  vi.resetAllMocks();
  permissions.allowed = null;
  selectedProvider = 1;
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
  client.get.mockImplementation((path: string) =>
    Promise.resolve(
      path.endsWith('/detail') ? record() : { items: [record()], total: 30 },
    ),
  );
  client.post.mockResolvedValue(undefined);
  client.put.mockResolvedValue(undefined);
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
  wrapper = mount(CloudAccountManagement, {
    attachTo: document.body,
    global: { plugins: [Antd] },
  });
  await flushPromises();
}
async function action(text: string, selector = 'button') {
  const found = [
    ...document.querySelectorAll<HTMLButtonElement>(selector),
  ].find((item) => item.textContent?.replace(/\s/g, '') === text);
  expect(found, `missing action ${text}`).toBeDefined();
  found!.click();
  await flushPromises();
}
async function fill(placeholder: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(
    `input[placeholder="${placeholder}"]`,
  );
  expect(input).not.toBeNull();
  await new DOMWrapper(input!).setValue(value);
}
async function edit() {
  const icon = wrapper!.find('[aria-label="edit"]');
  expect(icon.exists()).toBe(true);
  (icon.element.closest('button') as HTMLButtonElement).click();
  await flushPromises();
}
async function addRegion(code: string) {
  const input = document.querySelector<HTMLInputElement>(
    '#account-region-codes',
  );
  expect(input).not.toBeNull();
  await new DOMWrapper(input!.closest('.ant-select')!)
    .find('.ant-select-selector')
    .trigger('mousedown');
  await flushPromises();
  await new DOMWrapper(input!).setValue(code);
  await flushPromises();
  const option = [
    ...document.querySelectorAll<HTMLElement>('.ant-select-item-option'),
  ].find((item) => item.getAttribute('title') === code);
  expect(option).toBeDefined();
  option!.click();
  await flushPromises();
}
describe('云账户真实表单合同', () => {
  it('创建提交regions数组，接受空成功结果，不隐式验证或删除', async () => {
    await start();
    await action('添加账户');
    await fill('请输入云账户名称', '多地域账户');
    await fill('请输入 Access Key', 'offline-access-key');
    await fill('请输入 Secret Key', 'offline-secret-key');
    await addRegion('cn-hangzhou');
    await addRegion('cn-shanghai');
    await action('添加', '.ant-modal-footer button');
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.post.mock.calls[0]).toEqual([
      '/tree/cloud/account/create',
      expect.objectContaining({
        regions: [
          {
            region: 'cn-hangzhou',
            region_name: '',
            description: '',
            is_default: true,
          },
          {
            region: 'cn-shanghai',
            region_name: '',
            description: '',
            is_default: false,
          },
        ],
      }),
    ]);
    expect(client.post.mock.calls[0]![1]).not.toHaveProperty('region');
    expect(client.delete).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('验证并添加');
  });
  it('编辑先读完整详情，未改地域省略，保留全部现有地域', async () => {
    await start();
    await edit();
    expect(client.get).toHaveBeenCalledWith('/tree/cloud/account/7/detail');
    expect(
      document.querySelector('.account-regions-editor')?.textContent,
    ).toContain('cn-hangzhou');
    expect(
      document.querySelector('.account-regions-editor')?.textContent,
    ).toContain('cn-shanghai');
    await fill('请输入云账户名称', '只改名称');
    await action('更新', '.ant-modal-footer button');
    expect(client.put).toHaveBeenCalledTimes(1);
    expect(client.put.mock.calls[0]![1]).not.toHaveProperty('regions');
    expect(client.put.mock.calls[0]![1]).not.toHaveProperty('access_key');
    expect(client.put.mock.calls[0]![1]).not.toHaveProperty('secret_key');
  });
  it('增加地域时提交完整选中集合，原地域元数据不丢失', async () => {
    await start();
    await edit();
    await addRegion('cn-beijing');
    await action('更新', '.ant-modal-footer button');
    const payload = client.put.mock.calls[0]![1];
    expect(payload.regions).toEqual([
      {
        region: 'cn-hangzhou',
        region_name: '杭州',
        is_default: true,
        description: '原描述',
      },
      {
        region: 'cn-shanghai',
        region_name: '上海',
        is_default: false,
        description: '保留描述',
      },
      {
        region: 'cn-beijing',
        region_name: '',
        is_default: false,
        description: '',
      },
    ]);
  });
  it('取消创建不写入，取消详情读取不重新打开编辑框', async () => {
    await start();
    await action('添加账户');
    await action('取消', '.ant-modal-footer button');
    expect(client.post).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
    const late = Promise.withResolvers<unknown>();
    client.get.mockImplementation((path: string) =>
      path.endsWith('/detail')
        ? late.promise
        : Promise.resolve({ items: [record()], total: 30 }),
    );
    const icon = wrapper!.find('[aria-label="edit"]');
    (icon.element.closest('button') as HTMLButtonElement).click();
    await flushPromises();
    await action('取消', '.ant-modal-footer button');
    late.resolve(record());
    await flushPromises();
    expect(document.querySelector('.ant-modal[role="dialog"]')).toBeNull();
    expect(client.put).not.toHaveBeenCalled();
  });
  it('普通账户分页使用size且不发送伪region筛选', async () => {
    await start();
    await wrapper!.find('.ant-pagination-item-2 a').trigger('click');
    await flushPromises();
    const params = client.get.mock.calls
      .filter((call) => call[0] === '/tree/cloud/account/list')
      .at(-1)![1].params;
    expect(params).toEqual(expect.objectContaining({ page: 2, size: 10 }));
    expect(params).not.toHaveProperty('page_size');
    expect(params).not.toHaveProperty('region');
  });
});

it('凭据验证必须显式确认，失败也不删除已创建账户', async () => {
  await start();
  const verify = wrapper!.find('[aria-label="safety-certificate"]');
  expect(verify.exists()).toBe(true);
  (verify.element.closest('button') as HTMLButtonElement).click();
  await flushPromises();
  expect(client.post).not.toHaveBeenCalled();
  await action('取消', '.ant-modal-confirm-btns button');
  client.post.mockRejectedValue(new Error('offline verification fixture'));
  (verify.element.closest('button') as HTMLButtonElement).click();
  await flushPromises();
  await action('开始验证', '.ant-modal-confirm-btns button');
  expect(client.post.mock.calls).toEqual([['/tree/cloud/account/7/verify']]);
  expect(client.delete).not.toHaveBeenCalled();
  expect(wrapper!.text()).toContain('已有账户');
});

it('重复点击提交只创建一次，错误保留表单便于重试', async () => {
  await start();
  await action('添加账户');
  await fill('请输入云账户名称', '防重复账户');
  await fill('请输入 Access Key', 'offline-access-key');
  await fill('请输入 Secret Key', 'offline-secret-key');
  await addRegion('cn-hangzhou');
  const pending = Promise.withResolvers<unknown>();
  client.post.mockReturnValue(pending.promise);
  const submit = [
    ...document.querySelectorAll<HTMLButtonElement>('.ant-modal-footer button'),
  ].find((button) => button.textContent?.replace(/\s/g, '') === '添加')!;
  submit.click();
  submit.click();
  await flushPromises();
  expect(client.post).toHaveBeenCalledTimes(1);
  pending.reject(new Error('fixture unavailable'));
  await flushPromises();
  expect(
    (
      document.querySelector(
        'input[placeholder="请输入云账户名称"]',
      ) as HTMLInputElement
    ).value,
  ).toBe('防重复账户');
  expect(client.delete).not.toHaveBeenCalled();
});

it.each([2, 3])('已支持的云厂商 %i 可读取并编辑账户', async (provider) => {
  selectedProvider = provider;
  await start();
  expect(wrapper!.find('.account-table').text()).toContain(provider === 2 ? '腾讯云' : 'AWS');
  const button = wrapper!.find('[aria-label="edit"]').element.closest('button') as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  await edit();
  await fill('请输入云账户名称', '已编辑');
  await action('更新', '.ant-modal-footer button');
  expect(client.put).toHaveBeenCalledWith('/tree/cloud/account/7/update', expect.not.objectContaining({ access_key: expect.anything(), secret_key: expect.anything() }));
});

it.each([4, 5, 6])('未实现的厂商 %i 账户保持只读', async (provider) => {
  selectedProvider = provider;
  await start();
  const button = wrapper!.find('[aria-label="edit"]').element.closest('button') as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  button.click();
  expect(client.post).not.toHaveBeenCalled();
});

async function chooseProvider(name: string) {
  const select = document.querySelector('.account-form .ant-select-selector');
  expect(select).not.toBeNull();
  await new DOMWrapper(select!).trigger('mousedown');
  await flushPromises();
  const option = [...document.querySelectorAll<HTMLElement>('.ant-select-item-option')].find(item => item.textContent?.trim() === name);
  expect(option, `missing provider ${name}`).toBeDefined();
  option!.click();
  await flushPromises();
}

it.each([[1, '阿里云'], [2, '腾讯云'], [3, 'AWS']] as const)('新增 %s 账户不隐式请求云平台', async (provider, label) => {
  await start();
  await action('添加账户');
  if (provider !== 1) await chooseProvider(label);
  await fill('请输入云账户名称', '新账户');
  await fill('请输入 Access Key', 'offline-access-key');
  await fill('请输入 Secret Key', 'offline-secret-key');
  await addRegion(provider === 3 ? 'us-east-1' : 'ap-beijing');
  await action('添加', '.ant-modal-footer button');
  expect(client.post).toHaveBeenCalledTimes(1);
  expect(client.post).toHaveBeenCalledWith('/tree/cloud/account/create', expect.objectContaining({ provider }));
  expect(client.get.mock.calls.some(([url]) => String(url).includes('available-regions'))).toBe(false);
});

it('AWS 临时凭据禁止提交', async () => {
  await start();
  await action('添加账户');
  await chooseProvider('AWS');
  await fill('请输入云账户名称', '临时凭据账户');
  await fill('请输入 Access Key', 'ASIAEXAMPLE123456789');
  await fill('请输入 Secret Key', 'offline-secret-key');
  await addRegion('us-east-1');
  await action('添加', '.ant-modal-footer button');
  expect(client.post).not.toHaveBeenCalled();
});

it('缺少权限隐藏相关操作，禁用账户不验证', async () => {
  permissions.allowed = ['/api/tree/cloud/account/:id/detail'];
  selectedProvider = 3;
  await start();
  expect(document.body.textContent).not.toContain('添加账户');
  expect(wrapper!.find('[aria-label="edit"]').exists()).toBe(false);
  expect(wrapper!.find('[aria-label="safety-certificate"]').exists()).toBe(false);
  expect((wrapper!.find('.ant-switch').element as HTMLButtonElement).disabled).toBe(true);
});

it('已禁用账户不允许发起真实凭据验证', async () => {
  client.get.mockResolvedValue({ items: [{ ...record(), status: 2 }], total: 1 });
  await start();
  const button = wrapper!.find('[aria-label="safety-certificate"]').element.closest('button') as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  button.click();
  expect(client.post).not.toHaveBeenCalled();
});

it.each([[1, '阿里云'], [2, '腾讯云'], [3, 'AWS']] as const)('云厂商 %s 的验证需确认且支持状态/删除操作', async (provider, label) => {
  selectedProvider = provider;
  await start();
  const verify = wrapper!.find('[aria-label="safety-certificate"]').element.closest('button') as HTMLButtonElement;
  verify.click();
  await flushPromises();
  expect(document.body.textContent).toContain(`将向${label}验证`);
  expect(client.post).not.toHaveBeenCalled();
  await action('开始验证', '.ant-modal-confirm-btns button');
  expect(client.post).toHaveBeenCalledWith('/tree/cloud/account/7/verify');
  await wrapper!.find('.ant-switch').trigger('click');
  await flushPromises();
  expect(client.put).toHaveBeenCalledWith('/tree/cloud/account/7/status', { status: 2 });
  (wrapper!.find('[aria-label="delete"]').element.closest('button') as HTMLButtonElement).click();
  await flushPromises();
  expect(client.delete).not.toHaveBeenCalled();
  await action('确定删除', '.ant-modal-confirm-btns button');
  expect(client.delete).toHaveBeenCalledWith('/tree/cloud/account/7/delete');
});

it('已保存账户云端地域查询需要确认且GET只携带账户ID', async () => {
  selectedProvider = 3;
  client.get.mockImplementation((url: string) => {
    if (url.endsWith('/detail')) return Promise.resolve(record());
    if (url.endsWith('/available-regions')) return Promise.resolve({ regions: [{ region: 'us-east-1', region_name: '美国东部', available: true }] });
    return Promise.resolve({ items: [record()], total: 1 });
  });
  await start();
  await edit();
  await action('查询云端地域');
  expect(client.get.mock.calls.filter(([url]) => String(url).includes('available-regions'))).toHaveLength(0);
  await action('确认查询', '.ant-modal-confirm-btns button');
  const calls = client.get.mock.calls.filter(([url]) => String(url).includes('available-regions'));
  expect(calls).toEqual([['/tree/cloud/account/region/available-regions', { params: { cloud_account_id: 7 } }]]);
  expect(JSON.stringify(calls)).not.toContain('access_key');
  expect(JSON.stringify(calls)).not.toContain('secret_key');
});

it('关闭账户表单后，迟到的地域查询确认不会发起请求', async () => {
  await start();
  await edit();
  await action('查询云端地域');
  await action('取消', '.modern-modal .ant-modal-footer button');
  await action('确认查询', '.ant-modal-confirm-btns button');
  expect(client.get.mock.calls.some(([url]) => String(url).includes('available-regions'))).toBe(false);
});

it('未保存账户的地域参考只传厂商，无权限时隐藏入口', async () => {
  client.get.mockImplementation((url: string) => url.endsWith('/available-regions')
    ? Promise.resolve({ regions: [{ region: 'us-east-1', region_name: '美国东部', available: true }] })
    : Promise.resolve({ items: [record()], total: 1 }));
  await start();
  await action('添加账户');
  await chooseProvider('AWS');
  await action('加载地域参考');
  const call = client.get.mock.calls.find(([url]) => String(url).includes('available-regions'));
  expect(call).toEqual(['/tree/cloud/account/region/available-regions', { params: { provider: 3 } }]);
  expect(document.body.textContent).not.toContain('查询云端地域');
});

it('地域API运行时丢弃意外传入的密钥', async () => {
  const { getAvailableRegions } = await import('#/api/core/tree/tree_account_region');
  client.get.mockResolvedValue({ regions: [] });
  await getAvailableRegions({ cloud_account_id: 7, access_key: 'test-access', secret_key: 'test-secret' } as never);
  expect(client.get).toHaveBeenCalledWith('/tree/cloud/account/region/available-regions', { params: { cloud_account_id: 7 } });
});

it('缺少地域权限时不出现查询入口', async () => {
  permissions.allowed = ['/api/tree/cloud/account/create'];
  await start();
  await action('添加账户');
  expect(document.body.textContent).not.toContain('加载地域参考');
  expect(client.get.mock.calls.some(([url]) => String(url).includes('available-regions'))).toBe(false);
});

it('删除确认期间撤销权限不会发送请求', async () => {
  await start();
  (wrapper!.find('[aria-label="delete"]').element.closest('button') as HTMLButtonElement).click();
  await flushPromises();
  permissions.allowed = [];
  await action('确定删除', '.ant-modal-confirm-btns button');
  expect(client.delete).not.toHaveBeenCalled();
});

it.each(['create', 'edit'])('异步表单校验期间撤销 %s 权限不会写入', async (operation) => {
  await start();
  if (operation === 'edit') {
    await edit();
  } else {
    await action('添加账户');
    await fill('请输入云账户名称', '测试账户');
    await fill('请输入 Access Key', 'offline-access');
    await fill('请输入 Secret Key', 'offline-secret');
  }
  const button = [...document.querySelectorAll<HTMLButtonElement>('.modern-modal .ant-modal-footer button')]
    .find(item => item.textContent?.replace(/\s/g, '') === (operation === 'edit' ? '更新' : '添加'));
  expect(button).toBeDefined();
  button!.click();
  permissions.allowed = [];
  await flushPromises();
  expect(client.post).not.toHaveBeenCalled();
  expect(client.put).not.toHaveBeenCalled();
});

it('详情读取期间撤销权限不展示迟到数据', async () => {
  const pending = Promise.withResolvers<unknown>();
  client.get.mockImplementation((url: string) => url.endsWith('/detail')
    ? pending.promise : Promise.resolve({ items: [record()], total: 1 }));
  await start();
  const icon = wrapper!.find('[aria-label="edit"]');
  (icon.element.closest('button') as HTMLButtonElement).click();
  await flushPromises();
  permissions.allowed = [];
  pending.resolve({ ...record(), name: '敏感迟到内容' });
  await flushPromises();
  expect(document.body.textContent).not.toContain('敏感迟到内容');
});

it('地域读取期间撤销权限不展示迟到结果', async () => {
  const pending = Promise.withResolvers<unknown>();
  client.get.mockReturnValue(pending.promise);
  wrapper = mount(AccountRegionsEditor, {
    attachTo: document.body,
    global: { plugins: [Antd] },
    props: { modelValue: [], provider: 1, canRead: true, accountEnabled: true },
  });
  await action('加载地域参考');
  await wrapper.setProps({ canRead: false });
  pending.resolve({ regions: [{ region: 'cn-stale', region_name: '撤权迟到地域', available: true }] });
  await flushPromises();
  await new DOMWrapper(document.querySelector('#account-region-codes')!.closest('.ant-select')!).find('.ant-select-selector').trigger('mousedown');
  await flushPromises();
  expect(document.body.textContent).not.toContain('撤权迟到地域');
});

it('禁用账户不可查询云端地域', async () => {
  client.get.mockImplementation((url: string) => url.endsWith('/detail')
    ? Promise.resolve({ ...record(), status: 2 })
    : Promise.resolve({ items: [record()], total: 1 }));
  await start();
  await edit();
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find(item => item.textContent?.trim() === '查询云端地域');
  expect(button?.disabled).toBe(true);
  button?.click();
  expect(client.get.mock.calls.some(([url]) => String(url).includes('available-regions'))).toBe(false);
});

it('切换厂商后不采纳旧地域请求的迟到结果', async () => {
  const pending = Promise.withResolvers<unknown>();
  client.get.mockImplementation((url: string) => url.endsWith('/available-regions')
    ? pending.promise
    : Promise.resolve({ items: [record()], total: 1 }));
  await start();
  await action('添加账户');
  await action('加载地域参考');
  await chooseProvider('AWS');
  pending.resolve({ regions: [{ region: 'cn-stale-region', region_name: '过期地域', available: true }] });
  await flushPromises();
  await new DOMWrapper(document.querySelector('#account-region-codes')!.closest('.ant-select')!).find('.ant-select-selector').trigger('mousedown');
  await flushPromises();
  expect(document.body.textContent).not.toContain('过期地域');
  expect(client.post).not.toHaveBeenCalled();
});
