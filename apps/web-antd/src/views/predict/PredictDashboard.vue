<template>
  <div class="predict-dashboard">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <BarChartOutlined />
          </div>
          <div class="header-text">
            <h1 class="page-title">AI预测看板</h1>
            <p class="page-subtitle">智能预测系统资源使用趋势</p>
          </div>
        </div>
        <div class="header-actions">
          <a-button @click="resetForm">
            重置
          </a-button>
          <a-button type="primary" @click="refreshAllPredictions" :loading="loading" :disabled="!isFormValid">
            {{ hasInitialData ? '刷新预测' : '开始预测' }}
          </a-button>
        </div>
      </div>
    </div>

    <!-- 数据输入区域 -->
    <a-card title="输入当前指标数据" class="input-card" :class="{ 'highlight-required': !hasInitialData }">
      <template #extra>
        <a-tag color="blue" v-if="hasInitialData">数据已输入</a-tag>
        <a-tag color="orange" v-else>请填写指标数据</a-tag>
      </template>

      <a-form layout="horizontal" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
        <a-row :gutter="[24, 16]">
          <a-col :xs="24" :md="12">
            <a-form-item label="当前QPS" required>
              <a-input-number
                v-model:value="inputData.currentQps"
                :min="0"
                :max="100000"
                :precision="2"
                placeholder="输入当前QPS值"
                style="width: 100%"
                addon-after="/s"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="当前CPU使用率" required>
              <a-input-number
                v-model:value="inputData.currentCpu"
                :min="0"
                :max="100"
                :precision="2"
                placeholder="输入当前CPU使用率"
                style="width: 100%"
                addon-after="%"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="当前内存使用率" required>
              <a-input-number
                v-model:value="inputData.currentMemory"
                :min="0"
                :max="100"
                :precision="2"
                placeholder="输入当前内存使用率"
                style="width: 100%"
                addon-after="%"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="当前磁盘使用率" required>
              <a-input-number
                v-model:value="inputData.currentDisk"
                :min="0"
                :max="100"
                :precision="2"
                placeholder="输入当前磁盘使用率"
                style="width: 100%"
                addon-after="%"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="预测时长">
              <a-select v-model:value="timeRange" @change="onTimeRangeChange" style="width: 100%">
                <a-select-option value="1">1小时</a-select-option>
                <a-select-option value="6">6小时</a-select-option>
                <a-select-option value="24">24小时</a-select-option>
                <a-select-option value="72">3天</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="AI增强">
              <a-switch v-model:checked="aiEnhanced" />
              <span style="margin-left: 8px;">启用AI洞察</span>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

<a-alert v-if="predictionFailures.length" type="warning" :message="`以下预测未完成：${predictionFailures.join('、')}，失败项不展示旧数据。`" show-icon class="mb-4" />
    <!-- 关键指标卡片 -->
    <a-row :gutter="[16, 16]" class="metrics-overview">
      <a-col :xs="24" :sm="12" :lg="6" v-for="metric in metricsData" :key="metric.type">
        <a-card :class="['metric-card', `metric-${metric.type}`]">
          <div class="metric-content">
            <div class="metric-header">
              <div class="metric-icon">
                <component :is="metric.icon" />
              </div>
              <div class="metric-info">
                <div class="metric-name">{{ metric.name }}</div>
                <div class="metric-value">{{ predictionCache[metric.type] ? metric.currentValue + metric.unit : '暂无预测' }}</div>
              </div>
            </div>
            <div class="metric-trend">
              <div class="trend-info">
                <span class="trend-label">预测趋势:</span>
                <span v-if="predictionCache[metric.type]" :class="['trend-value', metric.trend > 0 ? 'trend-up' : 'trend-down']">
                  <component :is="metric.trend > 0 ? 'ArrowUpOutlined' : 'ArrowDownOutlined'" />
                  {{ Math.abs(metric.trend) }}%
                </span>
              </div>
              <div class="prediction-time">{{ timeRange }}小时预测</div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 预测图表区域 -->
    <a-row :gutter="[16, 16]" class="charts-section">
      <!-- 综合预测趋势图 -->
      <a-col :xs="24" :lg="16">
        <a-card title="综合预测趋势" class="chart-card">
          <template #extra>
            <a-radio-group v-model:value="chartType" size="small" @change="updateChart">
              <a-radio-button value="line">线图</a-radio-button>
              <a-radio-button value="area">面积图</a-radio-button>
            </a-radio-group>
          </template>
          <div ref="trendChartRef" class="chart-container"></div>
        </a-card>
      </a-col>

      <!-- 资源利用率预测 -->
      <a-col :xs="24" :lg="8">
        <a-card title="资源利用率预测" class="chart-card">
          <div ref="utilizationChartRef" class="chart-container-small"></div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 扩缩容建议和AI洞察 -->
    <a-row :gutter="[16, 16]" class="insights-section">
      <!-- 扩缩容建议 -->
      <a-col :xs="24" :lg="12">
        <a-card title="扩缩容建议" class="insights-card">
          <template #extra>
            <a-badge :count="scalingRecommendations.length" status="processing" />
          </template>
          <div class="recommendations-list">
            <div v-for="(rec, index) in scalingRecommendations" :key="index" class="recommendation-item">
              <div class="rec-header">
                <a-tag :color="getActionColor(rec.action)">
                  {{ getActionText(rec.action) }}
                </a-tag>
                <span class="rec-confidence">置信度: {{ (rec.confidence * 100).toFixed(1) }}%</span>
              </div>
              <div class="rec-content">
                <div class="rec-time">触发时间: {{ formatTime(rec.trigger_time) }}</div>
                <div class="rec-reason">{{ rec.reason }}</div>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>

      <!-- AI智能洞察 -->
      <a-col :xs="24" :lg="12">
        <a-card title="AI智能洞察" class="insights-card">
          <template #extra>
            <a-switch v-model:checked="aiEnhanced" @change="onAIToggle" size="small" />
          </template>
          <div class="ai-insights-list">
            <div v-for="(insight, index) in aiInsights" :key="index" class="insight-item">
              <div class="insight-icon">
                <BulbOutlined />
              </div>
              <div class="insight-content">{{ insight }}</div>
            </div>
            <a-empty v-if="aiInsights.length === 0" description="暂无AI洞察">
              <template #image>
                <RobotOutlined style="font-size: 48px; color: #bfbfbf;" />
              </template>
            </a-empty>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 成本分析 -->
    <a-row :gutter="[16, 16]" class="cost-section">
      <a-col :xs="24">
        <a-card title="成本分析与优化建议" class="cost-card">
          <div class="cost-overview">
            <div class="cost-current">
              <div class="cost-label">当前每小时成本</div>
              <div class="cost-value">${{ costAnalysis.current_hourly_cost || 0 }}</div>
            </div>
            <div class="cost-predicted">
              <div class="cost-label">预测每小时成本</div>
              <div class="cost-value">${{ costAnalysis.predicted_hourly_cost || 0 }}</div>
            </div>
            <div class="cost-savings">
              <div class="cost-label">潜在节省</div>
              <div class="cost-value savings">${{ costAnalysis.cost_savings_potential || 0 }}</div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue';
// 按需引入echarts，减少打包体积
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent, DataZoomComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// 注册必需的组件
echarts.use([
  LineChart, BarChart, PieChart,
  GridComponent, TooltipComponent, LegendComponent, TitleComponent, DataZoomComponent,
  CanvasRenderer
]);
import {
  BarChartOutlined, 
  ApiOutlined, 
  DatabaseOutlined, 
  HddOutlined, 
  ThunderboltOutlined,
  BulbOutlined,
  RobotOutlined
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import {
  predictQps,
  predictCpu,
  predictMemory,
  predictDisk,
  type PredictionResponse,
  type ScalingRecommendation,
  type CostAnalysis
} from '#/api/core/aiops/predict';

// 响应式数据
const loading = ref(false);
const timeRange = ref('24');
const chartType = ref('line');
const aiEnhanced = ref(true);
const hasInitialData = ref(false);

// 用户输入数据
const inputData = ref({
  currentQps: null as number | null,
  currentCpu: null as number | null,
  currentMemory: null as number | null,
  currentDisk: null as number | null
});

// 表单验证
const isFormValid = computed(() => {
  return inputData.value.currentQps !== null && 
         inputData.value.currentCpu !== null && 
         inputData.value.currentMemory !== null && 
         inputData.value.currentDisk !== null &&
         inputData.value.currentQps >= 0 &&
         inputData.value.currentCpu >= 0 && inputData.value.currentCpu <= 100 &&
         inputData.value.currentMemory >= 0 && inputData.value.currentMemory <= 100 &&
         inputData.value.currentDisk >= 0 && inputData.value.currentDisk <= 100;
});

// 图表引用
const trendChartRef = ref<HTMLElement>();
const utilizationChartRef = ref<HTMLElement>();
let trendChart: echarts.ECharts | null = null;
let utilizationChart: echarts.ECharts | null = null;

// 指标数据
const metricsData = ref([
  {
    type: 'qps',
    name: 'QPS',
    icon: ThunderboltOutlined,
    currentValue: 0,
    unit: '/s',
    trend: 0
  },
  {
    type: 'cpu',
    name: 'CPU使用率',
    icon: ApiOutlined,
    currentValue: 0,
    unit: '%',
    trend: 0
  },
  {
    type: 'memory',
    name: '内存使用率',
    icon: DatabaseOutlined,
    currentValue: 0,
    unit: '%',
    trend: 0
  },
  {
    type: 'disk',
    name: '磁盘使用率',
    icon: HddOutlined,
    currentValue: 0,
    unit: '%',
    trend: 0
  }
]);

const scalingRecommendations = ref<ScalingRecommendation[]>([]);
const aiInsights = ref<string[]>([]);
const costAnalysis = ref<CostAnalysis>({
  cost_trend_analysis: {}
});

// 预测数据缓存
const predictionCache = ref<Record<string, PredictionResponse>>({});
const predictionFailures = ref<string[]>([]);

// 方法定义
const refreshAllPredictions = async () => {
  if (!isFormValid.value) {
    message.warning('请填写完整的指标数据');
    return;
  }

  loading.value = true;
  try {
    // 清空之前的数据
    scalingRecommendations.value = [];
    aiInsights.value = [];

    predictionCache.value = {};
    predictionFailures.value = [];
    costAnalysis.value = { cost_trend_analysis: {} };
    const results = await Promise.allSettled([
      fetchQpsPrediction(),
      fetchCpuPrediction(),
      fetchMemoryPrediction(),
      fetchDiskPrediction()
    ]);

    const labels = ['QPS', 'CPU', '内存', '磁盘'];
    predictionFailures.value = results.flatMap((result, index) => result.status === 'rejected' ? [labels[index]!] : []);
    hasInitialData.value = results.some(result => result.status === 'fulfilled');
    updateCharts();
    if (predictionFailures.value.length === 4) message.error('全部预测失败，请检查服务状态后重试');
    else if (predictionFailures.value.length) message.warning('部分预测完成，请重试失败项');
    else message.success('预测数据已更新');
  } catch (error) {

    message.error('获取预测数据失败');
  } finally {
    loading.value = false;
  }
};

const fetchQpsPrediction = async () => {
  try {
    const response = await predictQps({
      current_qps: inputData.value.currentQps!,
      prediction_hours: Number(timeRange.value),
      enable_ai_insights: aiEnhanced.value
    });

    predictionCache.value.qps = response;
    updateMetricData('qps', response);
  } catch (error) {
    throw error;
  }
};

const fetchCpuPrediction = async () => {
  try {
    const response = await predictCpu({
      current_cpu_percent: inputData.value.currentCpu!,
      prediction_hours: Number(timeRange.value),
      enable_ai_insights: aiEnhanced.value
    });

    predictionCache.value.cpu = response;
    updateMetricData('cpu', response);
  } catch (error) {
    throw error;
  }
};

const fetchMemoryPrediction = async () => {
  try {
    const response = await predictMemory({
      current_memory_percent: inputData.value.currentMemory!,
      prediction_hours: Number(timeRange.value),
      enable_ai_insights: aiEnhanced.value
    });

    predictionCache.value.memory = response;
    updateMetricData('memory', response);
  } catch (error) {
    throw error;
  }
};

const fetchDiskPrediction = async () => {
  try {
    const response = await predictDisk({
      current_disk_percent: inputData.value.currentDisk!,
      prediction_hours: Number(timeRange.value),
      enable_ai_insights: aiEnhanced.value
    });

    predictionCache.value.disk = response;
    updateMetricData('disk', response);
  } catch (error) {
    throw error;
  }
};

const updateMetricData = (type: string, response: PredictionResponse) => {
  const metric = metricsData.value.find(m => m.type === type);
  if (metric) {
    metric.currentValue = response.current_value;

    // 计算趋势
    const predicted = response.predicted_data;
    if (predicted && predicted.length > 0) {
      const lastPoint = predicted[predicted.length - 1];
      if (lastPoint) {
        const lastValue = lastPoint.predicted_value;
        metric.trend = response.current_value === 0 ? 0 : ((lastValue - response.current_value) / response.current_value) * 100;
      }
    }
  }

  // 更新扩缩容建议
  if (response.scaling_recommendations) {
    scalingRecommendations.value.push(...response.scaling_recommendations);
  }

  if (response.ai_insights) {
    aiInsights.value.push(...response.ai_insights);
  }

  // 更新成本分析
  if (response.cost_analysis) {
    costAnalysis.value = response.cost_analysis;
  }
};

const initTrendChart = () => {
  if (!trendChartRef.value) return;

  trendChart = echarts.init(trendChartRef.value);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['QPS', 'CPU', '内存', '磁盘'],
      textStyle: { color: 'var(--ant-text-color)' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: [],
      axisLine: { lineStyle: { color: 'var(--ant-border-color)' } }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'var(--ant-border-color)' } },
      splitLine: { lineStyle: { color: 'var(--ant-border-color-split)' } }
    },
    series: []
  };

  trendChart.setOption(option);
};

const initUtilizationChart = () => {
  if (!utilizationChartRef.value) return;

  utilizationChart = echarts.init(utilizationChartRef.value);

  updateUtilizationChart();
};

const updateCharts = () => {
  updateTrendChart();
  updateUtilizationChart();
};

const updateTrendChart = () => {
  if (!trendChart) return;

  const categories = ['QPS', 'CPU', '内存', '磁盘'];
  const series: any[] = [];
  const xAxisData: string[] = [];

  // 构建时间轴（使用北京时间）
  for (let i = 0; i < Number(timeRange.value); i++) {
    const utcTime = new Date(Date.now() + i * 60 * 60 * 1000);
    const beijingTime = convertToBeijingTime(utcTime);
    xAxisData.push(beijingTime.getHours().toString().padStart(2, '0') + ':00');
  }

  // 构建系列数据
  categories.forEach((category, index) => {
    let type = category.toLowerCase();
    if (type === 'cpu') type = 'cpu';
    if (type === '内存') type = 'memory';
    if (type === '磁盘') type = 'disk';

    const prediction = predictionCache.value[type];
    const data: number[] = [];

    if (prediction && prediction.predicted_data) {
      prediction.predicted_data.forEach(point => {
        data.push(point.predicted_value);
      });
    }

    // 填充数据到指定长度
    while (data.length < Number(timeRange.value)) {
      data.push(0);
    }

    series.push({
      name: category,
      type: chartType.value === 'area' ? 'line' : 'line',
      smooth: true,
      data: data,
      areaStyle: chartType.value === 'area' ? {} : undefined,
      lineStyle: { width: 3 },
      itemStyle: { color: getSeriesColor(index) }
    });
  });

  trendChart.setOption({
    xAxis: { data: xAxisData },
    series: series
  }, { replaceMerge: ['series'] });
};

const updateUtilizationChart = () => {
  if (!utilizationChart) return;

  utilizationChart.setOption({
    tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${value}%` },
    grid: { left: 48, right: 24, top: 24, bottom: 32 },
    xAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category', data: ['CPU', '内存', '磁盘'] },
    series: [{ name: '使用率', type: 'bar', data: ['cpu', 'memory', 'disk'].map(key => predictionCache.value[key]?.current_value ?? null) }],
  }, true);
};

const getSeriesColor = (index: number) => {
  const colors = ['#1890ff', '#ff4d4f', '#faad14', '#52c41a'];
  return colors[index % colors.length];
};

const getActionColor = (action: string) => {
  switch (action) {
    case 'scale_up': return 'red';
    case 'scale_down': return 'green';
    case 'maintain': return 'blue';
    default: return 'default';
  }
};

const getActionText = (action: string) => {
  switch (action) {
    case 'scale_up': return '扩容';
    case 'scale_down': return '缩容';
    case 'maintain': return '保持';
    default: return '未知';
  }
};

// 时间转换工具函数：UTC转北京时间
const convertToBeijingTime = (utcTimestamp: string | Date): Date => {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;
  // 北京时间 = UTC时间 + 8小时
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
};

const formatTime = (timestamp: string) => {
  const beijingTime = convertToBeijingTime(timestamp);
  return beijingTime.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const onTimeRangeChange = () => {
  if (hasInitialData.value) {
    refreshAllPredictions();
  }
};

const resetForm = () => {
  inputData.value = {
    currentQps: null,
    currentCpu: null,
    currentMemory: null,
    currentDisk: null
  };
  hasInitialData.value = false;
  predictionCache.value = {};
  predictionFailures.value = [];
  scalingRecommendations.value = [];
  aiInsights.value = [];
  costAnalysis.value = { cost_trend_analysis: {} };

  // 重置指标数据
  metricsData.value.forEach(metric => {
    metric.currentValue = 0;
    metric.trend = 0;
  });

  // 清空图表
  if (trendChart) {
    trendChart.clear();
  }
  if (utilizationChart) {
    utilizationChart.clear();
  }

  message.success('表单已重置');
};

const updateChart = () => {
  updateTrendChart();
};

const onAIToggle = () => {
  refreshAllPredictions();
};



// 生命周期
const handleChartResize = () => {
  trendChart?.resize();
  utilizationChart?.resize();
};

onMounted(async () => {
  await nextTick();
  initTrendChart();
  initUtilizationChart();

  // 窗口大小变化时重新调整图表
  window.addEventListener('resize', handleChartResize);
});

onUnmounted(() => {
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

<style scoped>
.predict-dashboard {
  padding: 24px;
  background-color: var(--ant-background-color-light, var(--ops-ground));
  min-height: 100vh;
}

/* 页面头部 */
.predict-dashboard .page-header {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 16px 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--ops-border);
}

.predict-dashboard .header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.predict-dashboard .header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.predict-dashboard .header-icon {
  font-size: 32px;
  color: #1890ff;
}

.predict-dashboard .header-text {
  display: flex;
  flex-direction: column;
}

.predict-dashboard .page-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: var(--ops-ink);
  line-height: 1.2;
}

.predict-dashboard .page-subtitle {
  color: var(--ops-muted);
  margin: 0;
  font-size: 12px;
  margin-top: 4px;
}

.predict-dashboard .header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.input-card {
  margin-bottom: 24px;
  border-radius: var(--ops-radius);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.input-card.highlight-required {
  border: 2px solid #faad14;
  box-shadow: 0 0 10px rgba(250, 173, 20, 0.3);
}

.metrics-overview {
  margin-bottom: 24px;
}

.metric-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: var(--ops-radius);
  overflow: hidden;
}

.metric-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.metric-content {
  padding: 8px 0;
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.metric-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: hsl(var(--primary-foreground));
}

.metric-qps .metric-icon {
  background: var(--ops-accent);
}

.metric-cpu .metric-icon {
  background: var(--ops-accent);
}

.metric-memory .metric-icon {
  background: var(--ops-accent);
}

.metric-disk .metric-icon {
  background: var(--ops-accent);
}

.metric-info {
  flex: 1;
}

.metric-name {
  font-size: 14px;
  color: var(--ant-text-color-secondary);
  margin-bottom: 4px;
}

.metric-value {
  font-size: 24px;
  font-weight: bold;
  color: var(--ant-text-color);
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
  color: var(--ant-text-color-secondary);
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
  color: var(--ant-text-color-secondary);
}

.charts-section {
  margin-bottom: 24px;
}

.chart-card {
  border-radius: var(--ops-radius);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
  margin-bottom: 24px;
}

.insights-card {
  border-radius: var(--ops-radius);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.recommendations-list {
  max-height: 300px;
  overflow-y: auto;
}

.recommendation-item {
  padding: 12px;
  border-bottom: 1px solid var(--ant-border-color-split);
  transition: background-color 0.2s;
}

.recommendation-item:hover {
  background-color: var(--ant-background-color-light);
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
  color: var(--ant-text-color-secondary);
}

.rec-content {
  font-size: 12px;
}

.rec-time {
  color: var(--ant-text-color-secondary);
  margin-bottom: 4px;
}

.rec-reason {
  color: var(--ant-text-color);
}

.ai-insights-list {
  max-height: 300px;
  overflow-y: auto;
}

.insight-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ant-border-color-split);
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
  color: var(--ant-text-color);
}

.cost-section {
  margin-bottom: 24px;
}

.cost-card {
  border-radius: var(--ops-radius);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
  background-color: var(--ant-background-color-light);
}

.cost-label {
  font-size: 14px;
  color: var(--ant-text-color-secondary);
  margin-bottom: 8px;
}

.cost-value {
  font-size: 24px;
  font-weight: bold;
  color: var(--ant-text-color);
}

.cost-value.savings {
  color: #52c41a;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .predict-dashboard {
    padding: 16px;
  }

  .predict-dashboard .page-header {
    padding: 20px;
    margin-bottom: 16px;
  }

  .predict-dashboard .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .predict-dashboard .header-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .predict-dashboard .page-title {
    font-size: 20px;
  }

  .predict-dashboard .page-subtitle {
    font-size: 13px;
  }

  .predict-dashboard .header-icon {
    font-size: 36px;
  }

  .metric-header {
    gap: 12px;
  }

  .metric-icon {
    width: 40px;
    height: 40px;
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
</style>
