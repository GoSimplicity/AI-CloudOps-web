<template>
  <div class="rca-diagnosis">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">
        <SearchOutlined class="title-icon" />
        智能诊断中心
      </h1>
      <div class="header-actions">
        <a-button @click="resetDashboard">
          <ClearOutlined />
          重置
        </a-button>
        <a-button type="primary" @click="refreshAllDiagnosis" :loading="loading" :disabled="!isFormValid">
          <ReloadOutlined />
          {{ hasInitialData ? '刷新诊断' : '开始诊断' }}
        </a-button>
      </div>
    </div>

    <!-- 诊断参数输入区域 -->
    <a-card title="诊断参数配置" class="input-card" :class="{ 'highlight-required': !hasInitialData }">
      <template #extra>
        <a-tag color="blue" v-if="hasInitialData">参数已配置</a-tag>
        <a-tag color="orange" v-else>请填写诊断参数</a-tag>
      </template>
      
      <!-- 数据源错误提示 -->
      <a-alert 
        v-if="dataError.hasError"
        :message="dataError.isPrometheusDown ? '监控数据源异常' : '数据获取异常'"
        :description="dataError.errorMessage"
        :type="dataError.isPrometheusDown ? 'warning' : 'error'"
        show-icon
        closable
        style="margin-bottom: 16px;"
      >
        <template #icon>
          <ExclamationCircleOutlined v-if="dataError.isPrometheusDown" />
        </template>
      </a-alert>
      
      <a-form layout="horizontal" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
        <a-row :gutter="[24, 16]">
          <a-col :xs="24" :md="12">
            <a-form-item label="Kubernetes命名空间" required>
              <a-input
                v-model:value="inputData.namespace"
                placeholder="输入要诊断的K8s命名空间"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="分析时间范围">
              <a-select v-model:value="timeRange" style="width: 100%">
                <a-select-option value="0.5">30分钟</a-select-option>
                <a-select-option value="1">1小时</a-select-option>
                <a-select-option value="6">6小时</a-select-option>
                <a-select-option value="24">24小时</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="诊断级别">
              <a-radio-group v-model:value="diagnosisLevel" button-style="solid">
                <a-radio-button value="quick">快速</a-radio-button>
                <a-radio-button value="standard">标准</a-radio-button>
                <a-radio-button value="comprehensive">全面</a-radio-button>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="自动刷新">
              <a-switch v-model:checked="autoRefresh" @change="toggleAutoRefresh" />
              <span style="margin-left: 8px;">启用自动刷新</span>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

    <!-- 关键指标概览 -->
    <a-row :gutter="[16, 16]" class="metrics-overview">
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card class="metric-card metric-critical-issues" @click="viewDetailDiagnosis">
          <div class="metric-content">
            <div class="metric-header">
              <div class="metric-icon">
                <ExclamationCircleOutlined />
              </div>
              <div class="metric-info">
                <div class="metric-name">关键问题</div>
                <div class="metric-value">{{ quickDiagnosisResult?.critical_issues?.length || 0 }}</div>
              </div>
            </div>
            <div class="metric-status">
              <a-tag :color="(quickDiagnosisResult?.critical_issues?.length || 0) > 0 ? 'red' : 'green'">
                {{ (quickDiagnosisResult?.critical_issues?.length || 0) > 0 ? '严重' : '正常' }}
              </a-tag>
              <div class="metric-time">{{ timeRange }}小时内</div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card class="metric-card metric-warnings" @click="viewDetailDiagnosis">
          <div class="metric-content">
            <div class="metric-header">
              <div class="metric-icon">
                <WarningOutlined />
              </div>
              <div class="metric-info">
                <div class="metric-name">警告信息</div>
                <div class="metric-value">{{ quickDiagnosisResult?.warnings?.length || 0 }}</div>
              </div>
            </div>
            <div class="metric-status">
              <a-tag :color="(quickDiagnosisResult?.warnings?.length || 0) > 0 ? 'orange' : 'green'">
                {{ (quickDiagnosisResult?.warnings?.length || 0) > 0 ? '警告' : '正常' }}
              </a-tag>
              <div class="metric-time">{{ timeRange }}小时内</div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card class="metric-card metric-errors" @click="viewDetailDiagnosis">
          <div class="metric-content">
            <div class="metric-header">
              <div class="metric-icon">
                <BugOutlined />
              </div>
              <div class="metric-info">
                <div class="metric-name">错误总数</div>
                <div class="metric-value">{{ errorSummaryResult?.total_errors || 0 }}</div>
              </div>
            </div>
            <div class="metric-status">
              <a-tag :color="getErrorSeverityColor(errorSummaryResult?.total_errors || 0)">
                {{ getErrorSeverityText(errorSummaryResult?.total_errors || 0) }}
              </a-tag>
              <div class="metric-time">{{ timeRange }}小时内</div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card class="metric-card metric-health" @click="viewDetailDiagnosis">
          <div class="metric-content">
            <div class="metric-header">
              <div class="metric-icon">
                <HeartOutlined />
              </div>
              <div class="metric-info">
                <div class="metric-name">系统状态</div>
                <div class="metric-value">
                  {{ dataError.isPrometheusDown ? '数据源异常' : 
                     (quickDiagnosisResult?.status === 'healthy' ? '健康' : 
                      quickDiagnosisResult?.status ? '异常' : '未知') }}
                </div>
              </div>
            </div>
            <div class="metric-status">
              <a-tag :color="dataError.isPrometheusDown ? 'orange' : 
                            (quickDiagnosisResult?.status === 'healthy' ? 'green' : 'red')">
                {{ dataError.isPrometheusDown ? '数据源异常' :
                   (quickDiagnosisResult?.status === 'healthy' ? '正常' : 
                    quickDiagnosisResult?.status ? '异常' : '未知') }}
              </a-tag>
              <div class="metric-time">{{ timeRange }}小时内</div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 快速诊断结果 -->
    <a-row :gutter="[16, 16]" class="diagnosis-results" v-if="quickDiagnosisResult">
      <a-col :xs="24" :lg="12">
        <a-card title="关键问题" class="critical-issues-card">
          <template #extra>
            <a-badge :count="quickDiagnosisResult?.critical_issues?.length || 0" status="error" />
          </template>
          <div class="issues-list">
            <div v-if="quickDiagnosisResult?.critical_issues?.length" class="critical-issues">
              <div 
                v-for="(issue, index) in quickDiagnosisResult.critical_issues" 
                :key="index" 
                class="issue-item critical"
              >
                <ExclamationCircleOutlined class="issue-icon" />
                <div class="issue-content">{{ issue }}</div>
              </div>
            </div>
            <a-empty v-else description="未发现关键问题" size="small">
              <template #image>
                <CheckCircleOutlined style="font-size: 32px; color: #52c41a;" />
              </template>
            </a-empty>
          </div>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="12">
        <a-card title="警告信息" class="warnings-card">
          <template #extra>
            <a-badge :count="quickDiagnosisResult?.warnings?.length || 0" status="warning" />
          </template>
          <div class="warnings-list">
            <div v-if="quickDiagnosisResult?.warnings?.length" class="warnings">
              <div 
                v-for="(warning, index) in quickDiagnosisResult.warnings" 
                :key="index" 
                class="warning-item"
              >
                <WarningOutlined class="warning-icon" />
                <div class="warning-content">{{ warning }}</div>
              </div>
            </div>
            <a-empty v-else description="无警告信息" size="small">
              <template #image>
                <InfoCircleOutlined style="font-size: 32px; color: #1890ff;" />
              </template>
            </a-empty>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 事件模式分析和错误摘要 -->
    <a-row :gutter="[16, 16]" class="analysis-section">
      <!-- 事件模式图表 -->
      <a-col :xs="24" :lg="16">
        <a-card title="事件模式分析" class="chart-card">
          <template #extra>
            <a-radio-group v-model:value="chartType" size="small" @change="updateEventPatternsChart">
              <a-radio-button value="trend">趋势图</a-radio-button>
              <a-radio-button value="distribution">分布图</a-radio-button>
            </a-radio-group>
          </template>
          <div ref="eventPatternsChartRef" class="chart-container"></div>
        </a-card>
      </a-col>

      <!-- 错误分类统计 -->
      <a-col :xs="24" :lg="8">
        <a-card title="错误分类统计" class="chart-card">
          <div ref="errorCategoriesChartRef" class="chart-container-small"></div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 诊断建议和趋势分析 -->
    <a-row :gutter="[16, 16]" class="recommendations-section">
      <!-- 诊断建议 -->
      <a-col :xs="24" :lg="12">
        <a-card title="诊断建议" class="recommendations-card">
          <template #extra>
            <a-badge :count="quickDiagnosisResult?.recommendations?.length || 0" status="processing" />
          </template>
          <div class="recommendations-list">
            <div v-if="quickDiagnosisResult?.recommendations?.length" class="recommendations">
              <div 
                v-for="(rec, index) in quickDiagnosisResult.recommendations" 
                :key="index" 
                class="recommendation-item"
              >
                <div class="rec-icon">
                  <BulbOutlined />
                </div>
                <div class="rec-content">{{ rec }}</div>
              </div>
            </div>
            <a-empty v-else description="暂无建议" size="small">
              <template #image>
                <RobotOutlined style="font-size: 32px; color: #bfbfbf;" />
              </template>
            </a-empty>
          </div>
        </a-card>
      </a-col>

      <!-- 错误趋势时间线 -->
      <a-col :xs="24" :lg="12">
        <a-card title="错误趋势时间线" class="trends-card">
          <div ref="errorTrendsChartRef" class="chart-container-small"></div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 系统状态摘要 -->
    <a-row :gutter="[16, 16]" class="summary-section" v-if="hasInitialData">
      <a-col :xs="24">
        <a-card title="系统状态摘要" class="summary-card">
          <template #extra>
            <a-space>
              <a-tag v-if="quickDiagnosisResult?.timestamp" color="processing">
                {{ formatTime(quickDiagnosisResult.timestamp) }}
              </a-tag>
              <a-tag :color="quickDiagnosisResult?.status === 'healthy' ? 'green' : 'red'">
                {{ quickDiagnosisResult?.status || 'unknown' }}
              </a-tag>
            </a-space>
          </template>
          <div class="summary-content">
            <div class="summary-item">
              <div class="summary-label">命名空间:</div>
              <div class="summary-value namespace">{{ quickDiagnosisResult?.namespace || inputData.namespace }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">总错误数:</div>
              <div class="summary-value error">{{ errorSummaryResult?.total_errors || 0 }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">时间范围:</div>
              <div class="summary-value range">{{ errorSummaryResult?.time_range_hours || eventPatternsResult?.time_range_hours || timeRange }}小时</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">趋势事件:</div>
              <div class="summary-value trend">{{ eventPatternsResult?.trending_events?.length || 0 }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">异常事件:</div>
              <div class="summary-value anomaly">{{ eventPatternsResult?.anomalous_events?.length || 0 }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">分析耗时:</div>
              <div class="summary-value duration">{{ quickDiagnosisResult?.analysis_duration || 0 }}ms</div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import {
  SearchOutlined, 
  ReloadOutlined, 
  ClearOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  BulbOutlined,
  RobotOutlined,
  BugOutlined,
  HeartOutlined
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import {
  quickDiagnosis,
  getEventPatterns,
  getErrorSummary,
  type QuickDiagnosisResponse,
  type EventPatternsResponse,
  type ErrorSummaryResponse
} from '#/api/core/rca';

// 响应式数据
const loading = ref(false);
const timeRange = ref('1');
const chartType = ref('trend');
const diagnosisLevel = ref('standard');
const autoRefresh = ref(false);
const hasInitialData = ref(false);

// 错误状态管理
const dataError = ref({
  hasError: false,
  errorMessage: '',
  isPrometheusDown: false
});

// 用户输入数据
const inputData = ref({
  namespace: ''
});

// 表单验证
const isFormValid = computed(() => {
  return inputData.value.namespace.trim() !== '';
});

// 图表引用
const eventPatternsChartRef = ref<HTMLElement>();
const errorCategoriesChartRef = ref<HTMLElement>();
const errorTrendsChartRef = ref<HTMLElement>();
let eventPatternsChart: echarts.ECharts | null = null;
let errorCategoriesChart: echarts.ECharts | null = null;
let errorTrendsChart: echarts.ECharts | null = null;

// 诊断结果数据
const quickDiagnosisResult = ref<QuickDiagnosisResponse | null>(null);
const eventPatternsResult = ref<EventPatternsResponse | null>(null);
const errorSummaryResult = ref<ErrorSummaryResponse | null>(null);

let refreshTimer: NodeJS.Timeout | null = null;


const getErrorSeverityColor = (errorCount: number) => {
  if (errorCount === 0) return 'green';
  if (errorCount <= 5) return 'orange';
  return 'red';
};

const getErrorSeverityText = (errorCount: number) => {
  if (errorCount === 0) return '正常';
  if (errorCount <= 5) return '警告';
  return '严重';
};

// 错误处理辅助函数
const resetErrorState = () => {
  dataError.value = {
    hasError: false,
    errorMessage: '',
    isPrometheusDown: false
  };
};

const handleDataError = (error: any, context: string) => {
  console.error(`${context}失败:`, error);
  
  // 检查是否是 Prometheus 连接问题
  const isPrometheusError = error?.message?.includes('prometheus') || 
                           error?.response?.status === 502 ||
                           error?.response?.status === 503 ||
                           error?.message?.includes('connection') ||
                           error?.message?.includes('timeout');
  
  dataError.value = {
    hasError: true,
    errorMessage: isPrometheusError 
      ? '监控数据源(Prometheus)暂不可用，页面将显示默认状态' 
      : `${context}失败: ${error.message || '未知错误'}`,
    isPrometheusDown: isPrometheusError
  };
};

// 方法定义
const refreshAllDiagnosis = async () => {
  if (!isFormValid.value) {
    message.warning('请填写命名空间参数');
    return;
  }

  loading.value = true;
  resetErrorState();
  
  try {
    // 并发执行API调用，即使部分失败也不影响其他调用
    const results = await Promise.allSettled([
      fetchQuickDiagnosis(),
      fetchEventPatterns(),
      fetchErrorSummary()
    ]);
    
    // 检查是否所有API都失败了
    const allFailed = results.every(result => result.status === 'rejected');
    const anyFailed = results.some(result => result.status === 'rejected');
    
    if (allFailed) {
      // 如果全部失败，可能是系统性问题
      const firstError = (results[0] as PromiseRejectedResult).reason;
      handleDataError(firstError, '获取诊断数据');
      message.warning('数据源暂不可用，显示默认界面');
    } else {
      // 部分成功
      hasInitialData.value = true;
      updateCharts();
      
      if (anyFailed) {
        message.warning('部分数据获取失败，页面可能显示不完整');
      } else {
        message.success('诊断数据已更新');
      }
    }
    
  } catch (error) {
    console.error('获取诊断数据失败:', error);
    handleDataError(error, '获取诊断数据');
    message.error('获取诊断数据失败');
  } finally {
    loading.value = false;
  }
};

const fetchQuickDiagnosis = async () => {
  try {
    const response = await quickDiagnosis(inputData.value.namespace);
    quickDiagnosisResult.value = response;
  } catch (error) {
    console.error('快速诊断失败:', error);
    // 设置默认值，确保页面能正常渲染
    quickDiagnosisResult.value = {
      status: 'unknown',
      namespace: inputData.value.namespace,
      critical_issues: [],
      warnings: [],
      recommendations: [],
      timestamp: new Date().toISOString(),
      analysis_duration: 0
    };
    throw error; // 重新抛出以便上层处理
  }
};

const fetchEventPatterns = async () => {
  try {
    const response = await getEventPatterns(inputData.value.namespace, Number(timeRange.value));
    eventPatternsResult.value = response;
  } catch (error) {
    console.error('事件模式分析失败:', error);
    // 设置默认值
    eventPatternsResult.value = {
      namespace: inputData.value.namespace,
      time_range_hours: Number(timeRange.value),
      patterns: [],
      trending_events: [],
      anomalous_events: [],
      timestamp: new Date().toISOString()
    };
    throw error;
  }
};

const fetchErrorSummary = async () => {
  try {
    const response = await getErrorSummary(inputData.value.namespace, Number(timeRange.value));
    errorSummaryResult.value = response;
  } catch (error) {
    console.error('错误摘要失败:', error);
    // 设置默认值
    errorSummaryResult.value = {
      namespace: inputData.value.namespace,
      time_range_hours: Number(timeRange.value),
      total_errors: 0,
      error_categories: {},
      top_errors: [],
      error_timeline: [],
      timestamp: new Date().toISOString()
    };
    throw error;
  }
};

// 更新概览指标（现在直接在模板中使用数据，不需要单独的更新函数）

const initEventPatternsChart = () => {
  if (!eventPatternsChartRef.value) return;

  eventPatternsChart = echarts.init(eventPatternsChartRef.value);
  
  // 即使没有数据也要渲染空图表
  if (!eventPatternsResult.value || eventPatternsResult.value.patterns.length === 0) {
    const emptyOption = {
      title: {
        text: dataError.value.isPrometheusDown ? '数据源暂不可用' : '暂无事件数据',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: 'var(--ant-text-color-secondary)',
          fontSize: 16
        }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value' },
      series: [{ name: '事件趋势', type: 'line', data: [] }]
    };
    eventPatternsChart.setOption(emptyOption);
    return;
  }
  
  updateEventPatternsChart();
};

const initErrorCategoriesChart = () => {
  if (!errorCategoriesChartRef.value) return;

  errorCategoriesChart = echarts.init(errorCategoriesChartRef.value);
  
  // 检查是否有错误摘要数据
  if (!errorSummaryResult.value) {
    const emptyOption = {
      title: {
        text: dataError.value.isPrometheusDown ? '数据源暂不可用' : '暂无错误数据',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: 'var(--ant-text-color-secondary)',
          fontSize: 16
        }
      },
      series: [{
        name: '错误分类',
        type: 'pie',
        radius: '70%',
        data: []
      }]
    };
    errorCategoriesChart.setOption(emptyOption);
    return;
  }

  const categories = errorSummaryResult.value.error_categories || {};
  const data = Object.entries(categories).map(([name, value]) => ({
    name,
    value: value as number
  }));

  // 如果没有错误数据，显示空状态
  if (data.length === 0) {
    const emptyOption = {
      title: {
        text: '无错误数据',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: 'var(--ant-text-color-secondary)',
          fontSize: 16
        }
      },
      series: [{
        name: '错误分类',
        type: 'pie',
        radius: '70%',
        data: []
      }]
    };
    errorCategoriesChart.setOption(emptyOption);
    return;
  }

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b} : {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      textStyle: { color: 'var(--ant-text-color)' }
    },
    series: [
      {
        name: '错误分类',
        type: 'pie',
        radius: '70%',
        data: data,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        itemStyle: {
          color: (params: any) => {
            const colors = ['#ff4d4f', '#faad14', '#1890ff', '#52c41a', '#722ed1'];
            return colors[params.dataIndex % colors.length];
          }
        }
      }
    ]
  };

  errorCategoriesChart.setOption(option);
};

const initErrorTrendsChart = () => {
  if (!errorTrendsChartRef.value) return;

  errorTrendsChart = echarts.init(errorTrendsChartRef.value);
  
  // 检查是否有错误摘要数据
  if (!errorSummaryResult.value) {
    const emptyOption = {
      title: {
        text: dataError.value.isPrometheusDown ? '数据源暂不可用' : '暂无趋势数据',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: 'var(--ant-text-color-secondary)',
          fontSize: 16
        }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value' },
      series: [{ name: '错误数量', type: 'line', data: [] }]
    };
    errorTrendsChart.setOption(emptyOption);
    return;
  }

  const timeline = errorSummaryResult.value.error_timeline || [];
  const timeData = timeline.map((item: any) => formatTimeForChart(item.timestamp));
  const errorData = timeline.map((item: any) => item.error_count || 0);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
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
    yAxis: {
      type: 'value',
      name: '错误数量',
      axisLine: { lineStyle: { color: 'var(--ant-border-color)' } },
      splitLine: { lineStyle: { color: 'var(--ant-border-color-split)' } }
    },
    series: [
      {
        name: '错误数量',
        type: 'line',
        data: errorData,
        smooth: true,
        lineStyle: { color: '#ff4d4f', width: 2 },
        areaStyle: { opacity: 0.1, color: '#ff4d4f' }
      }
    ]
  };

  errorTrendsChart.setOption(option);
};

const updateEventPatternsChart = () => {
  if (!eventPatternsChart) return;
  
  // 如果没有数据，显示空状态
  if (!eventPatternsResult.value || eventPatternsResult.value.patterns.length === 0) {
    const emptyOption = {
      title: {
        text: dataError.value.isPrometheusDown ? '数据源暂不可用' : '暂无事件数据',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: 'var(--ant-text-color-secondary)',
          fontSize: 16
        }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value' },
      series: [{ name: '事件趋势', type: 'line', data: [] }]
    };
    eventPatternsChart.setOption(emptyOption);
    return;
  }

  const patterns = eventPatternsResult.value.patterns || [];
  
  if (chartType.value === 'trend') {
    const timeData = patterns.map((pattern: any) => formatTimeForChart(pattern.timestamp));
    const countData = patterns.map((pattern: any) => pattern.event_count || 0);

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: timeData,
        axisLine: { lineStyle: { color: 'var(--ant-border-color)' } }
      },
      yAxis: {
        type: 'value',
        name: '事件数量',
        axisLine: { lineStyle: { color: 'var(--ant-border-color)' } },
        splitLine: { lineStyle: { color: 'var(--ant-border-color-split)' } }
      },
      series: [
        {
          name: '事件趋势',
          type: 'line',
          data: countData,
          smooth: true,
          lineStyle: { color: '#1890ff', width: 3 },
          areaStyle: { opacity: 0.1, color: '#1890ff' }
        }
      ]
    };

    eventPatternsChart.setOption(option);
  } else {
    // 分布图
    const eventTypes = [...new Set(patterns.map((p: any) => p.event_type))];
    const data = eventTypes.map(type => ({
      name: type,
      value: patterns.filter((p: any) => p.event_type === type).length
    }));

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b} : {c} ({d}%)'
      },
      legend: {
        data: eventTypes,
        textStyle: { color: 'var(--ant-text-color)' }
      },
      series: [
        {
          name: '事件分布',
          type: 'pie',
          radius: '60%',
          data: data,
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

    eventPatternsChart.setOption(option);
  }
};

const updateCharts = () => {
  nextTick(() => {
    initEventPatternsChart();
    initErrorCategoriesChart();
    initErrorTrendsChart();
  });
};

// getStatusText函数已被内联到模板中，不再需要

const toggleAutoRefresh = (enabled: boolean) => {
  if (!hasInitialData.value && enabled) {
    message.warning('请先执行诊断获取数据');
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
    refreshAllDiagnosis();
  }, 30000);
};

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
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

const resetDashboard = () => {
  inputData.value.namespace = '';
  hasInitialData.value = false;
  quickDiagnosisResult.value = null;
  eventPatternsResult.value = null;
  errorSummaryResult.value = null;
  
  // 重置错误状态
  resetErrorState();
  
  // 数据已重置，模板会自动更新显示
  
  // 清空图表
  eventPatternsChart?.clear();
  errorCategoriesChart?.clear();
  errorTrendsChart?.clear();
  
  message.success('诊断面板已重置');
};

const viewDetailDiagnosis = () => {
  // 跳转到详细分析页面
  // router.push(`/rca/analysis`);
};

// 生命周期
onMounted(async () => {
  await nextTick();
  
  // 窗口大小变化时重新调整图表
  window.addEventListener('resize', () => {
    eventPatternsChart?.resize();
    errorCategoriesChart?.resize();
    errorTrendsChart?.resize();
  });
});

onUnmounted(() => {
  stopAutoRefresh();
  eventPatternsChart?.dispose();
  errorCategoriesChart?.dispose();
  errorTrendsChart?.dispose();
  window.removeEventListener('resize', () => {});
});
</script>

<style scoped>
.rca-diagnosis {
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
  background: linear-gradient(90deg, #722ed1, #eb2f96);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.title-icon {
  font-size: 28px;
  color: #722ed1;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.input-card {
  margin-bottom: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.input-card.highlight-required {
  border: 2px solid #722ed1;
  box-shadow: 0 0 10px rgba(114, 46, 209, 0.3);
}

.metrics-overview {
  margin-bottom: 24px;
}

.metric-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 8px;
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
  color: white;
}

.metric-critical-issues .metric-icon {
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
}

.metric-warnings .metric-icon {
  background: linear-gradient(135deg, #faad14, #ffc53d);
}

.metric-errors .metric-icon {
  background: linear-gradient(135deg, #722ed1, #a855f7);
}

.metric-health .metric-icon {
  background: linear-gradient(135deg, #52c41a, #73d13d);
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

.metric-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-time {
  font-size: 12px;
  color: var(--ant-text-color-secondary);
}

.diagnosis-results {
  margin-bottom: 24px;
}

.critical-issues-card,
.warnings-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.issues-list,
.warnings-list {
  max-height: 300px;
  overflow-y: auto;
}

.issue-item,
.warning-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ant-border-color-split);
}

.issue-item:last-child,
.warning-item:last-child {
  border-bottom: none;
}

.issue-icon {
  color: #ff4d4f;
  font-size: 16px;
  margin-top: 2px;
}

.warning-icon {
  color: #faad14;
  font-size: 16px;
  margin-top: 2px;
}

.issue-content,
.warning-content {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ant-text-color);
}

.analysis-section {
  margin-bottom: 24px;
}

.chart-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.chart-container {
  height: 350px;
  width: 100%;
}

.chart-container-small {
  height: 280px;
  width: 100%;
}

.recommendations-section {
  margin-bottom: 24px;
}

.recommendations-card,
.trends-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.recommendations-list {
  max-height: 300px;
  overflow-y: auto;
}

.recommendation-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ant-border-color-split);
}

.recommendation-item:last-child {
  border-bottom: none;
}

.rec-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #faad14, #ffc53d);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: white;
}

.rec-content {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ant-text-color);
}

.summary-section {
  margin-bottom: 24px;
}

.summary-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.summary-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
  padding: 16px 0;
}

.summary-item {
  text-align: center;
  padding: 16px;
  border-radius: 8px;
  background-color: var(--ant-background-color-light);
}

.summary-label {
  font-size: 14px;
  color: var(--ant-text-color-secondary);
  margin-bottom: 8px;
}

.summary-value {
  font-size: 24px;
  font-weight: bold;
  color: var(--ant-text-color);
}

.summary-value.error {
  color: #ff4d4f;
}

.summary-value.trend {
  color: #1890ff;
}

.summary-value.anomaly {
  color: #faad14;
}

.summary-value.duration {
  color: #52c41a;
}

.summary-value.namespace {
  color: #1890ff;
  font-weight: 600;
}

.summary-value.range {
  color: #722ed1;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .rca-diagnosis {
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
  
  .summary-content {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
