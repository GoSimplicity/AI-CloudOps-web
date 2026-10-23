import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MonitorOnDutyGroupTable from './MonitorOnDutyGroupTable.vue';

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { id: '7' } }),
  useRouter: () => navigation,
}));
let wrapper: VueWrapper | undefined;
const detail = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-31T12:00:00+08:00'));
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
  detail.mockResolvedValue({ id: 7, name: '离线值班组', users: [] });
  client.get.mockImplementation((path: string) =>
    path.includes('/detail/')
      ? detail()
      : Promise.resolve({ items: [], details: [], total: 0 }),
  );
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function start() {
  wrapper = mount(MonitorOnDutyGroupTable, {
    attachTo: document.body,
    global: { plugins: [Antd], stubs: { Icon: true } },
  });
}
function button(text: string) {
  return wrapper!
    .findAll('button')
    .find((item) => item.text().replace(/\s/g, '').includes(text))!;
}

describe('值班日历页面真实控件', () => {
  it('详情加载失败留在当前页并支持重试', async () => {
    detail.mockRejectedValueOnce(new Error('离线详情失败'));
    start();
    await flushPromises();
    expect(wrapper!.find('[role="alert"]').text()).toContain('离线详情失败');
    await button('重试').trigger('click');
    await flushPromises();
    expect(wrapper!.text()).toContain('离线值班组');
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('1月31日切到下月仍为2月并查询对应日期范围', async () => {
    start();
    await flushPromises();
    await wrapper!.findAll('.calendar-nav button')[1]!.trigger('click');
    await flushPromises();
    expect(wrapper!.find('.calendar-title').text()).toContain('2026年2月');
    expect(client.get).toHaveBeenCalledWith(
      '/monitor/onduty_groups/history/7',
      {
        params: expect.objectContaining({
          start_date: '2026-02-01',
          end_date: '2026-02-28',
        }),
      },
    );
  });

  it('历史搜索通过实际请求传递日期关键字', async () => {
    start();
    await flushPromises();
    await wrapper!
      .get('input[placeholder="搜索值班历史..."]')
      .setValue('2026-01-05');
    await wrapper!
      .get('input[placeholder="搜索值班历史..."]')
      .trigger('keydown', { key: 'Enter', keyCode: 13 });
    await flushPromises();
    expect(client.get).toHaveBeenLastCalledWith(
      '/monitor/onduty_groups/history/7',
      { params: expect.objectContaining({ search: '2026-01-05' }) },
    );
  });

  it('申请换班取消不调用写API', async () => {
    start();
    await flushPromises();
    await button('申请换班').trigger('click');
    await flushPromises();
    const cancel = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.ant-modal-footer button',
      ),
    ].find((item) =>
      /^(取消|Cancel)$/.test(item.textContent?.replace(/\s/g, '') || ''),
    )!;
    expect(cancel).toBeDefined();
    cancel.click();
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
  });
});
