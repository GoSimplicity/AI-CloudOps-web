import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CloudAccountManagement from './CloudAccountManagement.vue';

// FE-02：本文件验证业务行为，按「有按钮权限」渲染；权限判断本身见 utils/permission/*.test.ts
vi.mock('#/utils/permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/utils/permission')>()),
  usePermission: () => ({ can: () => true, hasPerm: () => true }),
}));

const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
let wrapper: VueWrapper | undefined;
const record = () => ({
  id: 7,
  name: '已有账户',
  provider: 1,
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

it('AWS使用Go枚举3且存量账户只读', async () => {
  client.get.mockResolvedValue({
    items: [{ ...record(), provider: 3 }],
    total: 1,
  });
  await start();
  expect(wrapper!.find('.account-table').text()).toContain('AWS');
  const edit = wrapper!
    .find('[aria-label="edit"]')
    .element.closest('button') as HTMLButtonElement;
  expect(edit.disabled).toBe(true);
  edit.click();
  await flushPromises();
  expect(client.post).not.toHaveBeenCalled();
  expect(client.put).not.toHaveBeenCalled();
  expect(client.delete).not.toHaveBeenCalled();
});
