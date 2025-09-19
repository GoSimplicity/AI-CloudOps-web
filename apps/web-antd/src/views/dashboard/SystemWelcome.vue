<template>
  <div class="dashboard-container">
    <!-- 全局加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <a-spin size="large" tip="正在加载系统数据...">
        <div class="loading-content"></div>
      </a-spin>
    </div>
    <!-- 顶部信息栏 -->
    <div class="dashboard-header">
      <div class="header-left">
        <h1 class="platform-title">AI-CloudOps 智能运维平台</h1>
        <span class="platform-desc">实时监控 · 智能预测 · 自动化运维</span>
      </div>
      <div class="header-right">
        <a-space size="large">
          <span class="status-indicator" :class="systemStatusClass">
            <span class="status-dot" :class="systemStatusClass"></span>
            {{ systemStatusText }}
          </span>
          <span class="time-display">{{ currentTime }}</span>
        </a-space>
      </div>
    </div>

    <!-- 核心指标卡片 -->
    <a-row :gutter="[16, 16]" class="metrics-section">
      <a-col :xs="24" :sm="12" :md="6" v-for="metric in metrics" :key="metric.key">
        <div class="metric-card">
          <div class="metric-info">
            <span class="metric-label">{{ metric.label }}</span>
            <span class="metric-value">{{ metric.value }}</span>
            <span class="metric-unit">{{ metric.unit }}</span>
          </div>
          <div class="metric-trend" :class="`trend-${metric.trend}`">
            <span>{{ metric.change }}</span>
          </div>
          <div class="metric-chart" :ref="(el) => { if (el) chartRefs[metric.key] = el as HTMLElement }"></div>
        </div>
      </a-col>
    </a-row>

    <!-- 系统概览区 -->
    <a-row :gutter="[16, 16]" class="overview-section">
      <a-col :xs="24" :lg="12">
        <div class="system-info-card">
          <div class="card-header">
            <h3 class="card-title">系统信息</h3>
            <a-button size="small" @click="refreshSystemData" :loading="refreshing">
              刷新
            </a-button>
          </div>
          <div class="system-info-grid">
            <div class="info-item">
              <span class="info-label">主机名</span>
              <span class="info-value" :title="moduleData.systemInfo?.hostname || '--'">{{ moduleData.systemInfo?.hostname || '--' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">操作系统</span>
              <span class="info-value os-info" :title="`${moduleData.systemInfo?.os || '--'} ${moduleData.systemInfo?.os_version || ''}`">
                {{ moduleData.systemInfo?.os || '--' }} {{ moduleData.systemInfo?.os_version || '' }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">系统架构</span>
              <span class="info-value">{{ moduleData.systemInfo?.arch || '--' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">CPU型号</span>
              <span class="info-value cpu-model" :title="moduleData.systemInfo?.cpu_model || '--'">
                {{ moduleData.systemInfo?.cpu_model || '--' }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">CPU核心数</span>
              <span class="info-value">{{ moduleData.systemInfo?.cpu_cores || '--' }} 核</span>
            </div>
            <div class="info-item">
              <span class="info-label">系统负载</span>
              <span class="info-value load-values" :title="
                moduleData.systemMetrics && (moduleData.systemMetrics.load_avg_1 > 0 || moduleData.systemMetrics.load_avg_5 > 0 || moduleData.systemMetrics.load_avg_15 > 0) 
                  ? `1分钟: ${moduleData.systemMetrics.load_avg_1?.toFixed(2) || '0.00'}, 5分钟: ${moduleData.systemMetrics.load_avg_5?.toFixed(2) || '0.00'}, 15分钟: ${moduleData.systemMetrics.load_avg_15?.toFixed(2) || '0.00'}`
                  : '暂无数据'
              ">
                {{ 
                  moduleData.systemMetrics && (moduleData.systemMetrics.load_avg_1 > 0 || moduleData.systemMetrics.load_avg_5 > 0 || moduleData.systemMetrics.load_avg_15 > 0) 
                    ? `${moduleData.systemMetrics.load_avg_1?.toFixed(2) || '0.00'} / ${moduleData.systemMetrics.load_avg_5?.toFixed(2) || '0.00'} / ${moduleData.systemMetrics.load_avg_15?.toFixed(2) || '0.00'}`
                    : '--'
                }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">运行时长</span>
              <span class="info-value">{{ moduleData.systemMetrics?.uptime_formatted || formatUptime(moduleData.systemMetrics?.uptime) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">进程数</span>
              <span class="info-value">{{ moduleData.systemMetrics?.process_count || '--' }}</span>
            </div>
          </div>
        </div>
      </a-col>
      
      <a-col :xs="24" :lg="12">
        <div class="network-card">
          <div class="card-header">
            <h3 class="card-title">网络流量</h3>
            <a-badge status="processing" text="实时监控" />
          </div>
          <div ref="networkChart" class="chart-container-small"></div>
        </div>
      </a-col>
    </a-row>

    <!-- 主要内容区 -->
    <a-row :gutter="[16, 16]" class="content-section">
      <!-- 性能趋势图表 -->
      <a-col :xs="24" :lg="16">
        <div class="chart-card">
          <div class="card-header">
            <h3 class="card-title">性能趋势分析</h3>
            <a-radio-group v-model:value="chartPeriod" size="small" @change="updateTrendChart">
              <a-radio-button value="1h">1小时</a-radio-button>
              <a-radio-button value="24h">24小时</a-radio-button>
              <a-radio-button value="7d">7天</a-radio-button>
            </a-radio-group>
          </div>
          <div ref="trendChart" class="chart-container"></div>
        </div>
      </a-col>

      <!-- 实时事件流 -->
      <a-col :xs="24" :lg="8">
        <div class="event-card">
          <div class="card-header">
            <h3 class="card-title">实时事件</h3>
            <a-badge status="processing" text="实时更新" />
          </div>
          <div class="event-list">
            <div v-for="event in events" :key="event.id" class="event-item">
              <div :class="`event-icon icon-${event.type}`">
                <component :is="getEventIcon(event.type)" />
              </div>
              <div class="event-content">
                <div class="event-message">{{ event.message }}</div>
                <div class="event-time">{{ event.time }}</div>
              </div>
            </div>
          </div>
        </div>
      </a-col>
    </a-row>

    <!-- 资源使用情况 -->
    <a-row :gutter="[16, 16]" class="resource-section">
      <a-col :xs="24" :sm="12" :lg="6" v-for="resource in resources" :key="resource.name">
        <div class="resource-card">
          <div class="resource-header">
            <span class="resource-name">{{ resource.name }}</span>
            <span class="resource-value">{{ resource.usage }}%</span>
          </div>
          <a-progress 
            :percent="resource.usage" 
            :stroke-color="getProgressColor(resource.usage)"
            :show-info="false"
            :stroke-width="8"
          />
          <div class="resource-details">
            <span>{{ resource.detail }}</span>
          </div>
        </div>
      </a-col>
    </a-row>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import * as echarts from 'echarts';
import { 
  CheckCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined 
} from '@ant-design/icons-vue';
import { getSystemInfoApi, getSystemMetricsApi, refreshSystemInfoApi } from '#/api/core/system/system';
import type { System } from '#/api/core/system/system';
import type { ECharts } from 'echarts';
// 时间显示
const currentTime = ref('');
const updateTime = () => {
  const now = new Date();
  currentTime.value = now.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// 核心指标数据
const metrics = ref([
  {
    key: 'cpu_usage',
    label: 'CPU使用率',
    value: '0',
    unit: '%',
    trend: 'down',
    change: '--',
    data: Array(7).fill(0)
  },
  {
    key: 'system_health',
    label: '系统健康度',
    value: '0',
    unit: '%',
    trend: 'up',
    change: '--',
    data: Array(7).fill(0)
  },
  {
    key: 'response_time',
    label: '系统响应时间',
    value: '0',
    unit: 'ms',
    trend: 'down',
    change: '--',
    data: Array(7).fill(0)
  },
  {
    key: 'stability_score',
    label: '系统稳定性',
    value: '0',
    unit: '%',
    trend: 'up',
    change: '--',
    data: Array(7).fill(0)
  }
]);

// 系统状态
const systemStatus = ref({
  system: { connected: false, healthy: false, lastCheck: '' }
});

// 系统数据
const moduleData = ref({
  systemInfo: null as System | null,
  systemMetrics: null as System | null
});

// 图表周期
const chartPeriod = ref('24h');

// 事件列表（初始化为空）
const events = ref<Array<{id: string, type: string, message: string, time: string}>>([]);



// 资源使用情况（从系统指标获取真实数据）
const resources = computed(() => {
  const systemMetrics = moduleData.value.systemMetrics;
  if (!systemMetrics) {
    return [
      { name: 'CPU', usage: 0, detail: '获取中...' },
      { name: '内存', usage: 0, detail: '获取中...' },
      { name: '存储', usage: 0, detail: '获取中...' },
      { name: '网络', usage: 0, detail: '获取中...' }
    ];
  }
  
  return [
    {
      name: 'CPU',
      usage: Math.round(systemMetrics.cpu_usage || 0),
      detail: `${systemMetrics.cpu_cores || 0} 核心 · ${systemMetrics.cpu_model?.substring(0, 20) || ''}...`
    },
    {
      name: '内存',
      usage: Math.round(systemMetrics.memory_usage || 0),
      detail: systemMetrics.memory_usage_formatted || `${formatBytes((systemMetrics.memory_used || 0) * 1024 * 1024)} / ${formatBytes((systemMetrics.memory_total || 0) * 1024 * 1024)}`
    },
    {
      name: '存储',
      usage: Math.round(systemMetrics.disk_usage || 0),
      detail: systemMetrics.disk_usage_formatted || (systemMetrics.disk_total > 0 ? `${systemMetrics.disk_used?.toFixed(1) || 0} GB / ${systemMetrics.disk_total?.toFixed(1) || 0} GB` : '暂无数据')
    },
    {
      name: '网络',
      usage: Math.min(100, Math.round(((systemMetrics.network_in || 0) + (systemMetrics.network_out || 0)) / 1024 / 1024 * 10)), // 网络使用率基于流量大小
      detail: `入: ${formatBytes(systemMetrics.network_in || 0)} 出: ${formatBytes(systemMetrics.network_out || 0)}`
    }
  ];
});

// 图表引用
const chartRefs = ref<Record<string, HTMLElement>>({});
const trendChart = ref<HTMLElement | null>(null);
const networkChart = ref<HTMLElement | null>(null);
let trendChartInstance: ECharts | null = null;
let networkChartInstance: ECharts | null = null;
const miniCharts: Record<string, ECharts> = {};

// 刷新状态
const refreshing = ref(false);
const loading = ref(true);

// 工具函数
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatUptime = (seconds?: number): string => {
  if (!seconds) return '--';
  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}天 ${hours}小时`;
  } else if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
};

// 获取事件图标
const getEventIcon = (type: string) => {
  const icons: Record<string, any> = {
    success: CheckCircleOutlined,
    info: InfoCircleOutlined,
    warning: WarningOutlined,
    error: CloseCircleOutlined
  };
  return icons[type] || InfoCircleOutlined;
};

// 获取进度条颜色
const getProgressColor = (value: number) => {
  if (value >= 80) return '#ff4d4f';
  if (value >= 60) return '#faad14';
  return '#52c41a';
};

// 计算系统整体状态
const systemStatusClass = computed(() => {
  const systemMetrics = moduleData.value.systemMetrics;
  if (!systemMetrics) return 'status-error';
  
  // 基于系统指标计算健康状态
  const cpuUsage = systemMetrics.cpu_usage || 0;
  const memoryUsage = systemMetrics.memory_usage || 0;
  const diskUsage = systemMetrics.disk_usage || 0;
  
  // 如果任何指标超过90%，系统状态为错误
  if (cpuUsage > 90 || memoryUsage > 90 || diskUsage > 90) {
    return 'status-error';
  }
  
  // 如果任何指标超过75%，系统状态为警告
  if (cpuUsage > 75 || memoryUsage > 75 || diskUsage > 75) {
    return 'status-warning';
  }
  
  return 'status-healthy';
});

const systemStatusText = computed(() => {
  const systemMetrics = moduleData.value.systemMetrics;
  if (!systemMetrics) return '系统数据获取中';
  
  const cpuUsage = systemMetrics.cpu_usage || 0;
  const memoryUsage = systemMetrics.memory_usage || 0;
  const diskUsage = systemMetrics.disk_usage || 0;
  
  if (cpuUsage > 90 || memoryUsage > 90 || diskUsage > 90) {
    return '系统负载过高';
  }
  
  if (cpuUsage > 75 || memoryUsage > 75 || diskUsage > 75) {
    return '系统负载较高';
  }
  
  return '系统运行正常';
});

// 初始化迷你图表
const initMiniChart = (element: HTMLElement, data: number[], color = '#1890ff'): ECharts | undefined => {
  if (!element) return;
  
  // 检查是否已有实例，如果有则先销毁
  const existingInstance = echarts.getInstanceByDom(element);
  if (existingInstance && !existingInstance.isDisposed()) {
    existingInstance.dispose();
  }
  
  const chart = echarts.init(element);
  chart.setOption({
    grid: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0
    },
    xAxis: {
      type: 'category',
      show: false
    },
    yAxis: {
      type: 'value',
      show: false
    },
    series: [{
      type: 'line',
      data: data,
      smooth: true,
      showSymbol: false,
      lineStyle: {
        width: 2,
        color: color
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: `${color}33` },
            { offset: 1, color: `${color}05` }
          ]
        }
      }
    }]
  });
  return chart;
};

// 初始化网络流量图表
const initNetworkChart = () => {
  if (!networkChart.value) return;
  
  // 检查是否已有实例，如果有则先销毁
  const existingInstance = echarts.getInstanceByDom(networkChart.value);
  if (existingInstance && !existingInstance.isDisposed()) {
    existingInstance.dispose();
  }
  
  networkChartInstance = echarts.init(networkChart.value);
  
  const systemMetrics = moduleData.value.systemMetrics;
  const networkIn = systemMetrics?.network_in || 0;
  const networkOut = systemMetrics?.network_out || 0;
  
  // 转换为MB显示
  const networkInMB = Math.round(networkIn / 1024 / 1024 * 100) / 100;
  const networkOutMB = Math.round(networkOut / 1024 / 1024 * 100) / 100;
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `${params.seriesName}<br/>${params.name}: ${params.value} MB (${params.percent}%)`;
      }
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      textStyle: {
        color: '#8c8c8c',
        fontSize: 12
      }
    },
    series: [
      {
        name: '网络流量',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['60%', '50%'],
        data: [
          { value: networkInMB, name: '入流量', itemStyle: { color: '#52c41a' } },
          { value: networkOutMB, name: '出流量', itemStyle: { color: '#1890ff' } }
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  };
  
  networkChartInstance.setOption(option);
};

// 初始化趋势图表
const initTrendChart = () => {
  if (!trendChart.value) return;
  
  // 检查是否已有实例，如果有则先销毁
  const existingInstance = echarts.getInstanceByDom(trendChart.value);
  if (existingInstance && !existingInstance.isDisposed()) {
    existingInstance.dispose();
  }
  
  trendChartInstance = echarts.init(trendChart.value);
  updateTrendChart();
};

// 更新趋势图表
const updateTrendChart = () => {
  if (!trendChartInstance) return;
  
  const systemMetrics = moduleData.value.systemMetrics;
  const currentCpu = systemMetrics?.cpu_usage || 0;
  const currentMemory = systemMetrics?.memory_usage || 0;
  
  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e8e8e8',
      borderWidth: 1,
      textStyle: {
        color: '#595959'
      },
      formatter: (params: any) => {
        let result = `${params[0].axisValue}<br/>`;
        params.forEach((param: any) => {
          const unit = param.seriesName === '响应时间' ? 'ms' : '%';
          result += `${param.marker}${param.seriesName}: ${param.value}${unit}<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: ['CPU使用率', '内存使用率', '系统负载'],
      bottom: 0,
      textStyle: {
        color: '#8c8c8c',
        fontSize: 12
      }
    },
    grid: {
      left: '3%',
      right: '3%',
      top: '5%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: generateTimeLabels(),
      axisLine: {
        lineStyle: {
          color: '#e8e8e8'
        }
      },
      axisLabel: {
        color: '#8c8c8c',
        fontSize: 11
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '使用率 (%)',
        position: 'left',
        max: 100,
        axisLine: {
          show: true,
          lineStyle: {
            color: '#e8e8e8'
          }
        },
        axisLabel: {
          color: '#8c8c8c',
          fontSize: 11
        },
        splitLine: {
          lineStyle: {
            color: '#f0f0f0',
            type: 'dashed'
          }
        }
      },
      {
        type: 'value',
        name: '负载倍数',
        position: 'right',
        max: 5,
        axisLine: {
          show: true,
          lineStyle: {
            color: '#e8e8e8'
          }
        },
        axisLabel: {
          color: '#8c8c8c',
          fontSize: 11
        },
        splitLine: {
          show: false
        }
      }
    ],
    series: [
      {
        name: 'CPU使用率',
        type: 'line',
        smooth: true,
        data: generateDataWithCurrent(currentCpu),
        itemStyle: {
          color: '#1890ff'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24, 144, 255, 0.2)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
            ]
          }
        }
      },
      {
        name: '内存使用率',
        type: 'line',
        smooth: true,
        data: generateDataWithCurrent(currentMemory),
        itemStyle: {
          color: '#52c41a'
        }
      },
      {
        name: '系统负载',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: generateDataWithCurrent(systemMetrics && systemMetrics.load_avg_1 > 0 && systemMetrics.cpu_cores > 0 ? systemMetrics.load_avg_1 / systemMetrics.cpu_cores : 0),
        itemStyle: {
          color: '#faad14'
        }
      }
    ]
  };
  
  trendChartInstance.setOption(option);
};

// 生成时间标签
const generateTimeLabels = () => {
  const labels = [];
  const period = chartPeriod.value;
  
  if (period === '1h') {
    for (let i = 0; i < 12; i++) {
      labels.push(`${i * 5}分钟`);
    }
  } else if (period === '24h') {
    for (let i = 0; i < 24; i += 2) {
      labels.push(`${i}:00`);
    }
  } else {
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    return days;
  }
  
  return labels;
};

// 生成包含当前值的历史数据
const generateDataWithCurrent = (currentValue: number) => {
  const points = chartPeriod.value === '1h' ? 12 : chartPeriod.value === '24h' ? 12 : 7;
  const data = [];
  
  // 生成历史数据（模拟波动）
  for (let i = 0; i < points - 1; i++) {
    const variation = (Math.random() - 0.5) * 20; // ±10的变化
    const value = Math.max(0, Math.min(100, currentValue + variation));
    data.push(parseFloat(value.toFixed(1)));
  }
  
  // 最后一个点是当前值
  data.push(parseFloat(currentValue.toFixed(1)));
  
  return data;
};

// 更新所有图表
const updateCharts = () => {
  // 更新趋势图
  updateTrendChart();
  
  // 更新网络图表
  if (networkChartInstance) {
    initNetworkChart();
  }
  
  // 更新迷你图表
  metrics.value.forEach(metric => {
    const element = chartRefs.value[metric.key];
    if (element) {
      if (miniCharts[metric.key]) {
        // 更新现有图表
        const chart = miniCharts[metric.key];
        if (chart) {
          chart.setOption({
            series: [{
              data: metric.data
            }]
          });
        }
      } else {
        // 创建新图表
        const colors: Record<string, string> = {
          'cpu_usage': '#ff4d4f',
          'system_health': '#52c41a',
          'response_time': '#faad14',
          'stability_score': '#1890ff'
        };
        const chart = initMiniChart(element, metric.data, colors[metric.key]);
        if (chart) {
          miniCharts[metric.key] = chart;
        }
      }
    }
  });
};

// 定时器
let timeTimer: any = null;
let dataTimer: any = null;



// 更新指标数据基于系统状态
const updateMetricsFromModuleData = () => {
  const systemMetrics = moduleData.value.systemMetrics;
  if (!systemMetrics) return;
  
  // 更新CPU使用率指标
  const cpuUsage = systemMetrics.cpu_usage || 0;
  if (metrics.value[0]) {
    metrics.value[0].value = cpuUsage.toFixed(1);
    metrics.value[0].change = cpuUsage < 50 ? '+良好' : cpuUsage < 75 ? '~正常' : '-偏高';
    metrics.value[0].data.shift();
    metrics.value[0].data.push(cpuUsage);
  }
  
  // 更新系统健康度（基于真实系统指标）
  const cpuHealth = Math.max(0, 100 - systemMetrics.cpu_usage);
  const memoryHealth = Math.max(0, 100 - systemMetrics.memory_usage);
  const diskHealth = Math.max(0, 100 - systemMetrics.disk_usage);
  const healthScore = (cpuHealth + memoryHealth + diskHealth) / 3;
  
  if (metrics.value[1]) {
    metrics.value[1].value = healthScore.toFixed(1);
    metrics.value[1].change = healthScore > 80 ? '+良好' : healthScore > 60 ? '~一般' : '-需关注';
    metrics.value[1].data.shift();
    metrics.value[1].data.push(healthScore);
  }
  
  // 更新系统响应时间（基于系统负载）
  const baseResponseTime = 50; // 基础响应时间
  const loadFactor = systemMetrics.load_avg_1 > 0 && systemMetrics.cpu_cores > 0 
    ? (systemMetrics.load_avg_1 / systemMetrics.cpu_cores) 
    : 0.5;
  const adjustedResponseTime = baseResponseTime * (1 + loadFactor);
  
  if (metrics.value[2]) {
    metrics.value[2].value = adjustedResponseTime.toFixed(0);
    metrics.value[2].change = loadFactor < 0.7 ? '-优秀' : loadFactor < 1.0 ? '~正常' : '+偏高';
    metrics.value[2].data.shift();
    metrics.value[2].data.push(adjustedResponseTime);
  }
  
  // 更新系统稳定性评分（基于系统运行时间和负载）
  let stabilityScore = 95; // 基础分
  
  // 根据系统负载调整
  if (systemMetrics.load_avg_5 > 0 && systemMetrics.cpu_cores > 0) {
    const loadRatio = systemMetrics.load_avg_5 / systemMetrics.cpu_cores;
    if (loadRatio > 1.5) stabilityScore -= 15;
    else if (loadRatio > 1.0) stabilityScore -= 8;
  }
  
  // 根据内存使用率调整
  if (systemMetrics.memory_usage > 90) stabilityScore -= 10;
  else if (systemMetrics.memory_usage > 80) stabilityScore -= 5;
  
  // 根据磁盘使用率调整
  if (systemMetrics.disk_usage > 95) stabilityScore -= 10;
  else if (systemMetrics.disk_usage > 85) stabilityScore -= 5;
  
  stabilityScore = Math.max(60, Math.min(100, stabilityScore));
  
  if (metrics.value[3]) {
    metrics.value[3].value = stabilityScore.toFixed(1);
    metrics.value[3].change = stabilityScore > 90 ? '+优秀' : stabilityScore > 80 ? '~良好' : '-需改进';
    metrics.value[3].data.shift();
    metrics.value[3].data.push(stabilityScore);
  }
};

// 生成系统事件
const generateSystemEvents = () => {
  const systemMetrics = moduleData.value.systemMetrics;
  if (!systemMetrics) return;
  
  const newEvents: Array<{id: string, type: string, message: string, time: string}> = [];
  
  // 检查CPU使用率
  if (systemMetrics.cpu_usage > 90) {
    newEvents.push({
      id: 'cpu_high',
      type: 'error',
      message: `CPU使用率过高: ${systemMetrics.cpu_usage.toFixed(1)}%`,
      time: '刚刚'
    });
  } else if (systemMetrics.cpu_usage > 75) {
    newEvents.push({
      id: 'cpu_warning',
      type: 'warning',
      message: `CPU使用率较高: ${systemMetrics.cpu_usage.toFixed(1)}%`,
      time: '刚刚'
    });
  }
  
  // 检查内存使用率
  if (systemMetrics.memory_usage > 90) {
    newEvents.push({
      id: 'memory_high',
      type: 'error',
      message: `内存使用率过高: ${systemMetrics.memory_usage.toFixed(1)}%`,
      time: '刚刚'
    });
  } else if (systemMetrics.memory_usage > 80) {
    newEvents.push({
      id: 'memory_warning',
      type: 'warning',
      message: `内存使用率较高: ${systemMetrics.memory_usage.toFixed(1)}%`,
      time: '刚刚'
    });
  }
  
  // 检查磁盘使用率
  if (systemMetrics.disk_usage > 95) {
    newEvents.push({
      id: 'disk_high',
      type: 'error',
      message: `磁盘使用率过高: ${systemMetrics.disk_usage.toFixed(1)}%`,
      time: '刚刚'
    });
  } else if (systemMetrics.disk_usage > 85) {
    newEvents.push({
      id: 'disk_warning',
      type: 'warning',
      message: `磁盘使用率较高: ${systemMetrics.disk_usage.toFixed(1)}%`,
      time: '刚刚'
    });
  }
  
  // 检查系统负载
  if (systemMetrics.load_avg_1 > 0 && systemMetrics.cpu_cores > 0) {
    const loadRatio = systemMetrics.load_avg_1 / systemMetrics.cpu_cores;
    if (loadRatio > 2.0) {
      newEvents.push({
        id: 'load_high',
        type: 'error',
        message: `系统负载过高: ${systemMetrics.load_avg_1.toFixed(2)}`,
        time: '刚刚'
      });
    } else if (loadRatio > 1.5) {
      newEvents.push({
        id: 'load_warning',
        type: 'warning',
        message: `系统负载较高: ${systemMetrics.load_avg_1.toFixed(2)}`,
        time: '刚刚'
      });
    }
  }
  
  // 更新事件列表
  if (newEvents.length > 0) {
    // 清除旧的系统事件
    events.value = events.value.filter(event => 
      !['cpu_high', 'cpu_warning', 'memory_high', 'memory_warning', 'disk_high', 'disk_warning', 'load_high', 'load_warning'].includes(event.id)
    );
    events.value = [...newEvents, ...events.value].slice(0, 10);
  } else {
    // 没有警告，添加正常事件
    const hasNormalEvent = events.value.some(event => event.id === 'system_normal');
    if (!hasNormalEvent) {
      events.value.unshift({
        id: 'system_normal',
        type: 'success',
        message: '系统运行正常，所有指标在正常范围内',
        time: '刚刚'
      });
      events.value = events.value.slice(0, 10);
    }
  }
};

// 获取系统信息数据
const fetchSystemData = async () => {
  try {
    const [systemInfo, systemMetrics] = await Promise.allSettled([
      getSystemInfoApi(),
      getSystemMetricsApi()
    ]);
    
    if (systemInfo.status === 'fulfilled') {
      moduleData.value.systemInfo = systemInfo.value;
      // 清除系统信息相关错误
      events.value = events.value.filter(event => !['system_info_error', 'system_data_error'].includes(event.id));
    } else {
      console.warn('Failed to fetch system info:', systemInfo.reason);
      events.value.unshift({
        id: 'system_info_error',
        type: 'warning',
        message: '系统信息获取失败，部分信息可能不准确',
        time: '刚刚'
      });
      events.value = events.value.slice(0, 10); // 限制事件数量
    }
    
    if (systemMetrics.status === 'fulfilled') {
      moduleData.value.systemMetrics = systemMetrics.value;
      // 清除系统监控相关错误
      events.value = events.value.filter(event => !['system_metrics_error', 'system_data_error'].includes(event.id));
    } else {
      console.warn('Failed to fetch system metrics:', systemMetrics.reason);
      events.value.unshift({
        id: 'system_metrics_error',
        type: 'warning',
        message: '系统监控数据获取失败，性能指标可能不准确',
        time: '刚刚'
      });
      events.value = events.value.slice(0, 10); // 限制事件数量
    }
  } catch (error) {
    console.error('Failed to fetch system data:', error);
    events.value.unshift({
      id: 'system_data_error',
      type: 'error',
      message: '系统数据获取异常，请检查网络连接',
      time: '刚刚'
    });
    events.value = events.value.slice(0, 10); // 限制事件数量
  }
};

// 刷新系统数据
const refreshSystemData = async () => {
  refreshing.value = true;
  try {
    await refreshSystemInfoApi();
    await fetchSystemData();
  } catch (error) {
    console.error('Failed to refresh system data:', error);
  } finally {
    refreshing.value = false;
  }
};

// 获取系统数据并更新状态
const fetchAllSystemData = async () => {
  loading.value = false;
  
  try {
    await fetchSystemData();
    
    // 更新系统状态
    const systemMetrics = moduleData.value.systemMetrics;
    systemStatus.value.system = {
      connected: !!systemMetrics,
      healthy: systemMetrics ? (
        systemMetrics.cpu_usage < 90 && 
        systemMetrics.memory_usage < 90 && 
        systemMetrics.disk_usage < 95
      ) : false,
      lastCheck: new Date().toISOString()
    };
    
    // 生成系统事件
    generateSystemEvents();
    
    // 更新指标和图表
    updateMetricsFromModuleData();
    updateCharts();
  } catch (error) {
    console.error('系统数据加载失败:', error);
    systemStatus.value.system = {
      connected: false,
      healthy: false,
      lastCheck: new Date().toISOString()
    };
  }
};

// 定时更新数据
const updateLiveData = () => {
  fetchAllSystemData();
};

onMounted(async () => {
  updateTime();
  timeTimer = setInterval(updateTime, 1000);
  
  // 快速初始化基础UI
  loading.value = false;
  
  // 加载系统数据
  fetchAllSystemData().catch(err => {
    console.warn('系统数据加载失败:', err);
  });
  
  // 设置定时更新（每30秒更新一次以减少服务器负载）
  dataTimer = setInterval(updateLiveData, 30000);
  
  // 延迟初始化图表，确保DOM已渲染
  setTimeout(() => {
    initTrendChart();
    initNetworkChart();
    updateCharts();
  }, 200);
  
  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    if (trendChartInstance) {
      trendChartInstance.resize();
    }
    if (networkChartInstance) {
      networkChartInstance.resize();
    }
    Object.values(miniCharts).forEach((chart: any) => {
      chart?.resize();
    });
  });
});

onUnmounted(() => {
  clearInterval(timeTimer);
  clearInterval(dataTimer);
  
  // 安全地销毁图表实例
  if (trendChartInstance && !trendChartInstance.isDisposed()) {
    trendChartInstance.dispose();
    trendChartInstance = null;
  }
  if (networkChartInstance && !networkChartInstance.isDisposed()) {
    networkChartInstance.dispose();
    networkChartInstance = null;
  }
  Object.values(miniCharts).forEach((chart: any) => {
    if (chart && !chart.isDisposed()) {
      chart.dispose();
    }
  });
});
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  padding: 24px;
  background: #f7f8fa;
  position: relative;
}

/* 加载状态 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(247, 248, 250, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.loading-content {
  width: 200px;
  height: 100px;
}

/* 头部样式 */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 0 4px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.platform-title {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
  letter-spacing: -0.5px;
}

.platform-desc {
  font-size: 13px;
  color: #8c8c8c;
}

.header-right {
  display: flex;
  align-items: center;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #52c41a;
}

.status-indicator.status-healthy {
  color: #52c41a;
}

.status-indicator.status-warning {
  color: #faad14;
}

.status-indicator.status-error {
  color: #ff4d4f;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #52c41a;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-dot.status-healthy {
  background: #52c41a;
}

.status-dot.status-warning {
  background: #faad14;
}

.status-dot.status-error {
  background: #ff4d4f;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

.time-display {
  font-size: 13px;
  color: #595959;
  font-variant-numeric: tabular-nums;
}

/* 指标卡片 */
.metrics-section {
  margin-bottom: 24px;
}

.metric-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  height: 140px;
  position: relative;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
  cursor: pointer;
}

.metric-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.metric-info {
  margin-bottom: 12px;
}

.metric-label {
  display: block;
  font-size: 13px;
  color: #8c8c8c;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 32px;
  font-weight: 600;
  color: #1a1a1a;
  font-variant-numeric: tabular-nums;
}

.metric-unit {
  font-size: 14px;
  color: #8c8c8c;
  margin-left: 4px;
}

.metric-trend {
  position: absolute;
  top: 20px;
  right: 20px;
  font-size: 12px;
  font-weight: 500;
}

.trend-up {
  color: #52c41a;
}

.trend-down {
  color: #52c41a;
}

.trend-stable {
  color: #8c8c8c;
}

.metric-chart {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  opacity: 0.6;
}

/* 系统概览区 */
.overview-section {
  margin-bottom: 24px;
}

.system-info-card,
.network-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  height: 320px;
  transition: all 0.3s ease;
  border: 1px solid #f0f0f0;
}

.system-info-card:hover,
.network-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
  border-color: #d9d9d9;
}

.system-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: #fafafa;
  border-radius: 8px;
  transition: all 0.2s ease;
  min-height: 55px;
  position: relative;
  overflow: hidden;
}

.info-item:hover {
  background: #f5f5f5;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.info-item-wide {
  grid-column: span 2;
}

.info-label {
  font-size: 12px;
  color: #8c8c8c;
  font-weight: 500;
  margin-bottom: 2px;
}

.info-value {
  font-size: 13px;
  color: #262626;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  max-height: 2.6em;
}

.cpu-model {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  max-height: 2.6em;
  font-size: 12px;
}

.load-values {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.3px;
  line-height: 1.2;
}

.os-info {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  max-height: 2.6em;
  font-size: 12px;
}

.chart-container-small {
  height: 240px;
  width: 100%;
}

/* 内容区 */
.content-section {
  margin-bottom: 24px;
}

.chart-card,
.event-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  height: 420px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f0f0;
  transition: all 0.3s ease;
}

.chart-card:hover,
.event-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
  border-color: #d9d9d9;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.chart-container {
  height: 340px;
  width: 100%;
}

/* 事件列表 */
.event-list {
  height: 340px;
  overflow-y: auto;
}

.event-list::-webkit-scrollbar {
  width: 4px;
}

.event-list::-webkit-scrollbar-track {
  background: transparent;
}

.event-list::-webkit-scrollbar-thumb {
  background: #d9d9d9;
  border-radius: 2px;
}

.event-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
  transition: background 0.2s;
}

.event-item:hover {
  background: #fafafa;
  margin: 0 -8px;
  padding: 12px 8px;
}

.event-item:last-child {
  border-bottom: none;
}

.event-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-success {
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
}

.icon-info {
  background: rgba(24, 144, 255, 0.1);
  color: #1890ff;
}

.icon-warning {
  background: rgba(250, 173, 20, 0.1);
  color: #faad14;
}

.icon-error {
  background: rgba(255, 77, 79, 0.1);
  color: #ff4d4f;
}

.event-content {
  flex: 1;
  min-width: 0;
}

.event-message {
  font-size: 13px;
  color: #262626;
  line-height: 1.5;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-time {
  font-size: 12px;
  color: #8c8c8c;
}

/* 资源卡片 */
.resource-section {
  margin-bottom: 24px;
}

.resource-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f0f0;
  transition: all 0.3s ease;
}

.resource-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
  border-color: #d9d9d9;
}

.resource-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.resource-name {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
}

.resource-value {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  font-variant-numeric: tabular-nums;
}

.resource-details {
  margin-top: 8px;
  font-size: 12px;
  color: #8c8c8c;
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .system-info-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 8px;
  }
}

@media (max-width: 1200px) {
  .system-info-grid {
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 8px;
  }
  
  .info-item-wide {
    grid-column: span 1;
  }
  
  .info-item {
    padding: 10px 12px;
    min-height: 50px;
  }
  
  .info-value {
    font-size: 12px;
  }
}

@media (max-width: 992px) {
  .system-info-grid {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 8px;
  }
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .platform-title {
    font-size: 20px;
  }
  
  .metric-card {
    height: 120px;
  }
  
  .metric-value {
    font-size: 28px;
  }
  
  .system-info-card,
  .network-card {
    height: auto;
    min-height: 280px;
  }
  
  .system-info-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  
  .info-item-wide {
    grid-column: span 2;
  }
  
  .info-item {
    padding: 10px 12px;
    min-height: 48px;
  }
  
  .info-value {
    font-size: 12px;
    line-height: 1.2;
  }
  
  .info-label {
    font-size: 11px;
  }
  
  .cpu-model {
    -webkit-line-clamp: 2;
    max-height: 2.4em;
    font-size: 11px;
  }
  
  .load-values {
    font-size: 11px;
    letter-spacing: 0.2px;
  }
  
  .chart-container-small {
    height: 200px;
  }
}

@media (max-width: 480px) {
  .system-info-grid {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  
  .info-item-wide {
    grid-column: span 1;
  }
  
  .info-item {
    padding: 8px 10px;
    min-height: 45px;
  }
  
  .info-value {
    font-size: 11px;
  }
  
  .info-label {
    font-size: 10px;
  }
}
</style>
