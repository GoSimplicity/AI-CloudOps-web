import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import LocalResource from './LocalResourceManagement.vue';

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
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
let wrapper: VueWrapper | undefined;
const resource = {
  id: 7,
  name: '密钥主机',
  ip_addr: '192.0.2.5',
  port: 22,
  username: 'root',
  auth_mode: 2,
  status: 1,
  os_type: 'linux',
  environment: 'test',
  description: '原描述',
  tags: [{ key: 'team', value: 'ops' }],
  tree_nodes: [],
};
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
      path === '/tree/local/list'
        ? { items: [resource], total: 1 }
        : { items: [], total: 0 },
    ),
  );
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
  wrapper = mount(LocalResource, {
    attachTo: document.body,
    global: { plugins: [Antd] },
  });
  await flushPromises();
}
async function action(text: string, selector = 'button') {
  const element = [...document.querySelectorAll(selector)].find(
    (item) => item.textContent?.replace(/\s/g, '') === text,
  );
  expect(element, `缺少操作 ${text}`).toBeDefined();
  await new DOMWrapper(element!).trigger('click');
  await flushPromises();
}
it('对象标签按键值显示，编辑已有密钥主机不要求重新输入凭据', async () => {
  await start();
  expect(wrapper!.text()).toContain('team=ops');
  await action('编辑');
  await new DOMWrapper(
    document.querySelector('.ant-modal input[placeholder="root"]')!,
  ).setValue('operator');
  await action('更新');
  expect(client.put).toHaveBeenCalledOnce();
  expect(client.put).toHaveBeenCalledWith(
    '/tree/local/update/7',
    expect.objectContaining({
      username: 'operator',
      tags: [{ key: 'team', value: 'ops' }],
    }),
  );
  expect(client.put.mock.calls[0]![1]).not.toHaveProperty('key');
  expect(client.put.mock.calls[0]![1]).not.toHaveProperty('password');
});
it('新增标签提交对象数组，同键标签不能重复', async () => {
  await start();
  await action('编辑');
  const tag = new DOMWrapper(
    document.querySelector(
      'input[placeholder="输入标签（如 team=ops），按回车添加"]',
    )!,
  );
  await tag.setValue('zone=local');
  await action('添加标签');
  await tag.setValue('team=duplicate');
  await action('添加标签');
  await action('更新');
  expect(client.put).toHaveBeenCalledWith(
    '/tree/local/update/7',
    expect.objectContaining({
      tags: [
        { key: 'team', value: 'ops' },
        { key: 'zone', value: 'local' },
      ],
    }),
  );
});
it('校验期间锁定重复提交，旧请求完成不关闭重新打开的表单', async () => {
  const pending = Promise.withResolvers<unknown>();
  client.put.mockReturnValue(pending.promise);
  await start();
  await action('编辑');
  const save = [...document.querySelectorAll('.ant-modal button')].find(
    (item) => item.textContent?.replace(/\s/g, '') === '更新',
  )!;
  save.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  save.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await flushPromises();
  expect(client.put).toHaveBeenCalledOnce();
  await action('取消', '.ant-modal button');
  await action('添加服务器');
  pending.resolve(undefined);
  await flushPromises();
  expect(document.querySelector('.ant-modal-title')?.textContent).toBe(
    '添加服务器',
  );
});
