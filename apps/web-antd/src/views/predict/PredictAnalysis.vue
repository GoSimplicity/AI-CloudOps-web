<template>
  <OpsPage title="预测分析" description="明确开始后预测单个指标，保留真实时间、零值与缺失区间" class="predict-analysis">
    <!-- 页面头部 -->
    <template #actions>
<a-space wrap><a-button @click="resetForm">
            重置
          </a-button>
<a-button type="primary" @click="startAnalysis" :loading="analyzing" :disabled="!isFormValid || analyzing">
            开始分析
          </a-button></a-space>
    </template>
    <a-alert v-if="predictionError" :message="predictionError" type="error" show-icon role="alert" />

    <a-row :gutter="[24, 24]">
      <a-col :xs="24" :lg="8">
        <a-card title="预测配置" class="config-card">
          <a-form :model="formData" layout="vertical">
            <a-form-item label="预测类型" name="predictionType">
              <a-select 
                v-model:value="formData.predictionType" 
                @change="onPredictionTypeChange"
                placeholder="选择预测类型"
              >
                <a-select-option value="qps">
                  <div class="option-content">
                    <ThunderboltOutlined style="color: #1890ff;" />
                    <span>QPS预测</span>
                  </div>
                </a-select-option>
                <a-select-option value="cpu">
                  <div class="option-content">
                    <ApiOutlined style="color: #ff4d4f;" />
                    <span>CPU预测</span>
                  </div>
                </a-select-option>
                <a-select-option value="memory">
                  <div class="option-content">
                    <DatabaseOutlined style="color: #faad14;" />
                    <span>内存预测</span>
                  </div>
                </a-select-option>
                <a-select-option value="disk">
                  <div class="option-content">
                    <HddOutlined style="color: #52c41a;" />
                    <span>磁盘预测</span>
                  </div>
                </a-select-option>
              </a-select>
            </a-form-item>

            <a-form-item :label="getCurrentValueLabel()" name="currentValue" required>
              <a-input-number
                v-model:value="formData.currentValue"
                :min="0"
                :max="getCurrentValueMax()"
                :precision="2"
                style="width: 100%"
                :placeholder="`输入当前${getCurrentValueLabel()}`"
                :addon-after="getCurrentValueUnit()"
                :status="formData.currentValue === null ? 'warning' : ''"
              />
              <div v-if="!isFormValid && formData.currentValue !== null" class="form-error">
                请输入有效的数值范围: 0 - {{ getCurrentValueMax() }}{{ getCurrentValueUnit() }}
              </div>
            </a-form-item>

            <a-form-item label="预测时长" name="predictionHours">
              <a-slider
                v-model:value="formData.predictionHours"
                :min="1"
                :max="168"
                :marks="timeMarks"
                :tipFormatter="(value: number) => `${value}小时`"
              />
            </a-form-item>

            <a-form-item label="时间粒度" name="granularity">
              <a-radio-group v-model:value="formData.granularity" button-style="solid">
                <a-radio-button value="minute">分钟</a-radio-button>
                <a-radio-button value="hour">小时</a-radio-button>
                <a-radio-button value="day">天</a-radio-button>
              </a-radio-group>
            </a-form-item>

            <a-collapse ghost>
              <a-collapse-panel key="advanced" header="高级选项">
                <a-form-item label="目标利用率" name="targetUtilization">
                  <a-slider
                    v-model:value="formData.targetUtilization"
                    :min="0"
                    :max="100"
                    :step="5"
                    :tipFormatter="(value: number) => `${value}%`"
                  />
                </a-form-item>

                <a-form-item label="敏感度" name="sensitivity">
                  <a-slider
                    v-model:value="formData.sensitivity"
                    :min="0"
                    :max="1"
                    :step="0.1"
                    :tipFormatter="(value: number) => value"
                  />
                </a-form-item>

                <a-form-item name="includeConfidence">
                  <a-checkbox v-model:checked="formData.includeConfidence">
                    包含置信区间
                  </a-checkbox>
                </a-form-item>

                <a-form-item name="includeAnomalyDetection">
                  <a-checkbox v-model:checked="formData.includeAnomalyDetection">
                    异常检测
                  </a-checkbox>
                </a-form-item>

                <a-form-item name="enableAiInsights">
                  <a-checkbox v-model:checked="formData.enableAiInsights">
                    启用AI洞察
                  </a-checkbox>
                </a-form-item>
              </a-collapse-panel>
            </a-collapse>
          </a-form>
          <p class="request-note">仅点击开始分析时调用服务；重置或改参数不会取消已发出的预测。</p>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="16">
        <a-card title="预测结果" class="result-card" v-if="predictionResult">
          <template #extra>
            <a-space wrap>
              <a-tag :color="getAccuracyColor(predictionResult.model_accuracy)">
                模型准确率: {{ Number.isFinite(predictionResult.model_accuracy) ? (predictionResult.model_accuracy! * 100).toFixed(1) + '%' : '未知' }}
              </a-tag>
              <a-button size="small" @click="exportResult">
                <DownloadOutlined />
                导出
              </a-button>
            </a-space>
          </template>

          <a-tabs v-model:activeKey="activeChartTab" @change="onChartTabChange">
            <a-tab-pane key="trend" tab="趋势预测">
              <div ref="trendChartRef" class="chart-container"></div>
            </a-tab-pane>
            <a-tab-pane key="confidence" tab="置信区间" v-if="formData.includeConfidence">
              <div ref="confidenceChartRef" class="chart-container"></div>
            </a-tab-pane>
          </a-tabs>
        </a-card>

        <a-card v-else class="empty-result-card">
          <a-empty description="暂无预测结果">
            <template #image>
              <BarChartOutlined style="font-size: 64px; color: #bfbfbf;" />
            </template>
            <a-button type="primary" @click="startAnalysis" :loading="analyzing" :disabled="!isFormValid || analyzing">
              开始预测分析
            </a-button>
          </a-empty>
        </a-card>

        <a-card title="扩缩容建议" class="recommendations-card" v-if="predictionResult?.scaling_recommendations?.length">
          <div class="recommendations-grid">
            <div 
              v-for="(rec, index) in predictionResult.scaling_recommendations" 
              :key="index" 
              class="recommendation-item"
            >
              <div class="rec-icon">
                <component :is="getActionIcon(rec.action)" />
              </div>
              <div class="rec-content">
                <div class="rec-action">
                  <a-tag :color="getActionColor(rec.action)">
                    {{ getActionText(rec.action) }}
                  </a-tag>
                  <span class="rec-confidence">{{ (rec.confidence * 100).toFixed(1) }}%</span>
                </div>
                <div class="rec-details">
                  <div class="rec-time">{{ formatTime(rec.trigger_time) }}</div>
                  <div class="rec-reason">{{ rec.reason }}</div>
                </div>
              </div>
            </div>
          </div>
        </a-card>

        <a-card title="AI智能洞察" class="insights-card" v-if="predictionResult?.ai_insights?.length">
          <div class="insights-list">
            <div v-for="(insight, index) in predictionResult.ai_insights" :key="index" class="insight-item">
              <BulbOutlined class="insight-icon" />
              <div class="insight-text">{{ insight }}</div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>
  </OpsPage>
</template>

<script setup lang="ts">
import OpsPage from '#/components/ops/OpsPage.vue';
import { useAiRequestScope } from '../assistant/useAiRequestScope';
import { chartColors, useChartAppearance } from '../assistant/chart-appearance';
import { forecastPoints, confidenceValues, formatPredictionTime } from './prediction-series';
import { ref, reactive, computed, onMounted, nextTick, onUnmounted, watch } from 'vue';
// 按需引入echarts，减少打包体积
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent, DataZoomComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// 注册必需的组件
echarts.use([
  LineChart,
  GridComponent, TooltipComponent, LegendComponent, TitleComponent, DataZoomComponent, MarkLineComponent,
  CanvasRenderer
]);
import { message } from 'ant-design-vue';
import {
  ThunderboltOutlined,
  ApiOutlined,
  DatabaseOutlined,
  HddOutlined,
  DownloadOutlined,
  BarChartOutlined,
  BulbOutlined
} from '@ant-design/icons-vue';
import {
  predictQps,
  predictCpu,
  predictMemory,
  predictDisk,
  type PredictionResponse,
  type QpsPredictionRequest,
  type CpuPredictionRequest,
  type MemoryPredictionRequest,
  type DiskPredictionRequest,
  PredictionGranularity
} from '#/api/core/aiops/predict';

const analyzing = ref(false);
const predictionError = ref('');
const activeChartTab = ref('trend');
const predictionResult = ref<PredictionResponse | null>(null);

const trendChartRef = ref<HTMLElement>();
const confidenceChartRef = ref<HTMLElement>();
let trendChart: echarts.ECharts | null = null;
let confidenceChart: echarts.ECharts | null = null;

const formData = reactive({
  predictionType: 'qps',
  currentValue: null as number | null,
  predictionHours: 24,
  granularity: PredictionGranularity.HOUR,
  targetUtilization: 70,
  sensitivity: 0.5,
  includeConfidence: true,
  includeAnomalyDetection: true,
  enableAiInsights: true
});

const scope = useAiRequestScope(() => { analysisLane.invalidate(); analyzing.value = false; predictionError.value = ''; predictionResult.value = null; disposeCharts(); formData.currentValue = null; });
const analysisLane = scope.createLane();
watch(formData, () => { analysisLane.invalidate(); analyzing.value = false; predictionError.value = ''; predictionResult.value = null; disposeCharts(); }, { flush: 'sync' });
useChartAppearance(() => { if (predictionResult.value) initCharts(); });
function disposeCharts() { trendChart?.dispose(); confidenceChart?.dispose(); trendChart = null; confidenceChart = null; }

const timeMarks = {
  1: '1h',
  6: '6h',
  24: '1d',
  72: '3d',
  168: '1w'
};

// 表单验证
const isFormValid = computed(() => {
  return !!scope.owner.value && Number.isFinite(formData.currentValue) && formData.currentValue !== null &&
         formData.currentValue >= 0 &&
         formData.currentValue <= getCurrentValueMax();
});

const getCurrentValueLabel = () => {
  switch (formData.predictionType) {
    case 'qps': return 'QPS';
    case 'cpu': return 'CPU使用率';
    case 'memory': return '内存使用率';
    case 'disk': return '磁盘使用率';
    default: return '当前值';
  }
};

const getCurrentValueUnit = () => {
  switch (formData.predictionType) {
    case 'qps': return '/s';
    case 'cpu':
    case 'memory':
    case 'disk': return '%';
    default: return '';
  }
};

const getCurrentValueMax = () => {
  switch (formData.predictionType) {
    case 'qps': return 10000;
    case 'cpu':
    case 'memory':
    case 'disk': return 100;
    default: return 100;
  }
};

const onPredictionTypeChange = () => {
  analysisLane.invalidate(); analyzing.value = false; predictionError.value = ''; disposeCharts();
  // 清空当前值，让用户重新填写
  formData.currentValue = null;
  // 清空之前的预测结果
  predictionResult.value = null;
};

const startAnalysis = async () => {
  if (!scope.owner.value || analyzing.value) return;
  if (!isFormValid.value) {
    message.warning(`请填写有效的${getCurrentValueLabel()}值`);
    return;
  }

  const ticket = analysisLane.begin();
  analyzing.value = true; predictionResult.value = null; predictionError.value = ''; disposeCharts();
  try {
    let response: PredictionResponse;

    const baseRequest = {
      prediction_hours: formData.predictionHours,
      granularity: formData.granularity,
      include_confidence: formData.includeConfidence,
      include_anomaly_detection: formData.includeAnomalyDetection,
      target_utilization: formData.targetUtilization / 100, // 将百分比转换为小数
      sensitivity: formData.sensitivity,
      enable_ai_insights: formData.enableAiInsights
    };

    switch (formData.predictionType) {
      case 'qps':
        response = await predictQps({
          ...baseRequest,
          current_qps: formData.currentValue
        } as QpsPredictionRequest);
        break;
      case 'cpu':
        response = await predictCpu({
          ...baseRequest,
          current_cpu_percent: formData.currentValue
        } as CpuPredictionRequest);
        break;
      case 'memory':
        response = await predictMemory({
          ...baseRequest,
          current_memory_percent: formData.currentValue
        } as MemoryPredictionRequest);
        break;
      case 'disk':
        response = await predictDisk({
          ...baseRequest,
          current_disk_percent: formData.currentValue
        } as DiskPredictionRequest);
        break;
      default:
        throw new Error('不支持的预测类型');
    }

    if (!analysisLane.current(ticket)) return;
    forecastPoints(response);
    predictionResult.value = response;

    await nextTick();
    if (!analysisLane.current(ticket)) return;
    initCharts();
    message.success('预测分析完成');
  } catch (error) {
    if (!analysisLane.current(ticket)) return;
    predictionResult.value = null; disposeCharts();
    predictionError.value = error instanceof Error ? error.message : '预测分析失败，请核对输入后重试';
  } finally {
    if (analysisLane.current(ticket)) analyzing.value = false;
  }
};

const initCharts = () => {
  initTrendChart();
  if (formData.includeConfidence) {
    initConfidenceChart();
  }
};

const initTrendChart = () => {
  if (!trendChartRef.value || !predictionResult.value) return;

  trendChart?.dispose();
  trendChart = echarts.init(trendChartRef.value);

  const data = forecastPoints(predictionResult.value).map(item => item.point);
  const xAxisData = data.map(point => formatTimeForChart(point.timestamp));
  const predictedData = data.map(point => point.predicted_value);

  const option = {
    textStyle: { color: chartColors().text },
    backgroundColor: "transparent",
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['预测值', '当前值'],
      textStyle: { color: chartColors().text }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      axisLine: { lineStyle: { color: chartColors().border } }
    },
    yAxis: {
      type: 'value',
      name: getCurrentValueLabel(),
      axisLine: { lineStyle: { color: chartColors().border } },
      splitLine: { lineStyle: { color: chartColors().border } }
    },
    series: [
      {
        name: '预测值',
        type: 'line',
        data: predictedData,
        smooth: true,
        lineStyle: { width: 3, color: '#1890ff' },
        areaStyle: { opacity: 0.1, color: '#1890ff' }
      },
      {
        name: '当前值',
        type: 'line',
        data: Array(xAxisData.length).fill(predictionResult.value.current_value),
        lineStyle: { type: 'dashed', color: '#ff4d4f' }
      }
    ]
  };

  trendChart.setOption(option);
};

const initConfidenceChart = () => {
  if (!confidenceChartRef.value || !predictionResult.value) return;

  confidenceChart?.dispose();
  confidenceChart = echarts.init(confidenceChartRef.value);

  const data = forecastPoints(predictionResult.value).map(item => item.point);
  const xAxisData = data.map(point => formatTimeForChart(point.timestamp));
  const predictedData = data.map(point => point.predicted_value);
  const upperData = confidenceValues(data, 'confidence_upper');
  const lowerData = confidenceValues(data, 'confidence_lower');

  const option = {
    textStyle: { color: chartColors().text },
    backgroundColor: "transparent",
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const dataIndex = params[0].dataIndex;
        const time = xAxisData[dataIndex];
        const predicted = predictedData[dataIndex];
        const upper = upperData[dataIndex] ?? '未知';
        const lower = lowerData[dataIndex] ?? '未知';
        return `时间: ${time}<br/>预测值: ${predicted}<br/>置信上限: ${upper}<br/>置信下限: ${lower}`;
      }
    },
    legend: {
      data: ['预测值', '置信上限', '置信下限'],
      textStyle: { color: chartColors().text }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      axisLine: { lineStyle: { color: chartColors().border } }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: chartColors().border } },
      splitLine: { lineStyle: { color: chartColors().border } }
    },
    series: [
      {
        name: '置信上限',
        type: 'line',
        data: upperData,
        lineStyle: { color: '#52c41a', type: 'dashed' },
        symbol: 'none'
      },
      {
        name: '预测值',
        type: 'line',
        data: predictedData,
        lineStyle: { color: '#1890ff', width: 3 },
        areaStyle: { opacity: 0.1 }
      },
      {
        name: '置信下限',
        type: 'line',
        data: lowerData,
        lineStyle: { color: '#52c41a', type: 'dashed' },
        symbol: 'none'
      }
    ]
  };

  confidenceChart.setOption(option);
};

const onChartTabChange = (key: string) => {
  activeChartTab.value = key;
  const result = predictionResult.value;
  nextTick(() => {
    if (predictionResult.value !== result || !result || activeChartTab.value !== key) return;
    switch (key) {
      case 'trend':
        initTrendChart();
        break;
      case 'confidence':
        initConfidenceChart();
        break;
    }
  });
};

const getAccuracyColor = (accuracy?: number) => {
  if (!Number.isFinite(accuracy)) return 'default';
  if (accuracy! > 0.9) return 'green';
  if (accuracy! > 0.7) return 'orange';
  return 'red';
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

const getActionIcon = (action: string) => {
  switch (action) {
    case 'scale_up': return 'ArrowUpOutlined';
    case 'scale_down': return 'ArrowDownOutlined';
    case 'maintain': return 'MinusOutlined';
    default: return 'MinusOutlined';
  }
};

// 时间转换工具函数：UTC转北京时间
const formatTime = (timestamp: string) => formatPredictionTime(timestamp);
const formatTimeForChart = (timestamp: string | Date) => formatPredictionTime(timestamp, true);

const resetForm = () => {
  analysisLane.invalidate(); analyzing.value = false; predictionError.value = ''; disposeCharts();
  Object.assign(formData, {
    predictionType: 'qps',
    currentValue: null,
    predictionHours: 24,
    granularity: PredictionGranularity.HOUR,
    targetUtilization: 70,
    sensitivity: 0.5,
    includeConfidence: true,
    includeAnomalyDetection: true,
    enableAiInsights: true
  });
  predictionResult.value = null;

};

const exportResult = () => {
  if (!predictionResult.value) return;

  const data = JSON.stringify(predictionResult.value, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `prediction-result-${Date.now()}.json`;
  link.click();

  URL.revokeObjectURL(url);
  message.success('预测结果已导出');
};

const handleChartResize = () => {
  trendChart?.resize();
  confidenceChart?.resize();
};

onMounted(() => {
  window.addEventListener('resize', handleChartResize);
});

onUnmounted(() => {
  // 安全地销毁ECharts实例
  if (trendChart && !trendChart.isDisposed()) {
    trendChart.dispose();
    trendChart = null;
  }
  if (confidenceChart && !confidenceChart.isDisposed()) {
    confidenceChart.dispose();
    confidenceChart = null;
  }
  window.removeEventListener('resize', handleChartResize);
});
</script>

<style scoped>

/* 页面头部 */








.config-card,
.result-card,
.empty-result-card,
.recommendations-card,
.insights-card {
  border-radius: var(--ops-radius);
  box-shadow: none;
  margin-bottom: var(--ops-space-lg);
}

.option-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-error {
  color: #ff4d4f;
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.4;
}

.chart-container {
  height: 400px;
  width: 100%;
}

.empty-result-card {
  text-align: center;
  padding: 48px 24px;
}

.recommendations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.recommendation-item {
  display: flex;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  transition: border-color var(--ops-duration) ease-out;
}

.recommendation-item:hover {
  box-shadow: none;
}

.rec-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: var(--ops-accent);
  color: hsl(var(--primary-foreground));
}

.rec-content {
  flex: 1;
}

.rec-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.rec-confidence {
  font-size: 12px;
  color: var(--ops-muted);
}

.rec-details {
  font-size: 12px;
}

.rec-time {
  color: var(--ops-muted);
  margin-bottom: 4px;
}

.rec-reason {
  color: var(--ops-ink);
}

.insights-list {
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

.insight-text {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ops-ink);
}

@media (max-width: 1200px) {
  .predict-analysis :deep(.ant-col-lg-8) {
    margin-bottom: var(--ops-space-lg);
  }
}

@media (max-width: 768px) {







  .chart-container {
    height: 300px;
  }

  .recommendations-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 575px) {
  .metric-name { overflow-wrap: anywhere; }
  .metric-value { font-size: 18px; }
  .cost-overview { grid-template-columns: 1fr; }
  .chart-container, .chart-container-small { min-width: 0; }
}
.request-note { color: var(--ops-muted); font-size: 12px; margin: var(--ops-space-md) 0 0; }
</style>
