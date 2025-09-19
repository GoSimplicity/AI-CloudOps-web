<template>
  <div class="rca-diagnosis">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <MedicineBoxOutlined />
          </div>
          <div class="header-text">
            <h1 class="page-title">快速诊断</h1>
            <p class="page-subtitle">系统故障快速诊断和修复建议</p>
          </div>
        </div>
        <div class="header-actions">
          <a-button 
            type="primary" 
            size="large" 
            @click="refreshAllDiagnosis"
            :loading="loading"
            :disabled="!isFormValid || loading"
          >
            {{ loading ? '诊断中...' : '开始诊断' }}
          </a-button>
        </div>
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
          <div class="switch-container">
            <a-switch v-model:checked="autoRefresh" @change="toggleAutoRefresh" />
            <span class="switch-label">{{ autoRefresh ? '已开启' : '已关闭' }}</span>
          </div>
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
    <div class="diagnosis-section" v-if="quickDiagnosisResult || loading">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <div class="loading-content">
          <div class="loading-main-icon">
            <Icon icon="mdi:chart-line" class="pulse-animation" />
          </div>
          <h3 class="loading-title">正在进行快速诊断...</h3>
          <p class="loading-subtitle">系统正在深度分析故障原因，请稍候</p>
          
          <!-- 诊断步骤指示器 -->
          <div class="diagnosis-steps">
            <div class="step-item" :class="{ active: getCurrentStep() >= 1 }">
              <div class="step-icon">
                <Icon v-if="getCurrentStep() > 1" icon="mdi:check" />
                <Icon v-else-if="getCurrentStep() === 1" icon="mdi:loading" class="rotate-animation" />
                <Icon v-else icon="mdi:circle-outline" />
              </div>
              <span class="step-text">收集系统数据</span>
            </div>
            <div class="step-item" :class="{ active: getCurrentStep() >= 2 }">
              <div class="step-icon">
                <Icon v-if="getCurrentStep() > 2" icon="mdi:check" />
                <Icon v-else-if="getCurrentStep() === 2" icon="mdi:loading" class="rotate-animation" />
                <Icon v-else icon="mdi:circle-outline" />
              </div>
              <span class="step-text">分析异常模式</span>
            </div>
            <div class="step-item" :class="{ active: getCurrentStep() >= 3 }">
              <div class="step-icon">
                <Icon v-if="getCurrentStep() > 3" icon="mdi:check" />
                <Icon v-else-if="getCurrentStep() === 3" icon="mdi:loading" class="rotate-animation" />
                <Icon v-else icon="mdi:circle-outline" />
              </div>
              <span class="step-text">生成诊断报告</span>
            </div>
          </div>

          <a-alert 
            message="预计耗时 30秒 - 2分钟" 
            type="info" 
            show-icon
            class="loading-tip"
          />
        </div>
      </div>
      
      <!-- 诊断结果 -->
      <div v-else-if="quickDiagnosisResult" class="issues-container">
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
                <span class="issue-type">{{ issue.type || 'unknown' }}</span>
                <span class="issue-severity">{{ issue.severity || 'critical' }}</span>
                <span class="issue-time" v-if="issue.timestamp">
                  {{ formatShortTime(issue.timestamp) }}
                </span>
              </div>
              <div class="issue-description">{{ issue.description || issue }}</div>
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
            <span class="cause-type">{{ cause.cause_type || 'unknown' }}</span>
            <div class="cause-confidence">
              <div class="confidence-mini-bar">
                <div class="confidence-mini-fill" :style="{width: (cause.confidence * 100) + '%'}"></div>
              </div>
            </div>
          </div>
          <p class="cause-description">{{ cause.description || '暂无描述' }}</p>
          <div class="cause-components" v-if="cause.affected_components?.length">
            <span class="components-label">影响组件:</span>
            <a-tag v-for="comp in cause.affected_components" :key="comp" size="small">
              {{ comp }}
            </a-tag>
          </div>
          <div class="cause-recommendations" v-if="cause.recommendations?.length">
            <span class="components-label">建议:</span>
            <div class="rec-list">
              <div v-for="(rec, recIndex) in cause.recommendations" :key="recIndex" class="rec-item">
                {{ rec }}
              </div>
            </div>
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
        <div class="summary-item" v-if="quickDiagnosisResult?.analysis_duration">
          <span class="summary-label">分析耗时</span>
          <span class="summary-value">{{ quickDiagnosisResult.analysis_duration }}ms</span>
        </div>
      </div>
    </div>


  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
import { message } from 'ant-design-vue';
import { MedicineBoxOutlined } from '@ant-design/icons-vue';
import type {
  QuickDiagnosisResponse,
  EventPatternsResponse,
  ErrorSummaryResponse,
  RCAAnalysisResponse
} from '#/api/core/aiops/rca';
import {
  quickDiagnosis,
  getEventPatterns,
  getErrorSummary,
  analyzeRootCause
} from '#/api/core/aiops/rca';

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
const quickDiagnosisResult = ref<QuickDiagnosisResponse | null>(null);
const eventPatternsResult = ref<EventPatternsResponse | null>(null);
const errorSummaryResult = ref<ErrorSummaryResponse | null>(null);
const rcaAnalysisResult = ref<RCAAnalysisResponse | null>(null);

// 图表引用
const errorTrendsChartRef = ref<HTMLElement>();
const errorCategoriesChartRef = ref<HTMLElement>();
let errorTrendsChart: echarts.ECharts | null = null;
let errorCategoriesChart: echarts.ECharts | null = null;

let refreshTimer: NodeJS.Timeout | null = null;
const currentStep = ref(0);

// 计算属性
const isFormValid = computed(() => {
  return inputData.value.namespace.trim() !== '';
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
        timestamp: null
      };
    }
    
    return {
      type: issue.type || 'unknown',
      severity: issue.severity || 'critical',
      description: issue.description || issue.message || '暂无描述',
      confidence: Math.max(0, Math.min(1, issue.confidence || 0)),
      timestamp: issue.timestamp || null
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
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (error) {
    return timestamp;
  }
};

// 获取当前诊断步骤
const getCurrentStep = () => {
  return currentStep.value;
};



// 刷新诊断
const refreshAllDiagnosis = async () => {
  if (!isFormValid.value) {
    message.warning('请填写命名空间');
    return;
  }

  const namespace = inputData.value.namespace.trim();
  if (!/^[a-z0-9-]+$/.test(namespace)) {
    message.error('命名空间格式不正确，只能包含小写字母、数字和连字符');
    return;
  }

  loading.value = true;
  currentStep.value = 0;
  
  // 开始诊断提示
  message.loading('开始快速诊断，请稍候...', 2);
  
  try {
    const promises: Promise<any>[] = [];
    
    // 步骤1: 快速诊断
    currentStep.value = 1;
    await new Promise(resolve => setTimeout(resolve, 500)); // 模拟进度
    
    promises.push(
      quickDiagnosis({
        namespace: inputData.value.namespace
      }).catch(error => {
        console.error('快速诊断失败:', error);
        return null;
      })
    );

    if (diagnosisLevel.value !== 'quick') {
      // 步骤2: 事件模式分析
      currentStep.value = 2;
      await new Promise(resolve => setTimeout(resolve, 300));
      
      promises.push(
        getEventPatterns({
          namespace: inputData.value.namespace,
          hours: Number(timeRange.value)
        }).catch(error => {
          console.error('事件模式分析失败:', error);
          return null;
        })
      );
    }

    if (diagnosisLevel.value === 'comprehensive') {
      // 步骤3: 综合分析
      currentStep.value = 3;
      await new Promise(resolve => setTimeout(resolve, 300));
      
      promises.push(
        getErrorSummary({
          namespace: inputData.value.namespace,
          hours: Number(timeRange.value)
        }).catch(error => {
          console.error('错误摘要失败:', error);
          return null;
        }),
        analyzeRootCause({
          namespace: inputData.value.namespace,
          time_window_hours: Number(timeRange.value),
          metrics: []
        }).catch(error => {
          console.error('根因分析失败:', error);
          return null;
        })
      );
    }

    const results = await Promise.all(promises);
    
    // 完成所有步骤
    currentStep.value = 4;
    
    if (results[0]) {
      quickDiagnosisResult.value = results[0];
    }
    
    if (results[1] && diagnosisLevel.value !== 'quick') {
      eventPatternsResult.value = results[1];
    }
    
    if (results[2] && diagnosisLevel.value === 'comprehensive') {
      errorSummaryResult.value = results[2];
    }
    
    if (results[3] && diagnosisLevel.value === 'comprehensive') {
      rcaAnalysisResult.value = results[3];
    }

    hasInitialData.value = true;
    await nextTick();
    initCharts();
    
    // 优化完成消息
    if (quickDiagnosisResult.value) {
      const criticalCount = getCriticalIssuesCount();
      const warningCount = getWarningsCount();
      
      if (criticalCount > 0) {
        message.success('快速诊断完成！发现了一些有价值的信息');
        setTimeout(() => {
          message.warning(`发现 ${criticalCount} 个关键问题，请及时处理`, 5);
        }, 500);
      } else if (warningCount > 0) {
        message.success('快速诊断完成！发现了一些有价值的信息');
        setTimeout(() => {
          message.info(`发现 ${warningCount} 个警告，建议关注`, 3);
        }, 500);
      } else {
        message.success('快速诊断完成！系统运行正常，未发现异常');
      }
    } else {
      message.success('快速诊断完成！');
    }
  } catch (error) {
    console.error('诊断失败:', error);
    let errorMessage = '诊断失败';
    if (error instanceof Error) {
      if (error.message.includes('Network Error')) {
        errorMessage = '网络连接失败，请检查网络设置';
      } else if (error.message.includes('timeout')) {
        errorMessage = '请求超时，请稍后重试';
      } else if (error.message.includes('500')) {
        errorMessage = '服务器内部错误，请联系管理员';
      } else if (error.message.includes('404')) {
        errorMessage = '服务不可用，请检查服务状态';
      }
    }
    message.error(errorMessage);
  } finally {
    loading.value = false;
    currentStep.value = 0;
  }
};

// 初始化图表
const initCharts = () => {
  try {
    initErrorTrendsChart();
    initErrorCategoriesChart();
  } catch (error) {
    console.error('图表初始化失败:', error);
    message.warning('图表渲染失败，但不影响诊断结果');
  }
};

const initErrorTrendsChart = () => {
  if (!errorTrendsChartRef.value) return;
  
  if (!errorTrendsChart) {
    errorTrendsChart = echarts.init(errorTrendsChartRef.value);
  }

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

  const topErrors = errorSummaryResult.value?.top_errors || [];
  const pieData = topErrors.slice(0, 5).map((error: any, index: number) => ({
    name: error.error_type || `错误类型 ${index + 1}`,
    value: error.count || 1
  }));

  if (pieData.length === 0) {
    pieData.push({ name: '无错误', value: 0 });
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
  
  message.info('已开启自动刷新，每30秒更新一次');
};

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    message.info('已停止自动刷新');
  }
};



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
.rca-diagnosis {
padding: 24px;
background: #f5f5f5;
min-height: 100vh;
}

/* 页面头部 */
.rca-diagnosis .page-header {
background: #fff;
border-radius: 12px;
padding: 24px;
margin-bottom: 24px;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
border: 1px solid #f0f0f0;
}

.rca-diagnosis .header-content {
display: flex;
justify-content: space-between;
align-items: center;
width: 100%;
}

.rca-diagnosis .header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  font-size: 32px;
  color: #1890ff;
}

.header-text {
  display: flex;
  flex-direction: column;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #262626;
  line-height: 1.2;
}

.page-subtitle {
  color: #8c8c8c;
  margin: 0;
  font-size: 12px;
  margin-top: 4px;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* 配置区域 */
.config-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f0f0;
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
  color: #595959;
  font-weight: 500;
}

.modern-input {
  height: 36px;
  border-radius: 8px;
  border: 1px solid #d9d9d9;
  transition: all 0.3s ease;
}

.modern-select {
  width: 100%;
  border-radius: 8px;
}

.modern-select :deep(.ant-select-selector) {
  height: 36px !important;
  border-radius: 8px !important;
  border: 1px solid #d9d9d9 !important;
  transition: all 0.3s ease;
}

.modern-select :deep(.ant-select-selection-item) {
  line-height: 34px !important;
}

.modern-input:focus {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.modern-select:hover :deep(.ant-select-selector) {
  border-color: #40a9ff !important;
}

.modern-select.ant-select-focused :deep(.ant-select-selector) {
  border-color: #1890ff !important;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2) !important;
}

.modern-input:hover {
  border-color: #40a9ff;
}

/* 下拉框特定样式 */
.modern-select :deep(.ant-select-dropdown) {
  z-index: 1050 !important;
}

.modern-select :deep(.ant-select-arrow) {
  color: #8c8c8c;
}

.switch-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.switch-label {
  font-size: 12px;
  color: #8c8c8c;
  font-weight: 500;
}

/* 指标卡片 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

.metric-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  gap: 20px;
  transition: all 0.3s ease;
  cursor: pointer;
  border: 1px solid #f0f0f0;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
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
  color: #262626;
  line-height: 1.2;
  margin-bottom: 8px;
}

.metric-label {
  font-size: 14px;
  color: #8c8c8c;
  font-weight: 500;
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

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f0f0;
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
  margin-bottom: 24px;
}

.pulse-animation {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
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
  color: #262626;
  margin-bottom: 8px;
}

.loading-subtitle {
  font-size: 14px;
  color: #8c8c8c;
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
  border-radius: 8px;
  transition: all 0.3s ease;
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
  background: #f5f5f5;
  border: 2px solid #d9d9d9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #8c8c8c;
  transition: all 0.3s ease;
}

.step-item.active .step-icon {
  background: #1890ff;
  border-color: #1890ff;
  color: white;
}

.step-text {
  font-size: 12px;
  color: #8c8c8c;
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

.rec-list {
  margin-top: 8px;
}

.rec-item {
  font-size: 13px;
  color: #595959;
  line-height: 1.4;
  padding: 4px 0;
  border-bottom: 1px solid #f0f0f0;
}

.rec-item:last-child {
  border-bottom: none;
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
  color: #595959;
  line-height: 1.4;
  padding: 8px 12px;
  background: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #f0f0f0;
  transition: all 0.2s ease;
}

.rec-item:hover {
  background: #f0f0f0;
  border-color: #d9d9d9;
}

/* 摘要 */
.summary-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
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
  padding: 16px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
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
.rca-diagnosis {
  padding: 16px;
}

.rca-diagnosis .page-header {
  padding: 20px;
  margin-bottom: 16px;
}

.rca-diagnosis .header-content {
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.rca-diagnosis .header-actions {
  width: 100%;
  justify-content: flex-start;
}

.rca-diagnosis .page-title {
  font-size: 20px;
}

.rca-diagnosis .page-subtitle {
  font-size: 13px;
}

.rca-diagnosis .header-icon {
  font-size: 36px;
}

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
.rca-diagnosis {
  padding: 12px;
}

.rca-diagnosis .page-header {
  padding: 16px;
}

.rca-diagnosis .page-title {
  font-size: 18px;
}

.rca-diagnosis .page-subtitle {
  font-size: 12px;
}

.rca-diagnosis .header-icon {
  font-size: 32px;
}

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
</style>
