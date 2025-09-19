<template>
  <div class="cron-log">
    <!-- 页面标题和统计 -->
    <div class="page-header">
      <div class="title-section">
        <h2>执行日志</h2>
        <div class="stats">
          <a-statistic title="总执行" :value="stats.total" />
          <a-statistic title="成功" :value="stats.success" value-style="color: #52c41a" />
          <a-statistic title="失败" :value="stats.failed" value-style="color: #ff4d4f" />
          <a-statistic title="成功率" :value="stats.successRate" suffix="%" value-style="color: #1890ff" />
        </div>
      </div>
      <div class="header-actions">
        <a-button @click="refreshData">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
        <a-button @click="clearLogs" danger>
          <template #icon><DeleteOutlined /></template>
          清空日志
        </a-button>
      </div>
    </div>

    <!-- 筛选和搜索 -->
    <div class="filter-section">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-select v-model:value="filterStatus" placeholder="状态筛选" allowClear @change="handleFilter">
            <a-select-option :value="0">成功</a-select-option>
            <a-select-option :value="1">失败</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-date-picker
            v-model:value="filterDate"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            @change="handleDateChange"
            placeholder="选择日期"
          />
        </a-col>
        <a-col :span="6">
          <a-input-search
            v-model:value="searchText"
            placeholder="搜索日志内容"
            @search="handleSearch"
            enter-button
          />
        </a-col>
        <a-col :span="6">
          <div class="filter-actions">
            <a-button @click="resetFilters">重置筛选</a-button>
            <a-button type="primary" @click="exportLogs">导出日志</a-button>
          </div>
        </a-col>
      </a-row>
    </div>

    <!-- 日志列表 -->
    <a-table
      :columns="columns"
      :data-source="filteredLogs"
      :loading="loading"
      :pagination="{
        current: currentPage,
        pageSize: pageSize,
        total: total,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total: number, range: [number, number]) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
      }"
      @change="handleTableChange"
      row-key="id"
      size="middle"
      :scroll="{ x: 1200 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="getStatusColor(record.status)">
            {{ getStatusText(record.status) }}
          </a-tag>
        </template>
        
        <template v-else-if="column.key === 'duration'">
          <span class="duration">{{ formatDuration(record.duration) }}</span>
        </template>
        
        <template v-else-if="column.key === 'start_time'">
          {{ formatTime(record.start_time) }}
        </template>
        
        <template v-else-if="column.key === 'end_time'">
          {{ record.end_time ? formatTime(record.end_time) : '-' }}
        </template>
        
        <template v-else-if="column.key === 'output'">
          <div class="output-preview" v-if="record.output">
            <pre class="output-text">{{ getOutputPreview(record.output) }}</pre>
            <a-button type="link" size="small" @click="viewDetail(record)" v-if="record.output.length > 100">
              查看完整
            </a-button>
          </div>
          <span v-else class="no-output">无输出</span>
        </template>
        
        <template v-else-if="column.key === 'error'">
          <div class="error-preview" v-if="record.error_message">
            <pre class="error-text">{{ getErrorPreview(record.error_message) }}</pre>
            <a-button type="link" size="small" @click="viewDetail(record)" v-if="record.error_message.length > 100">
              查看完整
            </a-button>
          </div>
          <span v-else>-</span>
        </template>
        
        <template v-else-if="column.key === 'actions'">
          <div class="action-buttons">
            <a-button type="link" size="small" @click="viewDetail(record)">详情</a-button>
            <a-button type="link" size="small" @click="deleteLog(record)" danger>删除</a-button>
          </div>
        </template>
      </template>
    </a-table>

    <!-- 日志详情模态框 -->
    <a-modal
      :open="detailVisible"
      title="执行详情"
      width="900px"
      :footer="null"
      @cancel="detailVisible = false"
    >
      <div v-if="currentLog" class="log-detail">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item label="执行状态">
            <a-tag :color="getStatusColor(currentLog.status)">
              {{ getStatusText(currentLog.status) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="执行耗时">
            {{ formatDuration(currentLog.duration) }}
          </a-descriptions-item>
          <a-descriptions-item label="开始时间">
            {{ formatTime(currentLog.start_time) }}
          </a-descriptions-item>
          <a-descriptions-item label="结束时间">
            {{ currentLog.end_time ? formatTime(currentLog.end_time) : '-' }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="log-content" v-if="currentLog.output || currentLog.error_message">
          <h4>执行输出</h4>
          <div class="output-section" v-if="currentLog.output">
            <pre class="full-output">{{ currentLog.output }}</pre>
          </div>
          <div class="no-output" v-else>
            <a-empty description="无输出内容" />
          </div>

          <h4 v-if="currentLog.error_message" class="error-title">错误信息</h4>
          <div class="error-section" v-if="currentLog.error_message">
            <pre class="full-error">{{ currentLog.error_message }}</pre>
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { message, Modal } from 'ant-design-vue';
// import { useRouter, useRoute } from 'vue-router';
import type { Dayjs } from 'dayjs';
import {
  ReloadOutlined,
  DeleteOutlined
} from '@ant-design/icons-vue';
// 临时的执行日志接口定义
interface ExecutionLog {
  id: number;
  job_id: number;
  status: number;
  start_time: string;
  end_time?: string;
  duration: number;
  output?: string;
  error_message?: string;
  trigger_type: string;
}

// const router = useRouter();
// const route = useRoute();

// 响应式数据
const loading = ref(false);
const logs = ref<ExecutionLog[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const searchText = ref('');
const filterStatus = ref<number | undefined>();
const filterDate = ref<Dayjs | undefined>();
const detailVisible = ref(false);
const currentLog = ref<ExecutionLog | null>(null);

// 计算属性
const filteredLogs = computed(() => {
  let result = logs.value;
  
  if (searchText.value) {
    result = result.filter((item: ExecutionLog) => 
      item.output?.toLowerCase().includes(searchText.value.toLowerCase()) ||
      item.error_message?.toLowerCase().includes(searchText.value.toLowerCase())
    );
  }
  
  if (filterStatus.value !== undefined) {
    result = result.filter((item: ExecutionLog) => item.status === filterStatus.value);
  }
  
  return result;
});

const stats = computed(() => {
  const totalLogs = logs.value.length;
  const successLogs = logs.value.filter((log: ExecutionLog) => log.status === 0).length;
  const failedLogs = totalLogs - successLogs;
  const successRate = totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 0;
  
  return {
    total: totalLogs,
    success: successLogs,
    failed: failedLogs,
    successRate
  };
});

const columns = [
  { title: '状态', key: 'status', width: 100 },
  { title: '开始时间', key: 'start_time', width: 180 },
  { title: '结束时间', key: 'end_time', width: 180 },
  { title: '执行耗时', key: 'duration', width: 120 },
  { title: '输出', key: 'output', width: 300 },
  { title: '错误信息', key: 'error', width: 300 },
  { title: '操作', key: 'actions', width: 150, fixed: 'right' }
];

// 方法
const refreshData = async () => {
  loading.value = true;
  try {
    // 模拟数据 - 在实际项目中应该调用真实的API
    const mockLogs: ExecutionLog[] = [
      {
        id: 1,
        job_id: 1,
        status: 0,
        start_time: new Date(Date.now() - 3600000).toISOString(),
        end_time: new Date(Date.now() - 3500000).toISOString(),
        duration: 60000,
        output: '任务执行成功\n输出结果：操作完成',
        trigger_type: 'schedule'
      },
      {
        id: 2,
        job_id: 1,
        status: 1,
        start_time: new Date(Date.now() - 7200000).toISOString(),
        end_time: new Date(Date.now() - 7100000).toISOString(),
        duration: 100000,
        error_message: '连接超时错误',
        trigger_type: 'manual'
      }
    ];
    
    logs.value = mockLogs;
    total.value = mockLogs.length;
    
    await new Promise(resolve => setTimeout(resolve, 500)); // 模拟网络延迟
  } catch (error) {
    message.error('获取执行日志失败');
    console.error('Fetch logs error:', error);
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  currentPage.value = 1;
  refreshData();
};

const handleFilter = () => {
  currentPage.value = 1;
  refreshData();
};

const handleDateChange = () => {
  currentPage.value = 1;
  refreshData();
};

const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  refreshData();
};

const resetFilters = () => {
  searchText.value = '';
  filterStatus.value = undefined;
  filterDate.value = undefined;
  currentPage.value = 1;
  refreshData();
};

const exportLogs = () => {
  message.info('导出功能开发中...');
};

const clearLogs = () => {
  Modal.confirm({
    title: '清空确认',
    content: '确定要清空所有执行日志吗？此操作不可撤销。',
    onOk: async () => {
      try {
        // 模拟清空日志操作
        logs.value = [];
        total.value = 0;
        message.success('日志清空成功');
      } catch (error) {
        message.error('清空日志失败');
        console.error('Clear logs error:', error);
      }
    }
  });
};

const viewDetail = (log: ExecutionLog) => {
  currentLog.value = log;
  detailVisible.value = true;
};

const deleteLog = (log: ExecutionLog) => {
  Modal.confirm({
    title: '删除确认',
    content: '确定要删除这条执行日志吗？',
    onOk: async () => {
      try {
        // 模拟删除日志操作
        logs.value = logs.value.filter(item => item.id !== log.id);
        total.value = logs.value.length;
        message.success('删除成功');
      } catch (error) {
        message.error('删除失败');
        console.error('Delete log error:', error);
      }
    }
  });
};

// 工具函数
const formatTime = (timeStr: string) => {
  if (!timeStr) return '-';
  return new Date(timeStr).toLocaleString('zh-CN');
};

const formatDuration = (duration: number) => {
  if (duration < 1000) return `${duration}ms`;
  if (duration < 60000) return `${(duration / 1000).toFixed(2)}s`;
  return `${(duration / 60000).toFixed(2)}min`;
};

const getStatusColor = (status: number) => {
  return status === 0 ? 'success' : 'error';
};

const getStatusText = (status: number) => {
  return status === 0 ? '成功' : '失败';
};

const getOutputPreview = (output: string) => {
  if (!output) return '';
  return output.length > 100 ? output.substring(0, 100) + '...' : output;
};

const getErrorPreview = (error: string) => {
  if (!error) return '';
  return error.length > 100 ? error.substring(0, 100) + '...' : error;
};

// 生命周期
onMounted(() => {
  refreshData();
});
</script>

<style scoped>
.cron-log {
  padding: 24px;
  background: #fff;
  min-height: calc(100vh - 64px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.title-section h2 {
  margin: 0 0 16px 0;
  font-size: 20px;
  font-weight: 600;
  color: #262626;
}

.stats {
  display: flex;
  gap: 32px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.filter-section {
  margin-bottom: 16px;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

.duration {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 12px;
  color: #1890ff;
}

.output-preview,
.error-preview {
  max-width: 300px;
}

.output-text,
.error-text {
  background: #f6f8fa;
  border: 1px solid #e1e4e8;
  border-radius: 4px;
  padding: 8px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 11px;
  line-height: 1.4;
  max-height: 60px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

.error-text {
  background: #fff2f0;
  border-color: #ffccc7;
  color: #ff4d4f;
}

.no-output {
  color: #8c8c8c;
  font-style: italic;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

.log-detail {
  margin-top: 16px;
}

.log-content {
  margin-top: 24px;
}

.log-content h4 {
  margin-bottom: 12px;
  font-weight: 600;
  color: #262626;
}

.error-title {
  color: #ff4d4f !important;
}

.output-section,
.error-section {
  margin-bottom: 16px;
}

.full-output,
.full-error {
  background: #f6f8fa;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  padding: 16px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 12px;
  line-height: 1.4;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

.full-error {
  background: #fff2f0;
  border-color: #ffccc7;
  color: #ff4d4f;
}

.no-output {
  text-align: center;
  padding: 32px;
}
</style>
