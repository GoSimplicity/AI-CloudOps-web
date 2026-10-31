import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import Antd from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Welcome from './SystemWelcome.vue';

/** 必须存在的页面、DOM 或调用缺失时立即失败，保留原测试前提。 */
function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected page contract fixture to exist');
  }
  return value;
}

const api = vi.hoisted(() => ({
  getSystemInfoApi: vi.fn(),
  getSystemMetricsApi: vi.fn(),
  refreshSystemInfoApi: vi.fn(),
}));
const charts = vi.hoisted(() => ({ instances: [] as any[] }));
vi.mock('#/api/core/system/system', () => api);
vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: (element: HTMLElement) => {
    const chart = {
      element,
      disposed: false,
      setOption: vi.fn(),
      clear: vi.fn(),
      resize: vi.fn(),
      dispose() {
        this.disposed = true;
      },
      isDisposed() {
        return this.disposed;
      },
    };
    charts.instances.push(chart);
    return chart;
  },
  getInstanceByDom: (element: HTMLElement) =>
    charts.instances.find(
      (chart) => chart.element === element && !chart.disposed,
    ),
}));
const sample = (overrides: Record<string, unknown> = {}) => ({
  hostname: 'owned-host',
  os: 'linux',
  os_version: 'test',
  arch: 'arm64',
  cpu_model: 'test CPU',
  cpu_cores: 8,
  cpu_usage: 0,
  memory_usage: 0,
  disk_usage: 0,
  memory_total: 1024,
  memory_used: 0,
  disk_total: 100,
  disk_used: 0,
  network_in: 12,
  network_out: 6,
  uptime: 0,
  process_count: 0,
  load_avg_1: 0,
  load_avg_5: 0,
  load_avg_15: 0,
  last_update_time: 1792740000,
  ...overrides,
});
let wrapper: VueWrapper | undefined;
const state = () => (required(wrapper).vm as any).$.setupState;
function render() {
  wrapper = mount(Welcome, { global: { plugins: [Antd] } });
  return wrapper;
}
const chart = (className: string) =>
  charts.instances.findLast(
    (item) => item.element.classList.contains(className) && !item.disposed,
  );
function deferred() {
  let resolve!: (value: any) => void;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { resolve, promise };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.clearAllMocks();
  charts.instances = [];
  api.getSystemInfoApi.mockResolvedValue(sample());
  api.getSystemMetricsApi.mockResolvedValue(sample());
  api.refreshSystemInfoApi.mockResolvedValue(sample());
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
  document.documentElement.classList.remove('dark');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('系统欢迎页真实采样合同', () => {
  it('真实零负载、运行时长和进程数均保留，不误判缺失', async () => {
    render();
    await flushPromises();
    const load = required(
      required(wrapper)
        .findAll('.info-item')
        .find((item) => item.text().includes('系统负载')),
    );
    expect(load.text()).toContain('0.00 / 0.00 / 0.00');
    expect(state().formatUptime(0)).toBe('0分钟');
    const processes = required(
      required(wrapper)
        .findAll('.info-item')
        .find((item) => item.text().includes('进程数')),
    );
    expect(processes.text()).toContain('0');
    expect(state().metrics[0].value).toBe('0.0');
  });
  it('手动刷新通过只读GET更新指标、事件与图表，不调用POST缓存写接口', async () => {
    render();
    await flushPromises();
    api.getSystemMetricsApi.mockResolvedValueOnce(
      sample({ cpu_usage: 95, network_in: 20, network_out: 8 }),
    );
    await state().refreshSystemData();
    await flushPromises();
    expect(api.refreshSystemInfoApi).not.toHaveBeenCalled();
    expect(state().metrics[0].value).toBe('95.0');
    expect(state().events.some((event: any) => event.id === 'cpu_high')).toBe(
      true,
    );
    const option = chart('chart-container').setOption.mock.calls.at(-1)[0];
    expect(
      option.series.find((series: any) => series.name === 'CPU使用率').data,
    ).toEqual([95]);
  });
  it('网络字段已经是累计MiB，不再次当字节除1024²，也不伪装速率', async () => {
    render();
    await flushPromises();
    const option = chart('chart-container-small').setOption.mock.calls.at(
      -1,
    )[0];
    expect(option.series[0].data).toEqual([12, 6]);
    expect(required(wrapper).text()).toContain('累计网络流量');
    expect(required(wrapper).text()).not.toContain('实时监控');
  });
  it('后续请求失败清除旧healthy、数值、图表和正常事件', async () => {
    render();
    await flushPromises();
    api.getSystemInfoApi.mockRejectedValueOnce(new Error('host unavailable'));
    api.getSystemMetricsApi.mockRejectedValueOnce(
      new Error('metrics unavailable'),
    );
    await state().refreshSystemData();
    await flushPromises();
    expect(state().moduleData.systemMetrics).toBeNull();
    expect(state().moduleData.systemInfo).toBeNull();
    expect(state().systemStatusClass).not.toBe('status-healthy');
    expect(
      state().metrics.every((metric: any) => metric.value === '未知'),
    ).toBe(true);
    expect(
      state().events.some((event: any) => event.id === 'system_normal'),
    ).toBe(false);
    expect(required(wrapper).text()).toContain('metrics unavailable');
  });
  it('空响应不会渲染成全零健康', async () => {
    api.getSystemInfoApi.mockResolvedValue(null);
    api.getSystemMetricsApi.mockResolvedValue(null);
    render();
    await flushPromises();
    expect(state().systemStatusClass).not.toBe('status-healthy');
    expect(
      state().metrics.every((metric: any) => metric.value === '未知'),
    ).toBe(true);
    expect(required(wrapper).text()).toContain('暂无性能采样');
  });
  it('缺失或无效单项不是零，不宣称系统健康', async () => {
    api.getSystemMetricsApi.mockResolvedValue(
      sample({
        cpu_usage: undefined,
        memory_usage: Number.NaN,
        disk_usage: 101,
        load_avg_1: undefined,
      }),
    );
    render();
    await flushPromises();
    expect(state().systemStatusClass).not.toBe('status-healthy');
    expect(
      state().metrics.every((metric: any) => metric.value === '未知'),
    ).toBe(true);
  });
  it('周期30秒读取且同一未完成请求不产生排队重叠', async () => {
    render();
    await flushPromises();
    expect(api.getSystemMetricsApi).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(api.getSystemMetricsApi).toHaveBeenCalledTimes(1);
    const pending = deferred();
    api.getSystemMetricsApi.mockReturnValueOnce(pending.promise);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.getSystemMetricsApi).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.getSystemMetricsApi).toHaveBeenCalledTimes(2);
    pending.resolve(sample());
    await flushPromises();
  });
  it('卸载后停止poll且迟到响应不能创建图表或写回状态', async () => {
    const pending = deferred();
    api.getSystemMetricsApi.mockReturnValueOnce(pending.promise);
    render();
    required(wrapper).unmount();
    const before = charts.instances.length;
    pending.resolve(sample({ cpu_usage: 99 }));
    await flushPromises();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.getSystemMetricsApi).toHaveBeenCalledTimes(1);
    expect(charts.instances).toHaveLength(before);
  });
  it('keepAlive离开停止poll，回到页面立即新采样，旧请求不能覆盖', async () => {
    const pending = deferred();
    api.getSystemMetricsApi
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(sample({ cpu_usage: 55 }));
    const show = ref(true);
    const Host = defineComponent({
      components: { Welcome },
      setup: () => ({ show }),
      template: '<KeepAlive><Welcome v-if="show" /></KeepAlive>',
    });
    wrapper = mount(Host, { global: { plugins: [Antd] } });
    await flushPromises();
    show.value = false;
    await flushPromises();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.getSystemMetricsApi).toHaveBeenCalledTimes(1);
    show.value = true;
    await flushPromises();
    expect(api.getSystemMetricsApi).toHaveBeenCalledTimes(2);
    const welcomeState = (wrapper.findComponent(Welcome).vm as any).$
      .setupState;
    expect(welcomeState.metrics[0].value).toBe('55.0');
    pending.resolve(sample({ cpu_usage: 99 }));
    await flushPromises();
    expect(welcomeState.metrics[0].value).toBe('55.0');
  });
  it('切换主题仅更新图表配色，不额外访问系统API', async () => {
    render();
    await flushPromises();
    const initial = chart('chart-container').setOption.mock.calls.length;
    document.documentElement.classList.add('dark');
    await flushPromises();
    expect(
      chart('chart-container').setOption.mock.calls.length,
    ).toBeGreaterThan(initial);
    expect(api.getSystemMetricsApi).toHaveBeenCalledTimes(1);
  });
  it('主机信息失败时使用当前metrics的元数据，仍保留部分失败原因', async () => {
    api.getSystemInfoApi.mockRejectedValueOnce(
      new Error('host cache unavailable'),
    );
    api.getSystemMetricsApi.mockResolvedValueOnce(
      sample({ hostname: 'fresh-host' }),
    );
    render();
    await flushPromises();
    expect(required(wrapper).text()).toContain('fresh-host');
    expect(required(wrapper).text()).toContain('host cache unavailable');
    expect(state().systemStatusClass).not.toBe('status-healthy');
  });
  it('只有缓存host响应时不能把其中旧数值当实时metrics', async () => {
    api.getSystemMetricsApi.mockRejectedValueOnce(
      new Error('metrics unavailable'),
    );
    render();
    await flushPromises();
    expect(required(wrapper).text()).toContain('owned-host');
    expect(state().moduleData.systemMetrics).toBeNull();
    expect(
      state().metrics.every((metric: any) => metric.value === '未知'),
    ).toBe(true);
  });
});
