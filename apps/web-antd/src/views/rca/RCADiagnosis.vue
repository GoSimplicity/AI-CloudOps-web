<template>
  <OpsPage
    class="rca-diagnosis"
    description="按选择范围诊断，部分失败与未知状态单独显示"
    title="快速诊断"
  >
    <!-- 页面头部 -->
    <template #actions>
      <a-button
        :disabled="!isFormValid || loading"
        :loading="loading"
        size="large"
        type="primary"
        @click="refreshAllDiagnosis"
      >
        {{ loading ? '诊断中...' : '开始诊断' }}
      </a-button>
    </template>

    <!-- 诊断参数配置 -->
    <a-alert
      v-if="diagnosisError"
      :message="diagnosisError"
      role="alert"
      show-icon
      type="error"
    />
    <div class="config-section">
      <div class="section-header">
        <h2>诊断配置</h2>
        <a-tag :color="hasInitialData ? '#10b981' : '#f59e0b'">
          {{ hasInitialData ? '已配置' : '待配置' }}
        </a-tag>
      </div>

      <div class="config-grid">
        <div class="config-item">
          <label>命名空间</label>
          <a-input
            v-model:value="inputData.namespace"
            :disabled="loading"
            class="modern-input"
            placeholder="输入K8s命名空间"
          />
        </div>
        <div class="config-item">
          <label>时间范围</label>
          <a-select
            v-model:value="timeRange"
            :disabled="loading"
            class="modern-select"
          >
            <a-select-option value="1">1小时</a-select-option>
            <a-select-option value="6">6小时</a-select-option>
            <a-select-option value="24">24小时</a-select-option>
          </a-select>
        </div>
        <div class="config-item">
          <label>诊断级别</label>
          <a-radio-group
            v-model:value="diagnosisLevel"
            :disabled="loading"
            button-style="solid"
          >
            <a-radio-button value="quick">快速</a-radio-button>
            <a-radio-button value="standard">标准</a-radio-button>
            <a-radio-button value="comprehensive">全面</a-radio-button>
          </a-radio-group>
        </div>
        <div class="config-item">
          <label>每30秒诊断（会重复调用分析服务）</label>
          <div class="switch-container">
            <a-switch
              v-model:checked="autoRefresh"
              @change="toggleAutoRefresh"
            />
            <span class="switch-label">{{
              autoRefresh ? '已开启' : '已关闭'
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <CollectionSummary
      v-if="quickDiagnosisResult && !loading"
      :collection="quickDiagnosisResult.collection"
      :status="quickDiagnosisResult.status"
    />

    <!-- 核心指标卡片 -->
    <div class="metrics-grid">
      <div class="metric-card critical">
        <div class="metric-icon"><Icon icon="mdi:alert-outline" /></div>
        <div class="metric-info">
          <div class="metric-value">
            {{
              quickUsable
                ? getCriticalIssuesCount()
                : quickDiagnosisResult
                  ? '未知'
                  : '待诊断'
            }}
          </div>
          <div class="metric-label">关键问题</div>
        </div>
        <div
          class="metric-trend"
          :class="
            !quickUsable
              ? 'trend-unknown'
              : getCriticalIssuesCount() > 0
                ? 'trend-up'
                : 'trend-stable'
          "
        >
          {{
            !quickUsable
              ? '结果不可用'
              : getCriticalIssuesCount() > 0
                ? '需要关注'
                : '本次未见关键问题'
          }}
        </div>
      </div>

      <div class="metric-card warning">
        <div class="metric-icon"><Icon icon="mdi:alert-circle-outline" /></div>
        <div class="metric-info">
          <div class="metric-value">
            {{
              quickUsable
                ? getWarningsCount()
                : quickDiagnosisResult
                  ? '未知'
                  : '待诊断'
            }}
          </div>
          <div class="metric-label">警告信息</div>
        </div>
        <div
          class="metric-trend"
          :class="
            !quickUsable
              ? 'trend-unknown'
              : getWarningsCount() > 0
                ? 'trend-warning'
                : 'trend-stable'
          "
        >
          {{
            !quickUsable
              ? '结果不可用'
              : getWarningsCount() > 0
                ? '存在警告'
                : '本次无警告'
          }}
        </div>
      </div>

      <div class="metric-card errors">
        <div class="metric-icon"><Icon icon="mdi:bug-outline" /></div>
        <div class="metric-info">
          <div class="metric-value">
            {{ errorSummaryResult ? getTotalErrors() : '未查询' }}
          </div>
          <div class="metric-label">错误总数</div>
        </div>
        <div
          class="metric-trend"
          :class="
            !errorSummaryResult
              ? 'trend-unknown'
              : getTotalErrors() > 100
                ? 'trend-up'
                : 'trend-stable'
          "
        >
          过去{{ timeRange }}小时
        </div>
      </div>

      <div class="metric-card health">
        <div class="metric-icon">
          <Icon icon="mdi:clipboard-check-outline" />
        </div>
        <div class="metric-info">
          <div class="metric-value">
            {{
              quickDiagnosisResult
                ? analysisStatus(quickDiagnosisResult.status).label
                : '待诊断'
            }}
          </div>
          <div class="metric-label">诊断状态</div>
        </div>
        <div class="metric-trend">以本次检查范围为准</div>
      </div>
    </div>

    <!-- 诊断结果区域 -->
    <div v-if="quickDiagnosisResult || loading" class="diagnosis-section">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <a-spin />
        <p>正在等待服务返回实际结果，请稍候</p>
      </div>

      <!-- 诊断结果 -->
      <div v-else-if="quickUsable" class="issues-container">
        <!-- 关键问题 -->
        <div class="issues-panel critical-panel">
          <div class="panel-header">
            <h3>关键问题</h3>
            <span class="issue-count">{{
              quickUsable
                ? getCriticalIssuesCount()
                : quickDiagnosisResult
                  ? '未知'
                  : '待诊断'
            }}</span>
          </div>
          <div class="issues-list">
            <div
              v-for="(issue, index) in formattedCriticalIssues"
              :key="index"
              class="issue-item critical-item"
            >
              <div class="issue-header">
                <span class="issue-type">{{ issue.type || 'unknown' }}</span>
                <span class="issue-severity">{{
                  issue.severity || 'critical'
                }}</span>
                <span v-if="issue.timestamp" class="issue-time">
                  {{ formatShortTime(issue.timestamp) }}
                </span>
              </div>
              <div class="issue-description">
                {{ issue.description || issue }}
              </div>
              <div
                class="issue-confidence"
                v-if="Number.isFinite(issue.confidence)"
              >
                <div class="confidence-bar">
                  <div
                    :style="{ width: issue.confidence * 100 + '%' }"
                    class="confidence-fill"
                  ></div>
                </div>
                <span class="confidence-text"
                  >{{ (issue.confidence * 100).toFixed(0) }}%</span
                >
              </div>
            </div>
            <div v-if="getCriticalIssuesCount() === 0" class="empty-state">
              ✅ 未发现关键问题
            </div>
          </div>
        </div>

        <!-- 建议措施 -->
        <div class="issues-panel recommendations-panel">
          <div class="panel-header">
            <h3>建议措施</h3>
            <span class="issue-count">{{ getRecommendationsCount() }}</span>
          </div>
          <div class="recommendations-list">
            <div
              v-for="(rec, index) in quickDiagnosisResult?.recommendations ||
              []"
              :key="index"
              class="recommendation-item"
            >
              <span class="rec-icon">💡</span>
              <span class="rec-text">{{ rec }}</span>
              <span class="rec-priority">P{{ index + 1 }}</span>
            </div>
            <div v-if="getRecommendationsCount() === 0" class="empty-state">
              暂无建议
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <a-alert
      v-if="diagnosisFailures.length"
      type="warning"
      :message="`未完成：${diagnosisFailures.join('、')}。当前结果不代表完整健康检查。`"
      show-icon
    />
    <div v-if="hasInitialData" class="charts-section">
      <div class="chart-container">
        <div class="chart-header">
          <h3>本次诊断错误总量</h3>
          <a-radio-group v-model:value="chartType" size="small">
            <a-radio-button value="line">折线图</a-radio-button>
            <a-radio-button value="bar">柱状图</a-radio-button>
          </a-radio-group>
        </div>
        <div ref="errorTrendsChartRef" class="chart-content"></div>
      </div>

      <div class="chart-container">
        <div class="chart-header">
          <h3>错误分类统计</h3>
        </div>
        <div ref="errorCategoriesChartRef" class="chart-content"></div>
      </div>
    </div>

    <!-- 根因分析详情 -->
    <div v-if="rcaAnalysisResult" class="rca-section">
      <div class="section-header">
        <h2>根因分析</h2>
        <a-tag v-if="rcaUsable" color="#6366f1">
          置信度:
          {{
            Number.isFinite(rcaAnalysisResult.confidence_score)
              ? (rcaAnalysisResult.confidence_score * 100).toFixed(1) + '%'
              : '未知'
          }}
        </a-tag>
      </div>

      <CollectionSummary
        :collection="rcaAnalysisResult.collection"
        :status="rcaAnalysisResult.status"
      />
      <div v-if="rcaUsable" class="rca-content">
        <div
          v-for="(cause, index) in rcaAnalysisResult.root_causes"
          :key="index"
          class="root-cause-card"
        >
          <div class="cause-header">
            <span class="cause-type">{{ cause.cause_type || 'unknown' }}</span>
            <div class="cause-confidence">
              <div class="confidence-mini-bar">
                <div
                  :style="{ width: cause.confidence * 100 + '%' }"
                  class="confidence-mini-fill"
                ></div>
              </div>
            </div>
          </div>
          <p class="cause-description">{{ cause.description || '暂无描述' }}</p>
          <div
            v-if="cause.affected_components?.length"
            class="cause-components"
          >
            <span class="components-label">影响组件:</span>
            <a-tag
              v-for="comp in cause.affected_components"
              :key="comp"
              size="small"
            >
              {{ comp }}
            </a-tag>
          </div>
          <div
            v-if="cause.recommendations?.length"
            class="cause-recommendations"
          >
            <span class="components-label">建议:</span>
            <div class="rec-list">
              <div
                v-for="(rec, recIndex) in cause.recommendations"
                :key="recIndex"
                class="rec-item"
              >
                {{ rec }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 系统摘要 -->
    <div v-if="hasInitialData" class="summary-section">
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">命名空间</span>
          <span class="summary-value">{{
            diagnosisContext?.namespace || '未知'
          }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">分析时间</span>
          <span class="summary-value">{{ getCurrentTime() }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">时间范围</span>
          <span class="summary-value"
            >{{ diagnosisContext?.hours ?? '未知' }}小时</span
          >
        </div>
        <div class="summary-item">
          <span class="summary-label">诊断状态</span>
          <span class="summary-value">{{
            quickDiagnosisResult
              ? analysisStatus(quickDiagnosisResult.status).label
              : '未知'
          }}</span>
        </div>
        <div
          v-if="quickDiagnosisResult?.analysis_duration"
          class="summary-item"
        >
          <span class="summary-label">分析耗时</span>
          <span class="summary-value"
            >{{ quickDiagnosisResult.analysis_duration }}ms</span
          >
        </div>
      </div>
    </div>
  </OpsPage>
</template>

<script setup lang="ts">
import OpsPage from '#/components/ops/OpsPage.vue';
import CollectionSummary from './CollectionSummary.vue';
import { analysisStatus } from './collection';
import { useAiRequestScope } from '../assistant/useAiRequestScope';
import { chartColors, useChartAppearance } from '../assistant/chart-appearance';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
// 按需引入echarts，减少打包体积
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// 注册必需的组件
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);
import { message } from 'ant-design-vue';
import { Icon } from '@iconify/vue';
import type {
  ErrorSummaryResponse,
  EventPatternsResponse,
  QuickDiagnosisResponse,
  RCAAnalysisResponse,
} from '#/api/core/aiops/rca';
import {
  analyzeRootCause,
  getErrorSummary,
  getEventPatterns,
  quickDiagnosis,
} from '#/api/core/aiops/rca';

// 响应式数据
const loading = ref(false);
const timeRange = ref('24');
const chartType = ref('line');
const diagnosisLevel = ref('standard');
const autoRefresh = ref(false);
const hasInitialData = ref(false);
const diagnosisFailures = ref<string[]>([]);

const inputData = ref({
  namespace: 'default',
});

// 诊断结果
const quickDiagnosisResult = ref<QuickDiagnosisResponse | null>(null);
const eventPatternsResult = ref<EventPatternsResponse | null>(null);
const errorSummaryResult = ref<ErrorSummaryResponse | null>(null);
const rcaAnalysisResult = ref<RCAAnalysisResponse | null>(null);
const usableStatus = (status?: string) =>
  status === 'completed' || status === 'degraded';
const quickUsable = computed(() =>
  usableStatus(quickDiagnosisResult.value?.status),
);
const rcaUsable = computed(() => usableStatus(rcaAnalysisResult.value?.status));

// 图表引用
const errorTrendsChartRef = ref<HTMLElement>();
const errorCategoriesChartRef = ref<HTMLElement>();
let errorTrendsChart: echarts.ECharts | null = null;
let errorCategoriesChart: echarts.ECharts | null = null;

let refreshTimer: ReturnType<typeof setInterval> | null = null;
const diagnosisError = ref('');
const diagnosisContext = ref<{ namespace: string; hours: number } | null>(null);
const scope = useAiRequestScope(() => {
  diagnosisLane.invalidate();
  stopAutoRefresh();
  autoRefresh.value = false;
  loading.value = false;
  hasInitialData.value = false;
  diagnosisError.value = '';
  diagnosisContext.value = null;
  diagnosisFailures.value = [];
  quickDiagnosisResult.value = null;
  eventPatternsResult.value = null;
  errorSummaryResult.value = null;
  rcaAnalysisResult.value = null;
  inputData.value.namespace = 'default';
  errorTrendsChart?.dispose();
  errorTrendsChart = null;
  errorCategoriesChart?.dispose();
  errorCategoriesChart = null;
});
const diagnosisLane = scope.createLane();
useChartAppearance(() => {
  if (hasInitialData.value) initCharts();
});

// 计算属性
const isFormValid = computed(() => {
  return !!scope.owner.value && inputData.value.namespace.trim() !== '';
});

const formattedCriticalIssues = computed(() => {
  if (!quickDiagnosisResult.value?.critical_issues) return [];

  return quickDiagnosisResult.value.critical_issues.map((issue: any) => {
    if (typeof issue === 'string') {
      return {
        type: 'unknown',
        severity: 'critical',
        description: issue,
        confidence: 0,
        timestamp: null,
      };
    }

    return {
      type: issue.type || 'unknown',
      severity: issue.severity || 'critical',
      description: issue.description || issue.message || '暂无描述',
      confidence: Math.max(0, Math.min(1, issue.confidence || 0)),
      timestamp: issue.timestamp || null,
    };
  });
});

// 辅助函数
const getCriticalIssuesCount = () => {
  return quickDiagnosisResult.value?.critical_issues?.length || 0;
};

const getWarningsCount = () => {
  return quickDiagnosisResult.value?.warnings?.length || 0;
};

const getTotalErrors = () => {
  return errorSummaryResult.value?.total_errors || 0;
};

const getRecommendationsCount = () => {
  return quickDiagnosisResult.value?.recommendations?.length || 0;
};

const getCurrentTime = () => {
  const timestamp =
    quickDiagnosisResult.value?.timestamp ||
    rcaAnalysisResult.value?.timestamp ||
    eventPatternsResult.value?.timestamp ||
    errorSummaryResult.value?.timestamp;
  return timestamp && Number.isFinite(Date.parse(timestamp))
    ? new Date(timestamp).toLocaleString('zh-CN')
    : '未知';
};

const formatShortTime = (timestamp: string) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return timestamp;
  }
};

// 获取当前诊断步骤
const refreshAllDiagnosis = async () => {
  if (!scope.owner.value || loading.value) return;
  if (!isFormValid.value) {
    message.warning('请填写命名空间');
    return;
  }

  const namespace = inputData.value.namespace.trim();
  if (!/^[a-z0-9-]+$/.test(namespace)) {
    message.error('命名空间格式不正确，只能包含小写字母、数字和连字符');
    return;
  }

  const ticket = diagnosisLane.begin();
  const level = diagnosisLevel.value;
  const hours = Number(timeRange.value);
  diagnosisError.value = '';
  loading.value = true;
  hasInitialData.value = false;
  diagnosisContext.value = null;
  quickDiagnosisResult.value = null;
  eventPatternsResult.value = null;
  errorSummaryResult.value = null;
  rcaAnalysisResult.value = null;
  diagnosisFailures.value = [];

  // 开始诊断提示

  try {
    const promises: Promise<any>[] = [];

    // 步骤1: 快速诊断

    promises.push(
      quickDiagnosis({
        namespace,
      }).catch((_error) => {
        // Quick diagnosis failed
        return null;
      }),
    );

    if (level !== 'quick') {
      // 步骤2: 事件模式分析

      promises.push(
        getEventPatterns({
          namespace,
          hours: hours,
        }).catch((_error) => {
          // Event patterns analysis failed
          return null;
        }),
      );
    }

    if (level === 'comprehensive') {
      // 步骤3: 综合分析

      promises.push(
        getErrorSummary({
          namespace,
          hours: hours,
        }).catch((_error) => {
          // Error summary analysis failed
          return null;
        }),
        analyzeRootCause({
          namespace,
          time_window_hours: hours,
          metrics: [],
        }).catch((_error) => {
          // Root cause analysis failed
          return null;
        }),
      );
    }

    const results = await Promise.all(promises);
    if (!diagnosisLane.current(ticket)) return;

    const labels = ['快速诊断', '事件模式', '错误汇总', '根因分析'];
    diagnosisFailures.value = results.flatMap((result, index) =>
      result === null ||
      ((index === 0 || index === 3) && !usableStatus(result.status))
        ? [labels[index]!]
        : [],
    );
    if (results.every((result) => result === null)) {
      diagnosisError.value = '全部诊断失败，请检查服务状态后重试';
      message.error(diagnosisError.value);
      return;
    }

    // 完成所有步骤

    if (results[0]) {
      quickDiagnosisResult.value = results[0];
    }

    if (results[1] && level !== 'quick') {
      eventPatternsResult.value = results[1];
    }

    if (results[2] && level === 'comprehensive') {
      errorSummaryResult.value = results[2];
    }

    if (results[3] && level === 'comprehensive') {
      rcaAnalysisResult.value = results[3];
    }

    diagnosisContext.value = { namespace, hours };
    hasInitialData.value = true;
    await nextTick();
    if (!diagnosisLane.current(ticket)) return;
    initCharts();

    if (diagnosisFailures.value.length) {
      message.warning('部分诊断未完成，请检查失败项目');
    } else if (
      results[0]?.status === 'degraded' ||
      results[3]?.status === 'degraded'
    ) {
      message.warning('诊断结果已降级，请检查采集状态');
    } else {
      message.success('诊断完成，请查看各项检查结果');
    }
  } catch (error) {
    if (!diagnosisLane.current(ticket)) return;
    diagnosisError.value =
      error instanceof Error ? error.message : '诊断失败，请核对参数后重试';
  } finally {
    if (diagnosisLane.current(ticket)) loading.value = false;
  }
};

// 初始化图表
const initCharts = () => {
  try {
    initErrorTrendsChart();
    initErrorCategoriesChart();
  } catch (error) {
    message.warning('图表渲染失败，但不影响诊断结果');
  }
};

const initErrorTrendsChart = () => {
  if (!errorTrendsChartRef.value) return;

  if (!errorTrendsChart) {
    errorTrendsChart = echarts.init(errorTrendsChartRef.value);
  }

  // Diagnosis returns aggregate counts, not a time-series histogram.
  const data = errorSummaryResult.value
    ? [{ time: '本次诊断', value: getTotalErrors() }]
    : [];

  const option = {
    textStyle: { color: chartColors().text },
    backgroundColor: 'transparent',
    color: ['#6366f1'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: chartColors().surface,
      borderColor: chartColors().border,
      borderWidth: 1,
      textStyle: { color: chartColors().text },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: chartType.value === 'bar',
      data: data.map((d) => d.time),
      axisLine: { lineStyle: { color: chartColors().border } },
      axisLabel: { color: chartColors().muted },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: chartColors().border } },
      splitLine: { lineStyle: { color: chartColors().ground } },
      axisLabel: { color: chartColors().muted },
    },
    series: [
      {
        name: '错误数量',
        type: chartType.value,
        data: data.map((d) => d.value),
        smooth: true,
        lineStyle: { width: 2 },
        areaStyle: chartType.value === 'line' ? { opacity: 0.1 } : undefined,
        itemStyle: {
          borderRadius: chartType.value === 'bar' ? [4, 4, 0, 0] : 0,
        },
      },
    ],
  };

  errorTrendsChart.setOption(option);
};

const initErrorCategoriesChart = () => {
  if (!errorCategoriesChartRef.value) return;

  if (!errorCategoriesChart) {
    errorCategoriesChart = echarts.init(errorCategoriesChartRef.value);
  }

  const topErrors = errorSummaryResult.value?.top_errors || [];
  const pieData = topErrors
    .filter((error: any) => Number.isFinite(error.count) && error.count >= 0)
    .slice(0, 5)
    .map((error: any, index: number) => ({
      name: error.error_type || `错误类型 ${index + 1}`,
      value: error.count,
    }));

  const option = {
    textStyle: { color: chartColors().text },
    backgroundColor: 'transparent',
    color: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
    tooltip: {
      trigger: 'item',
      backgroundColor: chartColors().surface,
      borderColor: chartColors().border,
      borderWidth: 1,
      textStyle: { color: chartColors().text },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '18',
            fontWeight: 'bold',
          },
        },
        labelLine: { show: false },
        data: pieData,
      },
    ],
  };

  errorCategoriesChart.setOption(option);
};

// 监听图表类型变化
watch(chartType, () => {
  if (hasInitialData.value) {
    nextTick(() => {
      initErrorTrendsChart();
    });
  }
});

const toggleAutoRefresh = (enabled: boolean) => {
  if (enabled) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
};

const startAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  refreshTimer = setInterval(() => {
    if (!loading.value) {
      refreshAllDiagnosis();
    }
  }, 30000);

  message.info('已明确开启每30秒诊断，离开页面或切换账户会停止');
};

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// 生命周期
onMounted(() => {
  const handleResize = () => {
    if (errorTrendsChart) {
      errorTrendsChart.resize();
    }
    if (errorCategoriesChart) {
      errorCategoriesChart.resize();
    }
  };

  window.addEventListener('resize', handleResize);

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
  });
});

onUnmounted(() => {
  stopAutoRefresh();

  // 安全地销毁ECharts实例
  if (errorTrendsChart && !errorTrendsChart.isDisposed()) {
    errorTrendsChart.dispose();
    errorTrendsChart = null;
  }
  if (errorCategoriesChart && !errorCategoriesChart.isDisposed()) {
    errorCategoriesChart.dispose();
    errorCategoriesChart = null;
  }
});
</script>

<style scoped>
.trend-unknown {
  color: var(--ops-muted);
  background: var(--ops-ground);
}

/* 页面头部 */

/* 配置区域 */
.config-section {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 24px;
  margin-bottom: var(--ops-space-lg);
  box-shadow: none;
  border: 1px solid var(--ops-border);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--ops-space-lg);
}

.section-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--ops-ink);
  margin: 0;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
  align-items: start;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  position: relative;
}

.config-item label {
  font-size: 14px;
  color: var(--ops-muted);
  font-weight: 500;
}

.modern-input {
  height: 36px;
  border-radius: var(--ops-radius);
  border: 1px solid var(--ops-border);
  transition: border-color var(--ops-duration) ease-out;
}

.modern-select {
  width: 100%;
  border-radius: var(--ops-radius);
}

.modern-select :deep(.ant-select-selector) {
  height: 36px !important;
  border-radius: 8px !important;
  border: 1px solid var(--ops-border) !important;
  transition: border-color var(--ops-duration) ease-out;
}

.modern-select :deep(.ant-select-selection-item) {
  line-height: 34px !important;
}

.modern-input:focus {
  border-color: #1890ff;
  box-shadow: none;
}

.modern-select:hover :deep(.ant-select-selector) {
  border-color: #40a9ff !important;
}

.modern-select.ant-select-focused :deep(.ant-select-selector) {
  border-color: #1890ff !important;
  box-shadow: none;
}

.modern-input:hover {
  border-color: #40a9ff;
}

/* 下拉框特定样式 */
.modern-select :deep(.ant-select-dropdown) {
  z-index: 1050 !important;
}

.modern-select :deep(.ant-select-arrow) {
  color: var(--ops-muted);
}

.switch-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.switch-label {
  font-size: 12px;
  color: var(--ops-muted);
  font-weight: 500;
}

/* 指标卡片 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: var(--ops-space-lg);
}

.metric-card {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 24px;
  box-shadow: none;
  display: flex;
  align-items: center;
  gap: 20px;
  transition: border-color var(--ops-duration) ease-out;
  border: 1px solid var(--ops-border);
}

.metric-card:hover {
  box-shadow: none;
}

.metric-icon {
  font-size: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.metric-info {
  flex: 1;
}

.metric-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--ops-ink);
  line-height: 1.2;
  margin-bottom: 8px;
}

.metric-label {
  font-size: 14px;
  color: var(--ops-muted);
  font-weight: 500;
}

.metric-trend {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.trend-stable {
  background: var(--ops-ground);
  color: #52c41a;
}

.trend-warning {
  background: var(--ops-ground);
  color: #faad14;
}

.trend-up {
  background: var(--ops-ground);
  color: #ff4d4f;
}

/* 诊断结果 */
.diagnosis-section {
  margin-bottom: var(--ops-space-lg);
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  box-shadow: none;
  border: 1px solid var(--ops-border);
}

.loading-content {
  text-align: center;
  padding: 40px;
  max-width: 600px;
  width: 100%;
}

.loading-main-icon {
  font-size: 80px;
  color: #1890ff;
  margin-bottom: var(--ops-space-lg);
}

.pulse-animation {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

.rotate-animation {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--ops-ink);
  margin-bottom: 8px;
}

.loading-subtitle {
  font-size: 14px;
  color: var(--ops-muted);
  margin-bottom: 32px;
}

.diagnosis-steps {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 32px;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-radius: var(--ops-radius);
  transition: border-color var(--ops-duration) ease-out;
  opacity: 0.5;
}

.step-item.active {
  opacity: 1;
  background: rgba(24, 144, 255, 0.05);
  border: 1px solid rgba(24, 144, 255, 0.2);
}

.step-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--ops-ground);
  border: 2px solid var(--ops-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--ops-muted);
  transition: border-color var(--ops-duration) ease-out;
}

.step-item.active .step-icon {
  background: var(--ops-accent);
  border-color: #1890ff;
  color: hsl(var(--primary-foreground));
}

.step-text {
  font-size: 12px;
  color: var(--ops-muted);
  font-weight: 500;
  text-align: center;
}

.step-item.active .step-text {
  color: #1890ff;
  font-weight: 600;
}

.loading-tip {
  margin-top: 24px;
}

.issues-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 24px;
}

.issues-panel {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 20px;
  box-shadow: none;
  border: 1px solid var(--ops-border);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--ops-ink);
  margin: 0;
}

.issue-count {
  background: var(--ops-ground);
  color: var(--ops-muted);
  padding: 4px 12px;
  border-radius: var(--ops-radius);
  font-size: 12px;
  font-weight: 500;
}

.issues-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.issue-item {
  padding: 16px;
  border-radius: 6px;
  background: var(--ops-ground);
  border-left: 1px solid;
  transition: border-color var(--ops-duration) ease-out;
}

.critical-item {
  border-left-color: #ff4d4f;
}

.critical-item:hover {
  background: var(--ops-ground);
}

.issue-header {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.issue-type {
  background: var(--ops-border);
  color: var(--ops-ink);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.issue-severity {
  background: var(--ops-ground);
  color: #ff4d4f;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.issue-time {
  margin-left: auto;
  color: var(--ops-muted);
  font-size: 12px;
}

.issue-description {
  color: var(--ops-muted);
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 8px;
}

.issue-confidence {
  display: flex;
  align-items: center;
  gap: 8px;
}

.confidence-bar {
  flex: 1;
  height: 4px;
  background: var(--ops-border);
  border-radius: 2px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  background: var(--ops-accent);
  transition: width 0.3s;
}

.confidence-text {
  font-size: 12px;
  color: var(--ops-muted);
  font-weight: 500;
}

/* 建议 */
.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recommendation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--ops-ground);
  border-radius: 6px;
  transition: border-color var(--ops-duration) ease-out;
}

.recommendation-item:hover {
  background: var(--ops-ground);
}

.rec-icon {
  font-size: 18px;
}

.rec-text {
  flex: 1;
  color: var(--ops-muted);
  font-size: 14px;
}

.rec-priority {
  background: #52c41a;
  color: hsl(var(--primary-foreground));
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.rec-list {
  margin-top: 8px;
}

.rec-item {
  font-size: 13px;
  color: var(--ops-muted);
  line-height: 1.4;
  padding: 4px 0;
  border-bottom: 1px solid var(--ops-border);
}

.rec-item:last-child {
  border-bottom: none;
}

/* 图表 */
.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 24px;
  margin-bottom: var(--ops-space-lg);
}

.chart-container {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 20px;
  box-shadow: none;
  border: 1px solid var(--ops-border);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.chart-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--ops-ink);
  margin: 0;
}

.chart-content {
  height: 300px;
}

/* 根因分析 */
.rca-section {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 24px;
  margin-bottom: var(--ops-space-lg);
  box-shadow: none;
  border: 1px solid var(--ops-border);
}

.rca-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}

.root-cause-card {
  padding: 20px;
  background: var(--ops-ground);
  border-radius: 6px;
  border: 1px solid var(--ops-border);
  transition: border-color var(--ops-duration) ease-out;
}

.root-cause-card:hover {
  box-shadow: none;
  background: var(--ops-surface);
}

.cause-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.cause-type {
  background: var(--ops-accent);
  color: hsl(var(--primary-foreground));
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.cause-confidence {
  width: 80px;
}

.confidence-mini-bar {
  height: 6px;
  background: var(--ops-border);
  border-radius: 3px;
  overflow: hidden;
}

.confidence-mini-fill {
  height: 100%;
  background: var(--ops-accent);
}

.cause-description {
  color: var(--ops-muted);
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 12px;
}

.cause-components {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.components-label {
  font-size: 12px;
  color: var(--ops-muted);
  font-weight: 500;
}

.cause-recommendations {
  margin-top: 12px;
}

.rec-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.rec-item {
  font-size: 13px;
  color: var(--ops-muted);
  line-height: 1.4;
  padding: 8px 12px;
  background: var(--ops-ground);
  border-radius: 4px;
  border: 1px solid var(--ops-border);
  transition: border-color var(--ops-duration) ease-out;
}

.rec-item:hover {
  background: var(--ops-border);
  border-color: var(--ops-border);
}

/* 摘要 */
.summary-section {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 24px;
  box-shadow: none;
  border: 1px solid var(--ops-border);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--ops-ground);
  border: 1px solid var(--ops-border);
  border-radius: 6px;
}

.summary-label {
  font-size: 12px;
  color: var(--ops-muted);
  text-transform: uppercase;
  font-weight: 600;
}

.summary-value {
  font-size: 16px;
  color: var(--ops-ink);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #bfbfbf;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .metrics-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .config-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .config-item {
    margin-bottom: 8px;
  }

  .issues-container {
    grid-template-columns: 1fr;
  }

  .charts-section {
    grid-template-columns: 1fr;
  }

  .rca-content {
    grid-template-columns: 1fr;
  }

  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart-content {
    height: 250px;
  }

  .loading-container {
    min-height: 300px;
  }

  .loading-content {
    padding: 20px;
  }

  .loading-main-icon {
    font-size: 60px;
  }

  .loading-title {
    font-size: 20px;
  }

  .diagnosis-steps {
    flex-direction: column;
    gap: 16px;
  }

  .step-item {
    flex-direction: row;
    gap: 12px;
    padding: 12px;
  }

  .step-icon {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }
}

@media (max-width: 576px) {
  .config-grid {
    grid-template-columns: 1fr;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }

  .metric-card {
    padding: 16px;
  }

  .metric-icon {
    font-size: 28px;
  }

  .metric-value {
    font-size: 20px;
  }
}

@media (max-width: 575px) {
  .overview-grid,
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ops-space-sm);
  }
  .overview-card,
  .metric-card {
    min-width: 0;
    padding: var(--ops-space-md);
    gap: var(--ops-space-sm);
    flex-wrap: wrap;
  }
  .metric-icon {
    font-size: 20px;
  }
  .card-value,
  .metric-value {
    overflow-wrap: anywhere;
  }
  .section-header {
    flex-wrap: wrap;
    gap: var(--ops-space-sm);
  }
}
</style>
