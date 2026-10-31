import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import CloudAccountManagement from './CloudAccountManagement.vue';
import AccountRegionsEditor from './cloudaccountmanagement/AccountRegionsEditor.vue';

/** 必须存在的页面、DOM 和调用缺失时立即失败，保留原非空断言的测试前提。 */
function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected cloud contract fixture to exist');
  }
  return value;
}

const permissions = vi.hoisted(() => ({
  allowed: null as null | string[],
  allowedRef: null as null | { value: null | string[] },
}));
// 验证按钮权限以及操作本身
vi.mock('#/utils/permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/utils/permission')>()),
  usePermission: () => ({
    can: (key: string) => {
      const allowed = permissions.allowedRef
        ? permissions.allowedRef.value
        : permissions.allowed;
      return allowed === null || allowed.includes(key);
    },
    hasPerm: (code: string) => {
      const allowed = permissions.allowedRef
        ? permissions.allowedRef.value
        : permissions.allowed;
      return allowed === null || allowed.includes(code);
    },
  }),
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
  permissions.allowedRef = null;
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
  required(found).click();
  await flushPromises();
}
async function fill(placeholder: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(
    `input[placeholder="${placeholder}"]`,
  );
  expect(input).not.toBeNull();
  await new DOMWrapper(required(input)).setValue(value);
}
async function edit() {
  const icon = required(wrapper).find('[aria-label="edit"]');
  expect(icon.exists()).toBe(true);
  (icon.element.closest('button') as HTMLButtonElement).click();
  await flushPromises();
}
async function addRegion(code: string) {
  const input = document.querySelector<HTMLInputElement>(
    '#account-region-codes',
  );
  expect(input).not.toBeNull();
  await new DOMWrapper(required(required(input).closest('.ant-select')))
    .find('.ant-select-selector')
    .trigger('mousedown');
  await flushPromises();
  await new DOMWrapper(required(input)).setValue(code);
  await flushPromises();
  const option = [
    ...document.querySelectorAll<HTMLElement>('.ant-select-item-option'),
  ].find((item) => item.getAttribute('title') === code);
  expect(option).toBeDefined();
  required(option).click();
  await flushPromises();
}
describe('云账户真实表单合同', () => {
  it('可创建停用账户，不触发验证或同步', async () => {
    await start();
    await action('添加账户');
    const status = required(
      required(document.querySelector('#cloud-account-create-status')).closest(
        '.ant-select',
      ),
    );
    expect(status.textContent).toContain('启用');
    await new DOMWrapper(
      required(status.querySelector('.ant-select-selector')),
    ).trigger('mousedown');
    await flushPromises();
    required(
      [
        ...document.querySelectorAll<HTMLElement>('.ant-select-item-option'),
      ].find((item) => item.textContent?.trim() === '停用（仅保存）'),
    ).click();
    await flushPromises();
    await fill('请输入云账户名称', '先保存停用配置');
    await fill('请输入 Access Key', 'offline-access-key');
    await fill('请输入 Secret Key', 'offline-secret-key');
    await addRegion('cn-hangzhou');
    await action('添加', '.ant-modal-footer button');
    expect(client.post).toHaveBeenCalledWith(
      '/tree/cloud/account/create',
      expect.objectContaining({ status: 2 }),
    );
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(
      client.get.mock.calls.some(([path]) =>
        /verify|sync|available-regions/.test(path),
      ),
    ).toBe(false);
    await action('添加账户');
    expect(
      required(
        required(
          document.querySelector('#cloud-account-create-status'),
        ).closest('.ant-select'),
      ).textContent,
    ).toContain('启用');
  });

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
        status: 1,
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
    expect(required(client.post.mock.calls[0])[1]).not.toHaveProperty('region');
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
    expect(required(client.put.mock.calls[0])[1]).not.toHaveProperty('regions');
    expect(required(client.put.mock.calls[0])[1]).not.toHaveProperty(
      'access_key',
    );
    expect(required(client.put.mock.calls[0])[1]).not.toHaveProperty(
      'secret_key',
    );
  });
  it('增加地域时提交完整选中集合，原地域元数据不丢失', async () => {
    await start();
    await edit();
    await addRegion('cn-beijing');
    await action('更新', '.ant-modal-footer button');
    const payload = required(client.put.mock.calls[0])[1];
    expect(payload.regions).toEqual([
      {
        description: '原描述',
        is_default: true,
        region: 'cn-hangzhou',
        region_name: '杭州',
      },
      {
        description: '保留描述',
        is_default: false,
        region: 'cn-shanghai',
        region_name: '上海',
      },
      {
        description: '',
        is_default: false,
        region: 'cn-beijing',
        region_name: '',
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
    const icon = required(wrapper).find('[aria-label="edit"]');
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
    await required(wrapper).find('.ant-pagination-item-2 a').trigger('click');
    await flushPromises();
    const params = required(
      client.get.mock.calls
        .filter((call) => call[0] === '/tree/cloud/account/list')
        .at(-1),
    )[1].params;
    expect(params).toEqual(expect.objectContaining({ page: 2, size: 10 }));
    expect(params).not.toHaveProperty('page_size');
    expect(params).not.toHaveProperty('region');
  });
});

it('凭据验证必须显式确认，失败也不删除已创建账户', async () => {
  await start();
  const verify = required(wrapper).find('[aria-label="safety-certificate"]');
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
  expect(required(wrapper).text()).toContain('已有账户');
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
  const submit = required(
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.ant-modal-footer button',
      ),
    ].find((button) => button.textContent?.replace(/\s/g, '') === '添加'),
  );
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

it.each([2, 3, 4])('已支持的云厂商 %i 可读取并编辑账户', async (provider) => {
  selectedProvider = provider;
  await start();
  expect(required(wrapper).find('.account-table').text()).toContain(
    provider === 2 ? '腾讯云' : provider === 3 ? 'AWS' : '华为云',
  );
  const button = required(wrapper)
    .find('[aria-label="edit"]')
    .element.closest('button') as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  await edit();
  await fill('请输入云账户名称', '已编辑');
  await action('更新', '.ant-modal-footer button');
  expect(client.put).toHaveBeenCalledWith(
    '/tree/cloud/account/7/update',
    expect.not.objectContaining({
      access_key: expect.anything(),
      secret_key: expect.anything(),
    }),
  );
});

it.each([7])('未知厂商 %i 账户保持只读', async (provider) => {
  selectedProvider = provider;
  await start();
  const button = required(wrapper)
    .find('[aria-label="edit"]')
    .element.closest('button') as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  button.click();
  expect(client.post).not.toHaveBeenCalled();
});

async function chooseProvider(name: string) {
  const select = document.querySelector('.account-form .ant-select-selector');
  expect(select).not.toBeNull();
  await new DOMWrapper(required(select)).trigger('mousedown');
  await flushPromises();
  const option = [
    ...document.querySelectorAll<HTMLElement>('.ant-select-item-option'),
  ].find((item) => item.textContent?.trim() === name);
  expect(option, `missing provider ${name}`).toBeDefined();
  required(option).click();
  await flushPromises();
}

async function chooseCredential(name: string) {
  const input = document.querySelector<HTMLInputElement>(
    '#cloud-credential-type',
  );
  expect(input).not.toBeNull();
  await new DOMWrapper(required(required(input).closest('.ant-select')))
    .find('.ant-select-selector')
    .trigger('mousedown');
  await flushPromises();
  const option = [
    ...document.querySelectorAll<HTMLElement>(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
    ),
  ].find((item) => item.textContent?.trim() === name);
  expect(option, `missing credential type ${name}`).toBeDefined();
  required(option).click();
  await flushPromises();
}

it.each([
  [2, '腾讯云'],
  [3, 'AWS'],
] as const)(
  '创建 %s 临时凭据只在写请求中携带完整组',
  async (provider, label) => {
    await start();
    await action('添加账户');
    await chooseProvider(label);
    await chooseCredential('临时凭据');
    await fill('请输入云账户名称', '临时账户');
    await fill(
      '请输入 Access Key',
      provider === 3 ? 'ASIA' + '0000000000000000' : 'tencent-access-key',
    );
    await fill('请输入 Secret Key', 'temporary-secret-canary');
    await fill('请输入 Session Token', 'temporary-token-canary');
    await fill('例如 2027-01-01T00:00:00Z', '2099-01-01T00:00:00Z');
    await addRegion(provider === 3 ? 'us-east-1' : 'ap-beijing');
    await action('添加', '.ant-modal-footer button');
    expect(client.post).toHaveBeenCalledWith(
      '/tree/cloud/account/create',
      expect.objectContaining({
        provider,
        credential_type: 'temporary',
        session_token: 'temporary-token-canary',
        credential_expires_at: '2099-01-01T00:00:00Z',
      }),
    );
    expect(JSON.stringify(client.get.mock.calls)).not.toContain(
      'temporary-token-canary',
    );
    expect(JSON.stringify(client.get.mock.calls)).not.toContain(
      'temporary-secret-canary',
    );
  },
);

it('临时账户空凭据保留现有配置，部分轮换不提交', async () => {
  selectedProvider = 3;
  client.get.mockImplementation((path: string) =>
    Promise.resolve(
      path.endsWith('/detail')
        ? {
            ...record(),
            credential_type: 'temporary',
            credential_expires_at: '2099-01-01T00:00:00Z',
          }
        : { items: [record()], total: 1 },
    ),
  );
  await start();
  await edit();
  expect(document.body.textContent).toContain('凭据全部留空可保留');
  await fill('请输入云账户名称', '仅修改名称');
  await action('更新', '.ant-modal-footer button');
  expect(client.put).toHaveBeenCalledWith(
    '/tree/cloud/account/7/update',
    expect.not.objectContaining({
      credential_type: expect.anything(),
      access_key: expect.anything(),
      secret_key: expect.anything(),
      session_token: expect.anything(),
      credential_expires_at: expect.anything(),
    }),
  );
  client.put.mockClear();
  await edit();
  await fill('请输入 Access Key', 'ASIA' + '0000000000000000');
  await action('更新', '.ant-modal-footer button');
  expect(client.put).not.toHaveBeenCalled();
});

it('临时凭据完整轮换、切换长期凭据与关闭清理', async () => {
  selectedProvider = 3;
  client.get.mockImplementation((path: string) =>
    Promise.resolve(
      path.endsWith('/detail')
        ? {
            ...record(),
            credential_type: 'temporary',
            credential_expires_at: '2099-01-01T00:00:00Z',
          }
        : { items: [record()], total: 1 },
    ),
  );
  await start();
  await edit();
  await fill('请输入 Access Key', 'ASIA' + '0000000000000000');
  await fill('请输入 Secret Key', 'new-secret-canary');
  await fill('请输入 Session Token', 'new-token-canary');
  await fill('例如 2027-01-01T00:00:00Z', '2099-02-01T00:00:00Z');
  await action('更新', '.ant-modal-footer button');
  expect(client.put).toHaveBeenCalledWith(
    '/tree/cloud/account/7/update',
    expect.objectContaining({
      credential_type: 'temporary',
      session_token: 'new-token-canary',
      credential_expires_at: '2099-02-01T00:00:00Z',
    }),
  );
  client.put.mockClear();
  await edit();
  await chooseCredential('长期凭据');
  await fill('请输入 Access Key', 'AKIA' + '0000000000000000');
  await fill('请输入 Secret Key', 'long-secret-canary');
  await action('更新', '.ant-modal-footer button');
  expect(client.put).toHaveBeenCalledWith(
    '/tree/cloud/account/7/update',
    expect.objectContaining({
      credential_type: 'long_term',
      access_key: 'AKIA' + '0000000000000000',
      secret_key: 'long-secret-canary',
    }),
  );
  expect(required(client.put.mock.calls.at(-1))[1]).not.toHaveProperty(
    'session_token',
  );
  await edit();
  await fill('请输入 Session Token', 'discard-token-canary');
  await action('取消', '.ant-modal-footer button');
  await edit();
  expect(
    (
      document.querySelector(
        'input[placeholder="请输入 Session Token"]',
      ) as HTMLInputElement
    ).value,
  ).toBe('');
});

it('临时账户编辑权限撤销时关闭并清除敏感输入', async () => {
  selectedProvider = 3;
  permissions.allowedRef = ref<null | string[]>(null);
  client.get.mockImplementation((path: string) =>
    Promise.resolve(
      path.endsWith('/detail')
        ? {
            ...record(),
            credential_type: 'temporary',
            credential_expires_at: '2099-01-01T00:00:00Z',
          }
        : { items: [record()], total: 1 },
    ),
  );
  await start();
  await edit();
  await fill('请输入 Access Key', 'ASIA' + '0000000000000000');
  await fill('请输入 Secret Key', 'withdrawn-secret-canary');
  await fill('请输入 Session Token', 'withdrawn-token-canary');
  permissions.allowedRef.value = ['/api/tree/cloud/account/:id/detail'];
  await flushPromises();
  const state = (
    required(wrapper).vm as unknown as {
      $: {
        setupState: {
          formData: {
            access_key: string;
            secret_key: string;
            session_token: string;
          };
          modalVisible: boolean;
        };
      };
    }
  ).$.setupState;
  expect(state.modalVisible).toBe(false);
  expect(state.formData.access_key).toBe('');
  expect(state.formData.secret_key).toBe('');
  expect(state.formData.session_token).toBe('');
  expect(client.put).not.toHaveBeenCalled();
});

it.each([
  '2020-01-01T00:00:00Z',
  '2099-01-01T08:00:00+08:00',
  '2099-02-30T00:00:00Z',
])('拒绝无效或非 UTC 到期时间 %s', async (expiry) => {
  await start();
  await action('添加账户');
  await chooseProvider('AWS');
  await chooseCredential('临时凭据');
  await fill('请输入云账户名称', '临时账户');
  await fill('请输入 Access Key', 'ASIA' + '0000000000000000');
  await fill('请输入 Secret Key', 'temporary-secret-canary');
  await fill('请输入 Session Token', 'temporary-token-canary');
  await fill('例如 2027-01-01T00:00:00Z', expiry);
  await addRegion('us-east-1');
  await action('添加', '.ant-modal-footer button');
  expect(client.post).not.toHaveBeenCalled();
});

it('华为账户每个地域填写项目 ID，新增地域保留其他项目映射', async () => {
  await start();
  await action('添加账户');
  await chooseProvider('华为云');
  await fill('请输入云账户名称', '华为账户');
  await fill('请输入 Access Key', 'huawei-access-key');
  await fill('请输入 Secret Key', 'huawei-secret-key');
  await addRegion('cn-north-4');
  await action('添加', '.ant-modal-footer button');
  expect(client.post).not.toHaveBeenCalled();
  await new DOMWrapper(
    required(
      document.querySelector<HTMLInputElement>(
        'input[aria-label="cn-north-4 项目 ID"]',
      ),
    ),
  ).setValue('project_one');
  await addRegion('cn-east-3');
  expect(
    (
      document.querySelector(
        'input[aria-label="cn-north-4 项目 ID"]',
      ) as HTMLInputElement
    ).value,
  ).toBe('project_one');
  await new DOMWrapper(
    required(
      document.querySelector<HTMLInputElement>(
        'input[aria-label="cn-east-3 项目 ID"]',
      ),
    ),
  ).setValue('project_two');
  await action('添加', '.ant-modal-footer button');
  expect(client.post).toHaveBeenCalledWith(
    '/tree/cloud/account/create',
    expect.objectContaining({
      provider: 4,
      regions: expect.arrayContaining([
        expect.objectContaining({
          region: 'cn-north-4',
          project_id: 'project_one',
        }),
        expect.objectContaining({
          region: 'cn-east-3',
          project_id: 'project_two',
        }),
      ]),
    }),
  );
});

it('华为编辑保留旧项目映射，仅变更时提交完整地域集合', async () => {
  selectedProvider = 4;
  const existing = {
    ...record(),
    regions: [
      {
        ...record().regions[0],
        region: 'cn-north-4',
        project_id: 'project_one',
      },
    ],
  };
  client.get.mockImplementation((path: string) =>
    Promise.resolve(
      path.endsWith('/detail') ? existing : { items: [existing], total: 1 },
    ),
  );
  await start();
  await edit();
  await fill('请输入云账户名称', '华为新名称');
  await action('更新', '.ant-modal-footer button');
  expect(required(client.put.mock.calls.at(-1))[1]).not.toHaveProperty(
    'regions',
  );
  client.put.mockClear();
  await edit();
  await addRegion('cn-east-3');
  await new DOMWrapper(
    required(
      document.querySelector<HTMLInputElement>(
        'input[aria-label="cn-east-3 项目 ID"]',
      ),
    ),
  ).setValue('project_two');
  await action('更新', '.ant-modal-footer button');
  expect(client.put).toHaveBeenCalledWith(
    '/tree/cloud/account/7/update',
    expect.objectContaining({
      regions: expect.arrayContaining([
        expect.objectContaining({
          region: 'cn-north-4',
          project_id: 'project_one',
        }),
        expect.objectContaining({
          region: 'cn-east-3',
          project_id: 'project_two',
        }),
      ]),
    }),
  );
});

it.each([
  [1, '阿里云'],
  [2, '腾讯云'],
  [3, 'AWS'],
] as const)('新增 %s 账户不隐式请求云平台', async (provider, label) => {
  await start();
  await action('添加账户');
  if (provider !== 1) await chooseProvider(label);
  await fill('请输入云账户名称', '新账户');
  await fill('请输入 Access Key', 'offline-access-key');
  await fill('请输入 Secret Key', 'offline-secret-key');
  await addRegion(provider === 3 ? 'us-east-1' : 'ap-beijing');
  await action('添加', '.ant-modal-footer button');
  expect(client.post).toHaveBeenCalledTimes(1);
  expect(client.post).toHaveBeenCalledWith(
    '/tree/cloud/account/create',
    expect.objectContaining({ provider }),
  );
  expect(
    client.get.mock.calls.some(([url]) =>
      String(url).includes('available-regions'),
    ),
  ).toBe(false);
});

it('aWS 临时 Access Key 不能作为长期凭据提交', async () => {
  await start();
  await action('添加账户');
  await chooseProvider('AWS');
  await fill('请输入云账户名称', '临时凭据账户');
  await fill('请输入 Access Key', 'ASIA' + '0000000000000000');
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
  expect(required(wrapper).find('[aria-label="edit"]').exists()).toBe(false);
  expect(
    required(wrapper).find('[aria-label="safety-certificate"]').exists(),
  ).toBe(false);
  expect(
    (required(wrapper).find('.ant-switch').element as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

it('已禁用账户不允许发起真实凭据验证', async () => {
  client.get.mockResolvedValue({
    items: [{ ...record(), status: 2 }],
    total: 1,
  });
  await start();
  const button = required(wrapper)
    .find('[aria-label="safety-certificate"]')
    .element.closest('button') as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  button.click();
  expect(client.post).not.toHaveBeenCalled();
});

it.each([
  [1, '阿里云'],
  [2, '腾讯云'],
  [3, 'AWS'],
  [4, '华为云'],
] as const)(
  '云厂商 %s 的验证需确认且支持状态/删除操作',
  async (provider, label) => {
    selectedProvider = provider;
    await start();
    const verify = required(wrapper)
      .find('[aria-label="safety-certificate"]')
      .element.closest('button') as HTMLButtonElement;
    verify.click();
    await flushPromises();
    expect(document.body.textContent).toContain(`将向${label}验证`);
    expect(client.post).not.toHaveBeenCalled();
    await action('开始验证', '.ant-modal-confirm-btns button');
    expect(client.post).toHaveBeenCalledWith('/tree/cloud/account/7/verify');
    await required(wrapper).find('.ant-switch').trigger('click');
    await flushPromises();
    expect(client.put).toHaveBeenCalledWith('/tree/cloud/account/7/status', {
      status: 2,
    });
    (
      required(wrapper)
        .find('[aria-label="delete"]')
        .element.closest('button') as HTMLButtonElement
    ).click();
    await flushPromises();
    expect(client.delete).not.toHaveBeenCalled();
    await action('确定删除', '.ant-modal-confirm-btns button');
    expect(client.delete).toHaveBeenCalledWith('/tree/cloud/account/7/delete');
  },
);

it('已保存账户云端地域查询需要确认且GET只携带账户ID', async () => {
  selectedProvider = 3;
  client.get.mockImplementation((url: string) => {
    if (url.endsWith('/detail')) return Promise.resolve(record());
    if (url.endsWith('/available-regions'))
      return Promise.resolve({
        regions: [
          { region: 'us-east-1', region_name: '美国东部', available: true },
        ],
      });
    return Promise.resolve({ items: [record()], total: 1 });
  });
  await start();
  await edit();
  await action('查询云端地域');
  expect(
    client.get.mock.calls.filter(([url]) =>
      String(url).includes('available-regions'),
    ),
  ).toHaveLength(0);
  await action('确认查询', '.ant-modal-confirm-btns button');
  const calls = client.get.mock.calls.filter(([url]) =>
    String(url).includes('available-regions'),
  );
  expect(calls).toEqual([
    [
      '/tree/cloud/account/region/available-regions',
      { params: { cloud_account_id: 7 } },
    ],
  ]);
  expect(JSON.stringify(calls)).not.toContain('access_key');
  expect(JSON.stringify(calls)).not.toContain('secret_key');
});

it('关闭账户表单后，迟到的地域查询确认不会发起请求', async () => {
  await start();
  await edit();
  await action('查询云端地域');
  await action('取消', '.modern-modal .ant-modal-footer button');
  await action('确认查询', '.ant-modal-confirm-btns button');
  expect(
    client.get.mock.calls.some(([url]) =>
      String(url).includes('available-regions'),
    ),
  ).toBe(false);
});

it('未保存账户的地域参考只传厂商，无权限时隐藏入口', async () => {
  client.get.mockImplementation((url: string) =>
    url.endsWith('/available-regions')
      ? Promise.resolve({
          regions: [
            { region: 'us-east-1', region_name: '美国东部', available: true },
          ],
        })
      : Promise.resolve({ items: [record()], total: 1 }),
  );
  await start();
  await action('添加账户');
  await chooseProvider('AWS');
  await action('加载地域参考');
  const call = client.get.mock.calls.find(([url]) =>
    String(url).includes('available-regions'),
  );
  expect(call).toEqual([
    '/tree/cloud/account/region/available-regions',
    { params: { provider: 3 } },
  ]);
  expect(document.body.textContent).not.toContain('查询云端地域');
});

it('地域API运行时丢弃意外传入的密钥', async () => {
  const { getAvailableRegions } =
    await import('#/api/core/tree/tree_account_region');
  client.get.mockResolvedValue({ regions: [] });
  await getAvailableRegions({
    cloud_account_id: 7,
    access_key: 'test-access',
    secret_key: 'test-secret',
  } as never);
  expect(client.get).toHaveBeenCalledWith(
    '/tree/cloud/account/region/available-regions',
    { params: { cloud_account_id: 7 } },
  );
});

it('缺少地域权限时不出现查询入口', async () => {
  permissions.allowed = ['/api/tree/cloud/account/create'];
  await start();
  await action('添加账户');
  expect(document.body.textContent).not.toContain('加载地域参考');
  expect(
    client.get.mock.calls.some(([url]) =>
      String(url).includes('available-regions'),
    ),
  ).toBe(false);
});

it('删除确认期间撤销权限不会发送请求', async () => {
  await start();
  (
    required(wrapper)
      .find('[aria-label="delete"]')
      .element.closest('button') as HTMLButtonElement
  ).click();
  await flushPromises();
  permissions.allowed = [];
  await action('确定删除', '.ant-modal-confirm-btns button');
  expect(client.delete).not.toHaveBeenCalled();
});

it.each(['create', 'edit'])(
  '异步表单校验期间撤销 %s 权限不会写入',
  async (operation) => {
    await start();
    if (operation === 'edit') {
      await edit();
    } else {
      await action('添加账户');
      await fill('请输入云账户名称', '测试账户');
      await fill('请输入 Access Key', 'offline-access');
      await fill('请输入 Secret Key', 'offline-secret');
    }
    const button = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.modern-modal .ant-modal-footer button',
      ),
    ].find(
      (item) =>
        item.textContent?.replace(/\s/g, '') ===
        (operation === 'edit' ? '更新' : '添加'),
    );
    expect(button).toBeDefined();
    required(button).click();
    permissions.allowed = [];
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
  },
);

it('详情读取期间撤销权限不展示迟到数据', async () => {
  const pending = Promise.withResolvers<unknown>();
  client.get.mockImplementation((url: string) =>
    url.endsWith('/detail')
      ? pending.promise
      : Promise.resolve({ items: [record()], total: 1 }),
  );
  await start();
  const icon = required(wrapper).find('[aria-label="edit"]');
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
  pending.resolve({
    regions: [
      { region: 'cn-stale', region_name: '撤权迟到地域', available: true },
    ],
  });
  await flushPromises();
  await new DOMWrapper(
    required(
      required(document.querySelector('#account-region-codes')).closest(
        '.ant-select',
      ),
    ),
  )
    .find('.ant-select-selector')
    .trigger('mousedown');
  await flushPromises();
  expect(document.body.textContent).not.toContain('撤权迟到地域');
});

it('禁用账户不可查询云端地域', async () => {
  client.get.mockImplementation((url: string) =>
    url.endsWith('/detail')
      ? Promise.resolve({ ...record(), status: 2 })
      : Promise.resolve({ items: [record()], total: 1 }),
  );
  await start();
  await edit();
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].find((item) => item.textContent?.trim() === '查询云端地域');
  expect(button?.disabled).toBe(true);
  button?.click();
  expect(
    client.get.mock.calls.some(([url]) =>
      String(url).includes('available-regions'),
    ),
  ).toBe(false);
});

it('切换厂商后不采纳旧地域请求的迟到结果', async () => {
  const pending = Promise.withResolvers<unknown>();
  client.get.mockImplementation((url: string) =>
    url.endsWith('/available-regions')
      ? pending.promise
      : Promise.resolve({ items: [record()], total: 1 }),
  );
  await start();
  await action('添加账户');
  await action('加载地域参考');
  await chooseProvider('AWS');
  pending.resolve({
    regions: [
      { region: 'cn-stale-region', region_name: '过期地域', available: true },
    ],
  });
  await flushPromises();
  await new DOMWrapper(
    required(
      required(document.querySelector('#account-region-codes')).closest(
        '.ant-select',
      ),
    ),
  )
    .find('.ant-select-selector')
    .trigger('mousedown');
  await flushPromises();
  expect(document.body.textContent).not.toContain('过期地域');
  expect(client.post).not.toHaveBeenCalled();
});

const azureCredential = {
  tenant_id: '11111111-1111-1111-1111-111111111111',
  client_id: '22222222-2222-2222-2222-222222222222',
  subscription_id: '33333333-3333-3333-3333-333333333333',
  client_secret: 'azure-secret-canary',
};
const gcpCredentialJSON = JSON.stringify(
  {
    type: 'service_account',
    project_id: 'identity-project',
    client_email: 'robot@identity-project.iam.gserviceaccount.com',
    private_key:
      '-----BEGIN PRIVATE KEY-----\nprivate-canary\n-----END PRIVATE KEY-----\n',
    token_uri: 'https://oauth2.googleapis.com/token',
  },
  null,
  2,
);
async function fillAzure() {
  await fill('请输入租户 ID', azureCredential.tenant_id);
  await fill('请输入应用 ID', azureCredential.client_id);
  await fill('请输入订阅 ID', azureCredential.subscription_id);
  await fill('请输入客户端密钥', azureCredential.client_secret);
}
async function fillGCP() {
  await fill('请输入 GCP 资源项目 ID', 'resource-project');
  await fill('粘贴服务账号 JSON', gcpCredentialJSON);
}

it.each([
  [5, 'Azure', 'eastus'],
  [6, 'GCP', 'us-central1-a'],
] as const)(
  '创建 %s 使用专用完整凭据且不隐式查询云平台',
  async (provider, label, region) => {
    await start();
    await action('添加账户');
    await chooseProvider(label);
    await fill('请输入云账户名称', `${label}账户`);
    if (provider === 5) await fillAzure();
    else await fillGCP();
    expect(
      (
        document.querySelector(
          `input[placeholder="${provider === 5 ? '请输入客户端密钥' : '粘贴服务账号 JSON'}"]`,
        ) as HTMLInputElement
      ).type,
    ).toBe('password');
    await addRegion(region);
    await action('添加', '.ant-modal-footer button');
    expect(client.post).toHaveBeenCalledTimes(1);
    const [path, body] = required(client.post.mock.calls[0]);
    expect(path).toBe('/tree/cloud/account/create');
    expect(body.provider).toBe(provider);
    expect(body.regions).toEqual([expect.objectContaining({ region })]);
    expect(body).not.toHaveProperty('access_key');
    expect(body).not.toHaveProperty('secret_key');
    expect(body).not.toHaveProperty('credential_type');
    if (provider === 5)
      expect(body.provider_credentials).toEqual(azureCredential);
    else {
      expect(body.provider_credentials.project_id).toBe('resource-project');
      expect(
        JSON.parse(body.provider_credentials.service_account_json),
      ).toMatchObject({
        type: 'service_account',
        private_key: expect.stringContaining('private-canary'),
      });
    }
    expect(JSON.stringify(client.get.mock.calls)).not.toContain('canary');
    expect(
      client.get.mock.calls.some(([url]) =>
        String(url).includes('available-regions'),
      ),
    ).toBe(false);
  },
);

it.each([
  [5, 'Azure', 'eastus'],
  [6, 'GCP', 'us-central1-a'],
] as const)(
  '%s 编辑全空保留凭据，部分填写拒绝，完整填写才轮换',
  async (provider, _label, region) => {
    selectedProvider = provider;
    const existing = {
      ...record(),
      regions: [{ ...record().regions[0], region, region_name: '', status: 1 }],
    };
    client.get.mockImplementation((path: string) =>
      Promise.resolve(
        path.endsWith('/detail') ? existing : { items: [existing], total: 1 },
      ),
    );
    await start();
    await edit();
    expect(document.body.textContent).toContain('已保存凭据不会回显');
    await action('更新', '.ant-modal-footer button');
    expect(required(client.put.mock.calls.at(-1))[1]).not.toHaveProperty(
      'provider_credentials',
    );
    client.put.mockClear();
    await edit();
    await fill(
      provider === 5 ? '请输入租户 ID' : '请输入 GCP 资源项目 ID',
      provider === 5 ? azureCredential.tenant_id : 'resource-project',
    );
    await action('更新', '.ant-modal-footer button');
    expect(client.put).not.toHaveBeenCalled();
    if (provider === 5) await fillAzure();
    else await fillGCP();
    await action('更新', '.ant-modal-footer button');
    const body = required(client.put.mock.calls.at(-1))[1];
    expect(body).toHaveProperty('provider_credentials');
    expect(body).not.toHaveProperty('access_key');
    expect(body).not.toHaveProperty('secret_key');
    if (provider === 5)
      expect(body.provider_credentials).toEqual(azureCredential);
    else
      expect(
        JSON.parse(body.provider_credentials.service_account_json).private_key,
      ).toContain('private-canary');
  },
);

it('拒绝错误地域和不可信 GCP 令牌地址，错误不会回显私钥', async () => {
  await start();
  await action('添加账户');
  await chooseProvider('GCP');
  await fill('请输入云账户名称', 'GCP账户');
  await fillGCP();
  await addRegion('us-central1');
  await action('添加', '.ant-modal-footer button');
  expect(client.post).not.toHaveBeenCalled();
  await action('取消', '.ant-modal-footer button');
  await action('添加账户');
  await chooseProvider('GCP');
  await fill('请输入云账户名称', 'GCP账户');
  await fill('请输入 GCP 资源项目 ID', 'resource-project');
  await fill(
    '粘贴服务账号 JSON',
    gcpCredentialJSON.replace(
      'https://oauth2.googleapis.com/token',
      'https://attacker.invalid/token',
    ),
  );
  await addRegion('us-central1-a');
  await action('添加', '.ant-modal-footer button');
  expect(client.post).not.toHaveBeenCalled();
  expect(document.body.textContent).not.toContain('private-canary');
});

it('取消、切换厂商或撤销权限均清除专用凭据', async () => {
  permissions.allowedRef = ref<null | string[]>(null);
  await start();
  await action('添加账户');
  await chooseProvider('Azure');
  await fillAzure();
  await chooseProvider('GCP');
  await fillGCP();
  await chooseProvider('Azure');
  expect(
    (
      document.querySelector(
        'input[placeholder="请输入客户端密钥"]',
      ) as HTMLInputElement
    ).value,
  ).toBe('');
  await fillAzure();
  await action('取消', '.ant-modal-footer button');
  await action('添加账户');
  await chooseProvider('Azure');
  expect(
    (
      document.querySelector(
        'input[placeholder="请输入客户端密钥"]',
      ) as HTMLInputElement
    ).value,
  ).toBe('');
  await fillAzure();
  permissions.allowedRef.value = [];
  await flushPromises();
  const state = (required(wrapper).vm as any).$.setupState;
  expect(state.modalVisible).toBe(false);
  expect(
    Object.values(state.providerCredentialDraft).every((value) => value === ''),
  ).toBe(true);
  expect(client.post).not.toHaveBeenCalled();
});

it('azure 创建请求失败时保留可重试输入，但不显示错误原文或写入其他请求', async () => {
  client.post.mockRejectedValueOnce(new Error('azure-secret-canary'));
  await start();
  await action('添加账户');
  await chooseProvider('Azure');
  await fill('请输入云账户名称', 'Azure账户');
  await fillAzure();
  await addRegion('eastus');
  await action('添加', '.ant-modal-footer button');
  expect(client.post).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).not.toContain('azure-secret-canary');
  expect(
    (
      document.querySelector(
        'input[placeholder="请输入客户端密钥"]',
      ) as HTMLInputElement
    ).value,
  ).toBe('azure-secret-canary');
  expect(JSON.stringify(client.get.mock.calls)).not.toContain(
    'azure-secret-canary',
  );
  await action('取消', '.ant-modal-footer button');
  expect(
    Object.values(
      (required(wrapper).vm as any).$.setupState.providerCredentialDraft,
    ).every((value) => value === ''),
  ).toBe(true);
});

it('azure 异步表单校验时撤销权限不会提交专用凭据', async () => {
  permissions.allowedRef = ref<null | string[]>(null);
  await start();
  await action('添加账户');
  await chooseProvider('Azure');
  await fill('请输入云账户名称', 'Azure账户');
  await fillAzure();
  await addRegion('eastus');
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>(
      '.modern-modal .ant-modal-footer button',
    ),
  ].find((item) => item.textContent?.replace(/\s/g, '') === '添加');
  expect(button).toBeDefined();
  required(button).click();
  permissions.allowedRef.value = [];
  await flushPromises();
  expect(client.post).not.toHaveBeenCalled();
  expect(
    Object.values(
      (required(wrapper).vm as any).$.setupState.providerCredentialDraft,
    ).every((value) => value === ''),
  ).toBe(true);
});
