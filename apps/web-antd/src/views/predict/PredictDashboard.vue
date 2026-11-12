<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import {
  ApiOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  BulbOutlined,
  DatabaseOutlined,
  HddOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';

import OpsPage from '#/components/ops/OpsPage.vue';

import { chartColors, useChartAppearance } from '../assistant/chart-appearance';
import { useAiRequestScope } from '../assistant/useAiRequestScope';
import { formatProbability } from './prediction-display';
import {
  alignForecasts,
  forecastPoints,
  formatPredictionTime,
} from './prediction-series';
import PredictionProvenance from './PredictionProvenance.vue';
// 按需引入echarts，减少打包体积
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

import {
  predictCpu,
  predictDisk,
  type PredictionResponse,
  predictMemory,
  predictQps,
  type ScalingRecommendation,
} from '#/api/core/aiops/predict';

// 注册必需的组件
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

// 响应式数据
const loading = ref(false);
const predictionError = ref('');
const predictionContext = ref<{ hours: number } | null>(null);
const timeRange = ref('24');
const chartType = ref('line');
const aiEnhanced = ref(true);
const hasInitialData = ref(false);

// 用户输入数据
const inputData = ref({
  currentCpu: null as null | number,
  currentDisk: null as null | number,
  currentMemory: null as null | number,
  currentQps: null as null | number,
});

// 表单验证
const isFormValid = computed(() => {
  return (
    !!scope.owner.value &&
    Object.values(inputData.value).every((value) => Number.isFinite(value)) &&
    inputData.value.currentQps !== null &&
    inputData.value.currentCpu !== null &&
    inputData.value.currentMemory !== null &&
    inputData.value.currentDisk !== null &&
    inputData.value.currentQps >= 0 &&
    inputData.value.currentCpu >= 0 &&
    inputData.value.currentCpu <= 100 &&
    inputData.value.currentMemory >= 0 &&
    inputData.value.currentMemory <= 100 &&
    inputData.value.currentDisk >= 0 &&
    inputData.value.currentDisk <= 100
  );
});

// 图表引用
const trendChartRef = ref<HTMLElement>();
const utilizationChartRef = ref<HTMLElement>();
let trendChart: echarts.ECharts | null = null;
let utilizationChart: echarts.ECharts | null = null;

// 指标数据
const metricsData = ref([
  {
    currentValue: 0,
    icon: ThunderboltOutlined,
    name: 'QPS',
    trend: null as null | number,
    type: 'qps',
    unit: '/s',
  },
  {
    currentValue: 0,
    icon: ApiOutlined,
    name: 'CPU使用率',
    trend: null as null | number,
    type: 'cpu',
    unit: '%',
  },
  {
    currentValue: 0,
    icon: DatabaseOutlined,
    name: '内存使用率',
    trend: null as null | number,
    type: 'memory',
    unit: '%',
  },
  {
    currentValue: 0,
    icon: HddOutlined,
    name: '磁盘使用率',
    trend: null as null | number,
    type: 'disk',
    unit: '%',
  },
]);

const scalingRecommendations = ref<
  Array<{ source: string } & ScalingRecommendation>
>([]);
const aiInsights = ref<string[]>([]);

// 预测数据缓存
const predictionCache = ref<Record<string, PredictionResponse>>({});
const predictionFailures = ref<string[]>([]);
const metricCards = computed(() =>
  metricsData.value.map((metric) => ({
    ...metric,
    prediction: predictionCache.value[metric.type],
  })),
);
const scope = useAiRequestScope(() => {
  clearPredictions();
  inputData.value = {
    currentCpu: null,
    currentDisk: null,
    currentMemory: null,
    currentQps: null,
  };
});
const predictionLane = scope.createLane();
watch([inputData, timeRange, aiEnhanced], clearPredictions, {
  deep: true,
  flush: 'sync',
});
const costEntries = computed(() =>
  Object.entries(predictionCache.value).flatMap(([type, response]) =>
    response.cost_analysis
      ? [
          {
            cost: response.cost_analysis,
            name: (
              {
                cpu: 'CPU',
                disk: '磁盘',
                memory: '内存',
                qps: 'QPS',
              } as Record<string, string>
            )[type],
            type,
          },
        ]
      : [],
  ),
);
const formatCost = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(2)
    : '未知';
useChartAppearance(() => {
  initTrendChart();
  initUtilizationChart();
  updateCharts();
});
function clearPredictions() {
  predictionLane.invalidate();
  loading.value = false;
  hasInitialData.value = false;
  predictionError.value = '';
  predictionCache.value = {};
  predictionFailures.value = [];
  predictionContext.value = null;
  scalingRecommendations.value = [];
  aiInsights.value = [];
  metricsData.value.forEach((metric) => {
    metric.currentValue = 0;
    metric.trend = null;
  });
  trendChart?.clear();
  utilizationChart?.clear();
}

const updateMetricData = (type: string, response: PredictionResponse) => {
  const metric = metricsData.value.find((m) => m.type === type);
  if (metric) {
    metric.currentValue = response.current_value;

    // 计算趋势
    const predicted = response.predicted_data;
    if (predicted && predicted.length > 0) {
      const lastPoint = predicted[predicted.length - 1];
      if (lastPoint) {
        const lastValue = lastPoint.predicted_value;
        if (response.current_value === 0)
          metric.trend = lastValue === 0 ? 0 : null;
        else
          metric.trend =
            ((lastValue - response.current_value) / response.current_value) *
            100;
      }
    }
  }

  // 更新扩缩容建议
  if (response.scaling_recommendations) {
    scalingRecommendations.value.push(
      ...response.scaling_recommendations.map((item) => ({
        ...item,
        source: metric?.name || type,
      })),
    );
  }

  if (response.ai_enhanced === true && response.ai_insights) {
    aiInsights.value.push(
      ...response.ai_insights.map(
        (insight) => `${metric?.name || type}：${insight}`,
      ),
    );
  }
};

const getSeriesColor = (index: number) => {
  const colors = ['#1890ff', '#ff4d4f', '#faad14', '#52c41a'];
  return colors[index % colors.length];
};

const updateTrendChart = () => {
  if (!trendChart) return;
  const data = alignForecasts(predictionCache.value);
  trendChart.setOption(
    {
      series: data.series.map((series, index) => ({
        ...series,
        areaStyle: chartType.value === 'area' ? {} : undefined,
        connectNulls: false,
        itemStyle: { color: getSeriesColor(index) },
        lineStyle: { width: 2 },
        smooth: false,
        type: 'line',
      })),
      textStyle: { color: chartColors().text },
      xAxis: {
        axisLine: { lineStyle: { color: chartColors().border } },
        data: data.labels,
        type: 'category',
      },
      yAxis: [
        {
          axisLabel: { color: chartColors().muted },
          min: 0,
          name: 'QPS (/s)',
          splitLine: { lineStyle: { color: chartColors().border } },
          type: 'value',
        },
        {
          axisLabel: { color: chartColors().muted },
          max: 100,
          min: 0,
          name: '使用率 (%)',
          splitLine: { show: false },
          type: 'value',
        },
      ],
    },
    { replaceMerge: ['series', 'yAxis'] },
  );
};

const updateUtilizationChart = () => {
  if (!utilizationChart) return;

  utilizationChart.setOption(
    {
      grid: { bottom: 32, left: 48, right: 24, top: 24 },
      series: [
        {
          data: ['cpu', 'memory', 'disk'].map(
            (key) => predictionCache.value[key]?.current_value ?? null,
          ),
          name: '使用率',
          type: 'bar',
        },
      ],
      textStyle: { color: chartColors().text },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: number) => `${value}%`,
      },
      xAxis: {
        axisLabel: { formatter: '{value}%' },
        max: 100,
        min: 0,
        type: 'value',
      },
      yAxis: { data: ['CPU', '内存', '磁盘'], type: 'category' },
    },
    true,
  );
};

const updateCharts = () => {
  updateTrendChart();
  updateUtilizationChart();
};

// 方法定义
const refreshAllPredictions = async () => {
  if (!scope.owner.value || loading.value) return;
  if (!isFormValid.value) {
    message.warning('请填写完整有效的指标数据');
    return;
  }
  const input = { ...inputData.value };
  const { currentCpu, currentDisk, currentMemory, currentQps } = input;
  if (
    currentQps === null ||
    currentCpu === null ||
    currentMemory === null ||
    currentDisk === null
  ) {
    message.warning('请填写完整有效的指标数据');
    return;
  }
  clearPredictions();
  const ticket = predictionLane.begin();
  const hours = Number(timeRange.value);
  const enhanced = aiEnhanced.value;
  loading.value = true;
  try {
    const common = { enable_ai_insights: enhanced, prediction_hours: hours };
    const results = await Promise.allSettled([
      predictQps({ ...common, current_qps: currentQps }),
      predictCpu({ ...common, current_cpu_percent: currentCpu }),
      predictMemory({
        ...common,
        current_memory_percent: currentMemory,
      }),
      predictDisk({ ...common, current_disk_percent: currentDisk }),
    ]);
    if (!predictionLane.current(ticket)) return;
    const keys = ['qps', 'cpu', 'memory', 'disk'];
    const labels = ['QPS', 'CPU', '内存', '磁盘'];
    results.forEach((result, index) => {
      const key = keys[index];
      const label = labels[index];
      if (key === undefined || label === undefined) {
        throw new Error('预测结果与指标定义不匹配');
      }
      if (result.status === 'rejected') {
        predictionFailures.value.push(
          `${label}：${result.reason instanceof Error ? result.reason.message : '服务未返回结果'}`,
        );
        return;
      }
      try {
        forecastPoints(result.value);
      } catch (error) {
        predictionFailures.value.push(
          `${label}：${error instanceof Error ? error.message : '响应数据无效'}`,
        );
        return;
      }
      predictionCache.value[key] = result.value;
      updateMetricData(key, result.value);
    });
    hasInitialData.value = Object.keys(predictionCache.value).length > 0;
    predictionContext.value = hasInitialData.value ? { hours } : null;
    updateCharts();
    if (!hasInitialData.value) {
      predictionError.value =
        '全部预测失败或数据无效，请检查服务与历史数据后重试';
      message.error(predictionError.value);
    } else if (predictionFailures.value.length > 0)
      message.warning('部分预测完成，请重试失败项');
    else if (
      Object.values(predictionCache.value).some(
        (result) =>
          result.fallback_mode ||
          result.method === 'rule_based' ||
          result.ai_fallback_reason ||
          (enhanced && result.ai_enhanced !== true) ||
          result.analysis_failures?.length,
      )
    )
      message.warning('预测已返回，部分功能降级，请查看各指标状态');
    else message.success('预测数据已更新');
  } catch (error) {
    if (!predictionLane.current(ticket)) return;
    predictionError.value =
      error instanceof Error ? error.message : '预测读取失败，请核对参数后重试';
  } finally {
    if (predictionLane.current(ticket)) loading.value = false;
  }
};

const initTrendChart = () => {
  if (!trendChartRef.value) return;

  trendChart?.dispose();
  trendChart = echarts.init(trendChartRef.value);

  const option = {
    backgroundColor: 'transparent',
    grid: {
      bottom: '3%',
      containLabel: true,
      left: '3%',
      right: '4%',
    },
    legend: {
      data: ['QPS', 'CPU', '内存', '磁盘'],
      textStyle: { color: chartColors().text },
    },
    series: [],
    textStyle: { color: chartColors().text },
    tooltip: {
      axisPointer: { type: 'cross' },
      trigger: 'axis',
    },
    xAxis: {
      axisLine: { lineStyle: { color: chartColors().border } },
      data: [],
      type: 'category',
    },
    yAxis: {
      axisLine: { lineStyle: { color: chartColors().border } },
      splitLine: { lineStyle: { color: chartColors().border } },
      type: 'value',
    },
  };

  trendChart.setOption(option);
};

const initUtilizationChart = () => {
  if (!utilizationChartRef.value) return;

  utilizationChart?.dispose();
  utilizationChart = echarts.init(utilizationChartRef.value);

  updateUtilizationChart();
};

const getActionColor = (action: string) => {
  switch (action) {
    case 'maintain': {
      return 'blue';
    }
    case 'scale_down': {
      return 'green';
    }
    case 'scale_up': {
      return 'red';
    }
    default: {
      return 'default';
    }
  }
};

const getActionText = (action: string) => {
  switch (action) {
    case 'maintain': {
      return '保持';
    }
    case 'scale_down': {
      return '缩容';
    }
    case 'scale_up': {
      return '扩容';
    }
    default: {
      return '未知';
    }
  }
};

// 时间转换工具函数：UTC转北京时间
const formatTime = (timestamp: string) => formatPredictionTime(timestamp);
const onTimeRangeChange = () => {
  clearPredictions();
};
const resetForm = () => {
  clearPredictions();
  inputData.value = {
    currentCpu: null,
    currentDisk: null,
    currentMemory: null,
    currentQps: null,
  };
};

const updateChart = () => {
  updateTrendChart();
};

const onAIToggle = () => {
  clearPredictions();
};

// 生命周期
const handleChartResize = () => {
  trendChart?.resize();
  utilizationChart?.resize();
};

let pageDisposed = false;
onMounted(async () => {
  await nextTick();
  if (pageDisposed) return;
  initTrendChart();
  initUtilizationChart();

  // 窗口大小变化时重新调整图表
  window.addEventListener('resize', handleChartResize);
});

onUnmounted(() => {
  pageDisposed = true;
  // 安全地销毁ECharts实例
  if (trendChart && !trendChart.isDisposed()) {
    trendChart.dispose();
    trendChart = null;
  }
  if (utilizationChart && !utilizationChart.isDisposed()) {
    utilizationChart.dispose();
    utilizationChart = null;
  }
  window.removeEventListener('resize', handleChartResize);
});
</script>

<template>
  <OpsPage
    class="predict-dashboard"
    description="对输入指标发起预测，各序列按实际时间对齐"
    title="预测看板"
  >
    <!-- 页面头部 -->
    <template #actions>
      <a-space wrap>
        <a-button @click="resetForm"> 重置 </a-button>
        <a-button
          :disabled="!isFormValid || loading"
          :loading="loading"
          type="primary"
          @click="refreshAllPredictions"
        >
          {{ hasInitialData ? '刷新预测' : '开始预测' }}
        </a-button>
      </a-space>
    </template>
    <a-alert
      v-if="predictionError"
      :message="predictionError"
      role="alert"
      show-icon
      type="error"
    />

    <!-- 数据输入区域 -->
    <a-card class="input-card" title="输入当前指标数据">
      <template #extra>
        <a-tag v-if="hasInitialData" color="blue">数据已输入</a-tag>
        <a-tag v-else color="orange">请填写指标数据</a-tag>
      </template>

      <a-form
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
        layout="horizontal"
      >
        <a-row :gutter="[24, 16]">
          <a-col :md="12" :xs="24">
            <a-form-item label="当前QPS" required>
              <a-input-number
                v-model:value="inputData.currentQps"
                :max="100000"
                :min="0"
                :precision="2"
                addon-after="/s"
                placeholder="输入当前QPS值"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :md="12" :xs="24">
            <a-form-item label="当前CPU使用率" required>
              <a-input-number
                v-model:value="inputData.currentCpu"
                :max="100"
                :min="0"
                :precision="2"
                addon-after="%"
                placeholder="输入当前CPU使用率"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :md="12" :xs="24">
            <a-form-item label="当前内存使用率" required>
              <a-input-number
                v-model:value="inputData.currentMemory"
                :max="100"
                :min="0"
                :precision="2"
                addon-after="%"
                placeholder="输入当前内存使用率"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :md="12" :xs="24">
            <a-form-item label="当前磁盘使用率" required>
              <a-input-number
                v-model:value="inputData.currentDisk"
                :max="100"
                :min="0"
                :precision="2"
                addon-after="%"
                placeholder="输入当前磁盘使用率"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :md="12" :xs="24">
            <a-form-item label="预测时长">
              <a-select
                v-model:value="timeRange"
                style="width: 100%"
                @change="onTimeRangeChange"
              >
                <a-select-option value="1">1小时</a-select-option>
                <a-select-option value="6">6小时</a-select-option>
                <a-select-option value="24">24小时</a-select-option>
                <a-select-option value="72">3天</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :md="12" :xs="24">
            <a-form-item label="AI增强">
              <a-switch v-model:checked="aiEnhanced" />
              <span style="margin-left: 8px">启用AI洞察</span>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
      <p class="request-note">
        仅点击开始或刷新预测时调用服务；改参数或重置不会取消已发出的请求。
      </p>
    </a-card>

    <a-alert
      v-if="predictionFailures.length > 0"
      :message="`以下预测未完成：${predictionFailures.join('、')}，失败项不展示旧数据。`"
      class="mb-4"
      show-icon
      type="warning"
    />
    <!-- 关键指标卡片 -->
    <a-row :gutter="[16, 16]" class="metrics-overview">
      <a-col v-for="metric in metricCards" :key="metric.type" :lg="6" :xs="12">
        <a-card :class="[`metric-${metric.type}`]" class="metric-card">
          <div class="metric-content">
            <div class="metric-header">
              <div class="metric-icon">
                <component :is="metric.icon" />
              </div>
              <div class="metric-info">
                <div class="metric-name">{{ metric.name }}</div>
                <div class="metric-value">
                  {{
                    predictionCache[metric.type]
                      ? metric.currentValue + metric.unit
                      : '暂无预测'
                  }}
                </div>
              </div>
            </div>
            <PredictionProvenance
              v-if="metric.prediction"
              :ai-requested="aiEnhanced"
              :result="metric.prediction"
            />
            <div class="metric-trend">
              <div class="trend-info">
                <span class="trend-label">预测趋势:</span>
                <span
                  v-if="predictionCache[metric.type] && metric.trend !== null"
                  :class="[metric.trend > 0 ? 'trend-up' : 'trend-down']"
                  class="trend-value"
                >
                  <component
                    :is="metric.trend > 0 ? ArrowUpOutlined : ArrowDownOutlined"
                    v-if="metric.trend !== 0"
                  />
                  {{
                    metric.trend === 0
                      ? '持平'
                      : `${Math.abs(metric.trend).toFixed(1)}%`
                  }}
                </span>
                <span v-else-if="predictionCache[metric.type]"
                  >无法计算变化率</span
                >
              </div>
              <div class="prediction-time">
                {{ predictionContext?.hours ?? '未知' }}小时预测
              </div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 预测图表区域 -->
    <a-row :gutter="[16, 16]" class="charts-section">
      <!-- 综合预测趋势图 -->
      <a-col :lg="16" :xs="24">
        <a-card class="chart-card" title="综合预测趋势">
          <template #extra>
            <a-radio-group
              v-model:value="chartType"
              size="small"
              @change="updateChart"
            >
              <a-radio-button value="line">线图</a-radio-button>
              <a-radio-button value="area">面积图</a-radio-button>
            </a-radio-group>
          </template>
          <div ref="trendChartRef" class="chart-container"></div>
        </a-card>
      </a-col>

      <!-- 资源利用率预测 -->
      <a-col :lg="8" :xs="24">
        <a-card class="chart-card" title="当前资源利用率">
          <div ref="utilizationChartRef" class="chart-container-small"></div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 扩缩容建议和AI洞察 -->
    <a-row :gutter="[16, 16]" class="insights-section">
      <!-- 扩缩容建议 -->
      <a-col :lg="12" :xs="24">
        <a-card class="insights-card" title="扩缩容建议">
          <template #extra>
            <a-badge
              :count="scalingRecommendations.length"
              status="processing"
            />
          </template>
          <div class="recommendations-list">
            <div
              v-for="(rec, index) in scalingRecommendations"
              :key="index"
              class="recommendation-item"
            >
              <div class="rec-header">
                <a-tag>{{ rec.source }}</a-tag>
                <a-tag :color="getActionColor(rec.action)">
                  {{ getActionText(rec.action) }}
                </a-tag>
                <span class="rec-confidence"
                  >置信度: {{ formatProbability(rec.confidence) }}</span
                >
              </div>
              <div class="rec-content">
                <div class="rec-time">
                  触发时间: {{ formatTime(rec.trigger_time) }}
                </div>
                <div class="rec-reason">{{ rec.reason }}</div>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>

      <!-- AI智能洞察 -->
      <a-col :lg="12" :xs="24">
        <a-card class="insights-card" title="AI智能洞察">
          <template #extra>
            <a-switch
              v-model:checked="aiEnhanced"
              size="small"
              @change="onAIToggle"
            />
          </template>
          <div class="ai-insights-list">
            <div
              v-for="(insight, index) in aiInsights"
              :key="index"
              class="insight-item"
            >
              <div class="insight-icon">
                <BulbOutlined />
              </div>
              <div class="insight-content">{{ insight }}</div>
            </div>
            <a-empty v-if="aiInsights.length === 0" description="暂无AI洞察">
              <template #image>
                <RobotOutlined style="font-size: 48px; color: #bfbfbf" />
              </template>
            </a-empty>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 成本分析 -->
    <a-row :gutter="[16, 16]" class="cost-section">
      <a-col :xs="24">
        <a-card class="cost-card" title="各指标的成本估算">
          <a-empty
            v-if="costEntries.length === 0"
            description="当前响应未提供成本估算"
          />
          <section
            v-for="entry in costEntries"
            :key="entry.type"
            class="cost-entry"
          >
            <h3>{{ entry.name }}</h3>
            <a-descriptions :column="{ xs: 1, md: 3 }" bordered size="small">
              <a-descriptions-item label="当前每小时成本">
                {{ formatCost(entry.cost.current_hourly_cost) }}
              </a-descriptions-item>
              <a-descriptions-item label="预测每小时成本">
                {{ formatCost(entry.cost.predicted_hourly_cost) }}
              </a-descriptions-item>
              <a-descriptions-item label="潜在节省">
                {{ formatCost(entry.cost.cost_savings_potential) }}
              </a-descriptions-item>
            </a-descriptions>
          </section>
        </a-card>
      </a-col>
    </a-row>
  </OpsPage>
</template>

<style scoped>
/* 响应式设计 */
@media (max-width: 768px) {
  .metric-header {
    gap: 12px;
  }

  .metric-icon {
    width: 24px;
    height: 24px;
    font-size: 20px;
  }

  .metric-value {
    font-size: 20px;
  }

  .chart-container,
  .chart-container-small {
    height: 250px;
  }

  .cost-overview {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 575px) {
  .metric-name,
  .metric-value {
    overflow-wrap: anywhere;
  }

  .metric-header {
    gap: var(--ops-space-sm);
    align-items: flex-start;
  }

  .metric-trend {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .metric-value {
    font-size: 18px;
  }

  .cost-overview {
    grid-template-columns: 1fr;
  }

  .chart-container,
  .chart-container-small {
    min-width: 0;
  }
}

.input-card {
  margin-bottom: var(--ops-space-lg);
  border-radius: var(--ops-radius);
  box-shadow: none;
}

.metrics-overview {
  margin-bottom: var(--ops-space-lg);
}

.metric-card {
  transition: border-color var(--ops-duration) ease-out;
  border-radius: var(--ops-radius);
  overflow: hidden;
}

.metric-card:hover {
  box-shadow: none;
}

.metric-card :deep(.ant-card-body) {
  padding: var(--ops-space-md);
}

.metric-content {
  min-width: 0;
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.metric-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 20px;
  color: var(--ops-muted);
}

.metric-info {
  flex: 1;
  min-width: 0;
}

.metric-name {
  font-size: 14px;
  color: var(--ops-muted);
  margin-bottom: 4px;
}

.metric-value {
  font-size: 24px;
  font-weight: bold;
  color: var(--ops-ink);
}

.metric-trend {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.trend-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trend-label {
  font-size: 12px;
  color: var(--ops-muted);
}

.trend-value {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
}

.trend-up {
  color: #ff4d4f;
}

.trend-down {
  color: #52c41a;
}

.prediction-time {
  font-size: 12px;
  color: var(--ops-muted);
}

.charts-section {
  margin-bottom: var(--ops-space-lg);
}

.chart-card {
  border-radius: var(--ops-radius);
  box-shadow: none;
}

.chart-container {
  height: 350px;
  width: 100%;
}

.chart-container-small {
  height: 300px;
  width: 100%;
}

.insights-section {
  margin-bottom: var(--ops-space-lg);
}

.insights-card {
  border-radius: var(--ops-radius);
  box-shadow: none;
}

.recommendations-list {
  max-height: 300px;
  overflow-y: auto;
}

.recommendation-item {
  padding: 12px;
  border-bottom: 1px solid var(--ops-border);
  transition: background-color 0.2s;
}

.recommendation-item:hover {
  background-color: var(--ops-ground);
}

.recommendation-item:last-child {
  border-bottom: none;
}

.rec-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.rec-confidence {
  font-size: 12px;
  color: var(--ops-muted);
}

.rec-content {
  font-size: 12px;
}

.rec-time {
  color: var(--ops-muted);
  margin-bottom: 4px;
}

.rec-reason {
  color: var(--ops-ink);
}

.ai-insights-list {
  max-height: 300px;
  overflow-y: auto;
}

.insight-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ops-border);
}

.insight-item:last-child {
  border-bottom: none;
}

.insight-icon {
  color: #faad14;
  font-size: 16px;
  margin-top: 2px;
}

.insight-content {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ops-ink);
}

.cost-section {
  margin-bottom: var(--ops-space-lg);
}

.cost-card {
  border-radius: var(--ops-radius);
  box-shadow: none;
}

.cost-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
  padding: 16px 0;
}

.cost-current,
.cost-predicted,
.cost-savings {
  text-align: center;
  padding: 16px;
  border-radius: var(--ops-radius);
  background-color: var(--ops-ground);
}

.cost-label {
  font-size: 14px;
  color: var(--ops-muted);
  margin-bottom: 8px;
}

.cost-value {
  font-size: 24px;
  font-weight: bold;
  color: var(--ops-ink);
}

.cost-value.savings {
  color: #52c41a;
}

.request-note {
  color: var(--ops-muted);
  font-size: 12px;
  margin: var(--ops-space-md) 0 0;
}

.cost-entry {
  margin-bottom: var(--ops-space-lg);
}

/* 页面头部 */
</style>
