import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Component } from 'vue';

import MonitorScrapePool from './MonitorScrapePool.vue';
import MonitorScrapeJob from './MonitorScrapeJob.vue';
import MonitorSend from './MonitorSend.vue';

const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));

let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.clearAllMocks();
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
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const pages: {
  component: Component;
  title: string;
  path: string;
  create: string;
}[] = [
  {
    component: MonitorScrapePool,
    title: '采集池',
    path: '/monitor/scrape_pools/list',
    create: '创建采集池',
  },
  {
    component: MonitorScrapeJob,
    title: '采集任务',
    path: '/monitor/scrape_jobs/list',
    create: '创建采集任务',
  },
  {
    component: MonitorSend,
    title: '发送组',
    path: '/monitor/send_groups/list',
    create: '创建发送组',
  },
];
const row = (name: string) => ({
  id: 1,
  name,
  name_zh: name,
  enable: 1,
  support_alert: 1,
  support_record: 2,
  prometheus_instances: ['local-only'],
  service_discovery_type: 2,
  pool_id: 1,
  notify_methods: [],
  static_receive_users: [],
  need_upgrade: 2,
});
function button(text: string) {
  const target = wrapper!
    .findAll('button')
    .find((item) => item.text().replace(/\s/g, '').includes(text));
  expect(target, `button ${text}`).toBeDefined();
  return target!;
}
function mountPage(
  page: (typeof pages)[number],
  list: ReturnType<typeof vi.fn>,
) {
  client.get.mockImplementation((path: string) =>
    path === page.path ? list() : Promise.resolve({ items: [], total: 0 }),
  );
  wrapper = mount(page.component, {
    attachTo: document.body,
    global: { plugins: [Antd], stubs: { Icon: true } },
  });
}

describe.each(pages)('$title 页面真实控件', (page) => {
  it('失败清除旧列表并通过错误区重试恢复', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [row('旧记录')], total: 1 })
      .mockRejectedValueOnce(new Error('离线测试失败'))
      .mockResolvedValue({ items: [row('恢复记录')], total: 1 });
    mountPage(page, list);
    await flushPromises();
    expect(wrapper!.text()).toContain('旧记录');
    await button('重置').trigger('click');
    await flushPromises();
    expect(wrapper!.text()).not.toContain('旧记录');
    expect(wrapper!.text()).toContain('离线测试失败');
    await button('重试').trigger('click');
    await flushPromises();
    expect(wrapper!.text()).toContain('恢复记录');
    expect(wrapper!.find('[role="alert"]').exists()).toBe(false);
  });

  it('旧响应不能覆盖更新查询的结果', async () => {
    let complete!: (value: unknown) => void;
    const list = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      )
      .mockResolvedValue({ items: [row('新结果')], total: 1 });
    mountPage(page, list);
    await button('重置').trigger('click');
    await flushPromises();
    complete({ items: [row('过期结果')], total: 200 });
    await flushPromises();
    expect(wrapper!.text()).toContain('新结果');
    expect(wrapper!.text()).not.toContain('过期结果');
  });

  it('旧请求失败不能清除更新查询的结果', async () => {
    let fail!: (error: Error) => void;
    const list = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            fail = reject;
          }),
      )
      .mockResolvedValue({ items: [row('新结果')], total: 1 });
    mountPage(page, list);
    await button('重置').trigger('click');
    await flushPromises();
    fail(new Error('过期错误'));
    await flushPromises();
    expect(wrapper!.text()).toContain('新结果');
    expect(wrapper!.text()).not.toContain('过期错误');
  });

  it('创建取消不会调用写API', async () => {
    mountPage(page, vi.fn().mockResolvedValue({ items: [], total: 0 }));
    await flushPromises();
    await button(page.create).trigger('click');
    await flushPromises();
    const cancel = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.ant-modal-footer button',
      ),
    ].find((item) =>
      /^(取消|Cancel)$/.test(item.textContent?.replace(/\s/g, '') || ''),
    );
    expect(cancel).toBeDefined();
    expect(document.querySelector('.ant-modal-title')?.textContent).toContain(
      page.create,
    );
    cancel!.click();
    await flushPromises();
    expect(document.querySelector('.ant-modal-title')).toBeNull();
    expect(client.post).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
  });
});

it('采集任务统计只展示本页观测，不把比例外推到总数', async () => {
  const page = pages[1]!;
  mountPage(
    page,
    vi.fn().mockResolvedValue({ items: [row('本页唯一任务')], total: 100 }),
  );
  await flushPromises();
  const statistic = wrapper!
    .findAll('.ant-statistic')
    .find((item) => item.text().includes('本页已启用'))!;
  expect(statistic.find('.ant-statistic-content').text()).toBe('1');
});
