<template>
  <div class="rca-analysis">
    <div class="page-header">
      <h1 class="page-title">
        <PartitionOutlined class="title-icon" />
        根因分析
      </h1>
      <div class="header-actions">
        <a-button @click="resetForm">
          <ClearOutlined />
          重置
        </a-button>
        <a-button type="primary" @click="startAnalysis" :loading="analyzing" :disabled="!isFormValid">
          <PlayCircleOutlined />
          开始分析
        </a-button>
      </div>
    </div>

    <a-row :gutter="[24, 24]">
      <!-- 左侧配置面板 -->
      <a-col :xs="24" :lg="7">
        <a-card title="分析配置" class="config-card">
          <a-form :model="formData" layout="vertical">
            <a-form-item label="Kubernetes命名空间" name="namespace" required>
              <a-input
                v-model:value="formData.namespace"
                placeholder="输入要分析的K8s命名空间"
                :status="!formData.namespace ? 'warning' : ''"
              />
              <div v-if="!formData.namespace" class="form-error">
                请输入Kubernetes命名空间
              </div>
            </a-form-item>

            <a-form-item label="分析时间窗口" name="timeWindowHours">
              <a-slider
                v-model:value="formData.timeWindowHours"
                :min="0.5"
                :max="24"
                :marks="timeMarks"
                :step="0.5"
                :tipFormatter="(value: number) => `${value}小时`"
              />
            </a-form-item>

            <a-form-item label="Prometheus指标（可选）" name="metrics">
              <a-select
                v-model:value="formData.metrics"
                mode="multiple"
                placeholder="选择要分析的指标"
                :loading="loadingMetrics"
                :options="availableMetrics"
                show-search
                :filter-option="filterMetrics"
                max-tag-count="responsive"
                allow-clear
              />
              <a-button 
                size="small" 
                @click="loadAvailableMetrics" 
                :loading="loadingMetrics" 
                style="margin-top: 8px;"
              >
                <ReloadOutlined />
                刷新指标
              </a-button>
            </a-form-item>
          </a-form>
        </a-card>

        <!-- 分析状态卡片 -->
        <a-card v-if="analysisResult" title="分析概览" class="status-card">
          <a-statistic
            title="分析ID"
            :value="analysisResult?.analysis_id?.substring(0, 8) + '...'"
            style="margin-bottom: 16px;"
          >
            <template #suffix>
              <a-tooltip :title="analysisResult?.analysis_id">
                <InfoCircleOutlined />
              </a-tooltip>
            </template>
          </a-statistic>
          
          <a-statistic
            title="置信度"
            :value="(analysisResult?.confidence_score * 100).toFixed(1)"
            suffix="%"
            :value-style="{ color: getConfidenceColor(analysisResult?.confidence_score || 0) }"
          >
            <template #prefix>
              <CheckCircleOutlined v-if="(analysisResult?.confidence_score || 0) > 0.7" />
              <ExclamationCircleOutlined v-else />
            </template>
          </a-statistic>
        </a-card>
      </a-col>

      <!-- 右侧结果面板 -->
      <a-col :xs="24" :lg="17">
        <a-card 
          v-if="analysisResult" 
          class="result-card"
          :body-style="{ padding: 0 }"
        >
          <a-tabs v-model:activeKey="activeResultTab" @change="onResultTabChange" class="result-tabs">
            <!-- 根因分析标签页 -->
            <a-tab-pane key="root-causes" tab="根因分析">
              <div class="tab-content">
                <!-- 分析元信息 -->
                <div class="meta-info">
                  <a-row :gutter="16">
                    <a-col :span="8">
                      <div class="meta-item">
                        <span class="meta-label">命名空间</span>
                        <span class="meta-value">{{ analysisResult?.namespace }}</span>
                      </div>
                    </a-col>
                    <a-col :span="8">
                      <div class="meta-item">
                        <span class="meta-label">时间窗口</span>
                        <span class="meta-value">{{ analysisResult?.time_window_hours }}小时</span>
                      </div>
                    </a-col>
                    <a-col :span="8">
                      <div class="meta-item">
                        <span class="meta-label">分析时间</span>
                        <span class="meta-value">{{ formatShortTime(analysisResult?.timestamp) }}</span>
                      </div>
                    </a-col>
                  </a-row>
                </div>

                <!-- 根因列表 -->
                <div class="root-causes-container">
                  <div v-if="analysisResult?.root_causes?.length" class="root-causes-list">
                    <div 
                      v-for="(cause, index) in analysisResult?.root_causes || []" 
                      :key="index" 
                      class="root-cause-card"
                    >
                      <div class="cause-header">
                        <div class="cause-title">
                          <AlertOutlined :style="{ color: getConfidenceColor(cause.confidence) }" />
                          <span class="cause-type">{{ cause.cause_type }}</span>
                        </div>
                        <a-tag :color="getConfidenceColor(cause.confidence)">
                          置信度 {{ (cause.confidence * 100).toFixed(0) }}%
                        </a-tag>
                      </div>
                      
                      <p class="cause-description">{{ cause.description }}</p>
                      
                      <!-- 证据展示 -->
                      <div v-if="cause.evidence" class="evidence-section">
                        <!-- 事件证据 -->
                        <div v-if="cause.evidence.events?.length" class="evidence-block">
                          <h5 class="evidence-title">
                            <FileTextOutlined />
                            关键事件
                          </h5>
                          <div class="events-list">
                            <div 
                              v-for="(event, idx) in cause.evidence.events.slice(0, 3)" 
                              :key="idx"
                              class="event-item"
                            >
                              <a-tag color="orange" class="event-tag">{{ event.reason }}</a-tag>
                              <span class="event-count">×{{ event.count }}</span>
                              <a-tooltip :title="event.message">
                                <span class="event-message">{{ truncateText(event.message, 60) }}</span>
                              </a-tooltip>
                            </div>
                            <div v-if="cause.evidence.events.length > 3" class="more-indicator">
                              还有 {{ cause.evidence.events.length - 3 }} 个事件...
                            </div>
                          </div>
                        </div>
                        
                        <!-- 日志证据 -->
                        <div v-if="cause.evidence.logs?.length" class="evidence-block">
                          <h5 class="evidence-title">
                            <BugOutlined />
                            错误类型
                          </h5>
                          <div class="logs-tags">
                            <a-tag 
                              v-for="log in cause.evidence.logs" 
                              :key="log" 
                              color="red"
                            >
                              {{ log }}
                            </a-tag>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <a-empty v-else description="未发现明确的根因" />
                </div>
              </div>
            </a-tab-pane>

            <!-- 异常检测标签页 -->
            <a-tab-pane key="anomalies" tab="异常检测">
              <div class="tab-content">
                <!-- 异常统计 -->
                <div class="anomaly-stats" v-if="hasAnomalies">
                  <a-row :gutter="[16, 16]">
                    <a-col :xs="12" :sm="6">
                      <div class="stat-card">
                        <div class="stat-value">{{ getCriticalEventsCount() }}</div>
                        <div class="stat-label">关键事件</div>
                      </div>
                    </a-col>
                    <a-col :xs="12" :sm="6">
                      <div class="stat-card">
                        <div class="stat-value">{{ getEventClustersCount() }}</div>
                        <div class="stat-label">事件集群</div>
                      </div>
                    </a-col>
                    <a-col :xs="12" :sm="6">
                      <div class="stat-card">
                        <div class="stat-value">{{ getErrorTypesCount() }}</div>
                        <div class="stat-label">错误类型</div>
                      </div>
                    </a-col>
                    <a-col :xs="12" :sm="6">
                      <div class="stat-card">
                        <div class="stat-value">{{ getTotalErrorCount() }}</div>
                        <div class="stat-label">错误总数</div>
                      </div>
                    </a-col>
                  </a-row>
                </div>

                <!-- 图表区域 -->
                <div v-if="hasAnomalies" class="charts-container">
                  <a-row :gutter="[16, 16]">
                    <a-col :span="24">
                      <div class="chart-wrapper">
                        <h4 class="chart-title">事件时间分布</h4>
                        <div ref="eventsChartRef" class="chart-container"></div>
                      </div>
                    </a-col>
                    <a-col :span="12">
                      <div class="chart-wrapper">
                        <h4 class="chart-title">集群分布</h4>
                        <div ref="clustersChartRef" class="chart-container-small"></div>
                      </div>
                    </a-col>
                    <a-col :span="12">
                      <div class="chart-wrapper">
                        <h4 class="chart-title">错误频率</h4>
                        <div ref="errorLogsChartRef" class="chart-container-small"></div>
                      </div>
                    </a-col>
                  </a-row>
                </div>

                <!-- 详细数据 -->
                <div v-if="hasAnomalies" class="anomaly-details">
                  <!-- 关键事件表格 -->
                  <div v-if="getCriticalEventsCount() > 0" class="detail-section">
                    <h4 class="section-title">关键事件列表</h4>
                    <div class="table-wrapper">
                      <a-table
                        :dataSource="getCriticalEventsTableData()"
                        :columns="criticalEventsColumns"
                        :pagination="{ pageSize: 5, size: 'small' }"
                        size="small"
                      />
                    </div>
                  </div>

                  <!-- 错误频率 -->
                  <div v-if="hasErrorFrequency()" class="detail-section">
                    <h4 class="section-title">错误频率统计</h4>
                    <div class="error-freq-list">
                      <div 
                        v-for="(count, key) in analysisResult?.anomalies?.logs?.error_frequency || {}" 
                        :key="key"
                        class="error-freq-item"
                      >
                        <span class="error-name">{{ truncateText(String(key), 40) }}</span>
                        <a-progress 
                          :percent="getErrorFrequencyPercent(count as number)" 
                          :stroke-color="getErrorFrequencyColor(count as number)"
                          :show-info="false"
                          size="small"
                        />
                        <span class="error-count">{{ count }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <a-empty v-if="!hasAnomalies" description="未检测到异常" />
              </div>
            </a-tab-pane>

            <!-- 相关性分析标签页 -->
            <a-tab-pane key="correlations" tab="相关性分析">
              <div class="tab-content">
                <div v-if="hasCorrelations()" class="correlations-list">
                  <div 
                    v-for="(correlation, index) in analysisResult?.correlations || []" 
                    :key="index" 
                    class="correlation-card"
                  >
                    <div class="correlation-header">
                      <div class="correlation-title">
                        <NodeIndexOutlined />
                        <span>{{ correlation.correlation_type }}</span>
                      </div>
                      <a-tag :color="getConfidenceColor(correlation.confidence)">
                        {{ (correlation.confidence * 100).toFixed(0) }}%
                      </a-tag>
                    </div>
                    
                    <div class="correlation-evidence">
                      <h5>证据链</h5>
                      <div class="evidence-list">
                        <a-tag 
                          v-for="ev in correlation.evidence" 
                          :key="ev" 
                          color="blue"
                        >
                          {{ ev }}
                        </a-tag>
                      </div>
                    </div>
                    
                    <div v-if="correlation.timeline?.length" class="timeline-section">
                      <h5>时间线</h5>
                      <div class="timeline-list">
                        <div 
                          v-for="(event, idx) in correlation.timeline.slice(0, 5)" 
                          :key="idx"
                          class="timeline-item"
                        >
                          <span class="timeline-time">{{ formatShortTime(event.timestamp) }}</span>
                          <a-tag :color="getSeverityColor(event.severity)" size="small">
                            {{ event.type }}
                          </a-tag>
                          <a-tooltip :title="event.description">
                            <span class="timeline-desc">{{ truncateText(event.description, 50) }}</span>
                          </a-tooltip>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <a-empty v-else description="暂无相关性分析数据" />
              </div>
            </a-tab-pane>

            <!-- 修复建议标签页 -->
            <a-tab-pane key="recommendations" tab="修复建议">
              <div class="tab-content">
                <div v-if="analysisResult?.recommendations?.length" class="recommendations-list">
                  <div 
                    v-for="(rec, index) in analysisResult?.recommendations || []" 
                    :key="index"
                    class="recommendation-card"
                  >
                    <div class="rec-header">
                      <div class="rec-number">
                        <BulbOutlined />
                        <span>建议 {{ index + 1 }}</span>
                      </div>
                      <a-tag color="green">推荐</a-tag>
                    </div>
                    <div class="rec-content">{{ rec }}</div>
                    <div class="rec-actions">
                      <a-button type="link" size="small">查看详情</a-button>
                      <a-button type="link" size="small">标记完成</a-button>
                    </div>
                  </div>
                </div>
                <a-empty v-else description="暂无修复建议" />
              </div>
            </a-tab-pane>
          </a-tabs>
        </a-card>

        <!-- 空状态 -->
        <a-card v-else class="empty-card">
          <a-empty description="请配置参数并开始分析">
            <template #image>
              <PartitionOutlined style="font-size: 64px; color: #bfbfbf;" />
            </template>
          </a-empty>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import { message } from 'ant-design-vue';
import {
  PartitionOutlined,
  ClearOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  BulbOutlined,
  NodeIndexOutlined,
  AlertOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
  BugOutlined
} from '@ant-design/icons-vue';
import {
  analyzeRootCause,
  getAllPrometheusMetrics,
  type RCAAnalyzeRequest,
  type RCAAnalysisResponse
} from '../../api/core/rca';

// 响应式数据
const analyzing = ref(false);
const loadingMetrics = ref(false);
const activeResultTab = ref('root-causes');
const analysisResult = ref<RCAAnalysisResponse | null>(null);
const availableMetrics = ref<Array<{label: string, value: string}>>([]);

// 图表引用
const eventsChartRef = ref<HTMLElement>();
const clustersChartRef = ref<HTMLElement>();
const errorLogsChartRef = ref<HTMLElement>();
let eventsChart: echarts.ECharts | null = null;
let clustersChart: echarts.ECharts | null = null;
let errorLogsChart: echarts.ECharts | null = null;

// 表单数据
const formData = reactive({
  namespace: 'default',
  timeWindowHours: 2,
  metrics: [] as string[]
});

// 时间标记
const timeMarks = {
  0.5: '30m',
  1: '1h',
  2: '2h',
  3: '3h',
  6: '6h',
  12: '12h',
  24: '24h'
};

// 关键事件表格列定义
const criticalEventsColumns = [
  {
    title: '时间',
    dataIndex: 'timestamp',
    key: 'timestamp',
    width: 150,
    ellipsis: true,
    customRender: ({ text }: any) => formatShortTime(text)
  },
  {
    title: '原因',
    dataIndex: 'reason',
    key: 'reason',
    width: 120,
    ellipsis: true
  },
  {
    title: '次数',
    dataIndex: 'count',
    key: 'count',
    width: 80,
    sorter: (a: any, b: any) => a.count - b.count
  },
  {
    title: '消息',
    dataIndex: 'message',
    key: 'message',
    ellipsis: true,
    customRender: ({ text }: any) => truncateText(text, 100)
  }
];

// 计算属性
const isFormValid = computed(() => {
  return formData.namespace.trim() !== '';
});

const hasAnomalies = computed(() => {
  if (!analysisResult.value?.anomalies) return false;
  const anomalies = analysisResult.value.anomalies;
  return !!(
    anomalies.events?.critical_events?.length ||
    Object.keys(anomalies.events?.event_clusters || {}).length ||
    Object.keys(anomalies.logs?.error_types || {}).length ||
    Object.keys(anomalies.logs?.error_frequency || {}).length
  );
});

// 工具函数
const truncateText = (text: string, maxLength: number) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// 加载可用指标
const loadAvailableMetrics = async () => {
  loadingMetrics.value = true;
  try {
    const response = await getAllPrometheusMetrics();
    const metrics = response.data?.items || response.items || response || [];
    availableMetrics.value = metrics.map((metric: string) => ({
      label: metric,
      value: metric
    }));
    message.success('指标列表已更新');
  } catch (error) {
    console.error('获取指标列表失败:', error);
    message.error('获取指标列表失败');
  } finally {
    loadingMetrics.value = false;
  }
};

// 过滤指标
const filterMetrics = (input: string, option: any) => {
  return option.label.toLowerCase().includes(input.toLowerCase());
};

// 开始分析
const startAnalysis = async () => {
  if (!isFormValid.value) {
    message.warning('请填写命名空间');
    return;
  }

  analyzing.value = true;
  try {
    const request: RCAAnalyzeRequest = {
      namespace: formData.namespace,
      time_window_hours: formData.timeWindowHours,
      metrics: formData.metrics.length > 0 ? formData.metrics : undefined
    };

    const response = await analyzeRootCause(request);
    analysisResult.value = response;
    
    await nextTick();
    if (activeResultTab.value === 'anomalies') {
      initCharts();
    }
    
    message.success('根因分析完成');
  } catch (error) {
    console.error('根因分析失败:', error);
    message.error('根因分析失败，请检查输入参数');
  } finally {
    analyzing.value = false;
  }
};

// 获取统计数据
const getCriticalEventsCount = () => {
  return analysisResult.value?.anomalies?.events?.critical_events?.length || 0;
};

const getEventClustersCount = () => {
  return Object.keys(analysisResult.value?.anomalies?.events?.event_clusters || {}).length;
};

const getErrorTypesCount = () => {
  return Object.keys(analysisResult.value?.anomalies?.logs?.error_types || {}).length;
};

const getTotalErrorCount = () => {
  const errorFreq = analysisResult.value?.anomalies?.logs?.error_frequency || {};
  return Object.values(errorFreq).reduce((sum: number, count: any) => sum + (count as number), 0);
};

const hasCorrelations = () => {
  return analysisResult.value?.correlations && analysisResult.value.correlations.length > 0;
};

const hasErrorFrequency = () => {
  const freq = analysisResult.value?.anomalies?.logs?.error_frequency;
  return freq && Object.keys(freq).length > 0;
};

// 获取关键事件表格数据
const getCriticalEventsTableData = () => {
  const events = analysisResult.value?.anomalies?.events?.critical_events || [];
  return events.map((event: any, index: number) => ({
    key: index,
    ...event
  }));
};

// 获取错误频率百分比
const getErrorFrequencyPercent = (count: number) => {
  const values = Object.values(analysisResult.value?.anomalies?.logs?.error_frequency || {});
  const maxCount = Math.max(...values.map(v => v as number));
  return maxCount > 0 ? (count / maxCount) * 100 : 0;
};

// 获取错误频率颜色
const getErrorFrequencyColor = (count: number) => {
  const percent = getErrorFrequencyPercent(count);
  if (percent > 80) return '#ff4d4f';
  if (percent > 50) return '#faad14';
  return '#1890ff';
};

// 初始化图表
const initCharts = () => {
  nextTick(() => {
    initEventsChart();
    initClustersChart();
    initErrorLogsChart();
  });
};

// 初始化事件图表
const initEventsChart = () => {
  if (!eventsChartRef.value || !analysisResult.value) return;

  if (eventsChart) {
    eventsChart.dispose();
  }
  eventsChart = echarts.init(eventsChartRef.value);

  const criticalEvents = analysisResult.value.anomalies?.events?.critical_events || [];
  const sortedEvents = [...criticalEvents].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const option = {
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '5%',
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const data = params[0];
        return `${data.name}<br/>事件数: ${data.value}`;
      }
    },
    xAxis: {
      type: 'category',
      data: sortedEvents.map(e => formatShortTime(e.timestamp)),
      axisLabel: {
        rotate: 45,
        interval: Math.floor(sortedEvents.length / 8)
      }
    },
    yAxis: {
      type: 'value',
      name: '次数'
    },
    series: [{
      data: sortedEvents.map(e => e.count),
      type: 'bar',
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#83bff6' },
          { offset: 0.5, color: '#188df0' },
          { offset: 1, color: '#188df0' }
        ])
      }
    }]
  };

  eventsChart.setOption(option);
};

// 初始化集群图表
const initClustersChart = () => {
  if (!clustersChartRef.value || !analysisResult.value) return;

  if (clustersChart) {
    clustersChart.dispose();
  }
  clustersChart = echarts.init(clustersChartRef.value);

  const clusters = analysisResult.value.anomalies?.events?.event_clusters || {};
  const clusterData = Object.entries(clusters).map(([key, events]) => ({
    name: truncateText(key, 20),
    value: (events as any[]).reduce((sum, e) => sum + (e.count || 1), 0)
  }));

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: false,
        position: 'center'
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      data: clusterData
    }]
  };

  clustersChart.setOption(option);
};

// 初始化错误日志图表
const initErrorLogsChart = () => {
  if (!errorLogsChartRef.value || !analysisResult.value) return;

  if (errorLogsChart) {
    errorLogsChart.dispose();
  }
  errorLogsChart = echarts.init(errorLogsChartRef.value);

  const errorFrequency = analysisResult.value.anomalies?.logs?.error_frequency || {};
  const errorData = Object.entries(errorFrequency)
    .map(([key, value]) => ({
      name: truncateText(key.split('_')[1] || key, 15),
      value: value as number
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const option = {
    grid: {
      left: '3%',
      right: '4%',
      bottom: '20%',
      top: '5%',
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    xAxis: {
      type: 'category',
      data: errorData.map(e => e.name),
      axisLabel: {
        rotate: 45,
        interval: 0
      }
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      data: errorData.map(e => e.value),
      type: 'bar',
      itemStyle: {
        color: '#ff4d4f'
      }
    }]
  };

  errorLogsChart.setOption(option);
};

// 标签页切换
const onResultTabChange = (key: string) => {
  activeResultTab.value = key;
  if (key === 'anomalies' && hasAnomalies.value) {
    initCharts();
  }
};

// 获取置信度颜色
const getConfidenceColor = (confidence: number) => {
  if (confidence > 0.8) return '#52c41a';
  if (confidence > 0.6) return '#1890ff';
  if (confidence > 0.4) return '#faad14';
  return '#ff4d4f';
};

// 获取严重程度颜色
const getSeverityColor = (severity: string) => {
  const severityMap: Record<string, string> = {
    'critical': '#ff4d4f',
    'high': '#ff7875',
    'medium': '#faad14',
    'low': '#1890ff',
    'info': '#52c41a'
  };
  return severityMap[severity] || '#d9d9d9';
};

// 时间格式化
const formatShortTime = (timestamp?: string) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return timestamp;
  
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 重置表单
const resetForm = () => {
  formData.namespace = 'default';
  formData.timeWindowHours = 2;
  formData.metrics = [];
  analysisResult.value = null;
  message.success('表单已重置');
};

// 处理窗口调整
const handleResize = () => {
  if (eventsChart) eventsChart.resize();
  if (clustersChart) clustersChart.resize();
  if (errorLogsChart) errorLogsChart.resize();
};

// 生命周期
onMounted(() => {
  loadAvailableMetrics();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  eventsChart?.dispose();
  clustersChart?.dispose();
  errorLogsChart?.dispose();
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.rca-analysis {
  padding: 20px;
  background: #f0f2f5;
  min-height: 100vh;
}

/* 页头样式 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 16px 24px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #262626;
}

.title-icon {
  font-size: 24px;
  color: #1890ff;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* 卡片样式 */
.config-card,
.status-card,
.result-card,
.empty-card {
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  overflow: hidden;
}

.status-card {
  margin-top: 24px;
}

.form-error {
  color: #ff4d4f;
  font-size: 12px;
  margin-top: 4px;
}

/* 标签页样式 */
.result-tabs :deep(.ant-tabs-nav) {
  padding: 0 24px;
  margin-bottom: 0;
}

.tab-content {
  padding: 24px;
  max-height: calc(100vh - 280px);
  overflow-y: auto;
}

/* 滚动条样式 */
.tab-content::-webkit-scrollbar {
  width: 6px;
}

.tab-content::-webkit-scrollbar-thumb {
  background: #d9d9d9;
  border-radius: 3px;
}

.tab-content::-webkit-scrollbar-thumb:hover {
  background: #bfbfbf;
}

/* 元信息样式 */
.meta-info {
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
  margin-bottom: 20px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 12px;
  color: #8c8c8c;
}

.meta-value {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 根因分析样式 */
.root-causes-container {
  max-height: 500px;
  overflow-y: auto;
  padding-right: 4px;
}

.root-causes-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.root-cause-card {
  padding: 16px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: white;
  transition: box-shadow 0.3s;
}

.root-cause-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.cause-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.cause-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cause-type {
  font-size: 16px;
  font-weight: 600;
  color: #262626;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cause-description {
  color: #595959;
  line-height: 1.6;
  margin-bottom: 16px;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* 证据样式 */
.evidence-section {
  border-top: 1px solid #f0f0f0;
  padding-top: 16px;
}

.evidence-block {
  margin-bottom: 16px;
}

.evidence-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #595959;
  margin-bottom: 8px;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #fafafa;
  border-radius: 4px;
}

.event-tag {
  flex-shrink: 0;
}

.event-count {
  font-weight: 600;
  color: #ff7875;
  flex-shrink: 0;
}

.event-message {
  flex: 1;
  font-size: 12px;
  color: #8c8c8c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-indicator {
  font-size: 12px;
  color: #8c8c8c;
  font-style: italic;
}

.logs-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* 异常检测样式 */
.anomaly-stats {
  margin-bottom: 24px;
}

.stat-card {
  padding: 16px;
  background: white;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #f0f0f0;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #262626;
}

.stat-label {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 4px;
}

/* 图表样式 */
.charts-container {
  margin-bottom: 24px;
}

.chart-wrapper {
  background: white;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #f0f0f0;
}

.chart-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: #262626;
}

.chart-container {
  height: 250px;
  width: 100%;
}

.chart-container-small {
  height: 200px;
  width: 100%;
}

/* 详细数据样式 */
.anomaly-details {
  margin-top: 24px;
}

.detail-section {
  margin-bottom: 24px;
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: #262626;
  padding-left: 8px;
  border-left: 3px solid #1890ff;
}

.table-wrapper {
  overflow-x: auto;
}

.table-wrapper :deep(.ant-table) {
  font-size: 13px;
}

.error-freq-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error-freq-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
}

.error-name {
  flex: 0 0 200px;
  font-size: 12px;
  color: #595959;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error-freq-item :deep(.ant-progress) {
  flex: 1;
}

.error-count {
  flex: 0 0 60px;
  text-align: right;
  font-weight: 600;
  color: #ff4d4f;
  font-size: 12px;
}

/* 相关性分析样式 */
.correlations-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.correlation-card {
  padding: 16px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: white;
}

.correlation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.correlation-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  color: #262626;
}

.correlation-evidence h5,
.timeline-section h5 {
  font-size: 13px;
  font-weight: 500;
  color: #595959;
  margin-bottom: 8px;
}

.evidence-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.timeline-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #fafafa;
  border-radius: 4px;
  font-size: 12px;
}

.timeline-time {
  color: #8c8c8c;
  flex-shrink: 0;
}

.timeline-desc {
  flex: 1;
  color: #595959;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 建议样式 */
.recommendations-list {
  display: grid;
  gap: 16px;
}

.recommendation-card {
  padding: 16px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: white;
}

.rec-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.rec-number {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #262626;
}

.rec-content {
  color: #595959;
  line-height: 1.6;
  margin-bottom: 12px;
  word-wrap: break-word;
}

.rec-actions {
  display: flex;
  gap: 8px;
}

/* 空状态 */
.empty-card {
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .rca-analysis {
    padding: 12px;
  }
  
  .page-header {
    flex-direction: column;
    gap: 12px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .error-name {
    flex: 0 0 120px;
  }
  
  .chart-container {
    height: 200px;
  }
  
  .chart-container-small {
    height: 180px;
  }
}

@media (max-width: 576px) {
  .cause-type {
    max-width: 200px;
  }
  
  .error-freq-item {
    flex-wrap: wrap;
  }
  
  .error-name {
    flex: 0 0 100%;
    margin-bottom: 8px;
  }
}
</style>
