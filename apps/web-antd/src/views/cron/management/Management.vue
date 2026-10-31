<script setup lang="ts">
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlaySquareOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue';
import { onMounted, onUnmounted, watch } from 'vue';
import OpsPage from '#/components/ops/OpsPage.vue';
import { message } from 'ant-design-vue';
import { useCronJobPage } from './Management';
import CronEditFields from './CronEditFields.vue';
import { useAccessStore } from '@vben/stores';

import { usePermission } from '#/utils/permission';

const { can } = usePermission();

// 使用组合式函数
const {
  // 响应式状态
  loading,
  submitLoading,
  detailLoading,
  error,
  sshResourcesLoading,
  searchText,
  filterStatus,
  filterJobType,
  currentPage,
  pageSize,
  total,
  selectedRows,
  isCreateModalVisible,
  isEditModalVisible,
  isDetailModalVisible,
  currentJobDetail,
  createFormModel,
  editFormModel,

  // 表单引用
  formRef,
  clearPage,

  // 计算属性
  filteredCronJobs,
  rowSelection,

  // 表单验证规则
  createFormRules,
  editFormRules,

  // 工具函数
  getStatusText,
  getStatusColor,
  getJobTypeText,
  getJobTypeColor,
  getLastRunStatusText,
  getLastRunStatusColor,
  formatDateTime,
  formatDuration,

  // HTTP头部管理
  addHttpHeader,
  removeHttpHeader,

  // SSH环境变量管理
  addSshEnvironment,
  removeSshEnvironment,

  // SSH资源搜索
  searchSshResources,
  filteredSshResources,

  // 命令参数管理
  addArg,
  removeArg,

  // 环境变量管理
  addEnvironment,
  removeEnvironment,

  // 数据操作
  fetchCronJobs,
  fetchSshResources,

  // 任务详情操作
  showJobDetail,
  closeDetailModal,

  // 创建操作
  openCreateModal,
  closeCreateModal,
  submitCreateForm,

  // 编辑操作
  openEditModal,
  closeEditModal,
  submitEditForm,

  // 任务操作
  deleteJob,
  enableJob,
  disableJob,
  triggerJob,

  // 批量操作
  batchOperation,

  // 表单操作
  validateScheduleExpression,
  handleJobTypeChange,

  // 本地执行开关
  allowLocalExec,
  isLocalExecLocked,

  // 常量
  CronJobStatus,
  CronJobType,
} = useCronJobPage();

// 获取访问控制store
const accessStore = useAccessStore();

// 定义表格列
const columns = [
  {
    title: '任务名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    ellipsis: true,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
  },
  {
    title: '类型',
    dataIndex: 'job_type',
    key: 'job_type',
    width: 120,
  },
  {
    title: '调度表达式',
    dataIndex: 'schedule',
    key: 'schedule',
    width: 150,
    ellipsis: true,
  },
  {
    title: '描述',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
  },
  {
    title: '下次执行',
    dataIndex: 'next_run_time',
    key: 'next_run_time',
    width: 160,
  },
  {
    title: '上次执行',
    dataIndex: 'last_run_time',
    key: 'last_run_time',
    width: 160,
  },
  {
    title: '最后状态',
    dataIndex: 'last_run_status',
    key: 'last_run_status',
    width: 100,
  },
  {
    title: '创建者',
    dataIndex: 'created_by_name',
    key: 'created_by_name',
    width: 100,
    ellipsis: true,
  },
  {
    title: '操作',
    key: 'action',
    width: 250,
  },
];

// 搜索处理函数
const onSearch = () => {
  currentPage.value = 1;
  fetchCronJobs();
};

// 筛选变化处理函数
const handleFilterChange = () => {
  currentPage.value = 1;
  fetchCronJobs();
};

// 重置筛选
const resetFilters = () => {
  if (filterStatus) filterStatus.value = undefined;
  if (filterJobType) filterJobType.value = undefined;
  if (searchText) searchText.value = '';
  if (currentPage) currentPage.value = 1;
  message.success('已重置所有筛选条件');
  fetchCronJobs();
};

// 表格变化处理函数
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  fetchCronJobs();
};

// 初始化数据加载
onMounted(async () => {
  if (!accessStore.accessToken) {
    return;
  }

  await fetchCronJobs();
});

// 监听认证状态变化，如果用户登录了就重新加载数据
watch(
  () => accessStore.accessToken,
  (newToken, oldToken) => {
    if (!newToken) clearPage();
    if (newToken && !oldToken) {
      // 用户刚刚登录，重新加载数据
      fetchCronJobs();
    }
  },
);
onUnmounted(clearPage);
</script>

<template>
  <OpsPage
    description="配置执行周期、查看任务结果并管理启停状态"
    title="定时任务管理"
  >
    <template #actions>
      <a-button
        :disabled="submitLoading"
        type="primary"
        @click="openCreateModal"
      >
        <template #icon><PlusOutlined /></template>
        创建任务
      </a-button>
      <a-button :loading="loading" @click="fetchCronJobs()">
        <template #icon><ReloadOutlined /></template>
        刷新数据
      </a-button>
    </template>
    <!-- 工具栏 -->
    <template #filters>
      <!-- 筛选和搜索区域 -->
      <div class="k8s-toolbar-filters">
        <div class="k8s-filter-group">
          <a-select
            v-model:value="filterStatus"
            allow-clear
            class="k8s-filter-select"
            placeholder="状态筛选"
            @change="handleFilterChange"
          >
            <template #suffixIcon><FilterOutlined /></template>
            <a-select-option :value="CronJobStatus.ENABLED">
              已启用
            </a-select-option>
            <a-select-option :value="CronJobStatus.DISABLED">
              已禁用
            </a-select-option>
            <a-select-option :value="CronJobStatus.RUNNING">
              运行中
            </a-select-option>
            <a-select-option :value="CronJobStatus.ERROR">异常</a-select-option>
          </a-select>

          <a-select
            v-model:value="filterJobType"
            allow-clear
            class="k8s-filter-select"
            placeholder="任务类型"
            @change="handleFilterChange"
          >
            <template #suffixIcon><FilterOutlined /></template>
            <a-select-option :value="CronJobType.SYSTEM">
              系统任务
            </a-select-option>
            <a-select-option :value="CronJobType.COMMAND">
              命令行
            </a-select-option>
            <a-select-option :value="CronJobType.HTTP">
              HTTP请求
            </a-select-option>
            <a-select-option :value="CronJobType.SCRIPT">
              脚本任务
            </a-select-option>
            <a-select-option :value="CronJobType.SSH">SSH远程</a-select-option>
          </a-select>
        </div>

        <div class="k8s-search-group">
          <a-input
            v-model:value="searchText"
            allow-clear
            class="k8s-search-input"
            placeholder="搜索任务名称或描述..."
            @keyup.enter="onSearch"
          >
            <template #prefix><SearchOutlined /></template>
          </a-input>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="k8s-toolbar-actions">
        <a-button
          :disabled="!filterStatus && !filterJobType && !searchText"
          class="k8s-toolbar-btn"
          title="重置所有筛选条件"
          @click="resetFilters"
        >
          <template #icon><DeleteOutlined /></template>
          重置筛选
        </a-button>

        <a-button
          type="primary"
          danger
          @click="batchOperation('删除')"
          :disabled="!selectedRows.length"
          v-if="can('cron.job.batchDelete') && selectedRows.length > 0"
          class="k8s-toolbar-btn"
          title="批量删除选中的任务"
        >
          <template #icon><DeleteOutlined /></template>
          删除 ({{ selectedRows.length }})
        </a-button>

        <a-button
          v-if="selectedRows.length > 0"
          :disabled="!selectedRows.length"
          class="k8s-toolbar-btn"
          title="批量启用选中的任务"
          @click="batchOperation('启用')"
        >
          <template #icon><PlayCircleOutlined /></template>
          启用 ({{ selectedRows.length }})
        </a-button>

        <a-button
          v-if="selectedRows.length > 0"
          :disabled="!selectedRows.length"
          class="k8s-toolbar-btn"
          title="批量禁用选中的任务"
          @click="batchOperation('禁用')"
        >
          <template #icon><PauseCircleOutlined /></template>
          禁用 ({{ selectedRows.length }})
        </a-button>
      </div>
    </template>

    <!-- 错误提示 -->
    <a-alert
      v-if="error"
      :message="error"
      class="k8s-error-alert"
      closable
      show-icon
      type="error"
      @close="error = null"
    >
      <template #action>
        <a-button size="small" type="primary" @click="fetchCronJobs()">
          重新加载
        </a-button>
      </template>
    </a-alert>

    <!-- 内容区域 -->
    <div class="k8s-data-display">
      <!-- 任务表格 -->
      <a-table
        :columns="columns"
        :data-source="filteredCronJobs"
        :loading="loading"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: number[]) =>
            `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['10', '20', '30', '50'],
        }"
        :row-selection="rowSelection"
        :scroll="{ x: 1500 }"
        class="k8s-table"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, text, record }">
          <template v-if="column.key === 'status'">
            <a-badge
              :status="getStatusColor(text)"
              :text="getStatusText(text)"
            />
          </template>
          <template v-else-if="column.key === 'job_type'">
            <a-tag :color="getJobTypeColor(text)">
              {{ getJobTypeText(text) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'next_run_time'">
            <span v-if="text">{{ formatDateTime(text) }}</span>
            <span v-else class="k8s-no-data">暂无</span>
          </template>
          <template v-else-if="column.key === 'last_run_time'">
            <span v-if="text">{{ formatDateTime(text) }}</span>
            <span v-else class="k8s-no-data">暂无</span>
          </template>
          <template v-else-if="column.key === 'last_run_status'">
            <a-tooltip
              v-if="record.last_run_time"
              :title="record.last_run_error || undefined"
            >
              <a-badge
                :status="getLastRunStatusColor(text)"
                :text="getLastRunStatusText(text)"
              />
            </a-tooltip>
            <span v-else class="k8s-no-data">暂无</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="k8s-action-column">
              <a-tooltip title="查看详情">
                <a-button
                  size="small"
                  type="text"
                  @click="showJobDetail(record)"
                >
                  <template #icon><EyeOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-tooltip
                :title="
                  isLocalExecLocked(record)
                    ? '本地命令/脚本任务已停用，不可编辑'
                    : '编辑任务'
                "
              >
                <a-button
                  type="text"
                  size="small"
                  @click="openEditModal(record)"
                  :disabled="isLocalExecLocked(record)"
                >
                  <template #icon><EditOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-tooltip
                :title="
                  record.status === CronJobStatus.ENABLED
                    ? '禁用任务'
                    : '启用任务'
                "
              >
                <a-button
                  size="small"
                  type="text"
                  @click="
                    record.status === CronJobStatus.ENABLED
                      ? disableJob(record)
                      : enableJob(record)
                  "
                >
                  <template #icon>
                    <PauseCircleOutlined
                      v-if="record.status === CronJobStatus.ENABLED"
                    />
                    <PlayCircleOutlined v-else />
                  </template>
                </a-button>
              </a-tooltip>

              <a-tooltip
                v-if="can('cron.job.trigger')"
                :title="
                  isLocalExecLocked(record)
                    ? '本地命令/脚本任务已停用，不可执行'
                    : '立即执行'
                "
              >
                <a-button
                  type="text"
                  size="small"
                  @click="triggerJob(record)"
                  :disabled="
                    record.status === CronJobStatus.DISABLED ||
                    isLocalExecLocked(record)
                  "
                >
                  <template #icon><PlaySquareOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-tooltip v-if="can('cron.job.delete')" title="删除任务">
                <a-button
                  :disabled="record.is_built_in === 1"
                  danger
                  size="small"
                  type="text"
                  @click="deleteJob(record)"
                >
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-tooltip>
            </div>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 创建任务模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      :confirm-loading="submitLoading"
      :width="800"
      cancel-text="取消"
      destroy-on-close
      ok-text="创建任务"
      title="创建定时任务"
      @cancel="closeCreateModal"
      @ok="submitCreateForm"
    >
      <a-form
        ref="formRef"
        :label-col="{ span: 6 }"
        :model="createFormModel"
        :rules="createFormRules"
        :wrapper-col="{ span: 18 }"
        class="k8s-form"
      >
        <a-form-item has-feedback label="任务名称" name="name">
          <a-input
            v-model:value="createFormModel.name"
            :maxlength="100"
            placeholder="请输入任务名称"
          />
        </a-form-item>

        <a-form-item label="任务描述" name="description">
          <a-textarea
            v-model:value="createFormModel.description"
            :maxlength="500"
            :rows="3"
            placeholder="请输入任务描述"
            show-count
          />
        </a-form-item>

        <a-form-item
          :extra="
            allowLocalExec
              ? undefined
              : '本地命令/脚本任务已停用（cron.allow_local_exec=false），请改用 HTTP 或 SSH 任务'
          "
          has-feedback
          label="任务类型"
          name="job_type"
        >
          <a-select
            v-model:value="createFormModel.job_type"
            placeholder="请选择任务类型"
            @change="handleJobTypeChange"
          >
            <a-select-option
              :disabled="!allowLocalExec"
              :value="CronJobType.COMMAND"
            >
              命令行
            </a-select-option>
            <a-select-option :value="CronJobType.HTTP">
              HTTP请求
            </a-select-option>
            <a-select-option
              :disabled="!allowLocalExec"
              :value="CronJobType.SCRIPT"
            >
              脚本任务
            </a-select-option>
            <a-select-option :value="CronJobType.SSH">SSH远程</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item
          extra="停用仅保存配置，明确启用后才参与调度。"
          label="初始状态"
          name="status"
        >
          <a-select
            id="cron-create-status"
            v-model:value="createFormModel.status"
            aria-label="初始状态"
          >
            <a-select-option :value="CronJobStatus.ENABLED">
              启用
            </a-select-option>
            <a-select-option :value="CronJobStatus.DISABLED">
              停用（仅保存）
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item has-feedback label="调度表达式" name="schedule">
          <a-input
            v-model:value="createFormModel.schedule"
            :maxlength="100"
            placeholder="例：0 0 * * * (每天午夜执行)"
          >
            <template #addonAfter>
              <a-button
                size="small"
                type="link"
                @click="validateScheduleExpression('create')"
              >
                验证
              </a-button>
            </template>
          </a-input>
          <div class="cron-schedule-tip">
            <small
              >格式：分 时 日 月 周；默认按 UTC 执行，可使用 CRON_TZ
              指定时区</small
            >
          </div>
        </a-form-item>

        <!-- 命令行任务配置 -->
        <template v-if="createFormModel.job_type === CronJobType.COMMAND">
          <a-form-item has-feedback label="执行命令" name="command">
            <a-textarea
              v-model:value="createFormModel.command"
              :maxlength="1000"
              :rows="3"
              placeholder="请输入要执行的命令"
            />
          </a-form-item>

          <a-form-item label="命令参数" name="args">
            <div class="k8s-key-value-inputs">
              <div
                v-for="(_, index) in createFormModel.args || []"
                :key="index"
                class="k8s-key-value-row"
              >
                <a-input
                  v-model:value="createFormModel.args![index]"
                  class="k8s-form-input"
                  placeholder="输入参数"
                  style="flex: 1; margin-right: 8px"
                />
                <a-button
                  danger
                  size="small"
                  type="primary"
                  @click="removeArg(index)"
                >
                  删除
                </a-button>
              </div>
              <a-button
                style="width: 100%; margin-top: 8px"
                type="dashed"
                @click="addArg"
              >
                <template #icon><PlusOutlined /></template>
                添加参数
              </a-button>
            </div>
          </a-form-item>

          <a-form-item label="工作目录" name="work_dir">
            <a-input
              v-model:value="createFormModel.work_dir"
              :maxlength="255"
              placeholder="命令执行的工作目录，留空使用默认目录"
            />
          </a-form-item>

          <a-form-item label="环境变量" name="environment">
            <div class="k8s-key-value-inputs">
              <div
                v-for="(env, index) in createFormModel.environment || []"
                :key="index"
                class="k8s-key-value-row"
              >
                <a-input
                  v-model:value="env.key"
                  class="k8s-form-input"
                  placeholder="变量名"
                />
                <a-input
                  v-model:value="env.value"
                  class="k8s-form-input"
                  placeholder="变量值"
                />
                <a-button
                  danger
                  size="small"
                  type="primary"
                  @click="removeEnvironment(index)"
                >
                  删除
                </a-button>
              </div>
              <a-button
                style="width: 100%; margin-top: 8px"
                type="dashed"
                @click="addEnvironment"
              >
                <template #icon><PlusOutlined /></template>
                添加环境变量
              </a-button>
            </div>
          </a-form-item>
        </template>

        <!-- HTTP 请求任务配置 -->
        <template v-if="createFormModel.job_type === CronJobType.HTTP">
          <a-form-item has-feedback label="请求方法" name="http_method">
            <a-select
              v-model:value="createFormModel.http_method"
              placeholder="请选择HTTP方法"
            >
              <a-select-option value="GET">GET</a-select-option>
              <a-select-option value="POST">POST</a-select-option>
              <a-select-option value="PUT">PUT</a-select-option>
              <a-select-option value="DELETE">DELETE</a-select-option>
              <a-select-option value="PATCH">PATCH</a-select-option>
              <a-select-option value="HEAD">HEAD</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item has-feedback label="请求URL" name="http_url">
            <a-input
              v-model:value="createFormModel.http_url"
              :maxlength="500"
              placeholder="https://example.com/api/endpoint"
            />
          </a-form-item>

          <a-form-item label="请求头" name="http_headers">
            <div class="k8s-key-value-inputs">
              <div
                v-for="(header, index) in createFormModel.http_headers || []"
                :key="index"
                class="k8s-key-value-row"
              >
                <a-input
                  v-model:value="header.key"
                  class="k8s-form-input"
                  placeholder="Header名称"
                />
                <a-input
                  v-model:value="header.value"
                  class="k8s-form-input"
                  placeholder="Header值"
                />
                <a-button
                  danger
                  size="small"
                  type="primary"
                  @click="removeHttpHeader(index)"
                >
                  删除
                </a-button>
              </div>
              <a-button
                style="width: 100%; margin-top: 8px"
                type="dashed"
                @click="addHttpHeader"
              >
                <template #icon><PlusOutlined /></template>
                添加请求头
              </a-button>
            </div>
          </a-form-item>

          <a-form-item label="请求体" name="http_body">
            <a-textarea
              v-model:value="createFormModel.http_body"
              :maxlength="5000"
              :rows="4"
              placeholder="POST/PUT请求的数据体，支持JSON格式"
              show-count
            />
          </a-form-item>
        </template>

        <!-- 脚本任务配置 -->
        <!-- 脚本任务配置 -->
        <template v-if="createFormModel.job_type === CronJobType.SCRIPT">
          <a-form-item has-feedback label="脚本类型" name="script_type">
            <a-select
              v-model:value="createFormModel.script_type"
              placeholder="请选择脚本类型"
            >
              <a-select-option value="bash">Bash Shell</a-select-option>
              <a-select-option value="python">Python</a-select-option>
              <a-select-option value="node">Node.js</a-select-option>
              <a-select-option value="powershell">PowerShell</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item has-feedback label="脚本内容" name="script_content">
            <a-textarea
              v-model:value="createFormModel.script_content"
              :maxlength="10000"
              :rows="10"
              class="k8s-config-textarea"
              placeholder="请输入脚本内容"
              show-count
            />
          </a-form-item>
        </template>

        <!-- SSH 远程任务配置 -->
        <template v-if="createFormModel.job_type === CronJobType.SSH">
          <a-form-item has-feedback label="SSH资源" name="ssh_resource_id">
            <a-select
              v-model:value="createFormModel.ssh_resource_id"
              :filter-option="false"
              :loading="sshResourcesLoading"
              placeholder="请选择SSH资源"
              show-search
              @dropdown-visible-change="
                (open: boolean) => open && fetchSshResources()
              "
              @search="searchSshResources"
            >
              <a-select-option
                v-for="resource in filteredSshResources"
                :key="resource.id"
                :value="resource.id"
              >
                <div
                  style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                  "
                >
                  <span>{{ resource.name }}</span>
                  <a-tag
                    :color="resource.status === 1 ? 'green' : 'red'"
                    size="small"
                  >
                    {{ resource.ip_addr }}:{{ resource.port }}
                  </a-tag>
                </div>
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item has-feedback label="远程命令" name="ssh_command">
            <a-textarea
              v-model:value="createFormModel.ssh_command"
              :maxlength="2000"
              :rows="4"
              class="k8s-config-textarea"
              placeholder="请输入要在远程服务器执行的命令"
              show-count
            />
          </a-form-item>

          <a-form-item label="工作目录" name="ssh_work_dir">
            <a-input
              v-model:value="createFormModel.ssh_work_dir"
              :maxlength="500"
              placeholder="远程命令执行的工作目录，留空使用默认目录"
            />
          </a-form-item>

          <a-form-item label="环境变量" name="ssh_environment">
            <div class="k8s-key-value-inputs">
              <div
                v-for="(env, index) in createFormModel.ssh_environment || []"
                :key="index"
                class="k8s-key-value-row"
              >
                <a-input
                  v-model:value="env.key"
                  class="k8s-form-input"
                  placeholder="变量名"
                />
                <a-input
                  v-model:value="env.value"
                  class="k8s-form-input"
                  placeholder="变量值"
                />
                <a-button
                  danger
                  size="small"
                  type="primary"
                  @click="removeSshEnvironment(index)"
                >
                  删除
                </a-button>
              </div>
              <a-button
                style="width: 100%; margin-top: 8px"
                type="dashed"
                @click="addSshEnvironment"
              >
                <template #icon><PlusOutlined /></template>
                添加环境变量
              </a-button>
            </div>
          </a-form-item>
        </template>

        <a-form-item label="超时时间" name="timeout">
          <a-input-number
            v-model:value="createFormModel.timeout"
            :max="3600"
            :min="1"
            addon-after="秒"
            placeholder="秒"
            style="width: 100%"
          />
          <div class="cron-timeout-tip">
            <small>任务执行超时时间，1-3600秒，默认300秒</small>
          </div>
        </a-form-item>

        <a-form-item
          extra="初次执行之外的重投预算，包含失败与进程崩溃恢复；0 表示不自动重投"
          label="自动重投次数"
          name="max_retry"
        >
          <a-input-number
            v-model:value="createFormModel.max_retry"
            :max="10"
            :min="0"
            addon-after="次"
            placeholder="次数"
            style="width: 100%"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑任务模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      :confirm-loading="submitLoading"
      :width="800"
      cancel-text="取消"
      destroy-on-close
      ok-text="保存修改"
      title="编辑定时任务"
      @cancel="closeEditModal"
      @ok="submitEditForm"
    >
      <a-form
        ref="formRef"
        :label-col="{ span: 6 }"
        :model="editFormModel"
        :rules="editFormRules"
        :wrapper-col="{ span: 18 }"
        class="k8s-form"
      >
        <a-form-item has-feedback label="任务名称" name="name">
          <a-input
            v-model:value="editFormModel.name"
            :maxlength="100"
            placeholder="请输入任务名称"
          />
        </a-form-item>

        <a-form-item label="任务描述" name="description">
          <a-textarea
            v-model:value="editFormModel.description"
            :maxlength="500"
            :rows="3"
            placeholder="请输入任务描述"
            show-count
          />
        </a-form-item>

        <a-form-item has-feedback label="调度表达式" name="schedule">
          <a-input
            v-model:value="editFormModel.schedule"
            :maxlength="100"
            placeholder="例：0 0 * * * (每天午夜执行)"
          >
            <template #addonAfter>
              <a-button
                size="small"
                type="link"
                @click="validateScheduleExpression('edit')"
              >
                验证
              </a-button>
            </template>
          </a-input>
        </a-form-item>

        <CronEditFields
          v-model="editFormModel"
          :loading="sshResourcesLoading"
          :resources="filteredSshResources"
          @open-resources="fetchSshResources"
          @search="searchSshResources"
        />

        <a-form-item label="超时时间" name="timeout">
          <a-input-number
            v-model:value="editFormModel.timeout"
            :max="3600"
            :min="1"
            addon-after="秒"
            placeholder="秒"
            style="width: 100%"
          />
        </a-form-item>

        <a-form-item
          extra="初次执行之外的重投预算，包含失败与进程崩溃恢复；0 表示不自动重投"
          label="自动重投次数"
          name="max_retry"
        >
          <a-input-number
            v-model:value="editFormModel.max_retry"
            :max="10"
            :min="0"
            addon-after="次"
            placeholder="次数"
            style="width: 100%"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 任务详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      :footer="null"
      :width="900"
      title="任务详情"
      @cancel="closeDetailModal"
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentJobDetail" class="k8s-detail-content">
          <a-descriptions :column="2" bordered>
            <a-descriptions-item label="任务名称">
              {{ currentJobDetail.name }}
            </a-descriptions-item>
            <a-descriptions-item label="任务状态">
              <a-badge
                :status="getStatusColor(currentJobDetail.status)"
                :text="getStatusText(currentJobDetail.status)"
              />
            </a-descriptions-item>
            <a-descriptions-item label="任务类型">
              <a-tag :color="getJobTypeColor(currentJobDetail.job_type)">
                {{ getJobTypeText(currentJobDetail.job_type) }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="调度表达式">
              {{ currentJobDetail.schedule }}
            </a-descriptions-item>
            <a-descriptions-item label="创建时间">
              {{ formatDateTime(currentJobDetail.created_at) }}
            </a-descriptions-item>
            <a-descriptions-item label="更新时间">
              {{ formatDateTime(currentJobDetail.updated_at) }}
            </a-descriptions-item>
            <a-descriptions-item label="下次执行">
              {{
                currentJobDetail.next_run_time
                  ? formatDateTime(currentJobDetail.next_run_time)
                  : '暂无'
              }}
            </a-descriptions-item>
            <a-descriptions-item label="上次执行">
              {{
                currentJobDetail.last_run_time
                  ? formatDateTime(currentJobDetail.last_run_time)
                  : '暂无'
              }}
            </a-descriptions-item>
            <a-descriptions-item label="上次状态">
              <a-badge
                :status="
                  getLastRunStatusColor(currentJobDetail.last_run_status)
                "
                :text="getLastRunStatusText(currentJobDetail.last_run_status)"
                v-if="currentJobDetail.last_run_time"
              />
              <span v-else class="k8s-no-data">暂无</span>
            </a-descriptions-item>
            <a-descriptions-item label="执行次数">
              {{ currentJobDetail.run_count || 0 }}次
            </a-descriptions-item>
            <a-descriptions-item label="成功次数">
              {{ currentJobDetail.success_count || 0 }}次
            </a-descriptions-item>
            <a-descriptions-item label="失败次数">
              {{ currentJobDetail.failure_count || 0 }}次
            </a-descriptions-item>
            <a-descriptions-item label="超时时间">
              {{ currentJobDetail.timeout }}秒
            </a-descriptions-item>
            <a-descriptions-item label="重试次数">
              {{ currentJobDetail.max_retry }}次
            </a-descriptions-item>
            <a-descriptions-item label="创建者">
              {{ currentJobDetail.created_by_name || '系统' }}
            </a-descriptions-item>
            <a-descriptions-item :span="2" label="任务描述">
              {{ currentJobDetail.description || '无描述' }}
            </a-descriptions-item>
            <a-descriptions-item
              v-if="currentJobDetail.last_run_duration > 0"
              label="执行耗时"
            >
              {{ formatDuration(currentJobDetail.last_run_duration) }}
            </a-descriptions-item>
            <a-descriptions-item
              v-if="currentJobDetail.last_run_output"
              :span="2"
              label="执行输出"
            >
              <div
                class="k8s-config-textarea"
                style="max-height: 200px; overflow-y: auto"
              >
                <pre>{{ currentJobDetail.last_run_output }}</pre>
              </div>
            </a-descriptions-item>
            <a-descriptions-item
              v-if="currentJobDetail.last_run_error"
              :span="2"
              label="错误信息"
            >
              <div
                class="k8s-config-textarea"
                style="max-height: 200px; overflow-y: auto; color: #ff4d4f"
              >
                <pre>{{ currentJobDetail.last_run_error }}</pre>
              </div>
            </a-descriptions-item>
          </a-descriptions>
        </div>
      </a-spin>
    </a-modal>
  </OpsPage>
</template>

<style scoped>
@import '../shared/cron-common.css';
</style>
