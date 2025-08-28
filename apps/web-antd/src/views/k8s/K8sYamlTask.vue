<template>
  <div class="cluster-management-container yaml-task-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="page-title">
            <PlayCircleOutlined class="title-icon" />
            <h1>YAML 任务管理</h1>
          </div>
          <p class="page-subtitle">执行、监控和管理 Kubernetes YAML 部署任务</p>
        </div>
        <div class="header-actions">
          <a-button size="large" @click="showCreateModal">
            <template #icon><PlusOutlined /></template>
            新建任务
          </a-button>
          <a-button type="primary" size="large" @click="refreshData" :loading="loading">
            <template #icon><ReloadOutlined /></template>
            刷新数据
          </a-button>
        </div>
      </div>
    </div>

    <!-- 数据概览卡片 -->
    <div class="overview-cards">
      <div class="overview-card total-tasks">
        <div class="card-icon">
          <PlayCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ tasks.length }}</div>
          <div class="card-label">任务总数</div>
        </div>
      </div>
      
      <div class="overview-card running-tasks">
        <div class="card-icon">
          <SyncOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ runningTasksCount }}</div>
          <div class="card-label">运行中</div>
        </div>
      </div>
      
      <div class="overview-card success-tasks">
        <div class="card-icon">
          <CheckCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ successTasksCount }}</div>
          <div class="card-label">成功</div>
        </div>
      </div>
      
      <div class="overview-card failed-tasks">
        <div class="card-icon">
          <ExclamationCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ failedTasksCount }}</div>
          <div class="card-label">失败</div>
        </div>
      </div>
    </div>

    <!-- 操作工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <a-select
          v-model:value="selectedCluster"
          placeholder="选择集群"
          class="env-filter cluster-selector"
          :loading="clustersLoading"
          @change="handleClusterChange"
        >
          <template #suffixIcon><ClusterOutlined /></template>
          <a-select-option v-for="cluster in clusters" :key="cluster.id" :value="cluster.id">
            <span class="cluster-option">
              <CloudServerOutlined />
              {{ cluster.name }}
            </span>
          </a-select-option>
        </a-select>

        <a-select
          v-model:value="statusFilter"
          placeholder="任务状态"
          class="env-filter"
          allow-clear
          @change="handleFilterChange"
        >
          <template #suffixIcon><FilterOutlined /></template>
          <a-select-option value="pending">待执行</a-select-option>
          <a-select-option value="running">运行中</a-select-option>
          <a-select-option value="success">成功</a-select-option>
          <a-select-option value="failed">失败</a-select-option>
          <a-select-option value="cancelled">已取消</a-select-option>
        </a-select>

        <a-select
          v-model:value="templateFilter"
          placeholder="选择模板"
          class="env-filter"
          allow-clear
          @change="handleFilterChange"
        >
          <template #suffixIcon><FileTextOutlined /></template>
          <a-select-option v-for="template in templates" :key="template.id" :value="template.id">
            {{ template.name }}
          </a-select-option>
        </a-select>
        
        <a-input-search
          v-model:value="searchKeyword"
          placeholder="搜索任务名称"
          class="search-input"
          @search="onSearch"
          allow-clear
        />
      </div>
      
      <div class="toolbar-right">
        <a-button 
          danger 
          :disabled="selectedRows.length === 0" 
          @click="batchDelete"
          :loading="batchDeleteLoading"
        >
          <template #icon><DeleteOutlined /></template>
          批量删除 ({{ selectedRows.length }})
        </a-button>
        
        <a-button 
          :disabled="selectedRows.length === 0" 
          @click="batchCancel"
          :loading="batchCancelLoading"
        >
          <template #icon><StopOutlined /></template>
          批量取消
        </a-button>
      </div>
    </div>

    <!-- 任务列表 -->
    <div class="data-display">
      <div class="display-header" v-if="filteredTasks.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ filteredTasks.length }} 个任务</span>
          <div class="env-tags">
            <a-tag color="blue">总计 {{ filteredTasks.length }}</a-tag>
            <a-tag color="orange">运行中 {{ runningTasksCount }}</a-tag>
            <a-tag color="green">成功 {{ successTasksCount }}</a-tag>
            <a-tag color="red">失败 {{ failedTasksCount }}</a-tag>
          </div>
        </div>
      </div>

      <a-table
        :columns="columns"
        :data-source="filteredTasks"
        :loading="loading"
        row-key="id"
        :row-selection="{
          selectedRowKeys: selectedRows.map(row => row.id),
          onChange: onSelectChange,
        }"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: totalItems,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: [number, number]) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['10', '20', '50', '100']
        }"
        @change="handleTableChange"
        class="cluster-table tasks-table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="task-name">
              <PlayCircleOutlined class="task-icon" />
              <span class="name-text">{{ record.name }}</span>
              <a-tag v-if="isMyTask(record)" color="green" size="small">我的</a-tag>
            </div>
          </template>

          <template v-else-if="column.key === 'status'">
            <div class="status-info">
              <a-tag 
                :color="getStatusColor(record.status)" 
                class="status-tag"
              >
                <SyncOutlined v-if="record.status === 'running'" :spin="true" />
                <CheckCircleOutlined v-else-if="record.status === 'success'" />
                <ExclamationCircleOutlined v-else-if="record.status === 'failed'" />
                <ClockCircleOutlined v-else-if="record.status === 'pending'" />
                <StopOutlined v-else />
                {{ getStatusText(record.status) }}
              </a-tag>
              <div class="status-progress" v-if="record.status === 'running' && taskProgress[record.id]">
                <a-progress 
                  :percent="taskProgress[record.id]" 
                  size="small" 
                  :show-info="false"
                />
              </div>
            </div>
          </template>

          <template v-else-if="column.key === 'template'">
            <div class="template-info">
              <FileTextOutlined />
              {{ getTemplateName(record.template_id) }}
            </div>
          </template>

          <template v-else-if="column.key === 'cluster'">
            <div class="cluster-info">
              <CloudServerOutlined />
              {{ getClusterName(record.cluster_id) }}
            </div>
          </template>

          <template v-else-if="column.key === 'variables'">
            <div class="variables-info">
              <a-tooltip v-if="record.variables && record.variables.length > 0">
                <template #title>
                  <div class="variables-tooltip">
                    <div v-for="(variable, index) in parseVariables(record.variables)" :key="index">
                      <strong>{{ variable.key }}:</strong> {{ variable.value }}
                    </div>
                  </div>
                </template>
                <a-tag color="cyan">
                  <SettingOutlined />
                  {{ record.variables.length }} 个变量
                </a-tag>
              </a-tooltip>
              <span v-else class="no-variables">无变量</span>
            </div>
          </template>

          <template v-else-if="column.key === 'created_at'">
            <div class="time-info">
              <div class="create-time">{{ formatDate(record.created_at) }}</div>
              <div class="update-time" v-if="record.updated_at !== record.created_at">
                更新: {{ formatDate(record.updated_at) }}
              </div>
            </div>
          </template>

          <template v-else-if="column.key === 'actions'">
            <div class="action-buttons">
              <a-tooltip title="查看详情">
                <a-button type="text" size="small" @click="viewTaskDetail(record)">
                  <EyeOutlined />
                </a-button>
              </a-tooltip>
              
              <a-tooltip v-if="record.status === 'pending'" title="执行任务">
                <a-button type="text" size="small" @click="executeTask(record)" :loading="executingTasks.includes(record.id)">
                  <PlayCircleOutlined />
                </a-button>
              </a-tooltip>
              
              <a-tooltip v-if="record.status === 'running'" title="取消执行">
                <a-button type="text" size="small" @click="cancelTask(record)" :loading="cancellingTasks.includes(record.id)">
                  <StopOutlined />
                </a-button>
              </a-tooltip>
              
              <a-tooltip v-if="record.status === 'failed'" title="重新执行">
                <a-button type="text" size="small" @click="retryTask(record)" :loading="retryingTasks.includes(record.id)">
                  <RedoOutlined />
                </a-button>
              </a-tooltip>
              
              <a-tooltip title="克隆任务">
                <a-button type="text" size="small" @click="cloneTask(record)">
                  <CopyOutlined />
                </a-button>
              </a-tooltip>
              
              <a-tooltip title="编辑">
                <a-button type="text" size="small" @click="editTask(record)" :disabled="record.status === 'running'">
                  <EditOutlined />
                </a-button>
              </a-tooltip>
              
              <a-tooltip title="删除">
                <a-button type="text" size="small" danger @click="deleteTask(record)" :disabled="record.status === 'running'">
                  <DeleteOutlined />
                </a-button>
              </a-tooltip>
            </div>
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import {
  getYamlTaskListWithFilterApi,
  getYamlTaskDetailApi,
  deleteYamlTaskApi,
  batchDeleteYamlTaskApi,
  applyYamlTaskApi,
  cancelYamlTaskApi,
  retryYamlTaskApi,
  cloneYamlTaskApi,
  getAllClustersApi,
  getYamlTemplateApi,
} from '#/api';
import type { 
  YamlTaskInfo, 
  YamlTemplateInfo
} from '#/api';
import { 
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  ClusterOutlined,
  CloudServerOutlined,
  FilterOutlined,
  FileTextOutlined,
  DeleteOutlined,
  StopOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  RedoOutlined,
  CopyOutlined,
  EditOutlined,
  SettingOutlined
} from '@ant-design/icons-vue';

// 状态变量
const loading = ref(false);
const batchDeleteLoading = ref(false);
const batchCancelLoading = ref(false);
const clustersLoading = ref(false);
const tasks = ref<YamlTaskInfo[]>([]);
const templates = ref<YamlTemplateInfo[]>([]);
const searchKeyword = ref('');
const statusFilter = ref<string>();
const templateFilter = ref<number>();
const selectedRows = ref<YamlTaskInfo[]>([]);
const clusters = ref<Array<{id: number, name: string}>>([]);
const selectedCluster = ref<number>();
const currentPage = ref(1);
const pageSize = ref(20);
const totalItems = ref(0);

// 任务执行状态跟踪
const executingTasks = ref<number[]>([]);
const cancellingTasks = ref<number[]>([]);
const retryingTasks = ref<number[]>([]);
const taskProgress = ref<Record<number, number>>({});

// 当前用户ID
const currentUserId = ref(1);

// 表格列配置
const columns = [
  {
    title: '任务名称',
    dataIndex: 'name',
    key: 'name',
    width: '20%',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: '12%',
  },
  {
    title: '模板',
    dataIndex: 'template_id',
    key: 'template',
    width: '15%',
  },
  {
    title: '集群',
    dataIndex: 'cluster_id',
    key: 'cluster',
    width: '12%',
  },
  {
    title: '变量',
    dataIndex: 'variables',
    key: 'variables',
    width: '12%',
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: '15%',
  },
  {
    title: '操作',
    key: 'actions',
    width: '14%',
  },
];

// 计算属性
const filteredTasks = computed(() => {
  let result = tasks.value;
  
  if (statusFilter.value) {
    result = result.filter(task => task.status === statusFilter.value);
  }
  
  if (templateFilter.value) {
    result = result.filter(task => task.template_id === templateFilter.value);
  }
  
  const searchValue = searchKeyword.value.toLowerCase().trim();
  if (searchValue) {
    result = result.filter(task => 
      task.name.toLowerCase().includes(searchValue)
    );
  }
  
  return result;
});

const runningTasksCount = computed(() => 
  tasks.value.filter(task => task.status === 'running').length
);

const successTasksCount = computed(() => 
  tasks.value.filter(task => task.status === 'success').length
);

const failedTasksCount = computed(() => 
  tasks.value.filter(task => task.status === 'failed').length
);

// 工具函数
const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const getClusterName = (clusterId: number) => {
  const cluster = clusters.value.find(c => c.id === clusterId);
  return cluster?.name || '未知集群';
};

const getTemplateName = (templateId: number) => {
  const template = templates.value.find(t => t.id === templateId);
  return template?.name || '未知模板';
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    pending: 'default',
    running: 'processing',
    success: 'success',
    failed: 'error',
    cancelled: 'warning',
  };
  return colors[status] || 'default';
};

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: '待执行',
    running: '运行中',
    success: '成功',
    failed: '失败',
    cancelled: '已取消',
  };
  return texts[status] || status;
};

const isMyTask = (task: YamlTaskInfo) => {
  return task.user_id === currentUserId.value;
};

const parseVariables = (variables: string[]) => {
  return variables.map(variable => {
    const [key, value] = variable.split('=');
    return { key, value };
  });
};

// API 方法
const getClusters = async () => {
  clustersLoading.value = true;
  try {
    const res = await getAllClustersApi();
    clusters.value = res ?? [];
    if (clusters.value.length > 0 && !selectedCluster.value) {
      selectedCluster.value = clusters.value[0]?.id;
      if (selectedCluster.value) {
        await Promise.all([
          getTasks(),
          getTemplates()
        ]);
      }
    }
  } catch (error: any) {
    message.error(error.message || '获取集群列表失败');
  } finally {
    clustersLoading.value = false;
  }
};

const getTemplates = async () => {
  if (!selectedCluster.value) return;
  
  try {
    const res = await getYamlTemplateApi(selectedCluster.value);
    templates.value = res || [];
  } catch (error: any) {
    console.error('获取模板列表失败:', error);
    templates.value = [];
  }
};

const getTasks = async () => {
  loading.value = true;
  try {
    const params = {
      page: currentPage.value,
      page_size: pageSize.value,
      status: statusFilter.value,
      cluster_id: selectedCluster.value,
      template_id: templateFilter.value,
      keyword: searchKeyword.value,
    };
    
    const res = await getYamlTaskListWithFilterApi(params);
    tasks.value = res || [];
    totalItems.value = tasks.value.length;
  } catch (error: any) {
    message.error(error.message || '获取任务列表失败');
    tasks.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

// 刷新数据
const refreshData = async () => {
  await Promise.all([
    getTasks(),
    getTemplates()
  ]);
};

// 搜索
const onSearch = () => {
  currentPage.value = 1;
  getTasks();
};

// 筛选处理
const handleFilterChange = () => {
  currentPage.value = 1;
  getTasks();
};

// 切换集群
const handleClusterChange = () => {
  tasks.value = [];
  templates.value = [];
  currentPage.value = 1;
  totalItems.value = 0;
  Promise.all([getTasks(), getTemplates()]);
};

// 分页处理
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  getTasks();
};

// 选择行
const onSelectChange = (_selectedRowKeys: number[], selected: YamlTaskInfo[]) => {
  selectedRows.value = selected;
};

// 显示创建弹窗
const showCreateModal = () => {
  message.info('创建任务功能开发中...');
};

// 编辑任务
const editTask = (_task: YamlTaskInfo) => {
  message.info('编辑任务功能开发中...');
};

// 查看任务详情
const viewTaskDetail = async (task: YamlTaskInfo) => {
  try {
    const detail = await getYamlTaskDetailApi(task.id);
    message.success('获取任务详情成功');
    console.log('任务详情:', detail);
  } catch (error: any) {
    message.error(error.message || '获取任务详情失败');
  }
};

// 执行任务
const executeTask = async (task: YamlTaskInfo) => {
  executingTasks.value.push(task.id);
  try {
    await applyYamlTaskApi(task.id);
    message.success('任务执行成功');
    refreshData();
  } catch (error: any) {
    message.error(error.message || '执行失败');
  } finally {
    executingTasks.value = executingTasks.value.filter(id => id !== task.id);
  }
};

// 取消任务
const cancelTask = async (task: YamlTaskInfo) => {
  cancellingTasks.value.push(task.id);
  try {
    await cancelYamlTaskApi(task.id);
    message.success('任务取消成功');
    refreshData();
  } catch (error: any) {
    message.error(error.message || '取消失败');
  } finally {
    cancellingTasks.value = cancellingTasks.value.filter(id => id !== task.id);
  }
};

// 重试任务
const retryTask = async (task: YamlTaskInfo) => {
  retryingTasks.value.push(task.id);
  try {
    await retryYamlTaskApi(task.id);
    message.success('任务重试成功');
    refreshData();
  } catch (error: any) {
    message.error(error.message || '重试失败');
  } finally {
    retryingTasks.value = retryingTasks.value.filter(id => id !== task.id);
  }
};

// 克隆任务
const cloneTask = async (task: YamlTaskInfo) => {
  try {
    await cloneYamlTaskApi(task.id, `${task.name}_copy`);
    message.success('任务克隆成功');
    refreshData();
  } catch (error: any) {
    message.error(error.message || '克隆失败');
  }
};

// 删除任务
const deleteTask = async (task: YamlTaskInfo) => {
  try {
    await deleteYamlTaskApi(task.id);
    message.success('任务删除成功');
    refreshData();
  } catch (error: any) {
    message.error(error.message || '删除失败');
  }
};

// 批量删除
const batchDelete = async () => {
  if (selectedRows.value.length === 0) return;

  batchDeleteLoading.value = true;
  try {
    const ids = selectedRows.value.map(row => row.id);
    await batchDeleteYamlTaskApi(ids);
    message.success('批量删除成功');
    selectedRows.value = [];
    refreshData();
  } catch (error: any) {
    message.error(error.message || '批量删除失败');
  } finally {
    batchDeleteLoading.value = false;
  }
};

// 批量取消
const batchCancel = async () => {
  if (selectedRows.value.length === 0) return;

  batchCancelLoading.value = true;
  try {
    const runningTasks = selectedRows.value.filter(task => task.status === 'running');
    await Promise.all(runningTasks.map(task => cancelYamlTaskApi(task.id)));
    message.success('批量取消成功');
    selectedRows.value = [];
    refreshData();
  } catch (error: any) {
    message.error(error.message || '批量取消失败');
  } finally {
    batchCancelLoading.value = false;
  }
};

// 页面加载时获取数据
onMounted(() => {
  getClusters();
});
</script>

<style scoped>
.yaml-task-container .task-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-name .task-icon {
  color: #1890ff;
}

.task-name .name-text {
  font-weight: 500;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-progress {
  width: 80px;
}

.template-info,
.cluster-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.variables-info .no-variables {
  color: #999;
  font-style: italic;
}

.time-info .create-time {
  font-weight: 500;
  margin-bottom: 2px;
}

.time-info .update-time {
  font-size: 12px;
  color: #666;
}

.action-buttons {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

.variables-tooltip {
  max-width: 300px;
}

.variables-tooltip > div {
  margin-bottom: 4px;
  padding: 2px 0;
}
</style>
