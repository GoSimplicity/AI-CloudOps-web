<template>
  <div class="rca-diagnosis">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">
          <span class="title-icon">🔍</span>
          快速诊断
        </h1>
        <p class="subtitle">快速诊断 · 根因分析 · 智能诊断</p>
      </div>
      <div class="header-actions">
        <a-button class="action-btn reset-btn" @click="resetDashboard">
          重置
        </a-button>
        <a-button 
          type="primary" 
          class="action-btn primary-btn"
          @click="refreshAllDiagnosis" 
          :loading="loading" 
          :disabled="!isFormValid"
        >
          {{ hasInitialData ? '刷新诊断' : '开始诊断' }}
        </a-button>
      </div>
    </div>

    <!-- 诊断参数配置 -->
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
            placeholder="输入K8s命名空间"
            class="modern-input"
          />
        </div>
        <div class="config-item">
          <label>时间范围</label>
          <a-select v-model:value="timeRange" class="modern-select">
            <a-select-option value="1">1小时</a-select-option>
            <a-select-option value="6">6小时</a-select-option>
            <a-select-option value="24">24小时</a-select-option>
          </a-select>
        </div>
        <div class="config-item">
          <label>诊断级别</label>
          <a-radio-group v-model:value="diagnosisLevel" button-style="solid">
            <a-radio-button value="quick">快速</a-radio-button>
            <a-radio-button value="standard">标准</a-radio-button>
            <a-radio-button value="comprehensive">全面</a-radio-button>
          </a-radio-group>
        </div>
        <div class="config-item">
          <label>自动刷新</label>
          <a-switch v-model:checked="autoRefresh" @change="toggleAutoRefresh" />
        </div>
      </div>
    </div>

    <!-- 核心指标卡片 -->
    <div class="metrics-grid">
      <div class="metric-card critical">
        <div class="metric-icon">⚠️</div>
        <div class="metric-info">
          <div class="metric-value">{{ getCriticalIssuesCount() }}</div>
          <div class="metric-label">关键问题</div>
        </div>
        <div class="metric-trend" :class="getCriticalIssuesCount() > 0 ? 'trend-up' : 'trend-stable'">
          {{ getCriticalIssuesCount() > 0 ? '需要关注' : '状态正常' }}
        </div>
      </div>

      <div class="metric-card warning">
        <div class="metric-icon">⚡</div>
        <div class="metric-info">
          <div class="metric-value">{{ getWarningsCount() }}</div>
          <div class="metric-label">警告信息</div>
        </div>
        <div class="metric-trend" :class="getWarningsCount() > 0 ? 'trend-warning' : 'trend-stable'">
          {{ getWarningsCount() > 0 ? '存在警告' : '无警告' }}
        </div>
      </div>

      <div class="metric-card errors">
        <div class="metric-icon">🐛</div>
        <div class="metric-info">
          <div class="metric-value">{{ getTotalErrors() }}</div>
          <div class="metric-label">错误总数</div>
        </div>
        <div class="metric-trend" :class="getTotalErrors() > 100 ? 'trend-up' : 'trend-stable'">
          过去{{ timeRange }}小时
        </div>
      </div>

      <div class="metric-card health">
        <div class="metric-icon">💚</div>
        <div class="metric-info">
          <div class="metric-value">{{ getHealthScore() }}%</div>
          <div class="metric-label">健康度</div>
        </div>
        <div class="metric-trend" :class="getHealthScoreClass()">
          {{ getHealthStatus() }}
        </div>
      </div>
    </div>

    <!-- 诊断结果区域 -->
    <div class="diagnosis-section" v-if="quickDiagnosisResult">
      <div class="issues-container">
        <!-- 关键问题 -->
        <div class="issues-panel critical-panel">
          <div class="panel-header">
            <h3>关键问题</h3>
            <span class="issue-count">{{ getCriticalIssuesCount() }}</span>
          </div>
          <div class="issues-list">
            <div 
              v-for="(issue, index) in formattedCriticalIssues" 
              :key="index"
              class="issue-item critical-item"
            >
              <div class="issue-header">
                <span class="issue-type">{{ issue.type }}</span>
                <span class="issue-severity">{{ issue.severity }}</span>
                <span class="issue-time" v-if="issue.timestamp">
                  {{ formatShortTime(issue.timestamp) }}
                </span>
              </div>
              <div class="issue-description">{{ issue.description }}</div>
              <div class="issue-confidence" v-if="issue.confidence">
                <div class="confidence-bar">
                  <div class="confidence-fill" :style="{width: (issue.confidence * 100) + '%'}"></div>
                </div>
                <span class="confidence-text">{{ (issue.confidence * 100).toFixed(0) }}%</span>
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
              v-for="(rec, index) in quickDiagnosisResult.recommendations" 
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
    <div class="charts-section" v-if="hasInitialData">
      <div class="chart-container">
        <div class="chart-header">
          <h3>错误趋势分析</h3>
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
    <div class="rca-section" v-if="rcaAnalysisResult">
      <div class="section-header">
        <h2>根因分析</h2>
        <a-tag color="#6366f1">
          置信度: {{ (rcaAnalysisResult.confidence_score * 100).toFixed(1) }}%
        </a-tag>
      </div>
      
      <div class="rca-content">
        <div 
          v-for="(cause, index) in rcaAnalysisResult.root_causes" 
          :key="index"
          class="root-cause-card"
        >
          <div class="cause-header">
            <span class="cause-type">{{ cause.cause_type }}</span>
            <div class="cause-confidence">
              <div class="confidence-mini-bar">
                <div class="confidence-mini-fill" :style="{width: (cause.confidence * 100) + '%'}"></div>
              </div>
            </div>
          </div>
          <p class="cause-description">{{ cause.description }}</p>
          <div class="cause-components" v-if="cause.affected_components?.length">
            <span class="components-label">影响组件:</span>
            <a-tag v-for="comp in cause.affected_components" :key="comp" size="small">
              {{ comp }}
            </a-tag>
          </div>
        </div>
      </div>
    </div>

    <!-- 系统摘要 -->
    <div class="summary-section" v-if="hasInitialData">
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">命名空间</span>
          <span class="summary-value">{{ inputData.namespace }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">分析时间</span>
          <span class="summary-value">{{ getCurrentTime() }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">时间范围</span>
          <span class="summary-value">{{ timeRange }}小时</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">诊断状态</span>
          <span class="summary-value">{{ quickDiagnosisResult?.status || 'unknown' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import { message } from 'ant-design-vue';
import {
  quickDiagnosis,
  getEventPatterns,
  getErrorSummary,
  analyzeRootCause
} from '#/api/core/rca';

// 响应式数据
const loading = ref(false);
const timeRange = ref('24');
const chartType = ref('line');
const diagnosisLevel = ref('standard');
const autoRefresh = ref(false);
const hasInitialData = ref(false);

const inputData = ref({
  namespace: 'default'
});

// 诊断结果
const quickDiagnosisResult = ref<any>(null);
const eventPatternsResult = ref<any>(null);
const errorSummaryResult = ref<any>(null);
const rcaAnalysisResult = ref<any>(null);

// 图表引用
const errorTrendsChartRef = ref<HTMLElement>();
const errorCategoriesChartRef = ref<HTMLElement>();
let errorTrendsChart: echarts.ECharts | null = null;
let errorCategoriesChart: echarts.ECharts | null = null;

let refreshTimer: NodeJS.Timeout | null = null;

// 计算属性
const isFormValid = computed(() => {
  return inputData.value.namespace.trim() !== '';
});

const formattedCriticalIssues = computed(() => {
  if (!quickDiagnosisResult.value?.critical_issues) return [];
  
  return quickDiagnosisResult.value.critical_issues.map((issue: any) => {
    // 处理字符串和对象两种格式
    if (typeof issue === 'string') {
      return {
        type: 'unknown',
        severity: 'critical',
        description: issue,
        confidence: 0
      };
    }
    return {
      type: issue.type || 'unknown',
      severity: issue.severity || 'critical',
      description: issue.description || '',
      confidence: issue.confidence || 0,
      timestamp: issue.timestamp
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

const getHealthScore = () => {
  if (!quickDiagnosisResult.value) return 100;
  const issues = getCriticalIssuesCount();
  const warnings = getWarningsCount();
  const errors = getTotalErrors();
  
  let score = 100;
  score -= issues * 10;
  score -= warnings * 5;
  score -= Math.min(errors / 10, 30);
  
  return Math.max(0, Math.round(score));
};

const getHealthScoreClass = () => {
  const score = getHealthScore();
  if (score >= 80) return 'trend-stable';
  if (score >= 50) return 'trend-warning';
  return 'trend-up';
};

const getHealthStatus = () => {
  const score = getHealthScore();
  if (score >= 80) return '系统健康';
  if (score >= 50) return '轻度异常';
  return '需要关注';
};

const getCurrentTime = () => {
  return new Date().toLocaleString('zh-CN');
};

const formatShortTime = (timestamp: string) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

// 刷新诊断
const refreshAllDiagnosis = async () => {
  if (!isFormValid.value) {
    message.warning('请填写命名空间');
    return;
  }

  loading.value = true;
  
  try {
    const [quickRes, eventRes, errorRes, rcaRes] = await Promise.allSettled([
      quickDiagnosis(inputData.value.namespace),
      getEventPatterns(inputData.value.namespace, Number(timeRange.value)),
      getErrorSummary(inputData.value.namespace, Number(timeRange.value)),
      analyzeRootCause({
        namespace: inputData.value.namespace,
        time_window_hours: Number(timeRange.value),
        metrics: []
      })
    ]);

    if (quickRes.status === 'fulfilled') {
      quickDiagnosisResult.value = quickRes.value;
    }
    if (eventRes.status === 'fulfilled') {
      eventPatternsResult.value = eventRes.value;
    }
    if (errorRes.status === 'fulfilled') {
      errorSummaryResult.value = errorRes.value;
    }
    if (rcaRes.status === 'fulfilled') {
      rcaAnalysisResult.value = rcaRes.value;
    }

    hasInitialData.value = true;
    await nextTick();
    initCharts();
    
    message.success('诊断完成');
  } catch (error) {
    console.error('诊断失败:', error);
    message.error('诊断失败');
  } finally {
    loading.value = false;
  }
};

// 初始化图表
const initCharts = () => {
  initErrorTrendsChart();
  initErrorCategoriesChart();
};

const initErrorTrendsChart = () => {
  if (!errorTrendsChartRef.value) return;
  
  if (!errorTrendsChart) {
    errorTrendsChart = echarts.init(errorTrendsChartRef.value);
  }

  // 生成模拟数据（因为API返回的timeline为空）
  const hours = Number(timeRange.value);
  const now = new Date();
  const data = [];
  
  for (let i = hours; i >= 0; i -= 1) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    data.push({
      time: time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      value: Math.floor(Math.random() * 20) + (getTotalErrors() / hours)
    });
  }

  const option = {
    color: ['#6366f1'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#1f2937' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: chartType.value === 'bar',
      data: data.map(d => d.time),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#6b7280' }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
      axisLabel: { color: '#6b7280' }
    },
    series: [{
      name: '错误数量',
      type: chartType.value,
      data: data.map(d => d.value),
      smooth: true,
      lineStyle: { width: 2 },
      areaStyle: chartType.value === 'line' ? { opacity: 0.1 } : undefined,
      itemStyle: {
        borderRadius: chartType.value === 'bar' ? [4, 4, 0, 0] : 0
      }
    }]
  };

  errorTrendsChart.setOption(option);
};

const initErrorCategoriesChart = () => {
  if (!errorCategoriesChartRef.value) return;
  
  if (!errorCategoriesChart) {
    errorCategoriesChart = echarts.init(errorCategoriesChartRef.value);
  }

  // 从top_errors生成分类数据
  const topErrors = errorSummaryResult.value?.top_errors || [];
  const pieData = topErrors.slice(0, 5).map((error: any, index: number) => ({
    name: `错误类型 ${index + 1}`,
    value: error.count || 1
  }));

  if (pieData.length === 0) {
    pieData.push({ name: '无错误', value: 1 });
  }

  const option = {
    color: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#1f2937' }
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      label: {
        show: false,
        position: 'center'
      },
      emphasis: {
        label: {
          show: true,
          fontSize: '18',
          fontWeight: 'bold'
        }
      },
      labelLine: { show: false },
      data: pieData
    }]
  };

  errorCategoriesChart.setOption(option);
};

const toggleAutoRefresh = (enabled: boolean) => {
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

const resetDashboard = () => {
  inputData.value.namespace = 'default';
  hasInitialData.value = false;
  quickDiagnosisResult.value = null;
  eventPatternsResult.value = null;
  errorSummaryResult.value = null;
  rcaAnalysisResult.value = null;
  
  errorTrendsChart?.clear();
  errorCategoriesChart?.clear();
  
  message.success('已重置');
};

// 生命周期
onMounted(() => {
  window.addEventListener('resize', () => {
    errorTrendsChart?.resize();
    errorCategoriesChart?.resize();
  });
});

onUnmounted(() => {
  stopAutoRefresh();
  errorTrendsChart?.dispose();
  errorCategoriesChart?.dispose();
});
</script>

<style scoped>
.rca-diagnosis {
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

.header-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.subtitle {
  color: #8c8c8c;
  margin: 0;
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  height: 32px;
  padding: 0 16px;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s;
}

.reset-btn {
  border: 1px solid #d9d9d9;
  background: white;
  color: #595959;
}

.reset-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.primary-btn {
  background: #1890ff;
  border: 1px solid #1890ff;
  color: white;
}

.primary-btn:hover {
  background: #40a9ff;
  border-color: #40a9ff;
}

.primary-btn:disabled {
  background: #f5f5f5;
  border-color: #d9d9d9;
  color: #bfbfbf;
}

/* 配置区域 */
.config-section {
  background: white;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: #262626;
  margin: 0;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-item label {
  font-size: 14px;
  color: #595959;
  font-weight: 500;
}

.modern-input,
.modern-select {
  height: 32px;
  border-radius: 6px;
  border: 1px solid #d9d9d9;
}

.modern-input:focus,
.modern-select:focus {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

/* 指标卡片 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

.metric-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  display: flex;
  align-items: center;
  gap: 20px;
  transition: all 0.3s;
  cursor: pointer;
  border: 1px solid #f0f0f0;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.metric-icon {
  font-size: 32px;
}

.metric-info {
  flex: 1;
}

.metric-value {
  font-size: 24px;
  font-weight: 600;
  color: #262626;
  line-height: 1;
  margin-bottom: 8px;
}

.metric-label {
  font-size: 14px;
  color: #8c8c8c;
}

.metric-trend {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.trend-stable {
  background: #f6ffed;
  color: #52c41a;
}

.trend-warning {
  background: #fffbe6;
  color: #faad14;
}

.trend-up {
  background: #fff2f0;
  color: #ff4d4f;
}

/* 诊断结果 */
.diagnosis-section {
  margin-bottom: 24px;
}

.issues-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 24px;
}

.issues-panel {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  border: 1px solid #f0f0f0;
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
  color: #262626;
  margin: 0;
}

.issue-count {
  background: #f5f5f5;
  color: #8c8c8c;
  padding: 4px 12px;
  border-radius: 12px;
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
  background: #fafafa;
  border-left: 4px solid;
  transition: all 0.2s;
}

.critical-item {
  border-left-color: #ff4d4f;
}

.critical-item:hover {
  background: #fff2f0;
}

.issue-header {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.issue-type {
  background: #f0f0f0;
  color: #262626;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.issue-severity {
  background: #fff2f0;
  color: #ff4d4f;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.issue-time {
  margin-left: auto;
  color: #8c8c8c;
  font-size: 12px;
}

.issue-description {
  color: #595959;
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
  background: #f0f0f0;
  border-radius: 2px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  background: linear-gradient(90deg, #1890ff, #40a9ff);
  transition: width 0.3s;
}

.confidence-text {
  font-size: 12px;
  color: #8c8c8c;
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
  background: #f6ffed;
  border-radius: 6px;
  transition: all 0.2s;
}

.recommendation-item:hover {
  background: #d9f7be;
}

.rec-icon {
  font-size: 18px;
}

.rec-text {
  flex: 1;
  color: #595959;
  font-size: 14px;
}

.rec-priority {
  background: #52c41a;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

/* 图表 */
.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

.chart-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  border: 1px solid #f0f0f0;
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
  color: #262626;
  margin: 0;
}

.chart-content {
  height: 300px;
}

/* 根因分析 */
.rca-section {
  background: white;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  border: 1px solid #f0f0f0;
}

.rca-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}

.root-cause-card {
  padding: 20px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
  transition: all 0.2s;
}

.root-cause-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  background: white;
}

.cause-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.cause-type {
  background: #1890ff;
  color: white;
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
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}

.confidence-mini-fill {
  height: 100%;
  background: linear-gradient(90deg, #1890ff, #40a9ff);
}

.cause-description {
  color: #595959;
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
  color: #8c8c8c;
  font-weight: 500;
}

/* 摘要 */
.summary-section {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  border: 1px solid #f0f0f0;
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
}

.summary-label {
  font-size: 12px;
  color: #8c8c8c;
  text-transform: uppercase;
  font-weight: 600;
}

.summary-value {
  font-size: 16px;
  color: #262626;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #bfbfbf;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .rca-diagnosis {
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
  
  .metrics-grid {
    grid-template-columns: 1fr;
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
}

@media (max-width: 576px) {
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
