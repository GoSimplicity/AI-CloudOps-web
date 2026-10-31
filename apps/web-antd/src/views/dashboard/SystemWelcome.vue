<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
} from 'vue';
import * as echarts from 'echarts/core';
import type { EChartsType } from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { InfoCircleOutlined, WarningOutlined } from '@ant-design/icons-vue';
import OpsPage from '#/components/ops/OpsPage.vue';
import {
  getSystemInfoApi,
  getSystemMetricsApi,
} from '#/api/core/system/system';
import type { System } from '#/api/core/system/system';

// 所有数值来自一次实际读取；本页历史仅保留激活期间最近30次采样
const definitions = [
  { key: 'cpu_usage', label: 'CPU使用率', unit: '%', precision: 1 },
  { key: 'memory_usage', label: '内存使用率', unit: '%', precision: 1 },
  { key: 'disk_usage', label: '磁盘使用率', unit: '%', precision: 1 },
  { key: 'load_avg_1', label: '系统负载（1分钟）', unit: '', precision: 2 },
] as const;
type MetricKey = (typeof definitions)[number]['key'];
type Snapshot = Partial<System>;
echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const moduleData = ref<{
  systemInfo: Snapshot | null;
  systemMetrics: Snapshot | null;
}>({ systemInfo: null, systemMetrics: null });
const history = ref<Record<MetricKey, Array<null | number>>>({
  cpu_usage: [],
  memory_usage: [],
  disk_usage: [],
  load_avg_1: [],
});
const readErrors = ref<string[]>([]);
const refreshing = ref(false);
const loading = ref(true);
const currentTime = ref('');
const receivedAt = ref('');
const chartRefs = ref<Record<string, HTMLElement>>({});
const trendChart = ref<HTMLElement>();
const networkChart = ref<HTMLElement>();
const miniCharts = new Map<string, EChartsType>();
let trendChartInstance: EChartsType | undefined;
let networkChartInstance: EChartsType | undefined;
let timeTimer: ReturnType<typeof setInterval> | undefined;
let dataTimer: ReturnType<typeof setInterval> | undefined;
let themeObserver: MutationObserver | undefined;
let active = false;
let disposed = false;
let generation = 0;
let inFlight = false;

function finite(value: unknown, maximum = Infinity): null | number {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= maximum
    ? value
    : null;
}
function sampleValue(key: MetricKey) {
  return finite(
    moduleData.value.systemMetrics?.[key],
    key === 'load_avg_1' ? Infinity : 100,
  );
}
const host = computed(() => ({
  ...moduleData.value.systemInfo,
  ...moduleData.value.systemMetrics,
}));
const metrics = computed(() =>
  definitions.map((definition) => {
    const value = sampleValue(definition.key);
    return {
      ...definition,
      raw: value,
      value: value === null ? '未知' : value.toFixed(definition.precision),
      data: history.value[definition.key],
    };
  }),
);
const loadText = computed(() =>
  ['load_avg_1', 'load_avg_5', 'load_avg_15']
    .map((key) => {
      const value = finite(
        moduleData.value.systemMetrics?.[key as keyof System],
      );
      return value === null ? '未知' : value.toFixed(2);
    })
    .join(' / '),
);
const loadRatio = computed(() => {
  const cores = finite(host.value.cpu_cores);
  const load = sampleValue('load_avg_1');
  return cores !== null && cores > 0 && load !== null ? load / cores : null;
});
const hasPerformanceValues = computed(() =>
  metrics.value.some((metric) => metric.raw !== null),
);
const hasNetworkValues = computed(
  () =>
    finite(moduleData.value.systemMetrics?.network_in) !== null ||
    finite(moduleData.value.systemMetrics?.network_out) !== null,
);
const systemStatusClass = computed(() => {
  if (refreshing.value) return 'status-unknown';
  if (!moduleData.value.systemMetrics) return 'status-unknown';
  if (
    metrics.value.some(
      (metric) =>
        metric.key !== 'load_avg_1' && metric.raw !== null && metric.raw > 90,
    ) ||
    (loadRatio.value !== null && loadRatio.value > 2)
  )
    return 'status-error';
  if (
    metrics.value.some((metric) => metric.raw === null) ||
    loadRatio.value === null ||
    readErrors.value.length
  )
    return 'status-unknown';
  if (
    metrics.value.some(
      (metric) =>
        metric.key !== 'load_avg_1' && metric.raw !== null && metric.raw > 75,
    ) ||
    (loadRatio.value !== null && loadRatio.value > 1.5)
  )
    return 'status-warning';
  return 'status-healthy';
});
const systemStatusText = computed(() =>
  refreshing.value
    ? '正在读取采样'
    : {
        'status-error': '当前采样超过告警阈值',
        'status-warning': '当前采样需要关注',
        'status-healthy': '本次可用采样未超阈值',
        'status-unknown': '采样不可用或不完整',
      }[systemStatusClass.value],
);
const events = computed(() => {
  const result = readErrors.value.map((message, index) => ({
    id: `read-error-${index}`,
    type: 'error',
    message,
  }));
  if (
    moduleData.value.systemMetrics &&
    (metrics.value.some((metric) => metric.raw === null) ||
      loadRatio.value === null)
  )
    result.push({
      id: 'sample_incomplete',
      type: 'warning',
      message: '部分采样字段缺失或无效，当前状态无法完整判断',
    });
  for (const metric of metrics.value) {
    if (metric.raw === null || metric.key === 'load_avg_1' || metric.raw <= 75)
      continue;
    const id = metric.key.split('_')[0];
    result.push({
      id: `${id}_${metric.raw > 90 ? 'high' : 'warning'}`,
      type: metric.raw > 90 ? 'error' : 'warning',
      message: `${metric.label}：${metric.value}%`,
    });
  }
  if (loadRatio.value !== null && loadRatio.value > 1.5)
    result.push({
      id: 'load_warning',
      type: 'warning',
      message: `每核心负载：${loadRatio.value.toFixed(2)}`,
    });
  return result;
});
function formatNumber(value: unknown) {
  const number = finite(value);
  return number === null ? '未知' : String(number);
}
function formatBytes(bytes: unknown): string {
  const value = finite(bytes);
  if (value === null) return '未知';
  if (value === 0) return '0 B';
  const index = Math.min(4, Math.floor(Math.log(value) / Math.log(1024)));
  return `${Number((value / 1024 ** index).toFixed(2))} ${['B', 'KiB', 'MiB', 'GiB', 'TiB'][index]}`;
}
function formatUptime(seconds: unknown): string {
  const value = finite(seconds);
  if (value === null) return '未知';
  const days = Math.floor(value / 86400),
    hours = Math.floor((value % 86400) / 3600),
    minutes = Math.floor((value % 3600) / 60);
  return days
    ? `${days}天 ${hours}小时`
    : hours
      ? `${hours}小时 ${minutes}分钟`
      : `${minutes}分钟`;
}
function pair(used: unknown, total: unknown, multiplier: number) {
  const left = finite(used),
    right = finite(total);
  return `${formatBytes(left === null ? null : left * multiplier)} / ${formatBytes(right === null ? null : right * multiplier)}`;
}
const resources = computed(() => [
  {
    name: 'CPU',
    usage: sampleValue('cpu_usage'),
    detail: `${formatNumber(host.value.cpu_cores)} 核 · ${host.value.cpu_model || '型号未知'}`,
  },
  {
    name: '内存',
    usage: sampleValue('memory_usage'),
    detail: pair(
      moduleData.value.systemMetrics?.memory_used,
      moduleData.value.systemMetrics?.memory_total,
      1024 ** 2,
    ),
  },
  {
    name: '存储',
    usage: sampleValue('disk_usage'),
    detail: pair(
      moduleData.value.systemMetrics?.disk_used,
      moduleData.value.systemMetrics?.disk_total,
      1024 ** 3,
    ),
  },
]);
const sampleTime = computed(() => {
  const timestamp = finite(moduleData.value.systemMetrics?.last_update_time);
  return timestamp === null
    ? '采集时间未知'
    : new Date(timestamp * 1000).toLocaleString('zh-CN');
});

function colors() {
  const probe = document.createElement('span');
  probe.style.visibility = 'hidden';
  document.body.append(probe);
  const read = (token: string, fallback: string) => {
    probe.style.color = `var(${token})`;
    return getComputedStyle(probe).color || fallback;
  };
  const result = {
    text: read('--ops-ink', '#222222'),
    muted: read('--ops-muted', '#777777'),
    border: read('--ops-border', '#dddddd'),
    surface: read('--ops-surface', '#ffffff'),
    accent: read('--ops-accent', '#1677ff'),
  };
  probe.remove();
  return result;
}
function miniRef(key: string, element: unknown) {
  if (element instanceof HTMLElement) chartRefs.value[key] = element;
  else delete chartRefs.value[key];
}
function instance(element: HTMLElement, previous?: EChartsType) {
  return previous && !previous.isDisposed() ? previous : echarts.init(element);
}
function updateCharts() {
  if (!active || disposed) return;
  const palette = colors();
  const tooltip = {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    textStyle: { color: palette.text },
  };
  if (trendChart.value && hasPerformanceValues.value) {
    trendChartInstance = instance(trendChart.value, trendChartInstance);
    trendChartInstance.setOption(
      {
        animation: false,
        textStyle: { color: palette.text },
        tooltip: { ...tooltip, trigger: 'axis' },
        legend: {
          data: ['CPU使用率', '内存使用率', '每核心负载'],
          bottom: 0,
          textStyle: { color: palette.muted },
        },
        grid: { left: 48, right: 48, top: 32, bottom: 70 },
        xAxis: {
          type: 'category',
          data: [sampleTime.value],
          axisLabel: { color: palette.muted },
          axisLine: { lineStyle: { color: palette.border } },
        },
        yAxis: [
          {
            type: 'value',
            min: 0,
            max: 100,
            name: '使用率 (%)',
            axisLabel: { color: palette.muted },
            splitLine: { lineStyle: { color: palette.border } },
          },
          {
            type: 'value',
            min: 0,
            max: (extent: { max: number }) =>
              Number.isFinite(extent.max)
                ? Math.max(2, Math.ceil(extent.max))
                : 2,
            name: '负载/核',
            splitLine: { show: false },
            axisLabel: { color: palette.muted },
          },
        ],
        series: [
          {
            name: 'CPU使用率',
            type: 'bar',
            data: [sampleValue('cpu_usage')],
            itemStyle: { color: palette.accent },
          },
          {
            name: '内存使用率',
            type: 'bar',
            data: [sampleValue('memory_usage')],
            itemStyle: { color: '#52a771' },
          },
          {
            name: '每核心负载',
            type: 'bar',
            yAxisIndex: 1,
            data: [loadRatio.value],
            itemStyle: { color: '#b88a36' },
          },
        ],
      },
      true,
    );
    trendChartInstance.resize();
  } else trendChartInstance?.clear();
  if (networkChart.value && hasNetworkValues.value) {
    networkChartInstance = instance(networkChart.value, networkChartInstance);
    networkChartInstance.setOption(
      {
        animation: false,
        textStyle: { color: palette.text },
        tooltip: {
          ...tooltip,
          trigger: 'axis',
          valueFormatter: (value: unknown) =>
            finite(value) === null ? '未知' : `${value} MiB`,
        },
        grid: { left: 80, right: 24, top: 16, bottom: 32 },
        xAxis: {
          type: 'value',
          min: 0,
          axisLabel: { color: palette.muted },
          splitLine: { lineStyle: { color: palette.border } },
        },
        yAxis: {
          type: 'category',
          data: ['累计接收', '累计发送'],
          axisLabel: { color: palette.muted },
        },
        series: [
          {
            name: '累计网络流量',
            type: 'bar',
            data: [
              finite(moduleData.value.systemMetrics?.network_in),
              finite(moduleData.value.systemMetrics?.network_out),
            ],
            itemStyle: { color: palette.accent },
          },
        ],
      },
      true,
    );
    networkChartInstance.resize();
  } else networkChartInstance?.clear();
  for (const metric of metrics.value) {
    const element = chartRefs.value[metric.key];
    if (!element) continue;
    const chart = instance(element, miniCharts.get(metric.key));
    miniCharts.set(metric.key, chart);
    chart.setOption(
      {
        animation: false,
        grid: { left: 2, right: 2, top: 4, bottom: 4 },
        xAxis: { type: 'category', show: false },
        yAxis: { type: 'value', show: false },
        series: [
          {
            type: 'line',
            data: metric.data,
            connectNulls: false,
            showSymbol: metric.data.length === 1,
            symbolSize: 4,
            lineStyle: { width: 1.5, color: palette.accent },
            itemStyle: { color: palette.accent },
          },
        ],
      },
      true,
    );
    chart.resize();
  }
}
function resizeCharts() {
  trendChartInstance?.resize();
  networkChartInstance?.resize();
  miniCharts.forEach((chart) => chart.resize());
}
function disposeCharts() {
  trendChartInstance?.dispose();
  networkChartInstance?.dispose();
  miniCharts.forEach((chart) => chart.dispose());
  trendChartInstance = undefined;
  networkChartInstance = undefined;
  miniCharts.clear();
}
function recordHistory() {
  for (const definition of definitions)
    history.value[definition.key] = moduleData.value.systemMetrics
      ? [...history.value[definition.key], sampleValue(definition.key)].slice(
          -30,
        )
      : [];
}
function snapshot(value: unknown): Snapshot | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
    ? (value as Snapshot)
    : null;
}
async function fetchAllSystemData() {
  if (!active || disposed || inFlight) return;
  const ticket = generation;
  inFlight = true;
  refreshing.value = true;
  try {
    const results = await Promise.allSettled([
      Promise.resolve().then(getSystemInfoApi),
      Promise.resolve().then(getSystemMetricsApi),
    ]);
    if (!active || disposed || ticket !== generation) return;
    const [info, measured] = results;
    const infoData = info.status === 'fulfilled' ? snapshot(info.value) : null;
    const metricsData =
      measured.status === 'fulfilled' ? snapshot(measured.value) : null;
    moduleData.value = { systemInfo: infoData, systemMetrics: metricsData };
    const reason = (entry: PromiseSettledResult<unknown>, label: string) =>
      entry.status === 'rejected' && entry.reason instanceof Error
        ? `${label}：${entry.reason.message}`
        : `${label}：未返回有效数据`;
    readErrors.value = [
      !infoData ? reason(info, '主机信息读取失败') : '',
      !metricsData ? reason(measured, '系统采样读取失败') : '',
    ].filter(Boolean);
    receivedAt.value = new Date().toLocaleString('zh-CN');
    recordHistory();
    await nextTick();
    if (active && !disposed && ticket === generation) updateCharts();
  } finally {
    if (active && !disposed && ticket === generation) {
      inFlight = false;
      refreshing.value = false;
      loading.value = false;
    }
  }
}
const refreshSystemData = () => fetchAllSystemData();
function updateTime() {
  currentTime.value = new Date().toLocaleString('zh-CN');
}
function activate() {
  if (active || disposed) return;
  active = true;
  generation += 1;
  inFlight = false;
  updateTime();
  timeTimer = setInterval(updateTime, 1000);
  dataTimer = setInterval(() => {
    void fetchAllSystemData();
  }, 30000);
  window.addEventListener('resize', resizeCharts);
  themeObserver = new MutationObserver(() => {
    if (active && !disposed) updateCharts();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style'],
  });
  void fetchAllSystemData();
}
function deactivate() {
  active = false;
  generation += 1;
  inFlight = false;
  refreshing.value = false;
  clearInterval(timeTimer);
  clearInterval(dataTimer);
  timeTimer = undefined;
  dataTimer = undefined;
  themeObserver?.disconnect();
  themeObserver = undefined;
  window.removeEventListener('resize', resizeCharts);
  disposeCharts();
}
onMounted(activate);
onActivated(activate);
onDeactivated(deactivate);
onBeforeUnmount(() => {
  disposed = true;
  deactivate();
});
</script>

<template>
  <OpsPage
    class="dashboard-container"
    description="后端运行主机的最近采样，每30秒读取一次；页面展示采样范围内的状态"
    title="系统欢迎页"
  >
    <template #actions>
      <a-space wrap>
        <span class="sample-status" :class="systemStatusClass" role="status">{{
          systemStatusText
        }}</span>
        <a-button :loading="refreshing" @click="refreshSystemData">
          刷新采样
        </a-button>
      </a-space>
    </template>
    <template #summary>
      <a-row :gutter="[12, 12]" class="metrics-section">
        <a-col v-for="metric in metrics" :key="metric.key" :md="6" :xs="12">
          <section :aria-label="metric.label" class="metric-card">
            <span class="metric-label">{{ metric.label }}</span>
            <div class="metric-reading">
              <strong class="metric-value">{{ metric.value }}</strong
              ><span v-if="metric.raw !== null" class="metric-unit">{{
                metric.unit
              }}</span>
            </div>
            <div
              :ref="(el) => miniRef(metric.key, el)"
              aria-hidden="true"
              class="metric-chart"
            ></div>
          </section>
        </a-col>
      </a-row>
    </template>
    <a-alert
      v-if="readErrors.length"
      :message="readErrors.join('；')"
      type="error"
      show-icon
      role="alert"
    />
    <div class="sample-meta">
      <span>采集时间：{{ sampleTime }}</span
      ><span v-if="receivedAt">最近读取：{{ receivedAt }}</span
      ><span title="浏览器当前时间">当前时间：{{ currentTime }}</span>
    </div>
    <a-row :gutter="[16, 16]">
      <a-col :lg="12" :xs="24">
        <section class="surface-card">
          <h2>主机信息</h2>
          <div class="system-info-grid">
            <div class="info-item">
              <span class="info-label">主机名</span
              ><span class="info-value">{{ host.hostname || '未知' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">操作系统</span
              ><span class="info-value"
                >{{ host.os || '未知' }} {{ host.os_version || '' }}</span
              >
            </div>
            <div class="info-item">
              <span class="info-label">系统架构</span
              ><span class="info-value">{{ host.arch || '未知' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">CPU型号</span
              ><span class="info-value">{{ host.cpu_model || '未知' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">CPU核心数</span
              ><span class="info-value"
                >{{ formatNumber(host.cpu_cores) }} 核</span
              >
            </div>
            <div class="info-item">
              <span class="info-label">系统负载</span
              ><span class="info-value">{{ loadText }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">运行时长</span
              ><span class="info-value">{{
                formatUptime(moduleData.systemMetrics?.uptime)
              }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">进程数</span
              ><span class="info-value">{{
                formatNumber(moduleData.systemMetrics?.process_count)
              }}</span>
            </div>
          </div>
        </section>
      </a-col>
      <a-col :lg="12" :xs="24">
        <section class="surface-card">
          <h2>累计网络流量</h2>
          <p class="section-note">后端网络计数器的累计接收与发送，单位 MiB</p>
          <p v-if="hasNetworkValues" class="network-values">
            累计接收
            {{ formatNumber(moduleData.systemMetrics?.network_in) }} MiB ·
            累计发送
            {{ formatNumber(moduleData.systemMetrics?.network_out) }} MiB
          </p>
          <a-empty v-if="!hasNetworkValues" description="暂无网络采样" />
          <div
            v-show="hasNetworkValues"
            ref="networkChart"
            aria-label="累计网络流量柱图"
            class="chart-container-small"
            role="img"
          ></div>
        </section>
      </a-col>
      <a-col :lg="16" :xs="24">
        <section class="surface-card">
          <h2>当前性能采样</h2>
          <p class="section-note">
            最近一次 CPU、内存使用率及每核心负载；顶部小图只保留本页最近30次采样
          </p>
          <a-empty v-if="!hasPerformanceValues" description="暂无性能采样" />
          <div
            v-show="hasPerformanceValues"
            ref="trendChart"
            aria-label="当前性能采样柱图"
            class="chart-container"
            role="img"
          ></div>
        </section>
      </a-col>
      <a-col :lg="8" :xs="24">
        <section class="surface-card">
          <h2>本次采样提示</h2>
          <a-empty
            v-if="!events.length"
            :description="
              refreshing
                ? '正在读取采样'
                : !moduleData.systemMetrics
                  ? '暂无可用采样'
                  : '本次未出现阈值告警'
            "
          />
          <div v-for="event in events" :key="event.id" class="event-item">
            <WarningOutlined
              v-if="event.type === 'error' || event.type === 'warning'"
              aria-hidden="true"
              class="event-icon"
            />
            <InfoCircleOutlined v-else aria-hidden="true" class="event-icon" />
            <span>{{ event.message }}</span>
          </div>
          <p class="section-note">
            CPU、内存、磁盘超过75%提示关注、超过90%告警；每核心负载超过1.5提示关注、超过2告警
          </p>
        </section>
      </a-col>
      <a-col
        v-for="resource in resources"
        :key="resource.name"
        :md="8"
        :xs="24"
      >
        <section class="surface-card resource-card">
          <div class="resource-header">
            <h2>{{ resource.name }}</h2>
            <span>{{
              resource.usage === null ? '未知' : resource.usage.toFixed(1) + '%'
            }}</span>
          </div>
          <a-progress
            v-if="resource.usage !== null"
            :percent="resource.usage"
            :show-info="false"
            :stroke-color="'var(--ops-accent)'"
          />
          <p class="section-note">{{ resource.detail }}</p>
        </section>
      </a-col>
    </a-row>
  </OpsPage>
</template>

<style scoped>
.dashboard-container {
  min-width: 0;
}
.sample-status {
  color: var(--ops-muted);
  font-size: 13px;
}
.status-error,
.status-warning {
  color: var(--ops-ink);
  font-weight: 600;
}
.metric-card {
  min-width: 0;
  padding: var(--ops-space-md);
  background: var(--ops-surface);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
}
.metric-label {
  color: var(--ops-muted);
  font-size: 12px;
}
.metric-reading {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-top: var(--ops-space-sm);
}
.metric-value {
  color: var(--ops-ink);
  font-size: 24px;
  font-weight: 600;
}
.metric-unit {
  color: var(--ops-muted);
  font-size: 12px;
}
.metric-chart {
  height: 32px;
  margin-top: var(--ops-space-sm);
}
.sample-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ops-space-sm) var(--ops-space-xl);
  color: var(--ops-muted);
  font-size: 12px;
}
.surface-card {
  min-width: 0;
  height: 100%;
  padding: var(--ops-space-lg);
  background: var(--ops-surface);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
}
h2 {
  margin: 0 0 var(--ops-space-md);
  font-size: 14px;
  font-weight: 600;
  color: var(--ops-ink);
}
.system-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ops-space-lg);
}
.info-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}
.info-label,
.section-note {
  color: var(--ops-muted);
  font-size: 12px;
}
.info-value {
  color: var(--ops-ink);
  font-size: 13px;
  overflow-wrap: anywhere;
}
.section-note {
  margin: var(--ops-space-sm) 0 0;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.network-values {
  margin: var(--ops-space-sm) 0 0;
  color: var(--ops-ink);
  font-size: 13px;
  overflow-wrap: anywhere;
}
.chart-container {
  width: 100%;
  height: 300px;
  min-width: 0;
}
.chart-container-small {
  width: 100%;
  height: 220px;
  min-width: 0;
}
.event-item {
  display: flex;
  align-items: flex-start;
  gap: var(--ops-space-sm);
  padding: var(--ops-space-sm) 0;
  color: var(--ops-ink);
  font-size: 13px;
  overflow-wrap: anywhere;
}
.event-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--ops-muted);
}
.resource-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--ops-space-sm);
  font-size: 13px;
}
@media (max-width: 575px) {
  .metric-value {
    font-size: 22px;
  }
  .metric-chart {
    height: 26px;
  }
  .system-info-grid {
    grid-template-columns: 1fr;
    gap: var(--ops-space-md);
  }
  .chart-container {
    height: 260px;
  }
  .chart-container-small {
    height: 200px;
  }
}
</style>
