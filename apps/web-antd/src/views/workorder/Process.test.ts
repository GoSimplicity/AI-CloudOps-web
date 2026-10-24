import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createForbiddenResponseInterceptor,
  createPermissionDeniedError,
} from '#/utils/permission/forbidden';
import Process from './Process.vue';

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

let wrapper: VueWrapper;
beforeEach(() => {
  vi.clearAllMocks();
  client.get.mockImplementation((url: string) =>
    Promise.resolve({
      items:
        url === '/workorder/process/list'
          ? [
              {
                id: 1,
                name: '发布应用',
                description: '',
                status: 1,
                category_id: 0,
                tags: [],
                form_design_id: 0,
                is_default: 2,
                definition: '{}',
              },
            ]
          : [],
      total: url === '/workorder/process/list' ? 1 : 0,
    }),
  );
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  const computedStyle = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    computedStyle(element),
  );
  wrapper = mount(Process, {
    attachTo: document.body,
    global: { plugins: [Antd] },
  });
});
afterEach(() => {
  wrapper.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('工单流程列表交互', () => {
  it('共享筛选区域的查询保留真实 API 参数', async () => {
    await flushPromises();
    await wrapper.get('.ops-page__filters input').setValue('发布');
    await wrapper.get('.ops-page__filters button').trigger('click');
    await flushPromises();
    expect(client.get).toHaveBeenLastCalledWith('/workorder/process/list', {
      params: expect.objectContaining({ search: '发布', page: 1 }),
    });
    expect(wrapper.get('.process-name-text').text()).toBe('发布应用');
  });

  it('查询失败清除旧记录并提供可操作的重试', async () => {
    await flushPromises();
    expect(wrapper.find('.process-name-text').exists()).toBe(true);
    client.get.mockRejectedValueOnce(new Error('unavailable'));
    await wrapper.get('.ops-page__filters button').trigger('click');
    await flushPromises();
    expect(wrapper.get('.ant-alert').text()).toContain('加载流程数据失败');
    expect(wrapper.find('.process-name-text').exists()).toBe(false);
    await wrapper.get('.ant-alert button').trigger('click');
    await flushPromises();
    expect(wrapper.find('.ant-alert').exists()).toBe(false);
    expect(wrapper.get('.process-name-text').text()).toBe('发布应用');
  });

  it('创建流程打开真实基础配置表单，取消不发创建请求', async () => {
    await flushPromises();
    await wrapper.get('.ops-page__actions button').trigger('click');
    await flushPromises();
    expect(document.querySelector('.ant-modal-title')?.textContent).toBe(
      '创建流程',
    );
    expect(document.querySelector('.process-basic-config')).not.toBeNull();
    const cancel = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.ant-modal-footer button',
      ),
    ].find((button) =>
      /^(取消|Cancel)$/.test(button.textContent?.replace(/\s/g, '') || ''),
    )!;
    cancel.click();
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
  });

  it('列表 403 已由统一提示，页面保留错误区但不重复弹错', async () => {
    await flushPromises();
    const error = vi.spyOn(message, 'error');
    client.get.mockRejectedValueOnce(await notifiedForbiddenError());
    await wrapper.get('.ops-page__filters button').trigger('click');
    await flushPromises();
    expect(wrapper.get('.ant-alert').text()).toContain('加载流程数据失败');
    expect(error).not.toHaveBeenCalled();
    client.get.mockRejectedValueOnce(new Error('unavailable'));
    await wrapper.get('.ops-page__filters button').trigger('click');
    await flushPromises();
    expect(error).toHaveBeenCalledWith('加载流程数据失败');
  });
});

/** 模拟请求拦截器链：业务 403 经统一提示拦截器后抛给页面的错误（已提示标记） */
async function notifiedForbiddenError() {
  const { rejected } = createForbiddenResponseInterceptor(() => {});
  return rejected(createPermissionDeniedError()).catch((error) => error);
}
