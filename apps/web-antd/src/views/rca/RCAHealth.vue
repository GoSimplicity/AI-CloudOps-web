<template>
  <div class="rca-health">
    <div class="page-header">
      <h1 class="page-title">
        <HeartOutlined class="title-icon" />
        RCA服务健康监控
      </h1>
      <div class="header-actions">
        <a-tag v-if="!serviceHealth" color="orange">点击刷新获取健康状态</a-tag>
        <a-tag v-else :color="serviceHealth.status === 'healthy' ? 'green' : 'red'">
          {{ serviceHealth.status === 'healthy' ? '服务健康' : '服务异常' }}
        </a-tag>
        <a-button @click="refreshHealth" :loading="loading" type="primary">
          <ReloadOutlined />
          {{ serviceHealth ? '刷新状态' : '获取健康状态' }}
        </a-button>
        <a-switch v-model:checked="autoRefresh" @change="toggleAutoRefresh" size="small" :disabled="!serviceHealth" />
        <span style="margin-left: 8px;">自动刷新</span>
      </div>
    </div>

    <!-- 错误状态提示 -->
    <a-alert 
      v-if="dataError.hasError && serviceHealth"
      :message="dataError.isServiceDown ? 'RCA服务连接异常' : '数据获取异常'"
      :description="dataError.errorMessage"
      :type="dataError.isServiceDown ? 'warning' : 'error'"
      show-icon
      closable
      style="margin-bottom: 16px;"
      @close="resetErrorState"
    />

    <!-- 无数据状态 -->
    <a-card v-if="!serviceHealth && !dataError.hasError" class="empty-state-card">
      <a-empty description="暂无健康监控数据">
        <template #image>
          <HeartOutlined style="font-size: 64px; color: #bfbfbf;" />
        </template>
        <p style="color: #8c8c8c; margin: 16px 0;">
          点击上方"获取健康状态"按钮来加载RCA服务的健康监控数据
        </p>
        <a-button type="primary" @click="refreshHealth" :loading="loading">
          <ReloadOutlined />
          获取健康状态
        </a-button>
      </a-empty>
    </a-card>

    <!-- 服务离线状态 -->
    <a-card v-if="dataError.isServiceDown" class="offline-state-card">
      <a-empty description="RCA服务暂不可用">
        <template #image>
          <CloseOutlined style="font-size: 64px; color: #ff4d4f;" />
        </template>
        <p style="color: #8c8c8c; margin: 16px 0;">
          服务可能正在维护或遇到连接问题，显示最后已知状态
        </p>
        <a-button type="primary" @click="refreshHealth" :loading="loading">
          <ReloadOutlined />
          重试连接
        </a-button>
      </a-empty>
    </a-card>

    <!-- 服务状态概览 -->
    <a-row v-if="serviceHealth" :gutter="[16, 16]" class="status-overview">
      <a-col :xs="12" :sm="6">
        <a-card class="status-card">
          <a-statistic
            :value="dataError.isServiceDown ? '离线' : 
                   (serviceHealth?.status === 'healthy' ? '正常' : 
                    serviceHealth?.status === 'unknown' ? '未知' : '异常')"
            :value-style="{ color: dataError.isServiceDown ? '#ff4d4f' :
                                   (serviceHealth?.status === 'healthy' ? '#3f8600' : '#cf1322') }"
          >
            <template #title>
              <div class="stat-title">
                <CheckCircleOutlined :style="{ color: dataError.isServiceDown ? '#ff4d4f' :
                                                      (serviceHealth?.status === 'healthy' ? '#3f8600' : '#cf1322') }" />
                服务状态
              </div>
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="12" :sm="6">
        <a-card class="status-card">
          <a-statistic
            :value="serviceHealth?.prometheus_connected ? '已连接' : '未连接'"
            :value-style="{ color: serviceHealth?.prometheus_connected ? '#3f8600' : '#cf1322' }"
          >
            <template #title>
              <div class="stat-title">
                <DatabaseOutlined :style="{ color: serviceHealth?.prometheus_connected ? '#3f8600' : '#cf1322' }" />
                Prometheus
              </div>
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="12" :sm="6">
        <a-card class="status-card">
          <a-statistic
            :value="serviceHealth?.kubernetes_connected ? '已连接' : '未连接'"
            :value-style="{ color: serviceHealth?.kubernetes_connected ? '#3f8600' : '#cf1322' }"
          >
            <template #title>
              <div class="stat-title">
                <ClusterOutlined :style="{ color: serviceHealth?.kubernetes_connected ? '#3f8600' : '#cf1322' }" />
                Kubernetes
              </div>
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="12" :sm="6">
        <a-card class="status-card">
          <a-statistic
            :value="serviceHealth?.redis_connected ? '已连接' : '未连接'"
            :value-style="{ color: serviceHealth?.redis_connected ? '#3f8600' : '#cf1322' }"
          >
            <template #title>
              <div class="stat-title">
                <GoldOutlined :style="{ color: serviceHealth?.redis_connected ? '#3f8600' : '#cf1322' }" />
                Redis
              </div>
            </template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 服务信息和配置 -->
    <a-row v-if="serviceHealth" :gutter="[16, 16]" class="main-content">
      <a-col :xs="24" :lg="12">
        <a-card title="服务信息" class="service-info-card">
          <template #extra>
            <a-tag color="blue">{{ serviceHealth.version || serviceInfo?.version || 'Unknown' }}</a-tag>
          </template>
          <div class="service-info-content">
            <div class="info-item">
              <div class="info-label">
                <SaveOutlined style="color: #1890ff;" />
                <span>服务名称</span>
              </div>
              <div class="info-value">{{ serviceInfo?.service || 'RCA服务' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">
                <TagOutlined style="color: #52c41a;" />
                <span>版本号</span>
              </div>
              <div class="info-value">{{ serviceHealth.version || serviceInfo?.version || '未知版本' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">
                <FileTextOutlined style="color: #faad14;" />
                <span>描述</span>
              </div>
              <div class="info-value">{{ serviceInfo?.description || 'RCA智能根因分析服务' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">
                <ClockCircleOutlined style="color: #722ed1;" />
                <span>最后检查时间</span>
              </div>
              <div class="info-value">{{ formatTime(serviceHealth.last_check_time) }}</div>
            </div>
            <div class="info-item" v-if="serviceInfo?.status">
              <div class="info-label">
                <CheckCircleOutlined style="color: #52c41a;" />
                <span>服务状态</span>
              </div>
              <div class="info-value">{{ serviceInfo.status }}</div>
            </div>
          </div>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="12">
        <a-card title="系统资源监控" class="performance-card">
          <div class="performance-metrics">
            <div class="metric-item">
              <div class="metric-header">
                <CloudServerOutlined style="color: #1890ff;" />
                <span class="metric-title">服务状态</span>
              </div>
              <div class="metric-value">
                <a-tag :color="serviceHealth?.status === 'healthy' ? 'green' : 'red'">
                  {{ serviceHealth?.status === 'healthy' ? '健康运行' : '异常状态' }}
                </a-tag>
              </div>
            </div>

            <div class="metric-item">
              <div class="metric-header">
                <ApiOutlined style="color: #ff4d4f;" />
                <span class="metric-title">连接状态</span>
              </div>
              <div class="metric-value">
                <div class="connection-grid">
                  <div class="connection-item">
                    <span>Prometheus</span>
                    <a-tag :color="serviceHealth?.prometheus_connected ? 'green' : 'red'" size="small">
                      {{ serviceHealth?.prometheus_connected ? '正常' : '异常' }}
                    </a-tag>
                  </div>
                  <div class="connection-item">
                    <span>Kubernetes</span>
                    <a-tag :color="serviceHealth?.kubernetes_connected ? 'green' : 'red'" size="small">
                      {{ serviceHealth?.kubernetes_connected ? '正常' : '异常' }}
                    </a-tag>
                  </div>
                  <div class="connection-item">
                    <span>Redis</span>
                    <a-tag :color="serviceHealth?.redis_connected ? 'green' : 'red'" size="small">
                      {{ serviceHealth?.redis_connected ? '正常' : '异常' }}
                    </a-tag>
                  </div>
                </div>
              </div>
            </div>

            <div class="metric-item">
              <div class="metric-header">
                <BarChartOutlined style="color: #52c41a;" />
                <span class="metric-title">响应时间趋势</span>
              </div>
              <div ref="responseTimeChartRef" class="mini-chart"></div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 服务能力和端点信息 -->
    <a-row v-if="serviceHealth" :gutter="[16, 16]" class="capabilities-section">
      <a-col :xs="24" :lg="12">
        <a-card title="服务能力" class="capabilities-card">
          <div class="capabilities-list">
            <div v-if="serviceConfig?.config?.capabilities?.length">
              <div 
                v-for="capability in serviceConfig.config.capabilities" 
                :key="capability" 
                class="capability-item"
              >
                <div class="capability-icon">
                  <component :is="getCapabilityIcon(capability)" />
                </div>
                <div class="capability-content">
                  <div class="capability-name">{{ getCapabilityDisplayName(capability) }}</div>
                  <div class="capability-status">
                    <a-tag color="green">可用</a-tag>
                  </div>
                </div>
              </div>
            </div>
            <div v-else>
              <!-- 默认能力展示 -->
              <div class="capability-item">
                <div class="capability-icon">
                  <PartitionOutlined style="color: #722ed1;" />
                </div>
                <div class="capability-content">
                  <div class="capability-name">根因分析</div>
                  <div class="capability-status">
                    <a-tag color="green">可用</a-tag>
                  </div>
                </div>
              </div>
              <div class="capability-item">
                <div class="capability-icon">
                  <SearchOutlined style="color: #13c2c2;" />
                </div>
                <div class="capability-content">
                  <div class="capability-name">快速诊断</div>
                  <div class="capability-status">
                    <a-tag color="green">可用</a-tag>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="12">
        <a-card title="服务配置" class="config-card">
          <template #extra v-if="serviceConfig">
            <a-tag color="processing">{{ formatTime(serviceConfig.timestamp) }}</a-tag>
          </template>
          <div class="config-content" v-if="serviceConfig?.config">
            <div class="config-section">
              <div class="config-title">基础信息</div>
              <div class="config-items">
                <div class="config-item">
                  <span class="config-key">服务名称:</span>
                  <span class="config-value">{{ serviceConfig.config.service_name || 'N/A' }}</span>
                </div>
                <div class="config-item">
                  <span class="config-key">状态:</span>
                  <span class="config-value">{{ formatConfigValue(serviceConfig.config.status) }}</span>
                </div>
              </div>
            </div>

            <div class="config-section" v-if="serviceConfig.config.components">
              <div class="config-title">组件状态</div>
              <div class="config-items">
                <div class="config-item" v-for="(value, key) in serviceConfig.config.components" :key="key">
                  <span class="config-key">{{ formatConfigKey(key as any) }}:</span>
                  <span class="config-value">
                    <a-tag :color="value ? 'green' : 'red'" size="small">
                      {{ value ? '启用' : '禁用' }}
                    </a-tag>
                  </span>
                </div>
              </div>
            </div>

            <div class="config-section" v-if="serviceConfig.config.cache_config">
              <div class="config-title">缓存配置</div>
              <div class="config-items">
                <div class="config-item" v-for="(value, key) in serviceConfig.config.cache_config" :key="key">
                  <span class="config-key">{{ formatConfigKey(key as any) }}:</span>
                  <span class="config-value">{{ formatConfigValue(value) }}</span>
                </div>
              </div>
            </div>

            <div class="config-section" v-if="serviceConfig.config.analysis_limits">
              <div class="config-title">分析限制</div>
              <div class="config-items">
                <div class="config-item" v-for="(value, key) in serviceConfig.config.analysis_limits" :key="key">
                  <span class="config-key">{{ formatConfigKey(key as any) }}:</span>
                  <span class="config-value">{{ formatConfigValue(value) }}</span>
                </div>
              </div>
            </div>
          </div>
          <a-empty v-else description="配置信息不可用" size="small">
            <template #image>
              <SettingOutlined style="font-size: 32px; color: #bfbfbf;" />
            </template>
          </a-empty>
        </a-card>
      </a-col>
    </a-row>

    <!-- 服务就绪状态和历史趋势 -->
    <a-row v-if="serviceHealth" :gutter="[16, 16]" class="charts-section">
      <a-col :xs="24" :lg="8">
        <a-card title="服务就绪状态" class="ready-status-card">
          <div class="ready-status-content">
            <div class="ready-indicator">
              <div :class="['status-circle', serviceReady?.ready ? 'ready' : 'not-ready']">
                <CheckOutlined v-if="serviceReady?.ready" />
                <CloseOutlined v-else />
              </div>
              <div class="status-text">
                <div class="status-label">{{ serviceReady?.ready ? '服务就绪' : '服务未就绪' }}</div>
                <div class="status-message">{{ serviceReady?.message || '状态检查中...' }}</div>
              </div>
            </div>
            <div class="ready-timestamp">
              检查时间: {{ formatTime(serviceReady?.timestamp) }}
            </div>
          </div>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="16">
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
  ClusterOutlined,
  GoldOutlined,
  SaveOutlined,
  TagOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  ApiOutlined,
  BarChartOutlined,
  PartitionOutlined,
  SearchOutlined,
  SettingOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons-vue';
import {
  getRCAHealth,
  getRCAReady,
  getRCAConfig,
  getRCAInfo,
  type RCAHealthResponse,
} from '#/api/core/rca';
import type { ServiceReadyResponse, ServiceConfigResponse, ServiceInfoResponse } from '#/api/core/common';

const loading = ref(false);
const autoRefresh = ref(true);
const trendPeriod = ref('6h');
const serviceHealth = ref<RCAHealthResponse | null>(null);
const serviceReady = ref<ServiceReadyResponse | null>(null);
const serviceConfig = ref<ServiceConfigResponse | null>(null);
const serviceInfo = ref<ServiceInfoResponse | null>(null);

// 错误状态管理
const dataError = ref({
  hasError: false,
  errorMessage: '',
  isServiceDown: false,
  hasPartialData: false
});

const responseTimeChartRef = ref<HTMLElement>();
const trendChartRef = ref<HTMLElement>();
let responseTimeChart: echarts.ECharts | null = null;
let trendChart: echarts.ECharts | null = null;

let refreshTimer: NodeJS.Timeout | null = null;

// 错误处理辅助函数
const resetErrorState = () => {
  dataError.value = {
    hasError: false,
    errorMessage: '',
    isServiceDown: false,
    hasPartialData: false
  };
};

const handleDataError = (error: any, context: string, isMainService = false) => {
  console.error(`${context}失败:`, error);
  
  // 检查是否是服务连接问题
  const isServiceError = error?.response?.status === 502 ||
                        error?.response?.status === 503 ||
                        error?.response?.status === 404 ||
                        error?.message?.includes('connection') ||
                        error?.message?.includes('timeout') ||
                        error?.code === 'ECONNREFUSED';
  
  dataError.value = {
    hasError: true,
    errorMessage: isServiceError 
      ? 'RCA服务暂不可用，显示离线状态' 
      : `${context}失败: ${error.message || '未知错误'}`,
    isServiceDown: isServiceError && isMainService,
    hasPartialData: !isMainService && !!serviceHealth.value
  };
};

const refreshHealth = async () => {
  loading.value = true;
  resetErrorState();
  
  try {
    // 使用 Promise.allSettled 以确保即使部分失败也能显示可用数据
    const results = await Promise.allSettled([
      getRCAHealth(),
      getRCAReady(),
      getRCAConfig(),
      getRCAInfo()
    ]);
    
    // 处理健康检查结果（最重要的数据）
    if (results[0].status === 'fulfilled') {
      serviceHealth.value = results[0].value;
    } else {
      handleDataError(results[0].reason, '获取健康状态', true);
      // 设置默认健康状态
      serviceHealth.value = {
        status: 'unknown',
        prometheus_connected: false,
        kubernetes_connected: false,
        redis_connected: false,
        last_check_time: new Date().toISOString(),
        version: 'Unknown'
      };
    }
    
    // 处理就绪状态
    if (results[1].status === 'fulfilled') {
      serviceReady.value = results[1].value;
    } else {
      console.error('获取就绪状态失败:', results[1].reason);
      serviceReady.value = {
        ready: false,
        service: 'RCA服务',
        message: '服务状态检查失败',
        timestamp: new Date().toISOString()
      };
    }
    
    // 处理配置信息（非关键）
    if (results[2].status === 'fulfilled') {
      serviceConfig.value = results[2].value;
    } else {
      console.error('获取配置失败:', results[2].reason);
      serviceConfig.value = null;
    }
    
    // 处理服务信息（非关键）
    if (results[3].status === 'fulfilled') {
      serviceInfo.value = results[3].value;
    } else {
      console.error('获取服务信息失败:', results[3].reason);
      serviceInfo.value = {
        service: 'RCA服务',
        version: 'Unknown',
        description: 'RCA智能根因分析服务',
        capabilities: [],
        endpoints: {},
        constraints: {},
        status: 'unknown'
      };
    }
    
    await nextTick();
    updateCharts();
    
    // 检查是否有错误发生
    const failedCount = results.filter(r => r.status === 'rejected').length;
    if (failedCount === 0) {
      message.success('健康状态已更新');
    } else if (failedCount === results.length) {
      message.warning('服务暂不可用，显示离线状态');
    } else {
      message.warning('部分数据获取失败，页面可能显示不完整');
      dataError.value.hasPartialData = true;
    }
    
  } catch (error) {
    console.error('获取健康状态失败:', error);
    handleDataError(error, '获取健康状态', true);
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
  if (!responseTimeChartRef.value) return;

  responseTimeChart = echarts.init(responseTimeChartRef.value);

  // 如果没有健康数据或服务离线，显示空状态
  if (!serviceHealth.value || dataError.value.isServiceDown) {
    const option = {
      title: {
        text: dataError.value.isServiceDown ? '服务离线' : '暂无响应时间数据',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: 'var(--ant-text-color-secondary)',
          fontSize: 12
        }
      },
      grid: { left: 0, right: 0, top: 10, bottom: 0 },
      xAxis: { type: 'category', show: false, data: [] },
      yAxis: { type: 'value', show: false },
      series: [{
        type: 'line',
        data: [],
        smooth: true,
        lineStyle: { color: '#d9d9d9', width: 2 },
        symbol: 'none',
        areaStyle: { color: 'rgba(217, 217, 217, 0.1)' }
      }]
    };
    responseTimeChart.setOption(option);
    return;
  }

  // 模拟响应时间数据（实际项目中应该从API获取）
  const mockData = [50, 45, 60, 55, 48, 52];
  const option = {
    grid: { left: 0, right: 0, top: 10, bottom: 0 },
    xAxis: { type: 'category', show: false, data: ['', '', '', '', '', ''] },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'line',
      data: mockData,
      smooth: true,
      lineStyle: { color: '#52c41a', width: 2 },
      symbol: 'none',
      areaStyle: { color: 'rgba(82, 196, 26, 0.1)' }
    }]
  };
  responseTimeChart.setOption(option);
};

const updateTrendChart = () => {
  if (!trendChartRef.value) return;

  trendChart = echarts.init(trendChartRef.value);

  // 如果没有健康数据或服务离线，显示空状态
  if (!serviceHealth.value || dataError.value.isServiceDown) {
    const option = {
      title: {
        text: dataError.value.isServiceDown ? '服务离线，无趋势数据' : '暂无健康趋势数据',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: 'var(--ant-text-color-secondary)',
          fontSize: 16
        }
      },
      legend: {
        data: ['服务状态', 'Prometheus', 'Kubernetes', 'Redis'],
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
        name: '状态',
        axisLine: { lineStyle: { color: 'var(--ant-border-color)' } },
        splitLine: { lineStyle: { color: 'var(--ant-border-color-split)' } }
      },
      series: [
        { name: '服务状态', type: 'line', data: [], lineStyle: { color: '#d9d9d9' } },
        { name: 'Prometheus', type: 'line', data: [], lineStyle: { color: '#d9d9d9' } },
        { name: 'Kubernetes', type: 'line', data: [], lineStyle: { color: '#d9d9d9' } },
        { name: 'Redis', type: 'line', data: [], lineStyle: { color: '#d9d9d9' } }
      ]
    };
    trendChart.setOption(option);
    return;
  }

  const currentTime = formatTimeForChart(new Date());
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: () => '显示当前状态，暂无历史数据'
    },
    legend: {
      data: ['服务状态', 'Prometheus', 'Kubernetes', 'Redis'],
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
      data: [currentTime],
      axisLine: { lineStyle: { color: 'var(--ant-border-color)' } }
    },
    yAxis: {
      type: 'value',
      name: '状态',
      min: 0,
      max: 1,
      axisLabel: {
        formatter: (value: number) => value === 1 ? '正常' : '异常'
      },
      axisLine: { lineStyle: { color: 'var(--ant-border-color)' } },
      splitLine: { lineStyle: { color: 'var(--ant-border-color-split)' } }
    },
    series: [
      {
        name: '服务状态',
        type: 'line',
        data: [serviceHealth.value.status === 'healthy' ? 1 : 0],
        smooth: false,
        step: 'end',
        lineStyle: { color: '#1890ff', width: 2 }
      },
      {
        name: 'Prometheus',
        type: 'line',
        data: [serviceHealth.value.prometheus_connected ? 1 : 0],
        smooth: false,
        step: 'end',
        lineStyle: { color: '#ff4d4f', width: 2 }
      },
      {
        name: 'Kubernetes',
        type: 'line',
        data: [serviceHealth.value.kubernetes_connected ? 1 : 0],
        smooth: false,
        step: 'end',
        lineStyle: { color: '#faad14', width: 2 }
      },
      {
        name: 'Redis',
        type: 'line',
        data: [serviceHealth.value.redis_connected ? 1 : 0],
        smooth: false,
        step: 'end',
        lineStyle: { color: '#52c41a', width: 2 }
      }
    ]
  };
  trendChart.setOption(option);
};

const getCapabilityIcon = (capability: string) => {
  switch (capability.toLowerCase()) {
    case 'root_cause_analysis':
    case 'rca':
      return 'PartitionOutlined';
    case 'quick_diagnosis':
    case 'diagnosis':
      return 'SearchOutlined';
    case 'metrics_analysis':
      return 'BarChartOutlined';
    case 'events_analysis':
      return 'ClockCircleOutlined';
    case 'logs_analysis':
      return 'FileTextOutlined';
    case 'event_patterns':
      return 'ApiOutlined';
    case 'error_summary':
      return 'DatabaseOutlined';
    case 'caching':
      return 'GoldOutlined';
    default:
      return 'SettingOutlined';
  }
};

const getCapabilityDisplayName = (capability: string) => {
  const displayNames: Record<string, string> = {
    'root_cause_analysis': '根因分析',
    'rca': '根因分析',
    'quick_diagnosis': '快速诊断',
    'diagnosis': '快速诊断',
    'metrics_analysis': '指标分析',
    'events_analysis': '事件分析',
    'logs_analysis': '日志分析',
    'event_patterns': '事件模式',
    'error_summary': '错误汇总',
    'caching': '缓存管理',
    'event_correlation': '事件关联',
    'correlation': '事件关联',
    'ai_insights': 'AI洞察',
    'ai': 'AI洞察',
    'anomaly_detection': '异常检测',
    'log_analysis': '日志分析'
  };
  return displayNames[capability.toLowerCase()] || capability;
};

const formatConfigKey = (key: string) => {
  const keyMappings: Record<string, string> = {
    'engine': '分析引擎',
    'metrics_collector': '指标收集器',
    'events_collector': '事件收集器',
    'logs_collector': '日志收集器',
    'cache_manager': '缓存管理器',
    'enabled': '启用状态',
    'prefix': '缓存前缀',
    'default_ttl': '默认过期时间(秒)',
    'max_time_window_hours': '最大时间窗口(小时)',
    'min_time_window_hours': '最小时间窗口(小时)',
    'max_log_lines': '最大日志行数',
    'default_log_lines': '默认日志行数'
  };
  return keyMappings[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const formatConfigValue = (value: any) => {
  if (typeof value === 'boolean') {
    return value ? '启用' : '禁用';
  }
  if (typeof value === 'string') {
    const statusMappings: Record<string, string> = {
      'initialized': '已初始化',
      'running': '运行中',
      'stopped': '已停止',
      'error': '错误状态'
    };
    return statusMappings[value] || value;
  }
  return String(value);
};


const convertToBeijingTime = (utcTimestamp: string | Date): Date => {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;

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
.rca-health {
  padding: 24px;
  background-color: var(--ant-background-color-light, #fafafa);
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ant-border-color, #d9d9d9);
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
  font-weight: bold;
  margin: 0;
  background: linear-gradient(90deg, #52c41a, #73d13d);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.title-icon {
  font-size: 28px;
  color: #52c41a;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.empty-state-card,
.offline-state-card {
  margin-bottom: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
  padding: 48px 24px;
}

.offline-state-card {
  border: 1px solid #ff4d4f;
  background-color: rgba(255, 77, 79, 0.05);
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

.service-info-card,
.performance-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.service-info-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--ant-border-color-split);
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--ant-text-color-secondary);
  font-weight: 500;
}

.info-value {
  color: var(--ant-text-color);
  font-size: 14px;
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
  margin-bottom: 12px;
}

.metric-title {
  font-size: 14px;
  color: var(--ant-text-color);
  font-weight: 500;
}

.performance-metrics .metric-value {
  font-size: 16px;
  color: var(--ant-text-color);
}

.connection-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.connection-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.mini-chart {
  height: 60px;
  width: 100%;
  margin-top: 8px;
}

.capabilities-section {
  margin-bottom: 24px;
}

.capabilities-card,
.config-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.capabilities-list {
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

.config-content {
  max-height: 400px;
  overflow-y: auto;
}

.config-section {
  margin-bottom: 24px;
}

.config-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ant-text-color);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--ant-border-color-split);
}

.config-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 14px;
}

.config-key {
  color: var(--ant-text-color-secondary);
  font-weight: 500;
}

.config-value {
  color: var(--ant-text-color);
}

.charts-section {
  margin-bottom: 24px;
}

.ready-status-card,
.trend-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.ready-status-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
}

.ready-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.status-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: white;
}

.status-circle.ready {
  background: linear-gradient(135deg, #52c41a, #73d13d);
}

.status-circle.not-ready {
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
}

.status-text {
  text-align: center;
}

.status-label {
  font-size: 18px;
  font-weight: 600;
  color: var(--ant-text-color);
  margin-bottom: 4px;
}

.status-message {
  font-size: 14px;
  color: var(--ant-text-color-secondary);
}

.ready-timestamp {
  font-size: 12px;
  color: var(--ant-text-color-secondary);
}

.trend-chart {
  height: 300px;
  width: 100%;
}

@media (max-width: 768px) {
  .rca-health {
    padding: 16px;
  }
  
  .page-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .header-actions {
    justify-content: center;
  }
  
  .info-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .performance-metrics .metric-value {
    font-size: 14px;
  }
  
  .mini-chart {
    height: 40px;
  }
  
  .trend-chart {
    height: 250px;
  }
  
  .status-circle {
    width: 60px;
    height: 60px;
    font-size: 24px;
  }
  
  .status-label {
    font-size: 16px;
  }
}
</style>
