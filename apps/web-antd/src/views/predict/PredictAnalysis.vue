<template>
  <div class="predict-analysis">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <LineChartOutlined />
          </div>
          <div class="header-text">
            <h1 class="page-title">智能预测分析</h1>
            <p class="page-subtitle">深度分析和预测系统性能趋势</p>
          </div>
        </div>
        <div class="header-actions">
          <a-button @click="resetForm">
            重置
          </a-button>
          <a-button type="primary" @click="startAnalysis" :loading="analyzing" :disabled="!isFormValid">
            开始分析
          </a-button>
        </div>
      </div>
    </div>

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
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="16">
        <a-card title="预测结果" class="result-card" v-if="predictionResult">
          <template #extra>
            <a-space>
              <a-tag :color="getAccuracyColor(predictionResult.model_accuracy)">
                模型准确率: {{ ((predictionResult.model_accuracy || 0) * 100).toFixed(1) }}%
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
            <a-button type="primary" @click="startAnalysis" :loading="analyzing" :disabled="!isFormValid">
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick, onUnmounted } from 'vue';
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
  LineChartOutlined,
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

const timeMarks = {
  1: '1h',
  6: '6h',
  24: '1d',
  72: '3d',
  168: '1w'
};

// 表单验证
const isFormValid = computed(() => {
  return formData.currentValue !== null && 
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
  // 清空当前值，让用户重新填写
  formData.currentValue = null;
  // 清空之前的预测结果
  predictionResult.value = null;
};

const startAnalysis = async () => {
  if (!isFormValid.value) {
    message.warning(`请填写有效的${getCurrentValueLabel()}值`);
    return;
  }

  analyzing.value = true;
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

    predictionResult.value = response;
    
    await nextTick();
    initCharts();
    message.success('预测分析完成');
  } catch (error) {

    message.error('预测分析失败，请检查输入参数');
  } finally {
    analyzing.value = false;
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

  trendChart = echarts.init(trendChartRef.value);

  const data = predictionResult.value.predicted_data;
  const xAxisData = data.map(point => formatTimeForChart(point.timestamp));
  const predictedData = data.map(point => point.predicted_value);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['预测值', '当前值'],
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
      data: xAxisData,
      axisLine: { lineStyle: { color: 'var(--ant-border-color)' } }
    },
    yAxis: {
      type: 'value',
      name: getCurrentValueLabel(),
      axisLine: { lineStyle: { color: 'var(--ant-border-color)' } },
      splitLine: { lineStyle: { color: 'var(--ant-border-color-split)' } }
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

  confidenceChart = echarts.init(confidenceChartRef.value);

  const data = predictionResult.value.predicted_data;
  const xAxisData = data.map(point => formatTimeForChart(point.timestamp));
  const predictedData = data.map(point => point.predicted_value);
  const upperData = data.map(point => point.confidence_upper || point.predicted_value);
  const lowerData = data.map(point => point.confidence_lower || point.predicted_value);

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const dataIndex = params[0].dataIndex;
        const time = xAxisData[dataIndex];
        const predicted = predictedData[dataIndex];
        const upper = upperData[dataIndex];
        const lower = lowerData[dataIndex];
        return `时间: ${time}<br/>预测值: ${predicted}<br/>置信上限: ${upper}<br/>置信下限: ${lower}`;
      }
    },
    legend: {
      data: ['预测值', '置信上限', '置信下限'],
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
      data: xAxisData,
      axisLine: { lineStyle: { color: 'var(--ant-border-color)' } }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'var(--ant-border-color)' } },
      splitLine: { lineStyle: { color: 'var(--ant-border-color-split)' } }
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
  nextTick(() => {
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
  if (!accuracy) return 'default';
  if (accuracy > 0.9) return 'green';
  if (accuracy > 0.7) return 'orange';
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

const formatTimeForChart = (timestamp: string | Date): string => {
  const beijingTime = convertToBeijingTime(timestamp);
  return beijingTime.toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const resetForm = () => {
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
  message.success('表单已重置');
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
.predict-analysis {
  padding: 24px;
  background-color: var(--ant-background-color-light, #fafafa);
  min-height: 100vh;
}

/* 页面头部 */
.predict-analysis .page-header {
  background: #fff;
  border-radius: 12px;
  padding: 16px 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f0f0;
}

.predict-analysis .header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.predict-analysis .header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.predict-analysis .header-icon {
  font-size: 32px;
  color: #1890ff;
}

.predict-analysis .header-text {
  display: flex;
  flex-direction: column;
}

.predict-analysis .page-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #262626;
  line-height: 1.2;
}

.predict-analysis .page-subtitle {
  color: #8c8c8c;
  margin: 0;
  font-size: 12px;
  margin-top: 4px;
}

.predict-analysis .header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.config-card,
.result-card,
.empty-result-card,
.recommendations-card,
.insights-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
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
  border: 1px solid var(--ant-border-color-split);
  border-radius: 8px;
  transition: all 0.3s;
}

.recommendation-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.rec-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: linear-gradient(135deg, #1890ff, #36cfc9);
  color: white;
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
  color: var(--ant-text-color-secondary);
}

.rec-details {
  font-size: 12px;
}

.rec-time {
  color: var(--ant-text-color-secondary);
  margin-bottom: 4px;
}

.rec-reason {
  color: var(--ant-text-color);
}

.insights-list {
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

.insight-text {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ant-text-color);
}

@media (max-width: 1200px) {
  .predict-analysis :deep(.ant-col-lg-8) {
    margin-bottom: 24px;
  }
}

@media (max-width: 768px) {
  .predict-analysis {
    padding: 16px;
  }
  
  .predict-analysis .page-header {
    padding: 20px;
    margin-bottom: 16px;
  }

  .predict-analysis .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .predict-analysis .header-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .predict-analysis .page-title {
    font-size: 20px;
  }

  .predict-analysis .page-subtitle {
    font-size: 13px;
  }

  .predict-analysis .header-icon {
    font-size: 36px;
  }
  
  .chart-container {
    height: 300px;
  }
  
  .recommendations-grid {
    grid-template-columns: 1fr;
  }
}
</style>
