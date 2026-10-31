import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Component } from 'vue';
import CloudAccount from './CloudAccountManagement.vue';
import CloudResource from './CloudResourceManager.vue';
import LocalResource from './LocalResourceManagement.vue';
import TreeNodes from './TreeNodeManager.vue';

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
const pages: {
  component: Component;
  path: string;
  create: string;
  hasSearch: boolean;
}[] = [
  {
    component: CloudAccount,
    path: '/tree/cloud/account/list',
    create: '添加账户',
    hasSearch: true,
  },
  {
    component: CloudResource,
    path: '/tree/cloud/list',
    create: '同步资源',
    hasSearch: true,
  },
  {
    component: LocalResource,
    path: '/tree/local/list',
    create: '添加服务器',
    hasSearch: false,
  },
  {
    component: TreeNodes,
    path: '/tree/node/list',
    create: '创建节点',
    hasSearch: true,
  },
];
const row = (name: string) => ({
  id: 1,
  name,
  provider: 1,
  status: 1,
  region: 'cn-hangzhou',
  environment: 'test',
  created_at: '2026-10-23T01:00:00Z',
  create_user_name: 'fixture',
  username: 'root',
  ip_addr: '127.0.0.1',
  port: 22,
  auth_mode: 1,
  os_type: 'linux',
  resource_type: 'ecs',
  tree_nodes: [],
  tags: [],
  children: [],
  parent_id: 0,
  level: 1,
  is_leaf: 2,
});
const result = (name: string) => ({ items: [row(name)], total: 1 });
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
  client.get.mockResolvedValue({ items: [], total: 0 });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  message.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function render(component: Component) {
  wrapper = mount(component, {
    attachTo: document.body,
    global: { plugins: [Antd], stubs: { Icon: true } },
  });
  return wrapper;
}
function button(text: string) {
  const found = wrapper!
    .findAll('button')
    .find((button) => button.text().replace(/\s/g, '') === text);
  if (!found) throw new Error(`Missing visible action: ${text}`);
  return found;
}

for (const page of pages) {
  describe(`${page.path} 真实组件行为`, () => {
    it('列表失败清旧结果并可从页面重试恢复', async () => {
      let calls = 0;
      client.get.mockImplementation((path: string) => {
        if (path !== page.path) return Promise.resolve({ items: [], total: 0 });
        calls++;
        if (calls === 2)
          return Promise.reject(new Error('fixture unavailable'));
        return Promise.resolve(
          result(calls === 1 ? 'PREVIOUS-RESOURCE' : 'RECOVERED-RESOURCE'),
        );
      });
      render(page.component);
      await flushPromises();
      expect(wrapper!.text()).toContain('PREVIOUS-RESOURCE');
      await button('刷新').trigger('click');
      await flushPromises();
      expect(wrapper!.text()).not.toContain('PREVIOUS-RESOURCE');
      expect(wrapper!.find('.ant-alert').text()).toContain('失败');
      await button('重试').trigger('click');
      await flushPromises();
      expect(wrapper!.text()).toContain('RECOVERED-RESOURCE');
      expect(wrapper!.find('.ops-page .ant-alert').exists()).toBe(false);
    });

    it('用户切换查询后迟到结果不能覆盖新范围', async () => {
      const old = Promise.withResolvers<unknown>();
      let calls = 0;
      client.get.mockImplementation((path: string) => {
        if (path !== page.path) return Promise.resolve({ items: [], total: 0 });
        return ++calls === 1
          ? old.promise
          : Promise.resolve(result('second-current'));
      });
      render(page.component);
      await flushPromises();
      if (page.hasSearch) {
        const input = wrapper!.find('.ops-page__filters input');
        await input.setValue('second');
        await input.trigger('keydown', { key: 'Enter', keyCode: 13 });
      } else {
        const select = wrapper!.findComponent({ name: 'ASelect' });
        select.vm.$emit('update:value', 1);
        select.vm.$emit('change', 1);
      }
      await flushPromises();
      expect(calls).toBeGreaterThan(1);
      old.resolve(result('older-stale'));
      await flushPromises();
      expect(wrapper!.text()).toContain('second-current');
      expect(wrapper!.text()).not.toContain('older-stale');
    });

    it('创建或同步确认前及取消都不写API', async () => {
      if (page.path === '/tree/cloud/list') {
        client.get.mockImplementation((path: string) =>
          Promise.resolve(
            path === '/tree/cloud/account/list'
              ? result('fixture-account')
              : { items: [], total: 0 },
          ),
        );
      }
      render(page.component);
      await flushPromises();
      await button(page.create).trigger('click');
      await flushPromises();
      expect(client.post).not.toHaveBeenCalled();
      const cancel = [
        ...document.querySelectorAll<HTMLButtonElement>('.ant-modal button'),
      ].find((element) =>
        ['取消', 'Cancel'].includes(
          element.textContent?.replace(/\s/g, '') ?? '',
        ),
      );
      expect(cancel).toBeDefined();
      cancel!.click();
      await flushPromises();
      expect(client.post).not.toHaveBeenCalled();
      expect(client.put).not.toHaveBeenCalled();
      expect(client.delete).not.toHaveBeenCalled();
    });
  });
}
