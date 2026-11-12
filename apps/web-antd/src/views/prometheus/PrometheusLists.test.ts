import type { Component } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MonitorAlertEvent from './MonitorAlertEvent.vue';
import MonitorAlertPool from './MonitorAlertPool.vue';
import MonitorAlertRecord from './MonitorAlertRecord.vue';
import MonitorAlertRule from './MonitorAlertRule.vue';
import MonitorConfig from './MonitorConfig.vue';
import MonitorOnDutyGroup from './MonitorOnDutyGroup.vue';
import MonitorScrapeJob from './MonitorScrapeJob.vue';
import MonitorScrapePool from './MonitorScrapePool.vue';
import MonitorSend from './MonitorSend.vue';

// FE-02：本文件验证业务行为，按「有按钮权限」渲染；权限判断本身见 utils/permission/*.test.ts
vi.mock('#/utils/permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/utils/permission')>()),
  usePermission: () => ({ can: () => true, hasPerm: () => true }),
}));

/** 必须存在的页面、DOM 或调用缺失时立即失败，保留原测试前提。 */
function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected page contract fixture to exist');
  }
  return value;
}

const client = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => 0 }),
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: 1 } }),
}));

let wrapper: undefined | VueWrapper;
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(message, 'success');
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addListener: vi.fn(),
      matches: false,
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
  create?: string;
  expectedFailure?: string;
  modalTitle?: string;
  path: string;
  title: string;
}[] = [
  {
    component: MonitorScrapePool,
    create: '创建采集池',
    expectedFailure: '加载采集池列表失败',
    path: '/monitor/scrape_pools/list',
    title: '采集池',
  },
  {
    component: MonitorScrapeJob,
    create: '创建采集任务',
    expectedFailure: '加载采集任务列表失败',
    path: '/monitor/scrape_jobs/list',
    title: '采集任务',
  },
  {
    component: MonitorSend,
    create: '创建发送组',
    path: '/monitor/send_groups/list',
    title: '发送组',
  },
  {
    component: MonitorAlertPool,
    create: '新增AlertManager实例池',
    expectedFailure: '加载实例池列表失败',
    path: '/monitor/alert_manager_pools/list',
    title: '告警实例池',
  },
  {
    component: MonitorAlertRecord,
    create: '新增记录',
    expectedFailure: '加载记录规则列表失败',
    path: '/monitor/record_rules/list',
    title: '记录规则',
  },
  {
    component: MonitorAlertEvent,
    path: '/monitor/alert_events/list',
    title: '告警事件',
  },
  {
    component: MonitorConfig,
    create: '新增监控配置',
    path: '/monitor/configs/list',
    title: '监控配置',
  },
  {
    component: MonitorOnDutyGroup,
    create: '新增值班组',
    expectedFailure: '获取值班组列表失败',
    path: '/monitor/onduty_groups/list',
    title: '值班组',
  },
  {
    component: MonitorAlertRule,
    create: '新建告警规则',
    path: '/monitor/alert_rules/list',
    title: '告警规则',
  },
];
const row = (name: string) => ({
  alert_name: name,
  config_type: 1,
  enable: 1,
  event_times: 5,
  expr: 'up',
  id: 1,
  instance_ip: '127.0.0.1',
  labels: [],
  name,
  name_zh: name,
  need_upgrade: 2,
  notify_methods: [],
  pool_id: 1,
  prometheus_instances: ['local-only'],
  service_discovery_type: 2,
  severity: 1,
  shift_days: 1,
  static_receive_users: [],
  status: 1,
  support_alert: 1,
  support_record: 2,
  today_duty_user: null,
  users: [],
});
function button(text: string) {
  const target = required(wrapper)
    .findAll('button')
    .find((item) => item.text().replaceAll(/\s/g, '').includes(text));
  expect(target, `button ${text}`).toBeDefined();
  return required(target);
}
function mountPage(
  page: (typeof pages)[number],
  list: ReturnType<typeof vi.fn>,
) {
  client.get.mockImplementation((path: string) =>
    path === page.path ? list() : Promise.resolve({ total: 0, items: [] }),
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
      .mockResolvedValueOnce({ total: 1, items: [row('旧记录')] })
      .mockRejectedValueOnce(new Error('离线测试失败'))
      .mockResolvedValue({ total: 1, items: [row('恢复记录')] });
    mountPage(page, list);
    await flushPromises();
    expect(required(wrapper).text()).toContain('旧记录');
    await button('重置').trigger('click');
    await flushPromises();
    expect(message.success).not.toHaveBeenCalled();
    expect(required(wrapper).text()).not.toContain('旧记录');
    expect(required(wrapper).text()).toContain(
      page.expectedFailure ?? '离线测试失败',
    );
    await button('重试').trigger('click');
    await flushPromises();
    expect(required(wrapper).text()).toContain('恢复记录');
    expect(required(wrapper).find('[role="alert"]').exists()).toBe(false);
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
      .mockResolvedValue({ total: 1, items: [row('新结果')] });
    mountPage(page, list);
    await button('重置').trigger('click');
    await flushPromises();
    complete({ total: 200, items: [row('过期结果')] });
    await flushPromises();
    expect(required(wrapper).text()).toContain('新结果');
    expect(required(wrapper).text()).not.toContain('过期结果');
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
      .mockResolvedValue({ total: 1, items: [row('新结果')] });
    mountPage(page, list);
    await button('重置').trigger('click');
    await flushPromises();
    fail(new Error('过期错误'));
    await flushPromises();
    expect(required(wrapper).text()).toContain('新结果');
    expect(required(wrapper).text()).not.toContain('过期错误');
  });

  if (page.create)
    it('创建取消不会调用写API', async () => {
      mountPage(page, vi.fn().mockResolvedValue({ total: 0, items: [] }));
      await flushPromises();
      await button(required(page.create)).trigger('click');
      await flushPromises();
      const cancel = [
        ...document.querySelectorAll<HTMLButtonElement>(
          '.ant-modal-footer button',
        ),
      ].find((item) =>
        /^(?:取消|Cancel)$/.test(item.textContent?.replace(/\s/g, '') || ''),
      );
      expect(cancel).toBeDefined();
      expect(document.querySelector('.ant-modal-title')?.textContent).toContain(
        page.modalTitle ?? page.create,
      );
      required(cancel).click();
      await flushPromises();
      expect(document.querySelector('.ant-modal-title')).toBeNull();
      expect(client.post).not.toHaveBeenCalled();
      expect(client.put).not.toHaveBeenCalled();
      expect(client.delete).not.toHaveBeenCalled();
    });
});

it('采集任务统计只展示本页观测，不把比例外推到总数', async () => {
  const page = required(pages[1]);
  mountPage(
    page,
    vi.fn().mockResolvedValue({ total: 100, items: [row('本页唯一任务')] }),
  );
  await flushPromises();
  const statistic = required(
    required(wrapper)
      .findAll('.ant-statistic')
      .find((item) => item.text().includes('本页已启用')),
  );
  expect(statistic.find('.ant-statistic-content').text()).toBe('1');
});

it('告警事件次数筛选明确作用于本页并实际过滤数据', async () => {
  const page = required(pages.find((item) => item.title === '告警事件'));
  mountPage(
    page,
    vi.fn().mockResolvedValue({
      total: 200,
      items: [
        { ...row('单次事件'), event_times: 1 },
        { ...row('高频事件'), event_times: 7, id: 2 },
      ],
    }),
  );
  await flushPromises();
  const filter = required(
    required(wrapper)
      .findAll('.ant-select')
      .find((item) => item.text().includes('触发次数')),
  );
  await filter.get('.ant-select-selector').trigger('mousedown');
  await flushPromises();
  const option = required(
    [...document.querySelectorAll<HTMLElement>('.ant-select-item-option')].find(
      (item) => item.textContent?.includes('5次以上'),
    ),
  );
  expect(option).toBeDefined();
  option.click();
  await flushPromises();
  expect(required(wrapper).text()).not.toContain('单次事件');
  expect(required(wrapper).text()).toContain('高频事件');
  expect(required(wrapper).text()).toContain('本页');
});
