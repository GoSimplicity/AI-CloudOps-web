<template>
  <div class="cron-list">
    <!-- 页面标题和统计 -->
    <div class="page-header">
      <div class="title-section">
        <h2>定时任务管理</h2>
        <div class="stats">
          <a-statistic title="总任务" :value="stats.total" />
          <a-statistic title="启用中" :value="stats.enabled" value-style="color: #52c41a" />
          <a-statistic title="运行中" :value="stats.running" value-style="color: #1890ff" />
          <a-statistic title="异常" :value="stats.error" value-style="color: #ff4d4f" />
        </div>
      </div>
      <a-button type="primary" @click="openCreateModal">
        <template #icon><PlusOutlined /></template>
        新建任务
      </a-button>
    </div>

    <!-- 搜索和筛选 -->
    <div class="filter-section">
      <a-row :gutter="16">
        <a-col :span="8">
          <a-input-search
            v-model:value="searchText"
            placeholder="搜索任务名称或描述"
            @search="handleSearch"
            enter-button
          />
        </a-col>
        <a-col :span="4">
          <a-select v-model:value="filterStatus" placeholder="状态筛选" allowClear @change="handleFilter">
            <a-select-option :value="CronJobStatus.ENABLED">启用</a-select-option>
            <a-select-option :value="CronJobStatus.DISABLED">禁用</a-select-option>
            <a-select-option :value="CronJobStatus.RUNNING">运行中</a-select-option>
            <a-select-option :value="CronJobStatus.ERROR">异常</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-select v-model:value="filterType" placeholder="类型筛选" allowClear @change="handleFilter">
            <a-select-option :value="CronJobType.SYSTEM">系统任务</a-select-option>
            <a-select-option :value="CronJobType.COMMAND">命令任务</a-select-option>
            <a-select-option :value="CronJobType.HTTP">HTTP任务</a-select-option>
            <a-select-option :value="CronJobType.SCRIPT">脚本任务</a-select-option>
            <a-select-option :value="CronJobType.SSH">SSH任务</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="8">
          <div class="batch-actions">
            <a-button :disabled="selectedRows.length === 0 || !canBatchEnable" @click="batchEnable">
              批量启用
            </a-button>
            <a-button :disabled="selectedRows.length === 0 || !canBatchDisable" @click="batchDisable">
              批量禁用
            </a-button>
            <a-button danger :disabled="selectedRows.length === 0" @click="batchDelete">
              批量删除
            </a-button>
          </div>
        </a-col>
      </a-row>
    </div>

    <!-- 任务列表表格 -->
    <a-table
      :columns="columns"
      :data-source="filteredData"
      :loading="loading"
      :row-selection="rowSelection"
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
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-badge :status="getStatusBadge(record.status)" :text="getStatusText(record.status)" />
        </template>
        
        <template v-else-if="column.key === 'job_type'">
          <a-tag :color="getTypeColor(record.job_type)">{{ getTypeText(record.job_type) }}</a-tag>
        </template>
        
        <template v-else-if="column.key === 'schedule'">
          <a-tooltip :title="getScheduleDescription(record.schedule)">
            <code>{{ record.schedule }}</code>
          </a-tooltip>
        </template>
        
        <template v-else-if="column.key === 'next_run_time'">
          {{ record.next_run_time ? formatTime(record.next_run_time) : '-' }}
        </template>
        
        <template v-else-if="column.key === 'last_run'">
          <div v-if="record.last_run_time" class="last-run-info">
            <div>{{ formatTime(record.last_run_time) }}</div>
            <div class="run-status">
              <a-tag :color="getRunStatusColor(record.last_run_status)" size="small">
                {{ getRunStatusText(record.last_run_status) }}
              </a-tag>
              <span v-if="record.last_run_duration" class="duration">
                {{ formatDuration(record.last_run_duration) }}
              </span>
            </div>
          </div>
          <span v-else>-</span>
        </template>
        
        <template v-else-if="column.key === 'statistics'">
          <div class="execution-stats">
            <span class="stat-item">总: {{ record.run_count }}</span>
            <span class="stat-item success">成功: {{ record.success_count }}</span>
            <span class="stat-item error">失败: {{ record.failure_count }}</span>
          </div>
        </template>
        
        <template v-else-if="column.key === 'actions'">
          <div class="action-buttons">
            <a-button type="link" size="small" @click="viewDetail(record)">详情</a-button>
            <a-button type="link" size="small" @click="editJob(record)">编辑</a-button>
            <a-button 
              type="link" 
              size="small" 
              @click="triggerJob(record)"
              :disabled="record.status === CronJobStatus.RUNNING"
            >
              执行
            </a-button>
            <a-button type="link" size="small" @click="viewLogs(record)">日志</a-button>
            <a-dropdown>
              <template #overlay>
                <a-menu>
                  <a-menu-item v-if="record.status === CronJobStatus.DISABLED" @click="enableJob(record)">
                    启用任务
                  </a-menu-item>
                  <a-menu-item v-if="record.status === CronJobStatus.ENABLED" @click="disableJob(record)">
                    禁用任务
                  </a-menu-item>
                  <a-menu-divider />
                  <a-menu-item danger @click="deleteJob(record)">删除任务</a-menu-item>
                </a-menu>
              </template>
              <a-button type="link" size="small">
                更多 <DownOutlined />
              </a-button>
            </a-dropdown>
          </div>
        </template>
      </template>
    </a-table>

    <!-- 创建/编辑任务模态框 -->
    <a-modal
      :open="modalVisible"
      :title="isEdit ? '编辑任务' : '创建任务'"
      width="800px"
      :footer="null"
      @cancel="handleModalCancel"
    >
      <a-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        layout="vertical"
        @finish="handleSubmit"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="任务名称" name="name">
              <a-input v-model:value="formData.name" placeholder="请输入任务名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="任务类型" name="job_type">
              <a-select v-model:value="formData.job_type" @change="handleTypeChange">
                <a-select-option :value="CronJobType.SYSTEM">系统任务</a-select-option>
                <a-select-option :value="CronJobType.COMMAND">命令任务</a-select-option>
                <a-select-option :value="CronJobType.HTTP">HTTP任务</a-select-option>
                <a-select-option :value="CronJobType.SCRIPT">脚本任务</a-select-option>
                <a-select-option :value="CronJobType.SSH">SSH任务</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="formData.description" placeholder="请输入任务描述" :rows="2" />
        </a-form-item>

        <a-form-item label="调度表达式" name="schedule">
          <a-input v-model:value="formData.schedule" placeholder="例如: 0 */5 * * * *" @blur="validateScheduleExpression">
            <template #suffix>
              <a-tooltip title="Cron表达式格式：秒 分 时 日 月 周">
                <InfoCircleOutlined style="color: rgba(0,0,0,.45)" />
              </a-tooltip>
            </template>
          </a-input>
          <div v-if="schedulePreview" class="schedule-preview">
            <small class="text-muted">预计下次执行时间：{{ schedulePreview }}</small>
          </div>
        </a-form-item>

        <!-- 命令任务配置 -->
        <template v-if="formData.job_type === CronJobType.COMMAND">
          <a-form-item label="执行命令" name="command">
            <a-input v-model:value="formData.command" placeholder="请输入要执行的命令" />
          </a-form-item>
          <a-form-item label="命令参数" name="args">
            <a-select mode="tags" v-model:value="formData.args" placeholder="输入参数后按回车">
            </a-select>
          </a-form-item>
          <a-form-item label="工作目录" name="work_dir">
            <a-input v-model:value="formData.work_dir" placeholder="命令执行的工作目录" />
          </a-form-item>
        </template>

        <!-- HTTP任务配置 -->
        <template v-if="formData.job_type === CronJobType.HTTP">
          <a-row :gutter="16">
            <a-col :span="8">
              <a-form-item label="HTTP方法" name="http_method">
                <a-select v-model:value="formData.http_method">
                  <a-select-option value="GET">GET</a-select-option>
                  <a-select-option value="POST">POST</a-select-option>
                  <a-select-option value="PUT">PUT</a-select-option>
                  <a-select-option value="DELETE">DELETE</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="16">
              <a-form-item label="请求URL" name="http_url">
                <a-input v-model:value="formData.http_url" placeholder="http://example.com/api" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item label="请求体" name="http_body" v-if="formData.http_method !== 'GET'">
            <a-textarea v-model:value="formData.http_body" placeholder="JSON格式的请求体" :rows="3" />
          </a-form-item>
        </template>

        <!-- 脚本任务配置 -->
        <template v-if="formData.job_type === CronJobType.SCRIPT">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="脚本类型" name="script_type">
                <a-select v-model:value="formData.script_type">
                  <a-select-option value="shell">Shell</a-select-option>
                  <a-select-option value="python">Python</a-select-option>
                  <a-select-option value="node">Node.js</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item label="脚本内容" name="script_content">
            <a-textarea v-model:value="formData.script_content" placeholder="请输入脚本内容" :rows="6" />
          </a-form-item>
        </template>

        <!-- SSH任务配置 -->
        <template v-if="formData.job_type === CronJobType.SSH">
          <a-form-item label="SSH资源" name="ssh_resource_id">
            <a-select v-model:value="formData.ssh_resource_id" placeholder="选择SSH资源">
              <!-- 这里应该从API获取SSH资源列表 -->
            </a-select>
          </a-form-item>
          <a-form-item label="SSH命令" name="ssh_command">
            <a-input v-model:value="formData.ssh_command" placeholder="要在远程服务器执行的命令" />
          </a-form-item>
          <a-form-item label="远程工作目录" name="ssh_work_dir">
            <a-input v-model:value="formData.ssh_work_dir" placeholder="远程服务器的工作目录" />
          </a-form-item>
        </template>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="超时时间（秒）" name="timeout">
              <a-input-number v-model:value="formData.timeout" :min="1" :max="3600" placeholder="300" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="最大重试次数" name="max_retry">
              <a-input-number v-model:value="formData.max_retry" :min="0" :max="10" placeholder="3" />
            </a-form-item>
          </a-col>
        </a-row>

        <div class="form-actions">
          <a-button @click="handleModalCancel">取消</a-button>
          <a-button type="primary" html-type="submit" :loading="submitting">
            {{ isEdit ? '更新' : '创建' }}
          </a-button>
        </div>
      </a-form>
    </a-modal>

    <!-- 任务详情模态框 -->
    <a-modal
      :open="detailVisible"
      title="任务详情"
      width="800px"
      :footer="null"
      @cancel="detailVisible = false"
    >
      <div v-if="currentJob" class="job-detail">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item label="任务名称">{{ currentJob.name }}</a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-badge :status="getStatusBadge(currentJob.status)" :text="getStatusText(currentJob.status)" />
          </a-descriptions-item>
          <a-descriptions-item label="任务类型">
            <a-tag :color="getTypeColor(currentJob.job_type)">{{ getTypeText(currentJob.job_type) }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="调度表达式">
            <code>{{ currentJob.schedule }}</code>
          </a-descriptions-item>
          <a-descriptions-item label="下次执行时间">
            {{ currentJob.next_run_time ? formatTime(currentJob.next_run_time) : '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="上次执行时间">
            {{ currentJob.last_run_time ? formatTime(currentJob.last_run_time) : '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="执行统计" :span="2">
            <div class="execution-stats">
              <span class="stat">总计: {{ currentJob.run_count }}</span>
              <span class="stat success">成功: {{ currentJob.success_count }}</span>
              <span class="stat error">失败: {{ currentJob.failure_count }}</span>
              <span class="stat success-rate">成功率: {{ getSuccessRate(currentJob) }}%</span>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="描述" :span="2">
            {{ currentJob.description || '-' }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-actions">
          <a-button @click="editJobFromDetail">
            <template #icon><EditOutlined /></template>
            编辑任务
          </a-button>
          <a-button @click="viewLogsFromDetail">
            <template #icon><FileTextOutlined /></template>
            查看日志
          </a-button>
          <a-button @click="triggerJobFromDetail" :disabled="currentJob.status === CronJobStatus.RUNNING">
            <template #icon><PlayCircleOutlined /></template>
            立即执行
          </a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useListManager } from './List';
import {
  PlusOutlined,
  DownOutlined,
  InfoCircleOutlined,
  EditOutlined,
  FileTextOutlined,
  PlayCircleOutlined
} from '@ant-design/icons-vue';

const {
  // 响应式数据
  loading,
  selectedRows,
  currentPage,
  pageSize,
  total,
  searchText,
  filterStatus,
  filterType,
  modalVisible,
  detailVisible,
  isEdit,
  currentJob,
  
  // 计算属性
  filteredData,
  stats,
  rowSelection,
  canBatchEnable,
  canBatchDisable,
  columns,
  
  // 方法
  refreshData,
  handleSearch,
  handleFilter,
  handleTableChange,
  openCreateModal,
  editJob,
  viewDetail,
  viewLogs,
  triggerJob,
  enableJob,
  disableJob,
  deleteJob,
  batchEnable,
  batchDisable,
  batchDelete,
  
  // 工具函数
  getStatusBadge,
  getStatusText,
  getTypeColor,
  getTypeText,
  getRunStatusColor,
  getRunStatusText,
  formatTime,
  formatDuration,
  getScheduleDescription,
  
  // 常量
  CronJobStatus,
  CronJobType
} = useListManager();

// 表单相关
const formRef = ref();
const submitting = ref(false);
const schedulePreview = ref('');

const formData = reactive({
  name: '',
  description: '',
  job_type: CronJobType.COMMAND,
  schedule: '',
  command: '',
  args: [],
  work_dir: '',
  http_method: 'GET',
  http_url: '',
  http_body: '',
  script_type: 'shell',
  script_content: '',
  ssh_resource_id: undefined,
  ssh_command: '',
  ssh_work_dir: '',
  timeout: 300,
  max_retry: 3
});

const rules = computed(() => ({
  name: [{ required: true, message: '请输入任务名称' }],
  job_type: [{ required: true, message: '请选择任务类型' }],
  schedule: [{ required: true, message: '请输入调度表达式' }],
  command: formData.job_type === CronJobType.COMMAND ? [{ required: true, message: '请输入执行命令' }] : [],
  http_url: formData.job_type === CronJobType.HTTP ? [{ required: true, message: '请输入请求URL' }] : [],
  script_content: formData.job_type === CronJobType.SCRIPT ? [{ required: true, message: '请输入脚本内容' }] : [],
  ssh_command: formData.job_type === CronJobType.SSH ? [{ required: true, message: '请输入SSH命令' }] : []
}));

// 表单方法
const resetForm = () => {
  Object.assign(formData, {
    name: '',
    description: '',
    job_type: CronJobType.COMMAND,
    schedule: '',
    command: '',
    args: [],
    work_dir: '',
    http_method: 'GET',
    http_url: '',
    http_body: '',
    script_type: 'shell',
    script_content: '',
    ssh_resource_id: undefined,
    ssh_command: '',
    ssh_work_dir: '',
    timeout: 300,
    max_retry: 3
  });
  schedulePreview.value = '';
  formRef.value?.resetFields();
};

const handleModalCancel = () => {
  modalVisible.value = false;
  resetForm();
};

const handleTypeChange = () => {
  // 根据任务类型重置相关字段
  if (formData.job_type === CronJobType.COMMAND) {
    formData.http_url = '';
    formData.script_content = '';
    formData.ssh_command = '';
  } else if (formData.job_type === CronJobType.HTTP) {
    formData.command = '';
    formData.script_content = '';
    formData.ssh_command = '';
  } else if (formData.job_type === CronJobType.SCRIPT) {
    formData.command = '';
    formData.http_url = '';
    formData.ssh_command = '';
  } else if (formData.job_type === CronJobType.SSH) {
    formData.command = '';
    formData.http_url = '';
    formData.script_content = '';
  }
};

const validateScheduleExpression = async () => {
  if (formData.schedule) {
    try {
      const { validateSchedule } = await import('#/api/core/cron/cron');
      const res = await validateSchedule({ schedule: formData.schedule });
      if (res.valid && res.next_run_times?.[0]) {
        schedulePreview.value = new Date(res.next_run_times[0]).toLocaleString('zh-CN');
      } else {
        schedulePreview.value = '';
      }
    } catch (error) {
      schedulePreview.value = '';
    }
  }
};

const handleSubmit = async () => {
  try {
    submitting.value = true;
    
    if (isEdit.value && currentJob.value) {
      const { updateCronJob } = await import('#/api/core/cron/cron');
      await updateCronJob({
        id: currentJob.value.id,
        ...formData
      });
      message.success('任务更新成功');
    } else {
      const { createCronJob } = await import('#/api/core/cron/cron');
      await createCronJob(formData);
      message.success('任务创建成功');
    }
    
    modalVisible.value = false;
    refreshData();
    resetForm();
  } catch (error) {
    message.error(isEdit.value ? '更新任务失败' : '创建任务失败');
  } finally {
    submitting.value = false;
  }
};

// 详情页面操作
const editJobFromDetail = () => {
  detailVisible.value = false;
  if (currentJob.value) {
    editJob(currentJob.value);
  }
};

const viewLogsFromDetail = () => {
  detailVisible.value = false;
  if (currentJob.value) {
    viewLogs(currentJob.value);
  }
};

const triggerJobFromDetail = () => {
  detailVisible.value = false;
  if (currentJob.value) {
    triggerJob(currentJob.value);
  }
};

const getSuccessRate = (job: any) => {
  if (job.run_count === 0) return 0;
  return Math.round((job.success_count / job.run_count) * 100);
};

// 监听编辑操作
watch(() => modalVisible.value, (newValue: boolean) => {
  if (newValue && isEdit.value && currentJob.value) {
    Object.assign(formData, {
      name: currentJob.value.name,
      description: currentJob.value.description,
      job_type: currentJob.value.job_type,
      schedule: currentJob.value.schedule,
      command: currentJob.value.command,
      args: currentJob.value.args || [],
      work_dir: currentJob.value.work_dir,
      http_method: currentJob.value.http_method,
      http_url: currentJob.value.http_url,
      http_body: currentJob.value.http_body,
      script_type: currentJob.value.script_type,
      script_content: currentJob.value.script_content,
      ssh_resource_id: currentJob.value.ssh_resource_id,
      ssh_command: currentJob.value.ssh_command,
      ssh_work_dir: currentJob.value.ssh_work_dir,
      timeout: currentJob.value.timeout || 300,
      max_retry: currentJob.value.max_retry || 3
    });
  }
});
</script>

<style scoped>
.cron-list {
  padding: 24px;
  background: #fff;
  min-height: calc(100vh - 64px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.filter-section {
  margin-bottom: 16px;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
}

.batch-actions {
  display: flex;
  gap: 8px;
}

.last-run-info {
  font-size: 12px;
}

.run-status {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.duration {
  color: #8c8c8c;
  font-size: 11px;
}

.execution-stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}

.stat-item {
  color: #8c8c8c;
}

.stat-item.success {
  color: #52c41a;
}

.stat-item.error {
  color: #ff4d4f;
}

.action-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.schedule-preview {
  margin-top: 4px;
}

.text-muted {
  color: #8c8c8c;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
  border-top: 1px solid #f0f0f0;
  padding-top: 16px;
}

.job-detail {
  margin-top: 16px;
}

.execution-stats .stat {
  padding: 4px 8px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 12px;
  margin-right: 8px;
}

.execution-stats .stat.success {
  background: #f6ffed;
  color: #52c41a;
}

.execution-stats .stat.error {
  background: #fff2f0;
  color: #ff4d4f;
}

.execution-stats .stat.success-rate {
  background: #e6f7ff;
  color: #1890ff;
}

.detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}
</style>
