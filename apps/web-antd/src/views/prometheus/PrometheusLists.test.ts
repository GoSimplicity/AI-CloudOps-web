import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Component } from 'vue';

import MonitorScrapePool from './MonitorScrapePool.vue';
import MonitorScrapeJob from './MonitorScrapeJob.vue';
import MonitorSend from './MonitorSend.vue';
import MonitorAlertPool from './MonitorAlertPool.vue';
import MonitorAlertRecord from './MonitorAlertRecord.vue';
import MonitorAlertEvent from './MonitorAlertEvent.vue';
import MonitorConfig from './MonitorConfig.vue';
import MonitorOnDutyGroup from './MonitorOnDutyGroup.vue';
import MonitorAlertRule from './MonitorAlertRule.vue';

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
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: 1 } }),
}));

let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(message, 'success');
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
  create?: string;
  modalTitle?: string;
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
  {
    component: MonitorAlertPool,
    title: '告警实例池',
    path: '/monitor/alert_manager_pools/list',
    create: '新增AlertManager实例池',
  },
  {
    component: MonitorAlertRecord,
    title: '记录规则',
    path: '/monitor/record_rules/list',
    create: '新增记录',
  },
  {
    component: MonitorAlertEvent,
    title: '告警事件',
    path: '/monitor/alert_events/list',
  },
  {
    component: MonitorConfig,
    title: '监控配置',
    path: '/monitor/configs/list',
    create: '新增监控配置',
  },
  {
    component: MonitorOnDutyGroup,
    title: '值班组',
    path: '/monitor/onduty_groups/list',
    create: '新增值班组',
  },
  {
    component: MonitorAlertRule,
    title: '告警规则',
    path: '/monitor/alert_rules/list',
    create: '新建告警规则',
  },
];
const row = (name: string) => ({
  alert_name: name,
  status: 1,
  labels: [],
  event_times: 5,
  shift_days: 1,
  users: [],
  today_duty_user: null,
  config_type: 1,
  instance_ip: '127.0.0.1',
  expr: 'up',
  severity: 1,
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
    expect(message.success).not.toHaveBeenCalled();
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

  if (page.create)
    it('创建取消不会调用写API', async () => {
      mountPage(page, vi.fn().mockResolvedValue({ items: [], total: 0 }));
      await flushPromises();
      await button(page.create!).trigger('click');
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
        page.modalTitle ?? page.create,
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

it('告警事件次数筛选明确作用于本页并实际过滤数据', async () => {
  const page = pages.find((item) => item.title === '告警事件')!;
  mountPage(
    page,
    vi.fn().mockResolvedValue({
      items: [
        { ...row('单次事件'), event_times: 1 },
        { ...row('高频事件'), id: 2, event_times: 7 },
      ],
      total: 200,
    }),
  );
  await flushPromises();
  const filter = wrapper!
    .findAll('.ant-select')
    .find((item) => item.text().includes('触发次数'))!;
  await filter.get('.ant-select-selector').trigger('mousedown');
  await flushPromises();
  const option = [
    ...document.querySelectorAll<HTMLElement>('.ant-select-item-option'),
  ].find((item) => item.textContent?.includes('5次以上'))!;
  expect(option).toBeDefined();
  option.click();
  await flushPromises();
  expect(wrapper!.text()).not.toContain('单次事件');
  expect(wrapper!.text()).toContain('高频事件');
  expect(wrapper!.text()).toContain('本页');
});
