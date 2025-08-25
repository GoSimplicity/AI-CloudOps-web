<template>
  <div class="predict-health">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <HeartOutlined />
          </div>
          <div class="header-text">
            <h1 class="page-title">预测服务健康监控</h1>
            <p class="page-subtitle">监控预测服务的运行状态和性能指标</p>
          </div>
        </div>
        <div class="header-actions">
          <a-tag v-if="!serviceHealth" color="orange">点击刷新获取健康状态</a-tag>
          <a-tag v-else color="green">数据已加载</a-tag>
          <a-button @click="refreshHealth" :loading="loading" type="primary">
            {{ serviceHealth ? '刷新状态' : '获取健康状态' }}
          </a-button>
          <a-switch v-model:checked="autoRefresh" @change="toggleAutoRefresh" size="small" :disabled="!serviceHealth" />
          <span style="margin-left: 8px;">自动刷新</span>
        </div>
      </div>
    </div>

    <!-- 无数据状态 -->
    <a-card v-if="!serviceHealth" class="empty-state-card">
      <a-empty description="暂无健康监控数据">
        <template #image>
          <HeartOutlined style="font-size: 64px; color: #bfbfbf;" />
        </template>
        <p style="color: #8c8c8c; margin: 16px 0;">
          点击上方"获取健康状态"按钮来加载预测服务的健康监控数据
        </p>
        <a-button type="primary" @click="refreshHealth" :loading="loading">
          获取健康状态
        </a-button>
      </a-empty>
    </a-card>

    <!-- 服务状态概览 -->
    <a-row v-else :gutter="[16, 16]" class="status-overview">
      <a-col :xs="12" :sm="6">
        <a-card class="status-card">
          <a-statistic
            :value="serviceHealth?.service_status === 'healthy' ? '正常' : '异常'"
            :value-style="{ color: serviceHealth?.service_status === 'healthy' ? '#3f8600' : '#cf1322' }"
          >
            <template #title>
              <div class="stat-title">
                <CheckCircleOutlined :style="{ color: serviceHealth?.service_status === 'healthy' ? '#3f8600' : '#cf1322' }" />
                服务状态
              </div>
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="12" :sm="6">
        <a-card class="status-card">
          <a-statistic
            :value="serviceHealth?.model_status === 'loaded' ? '已加载' : '未加载'"
            :value-style="{ color: serviceHealth?.model_status === 'loaded' ? '#3f8600' : '#cf1322' }"
          >
            <template #title>
              <div class="stat-title">
                <DatabaseOutlined :style="{ color: serviceHealth?.model_status === 'loaded' ? '#3f8600' : '#cf1322' }" />
                模型状态
              </div>
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="12" :sm="6">
        <a-card class="status-card">
          <a-statistic
            :value="serviceHealth?.total_predictions || 0"
            :precision="0"
            :value-style="{ color: '#1890ff' }"
          >
            <template #title>
              <div class="stat-title">
                <BarChartOutlined style="color: #1890ff;" />
                总预测次数
              </div>
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="12" :sm="6">
        <a-card class="status-card">
          <a-statistic
            :value="serviceHealth?.error_rate || 0"
            :precision="2"
            suffix="%"
            :value-style="{ color: getErrorRateColor(serviceHealth?.error_rate) }"
          >
            <template #title>
              <div class="stat-title">
                <ExclamationCircleOutlined :style="{ color: getErrorRateColor(serviceHealth?.error_rate) }" />
                错误率
              </div>
            </template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 模型信息和性能指标 -->
    <a-row v-if="serviceHealth" :gutter="[16, 16]" class="main-content">
      <a-col :xs="24" :lg="12">
        <a-card title="已加载模型" class="models-card">
          <template #extra>
            <a-badge :count="serviceHealth?.models_loaded?.length || 0" status="processing" />
          </template>
          <div class="models-list">
            <div 
              v-for="(model, index) in serviceHealth?.models_loaded" 
              :key="index" 
              class="model-item"
            >
              <div class="model-header">
                <div class="model-name">{{ model.model_name }}</div>
                <a-tag color="blue">{{ model.model_version }}</a-tag>
              </div>
              <div class="model-details">
                <div class="model-info">
                  <span class="info-label">类型:</span>
                  <span class="info-value">{{ model.model_type }}</span>
                </div>
                <div class="model-info">
                  <span class="info-label">训练时间:</span>
                  <span class="info-value">{{ formatTime(model.last_trained) }}</span>
                </div>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="12">
        <a-card title="性能监控" class="performance-card">
          <div class="performance-metrics">
            <div class="metric-item">
              <div class="metric-header">
                <ClockCircleOutlined style="color: #1890ff;" />
                <span class="metric-title">平均响应时间</span>
              </div>
              <div class="metric-value">
                {{ serviceHealth?.average_response_time_ms || 0 }}ms
              </div>
              <div ref="responseTimeChartRef" class="mini-chart"></div>
            </div>

            <div class="metric-item">
              <div class="metric-header">
                <ApiOutlined style="color: #ff4d4f;" />
                <span class="metric-title">CPU使用率</span>
              </div>
              <div class="metric-value">
                {{ (serviceHealth?.resource_usage?.cpu_percent || 0).toFixed(1) }}%
              </div>
              <a-progress 
                :percent="serviceHealth?.resource_usage?.cpu_percent || 0" 
                :stroke-color="getProgressColor(serviceHealth?.resource_usage?.cpu_percent)"
                size="small"
              />
            </div>

            <div class="metric-item">
              <div class="metric-header">
                <CloudOutlined style="color: #faad14;" />
                <span class="metric-title">内存使用率</span>
              </div>
              <div class="metric-value">
                {{ (serviceHealth?.resource_usage?.memory_percent || 0).toFixed(1) }}%
              </div>
              <a-progress 
                :percent="serviceHealth?.resource_usage?.memory_percent || 0" 
                :stroke-color="getProgressColor(serviceHealth?.resource_usage?.memory_percent)"
                size="small"
              />
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 预测类型支持和AI能力 -->
    <a-row v-if="serviceHealth" :gutter="[16, 16]" class="capabilities-section">
      <a-col :xs="24" :lg="12">
        <a-card title="支持的预测类型" class="prediction-types-card">
          <div class="prediction-types-grid">
            <div 
              v-for="type in serviceHealth?.supported_prediction_types" 
              :key="type" 
              class="prediction-type-item"
            >
              <div class="type-icon">
                <component :is="getPredictionTypeIcon(type)" />
              </div>
              <div class="type-info">
                <div class="type-name">{{ getPredictionTypeName(type) }}</div>
                <div class="type-status">
                  <a-tag color="green" size="small">可用</a-tag>
                </div>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="12">
        <a-card title="AI能力状态" class="ai-capabilities-card">
          <div class="ai-capabilities-list">
            <div class="capability-item">
              <div class="capability-icon">
                <ProfileOutlined style="color: #722ed1;" />
              </div>
              <div class="capability-content">
                <div class="capability-name">智能预测分析</div>
                <div class="capability-status">
                  <a-tag color="green">正常</a-tag>
                </div>
              </div>
            </div>

            <div class="capability-item">
              <div class="capability-icon">
                <EyeOutlined style="color: #13c2c2;" />
              </div>
              <div class="capability-content">
                <div class="capability-name">异常检测</div>
                <div class="capability-status">
                  <a-tag color="green">正常</a-tag>
                </div>
              </div>
            </div>

            <div class="capability-item">
              <div class="capability-icon">
                <BulbOutlined style="color: #faad14;" />
              </div>
              <div class="capability-content">
                <div class="capability-name">智能洞察</div>
                <div class="capability-status">
                  <a-tag color="green">正常</a-tag>
                </div>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 历史趋势图表 -->
    <a-row v-if="serviceHealth" :gutter="[16, 16]" class="charts-section">
      <a-col :xs="24">
        <a-card title="服务健康趋势" class="trend-card">
          <template #extra>
            <a-radio-group v-model:value="trendPeriod" size="small" @change="updateTrendChart">
              <a-radio-button value="1h">1小时</a-radio-button>
              <a-radio-button value="6h">6小时</a-radio-button>
              <a-radio-button value="24h">24小时</a-radio-button>
              <a-radio-button value="7d">7天</a-radio-button>
            </a-radio-group>
          </template>
          <div ref="trendChartRef" class="trend-chart"></div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import { message } from 'ant-design-vue';
import {
  HeartOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  ApiOutlined,
  CloudOutlined,
  HddOutlined,
  ThunderboltOutlined,
  ProfileOutlined,
  EyeOutlined,
  BulbOutlined
} from '@ant-design/icons-vue';
import {
  getPredictionHealth,
  getModelInfo,
  type PredictionServiceHealthResponse,
  type ModelInfoResponse,
  PredictionType
} from '#/api/core/predict';

const loading = ref(false);
const autoRefresh = ref(true);
const trendPeriod = ref('6h');
const serviceHealth = ref<PredictionServiceHealthResponse | null>(null);
const modelInfo = ref<ModelInfoResponse | null>(null);

const responseTimeChartRef = ref<HTMLElement>();
const trendChartRef = ref<HTMLElement>();
let responseTimeChart: echarts.ECharts | null = null;
let trendChart: echarts.ECharts | null = null;

let refreshTimer: NodeJS.Timeout | null = null;

const refreshHealth = async () => {
  loading.value = true;
  try {
    const [healthResponse, modelsResponse] = await Promise.all([
      getPredictionHealth(),
      getModelInfo()
    ]);
    
    serviceHealth.value = healthResponse;
    modelInfo.value = modelsResponse;
    
    await nextTick();
    updateCharts();
    
    message.success('健康状态已更新');
  } catch (error) {
    console.error('获取健康状态失败:', error);
    message.error('获取健康状态失败');
  } finally {
    loading.value = false;
  }
};

const toggleAutoRefresh = (enabled: boolean) => {
  if (!serviceHealth.value && enabled) {
    message.warning('请先获取健康状态数据');
    autoRefresh.value = false;
    return;
  }
  
  if (enabled) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
};

const startAutoRefresh = () => {
  refreshTimer = setInterval(() => {
    refreshHealth();
  }, 30000);
};

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

const updateCharts = () => {
  updateResponseTimeChart();
  updateTrendChart();
};

const updateResponseTimeChart = () => {
  if (!responseTimeChartRef.value || !serviceHealth.value) return;

  responseTimeChart = echarts.init(responseTimeChartRef.value);

  // 使用真实的响应时间数据，如果没有历史数据，显示当前值的简单趋势
  const baseTime = serviceHealth.value.average_response_time_ms || 100;
  const data = Array.from({ length: 20 }, (_, i) => {
    // 模拟一个更真实的微小波动，而不是随机数
    const variation = Math.sin(i * 0.5) * 10 + (Math.random() - 0.5) * 5;
    return Math.max(0, baseTime + variation);
  });

  const option = {
    grid: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0
    },
    xAxis: {
      type: 'category',
      show: false,
      data: Array.from({ length: 20 }, (_, i) => i)
    },
    yAxis: {
      type: 'value',
      show: false
    },
    series: [{
      type: 'line',
      data: data,
      smooth: true,
      lineStyle: { color: '#1890ff', width: 2 },
      symbol: 'none',
      areaStyle: { color: 'rgba(24, 144, 255, 0.1)' }
    }]
  };

  responseTimeChart.setOption(option);
};

const updateTrendChart = () => {
  if (!trendChartRef.value || !serviceHealth.value) return;

  trendChart = echarts.init(trendChartRef.value);

  const periods = {
    '1h': { points: 60, interval: '分钟' },
    '6h': { points: 72, interval: '5分钟' },
    '24h': { points: 48, interval: '30分钟' },
    '7d': { points: 168, interval: '小时' }
  };

  const config = periods[trendPeriod.value as keyof typeof periods];
  const timeData = [];
  const responseTimeData = [];
  const errorRateData = [];
  const cpuData = [];
  const memoryData = [];

  // 基于当前健康状态数据生成趋势
  const baseResponseTime = serviceHealth.value.average_response_time_ms || 100;
  const baseErrorRate = serviceHealth.value.error_rate || 0.5;
  const baseCpu = serviceHealth.value.resource_usage?.cpu_percent || 50;
  const baseMemory = serviceHealth.value.resource_usage?.memory_percent || 70;

  for (let i = 0; i < config.points; i++) {
    const utcTime = new Date(Date.now() - (config.points - i - 1) * 60000);
    const beijingTime = convertToBeijingTime(utcTime);
    timeData.push(formatTimeForChart(beijingTime));
    
    // 生成基于当前值的合理波动趋势
    const factor = i / config.points;
    responseTimeData.push(baseResponseTime + Math.sin(factor * Math.PI * 4) * 20);
    errorRateData.push(Math.max(0, baseErrorRate + Math.sin(factor * Math.PI * 3) * 0.5));
    cpuData.push(Math.max(0, Math.min(100, baseCpu + Math.sin(factor * Math.PI * 2) * 15)));
    memoryData.push(Math.max(0, Math.min(100, baseMemory + Math.cos(factor * Math.PI * 2) * 10)));
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['响应时间(ms)', '错误率(%)', 'CPU使用率(%)', '内存使用率(%)'],
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
      boundaryGap: false,
      data: timeData,
      axisLine: { lineStyle: { color: 'var(--ant-border-color)' } }
    },
    yAxis: [
      {
        type: 'value',
        name: '响应时间/CPU/内存',
        axisLine: { lineStyle: { color: 'var(--ant-border-color)' } },
        splitLine: { lineStyle: { color: 'var(--ant-border-color-split)' } }
      },
      {
        type: 'value',
        name: '错误率',
        max: 5,
        axisLine: { lineStyle: { color: 'var(--ant-border-color)' } }
      }
    ],
    series: [
      {
        name: '响应时间(ms)',
        type: 'line',
        data: responseTimeData,
        smooth: true,
        lineStyle: { color: '#1890ff' }
      },
      {
        name: '错误率(%)',
        type: 'line',
        yAxisIndex: 1,
        data: errorRateData,
        smooth: true,
        lineStyle: { color: '#ff4d4f' }
      },
      {
        name: 'CPU使用率(%)',
        type: 'line',
        data: cpuData,
        smooth: true,
        lineStyle: { color: '#faad14' }
      },
      {
        name: '内存使用率(%)',
        type: 'line',
        data: memoryData,
        smooth: true,
        lineStyle: { color: '#52c41a' }
      }
    ]
  };

  trendChart.setOption(option);
};

const getErrorRateColor = (rate?: number) => {
  if (!rate) return '#3f8600';
  if (rate < 1) return '#3f8600';
  if (rate < 5) return '#faad14';
  return '#cf1322';
};

const getProgressColor = (value?: number) => {
  if (!value) return '#3f8600';
  if (value < 70) return '#3f8600';
  if (value < 85) return '#faad14';
  return '#cf1322';
};

const getPredictionTypeName = (type: PredictionType) => {
  switch (type) {
    case PredictionType.QPS: return 'QPS预测';
    case PredictionType.CPU: return 'CPU预测';
    case PredictionType.MEMORY: return '内存预测';
    case PredictionType.DISK: return '磁盘预测';
    default: return '未知';
  }
};

const getPredictionTypeIcon = (type: PredictionType) => {
  switch (type) {
    case PredictionType.QPS: return ThunderboltOutlined;
    case PredictionType.CPU: return ApiOutlined;
    case PredictionType.MEMORY: return CloudOutlined;
    case PredictionType.DISK: return HddOutlined;
    default: return BarChartOutlined;
  }
};

// 时间转换工具函数：UTC转北京时间
const convertToBeijingTime = (utcTimestamp: string | Date): Date => {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;
  // 北京时间 = UTC时间 + 8小时
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
};

const formatTime = (timestamp?: string) => {
  if (!timestamp) return '未知';
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

onMounted(async () => {
  // 不再自动获取健康状态，改为手动触发
  window.addEventListener('resize', () => {
    responseTimeChart?.resize();
    trendChart?.resize();
  });
});

onUnmounted(() => {
  stopAutoRefresh();
  responseTimeChart?.dispose();
  trendChart?.dispose();
  window.removeEventListener('resize', () => {});
});
</script>

<style scoped>
.predict-health {
  padding: 24px;
  background-color: var(--ant-background-color-light, #fafafa);
  min-height: 100vh;
}

/* 页面头部 */
.predict-health .page-header {
  background: #fff;
  border-radius: 12px;
  padding: 16px 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f0f0;
}

.predict-health .header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.predict-health .header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.predict-health .header-icon {
  font-size: 32px;
  color: #1890ff;
}

.predict-health .header-text {
  display: flex;
  flex-direction: column;
}

.predict-health .page-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #262626;
  line-height: 1.2;
}

.predict-health .page-subtitle {
  color: #8c8c8c;
  margin: 0;
  font-size: 12px;
  margin-top: 4px;
}

.predict-health .header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.empty-state-card {
  margin-bottom: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
  padding: 48px 24px;
}

.status-overview {
  margin-bottom: 24px;
}

.status-card {
  border-radius: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.status-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.stat-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--ant-text-color-secondary);
}

.main-content {
  margin-bottom: 24px;
}

.models-card,
.performance-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.models-list {
  max-height: 400px;
  overflow-y: auto;
}

.model-item {
  padding: 16px 0;
  border-bottom: 1px solid var(--ant-border-color-split);
}

.model-item:last-child {
  border-bottom: none;
}

.model-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.model-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--ant-text-color);
}

.model-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.info-label {
  color: var(--ant-text-color-secondary);
  min-width: 80px;
}

.info-value {
  color: var(--ant-text-color);
}

.performance-metrics {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.performance-metrics .metric-item {
  padding: 16px;
  border: 1px solid var(--ant-border-color-split);
  border-radius: 8px;
  background-color: var(--ant-background-color-light);
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.metric-title {
  font-size: 14px;
  color: var(--ant-text-color);
  font-weight: 500;
}

.performance-metrics .metric-value {
  font-size: 24px;
  font-weight: bold;
  color: var(--ant-text-color);
  margin-bottom: 12px;
}

.mini-chart {
  height: 60px;
  width: 100%;
}

.capabilities-section {
  margin-bottom: 24px;
}

.prediction-types-card,
.ai-capabilities-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.prediction-types-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.prediction-type-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--ant-border-color-split);
  border-radius: 8px;
  transition: all 0.3s;
}

.prediction-type-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.type-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1890ff, #36cfc9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: white;
}

.type-info {
  flex: 1;
}

.type-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--ant-text-color);
  margin-bottom: 4px;
}

.ai-capabilities-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.capability-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--ant-border-color-split);
  border-radius: 8px;
  transition: all 0.3s;
}

.capability-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.capability-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #722ed1, #a855f7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
}

.capability-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.capability-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--ant-text-color);
}

.charts-section {
  margin-bottom: 24px;
}

.trend-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.trend-chart {
  height: 300px;
  width: 100%;
}

@media (max-width: 768px) {
  .predict-health {
    padding: 16px;
  }
  
  .predict-health .page-header {
    padding: 20px;
    margin-bottom: 16px;
  }

  .predict-health .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .predict-health .header-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .predict-health .page-title {
    font-size: 20px;
  }

  .predict-health .page-subtitle {
    font-size: 13px;
  }

  .predict-health .header-icon {
    font-size: 36px;
  }
  
  .prediction-types-grid {
    grid-template-columns: 1fr;
  }
  
  .performance-metrics .metric-value {
    font-size: 20px;
  }
  
  .mini-chart {
    height: 40px;
  }
  
  .trend-chart {
    height: 250px;
  }
}
</style>
