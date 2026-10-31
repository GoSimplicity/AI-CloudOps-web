<script lang="ts" setup>
import OpsPage from '#/components/ops/OpsPage.vue';
import { onMounted, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { usePodPage } from './Pod';
import {
  formatDateTime,
  formatK8sTime,
  getRelativeTime,
  namespacedResourceKey,
} from '../shared/utils';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  CodeOutlined,
  ContainerOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileAddOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FilterOutlined,
  FolderOutlined,
  FormatPainterOutlined,
  LinkOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  TagsOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue';

import { usePermission } from '#/utils/permission';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';

const { can } = usePermission();

const {
  // state
  clusters,
  namespaces,
  loading,
  loadError,
  clustersError,
  namespacesError,
  clustersLoading,
  namespacesLoading,
  searchText,
  filterStatus,
  filterClusterId,
  filterNamespace,
  filterLabels,
  selectedRows,
  currentPage,
  pageSize,
  total,
  clustersTotal,
  namespacesTotal,

  // modal state
  isCreateModalVisible,
  isCreateYamlModalVisible,
  isEditModalVisible,
  isDetailModalVisible,
  isYamlModalVisible,
  isLogsModalVisible,
  isExecModalVisible,
  isPortForwardModalVisible,
  isFileManagerModalVisible,
  submitLoading,
  detailLoading,
  logsLoading,
  isLogsStreaming,

  // 终端状态
  isTerminalConnected,
  terminalLoading,

  // operation targets
  currentOperationPod,
  currentPodDetail,
  podLogs,
  podContainers,

  // form models
  createFormModel,
  editFormModel,
  yamlFormModel,
  createYamlFormModel,
  logsFormModel,
  execFormModel,
  portForwardFormModel,

  // form refs
  formRef,
  yamlFormRef,
  createYamlFormRef,
  execFormRef,

  // form rules
  createFormRules,
  yamlFormRules,
  createYamlFormRules,
  execFormRules,

  // computed
  filteredPods,
  rowSelection,

  // helpers
  getEnvText,
  getStatusText,
  getStatusColor,
  getPhaseText,

  // operations
  fetchClusters,
  fetchNamespaces,
  fetchPods,
  clearPods,
  clearNamespaces,
  loadMoreClusters,
  loadMoreNamespaces,

  // detail operations
  showPodDetail,
  closeDetailModal,

  // YAML operations
  showYamlModal,
  closeYamlModal,
  submitYamlForm,

  // YAML toolbar operations
  insertYamlTemplate,
  formatYaml,
  validateYaml,
  clearYaml,
  formatEditYaml,
  validateEditYaml,

  // create operations
  openCreateModal,
  closeCreateModal,
  submitCreateForm,
  openCreateYamlModal,
  closeCreateYamlModal,
  submitCreateYamlForm,

  // edit operations
  openEditModal,
  closeEditModal,
  submitEditForm,

  // pod operations
  deletePod,

  // logs operations
  showLogsModal,
  closeLogsModal,
  fetchPodLogs,
  stopLogsStream,

  // exec operations
  showExecModal,
  closeExecModal,
  connectToTerminal,
  disconnectTerminal,

  // port forward operations
  showPortForwardModal,
  closePortForwardModal,
  submitPortForward,

  // file operations
  showFileManagerModal,
  closeFileManagerModal,
  uploadFile,
  downloadFile,

  // filter operations
  addFilterLabel,
  removeFilterLabel,
  clearFilterLabels,

  // batch operations
  batchOperation,

  // pagination operations
  handlePageChange,

  // form field operations
  addContainerField,
  removeContainerField,
  addEnvField,
  removeEnvField,
  addPortField,
  removePortField,
  addPortForwardField,
  removePortForwardField,
  removeLabelField,
  removeAnnotationField,

  // constants
  K8sPodStatus,
} = usePodPage();

// 添加新标签/注解的方法
const newLabelKey = ref('');
const newAnnotationKey = ref('');
const newEditLabelKey = ref('');
const newEditAnnotationKey = ref('');

const addNewLabel = () => {
  if (newLabelKey.value && newLabelKey.value.trim()) {
    createFormModel.value.labels[newLabelKey.value.trim()] = '';
    newLabelKey.value = '';
  }
};

const addNewAnnotation = () => {
  if (newAnnotationKey.value && newAnnotationKey.value.trim()) {
    createFormModel.value.annotations[newAnnotationKey.value.trim()] = '';
    newAnnotationKey.value = '';
  }
};

const addNewEditLabel = () => {
  if (newEditLabelKey.value && newEditLabelKey.value.trim()) {
    editFormModel.value.labels[newEditLabelKey.value.trim()] = '';
    newEditLabelKey.value = '';
  }
};

const addNewEditAnnotation = () => {
  if (newEditAnnotationKey.value && newEditAnnotationKey.value.trim()) {
    editFormModel.value.annotations[newEditAnnotationKey.value.trim()] = '';
    newEditAnnotationKey.value = '';
  }
};

const removeEditLabelField = (key: string) => {
  delete editFormModel.value.labels[key];
};

const removeEditAnnotationField = (key: string) => {
  delete editFormModel.value.annotations[key];
};

// 计算Pod就绪百分比
const calculateReadyPercent = (ready: string) => {
  if (!ready || !ready.includes('/')) return 0;
  const [readyCount, totalCount] = ready.split('/').map(Number);
  return totalCount && totalCount > 0
    ? Math.round(((readyCount || 0) / totalCount) * 100)
    : 0;
};

// 检查Pod是否完全就绪
const isFullyReady = (ready: string) => {
  if (!ready || !ready.includes('/')) return false;
  const [readyCount, totalCount] = ready.split('/').map(Number);
  return readyCount === totalCount;
};

// 获取QoS等级颜色
const getQosClassColor = (qosClass: string) => {
  const map: Record<string, string> = {
    Guaranteed: 'green',
    Burstable: 'orange',
    BestEffort: 'blue',
  };
  return map[qosClass] || 'default';
};

// 注意：时间格式化函数已移至 shared/utils.ts，使用 formatK8sTime

const onSearch = () => {
  currentPage.value = 1;
  fetchPods();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchPods();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearNamespaces();
  clearPods();

  if (filterClusterId.value) {
    fetchNamespaces(true); // 重置命名空间分页
    fetchPods();
  }
};

const handleTableChange = (pagination: {
  current?: number;
  pageSize?: number;
}) => {
  if (pagination) {
    handlePageChange(
      pagination.current || currentPage.value,
      pagination.pageSize,
    );
  }
};

// 处理集群下拉选择的滚动事件
const handleClusterDropdownScroll = (e: Event) => {
  const { target } = e;
  if (
    target &&
    'scrollTop' in target &&
    'scrollHeight' in target &&
    'clientHeight' in target
  ) {
    const scrollTarget = target as HTMLElement;
    if (
      scrollTarget.scrollTop + scrollTarget.clientHeight >=
      scrollTarget.scrollHeight - 5
    ) {
      loadMoreClusters();
    }
  }
};

const columns = [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    width: 150,
    ellipsis: true,
    fixed: 'left',
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    width: 120,
    ellipsis: true,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    align: 'center',
  },
  {
    title: '阶段',
    dataIndex: 'phase',
    key: 'phase',
    width: 90,
    align: 'center',
  },
  {
    title: '就绪',
    dataIndex: 'ready',
    key: 'ready',
    width: 100,
    align: 'center',
  },
  {
    title: '重启次数',
    dataIndex: 'restart_count',
    key: 'restart_count',
    width: 90,
    align: 'center',
  },
  {
    title: '节点',
    dataIndex: 'node_name',
    key: 'node_name',
    width: 150,
    ellipsis: true,
  },
  {
    title: 'Pod IP',
    dataIndex: 'pod_ip',
    key: 'pod_ip',
    width: 130,
  },
  {
    title: 'QoS等级',
    dataIndex: 'qos_class',
    key: 'qos_class',
    width: 100,
    align: 'center',
  },
  {
    title: '标签',
    dataIndex: 'labels',
    key: 'labels',
    width: 150,
  },
  {
    title: '注解',
    dataIndex: 'annotations',
    key: 'annotations',
    width: 120,
  },
  {
    title: 'UID',
    dataIndex: 'uid',
    key: 'uid',
    width: 100,
    ellipsis: true,
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 160,
  },
  {
    title: '操作',
    key: 'actions',
    width: 350,
    fixed: 'right',
    align: 'center',
  },
];

// 标签过滤器状态
const isLabelsFilterModalVisible = ref(false);
const newFilterKey = ref('');
const newFilterValue = ref('');

// 标签过滤器操作
const openLabelsFilter = () => {
  isLabelsFilterModalVisible.value = true;
};

const closeLabelsFilterModal = () => {
  isLabelsFilterModalVisible.value = false;
  newFilterKey.value = '';
  newFilterValue.value = '';
};

const addNewFilterLabel = () => {
  if (newFilterKey.value.trim() && newFilterValue.value.trim()) {
    addFilterLabel(newFilterKey.value.trim(), newFilterValue.value.trim());
    newFilterKey.value = '';
    newFilterValue.value = '';
  }
};

const applyLabelsFilter = () => {
  if (newFilterKey.value.trim() && newFilterValue.value.trim()) {
    addNewFilterLabel();
  }
  closeLabelsFilterModal();
};

// 重置所有筛选条件
const resetFilters = () => {
  filterStatus.value = undefined;
  searchText.value = '';
  filterClusterId.value = undefined;
  filterNamespace.value = undefined;
  clearFilterLabels();
  currentPage.value = 1;
  clearPods();
  clearNamespaces();
  message.success('已重置所有筛选条件');
};

onMounted(async () => {
  await fetchClusters();
});

// 监听容器变化，自动停止之前的流
watch(
  () => logsFormModel.value.container,
  (newContainer, oldContainer) => {
    if (newContainer !== oldContainer && isLogsStreaming.value) {
      stopLogsStream();
      message.info('已切换容器，请重新启动实时流');
    }
  },
);

// 文件管理相关状态
const fileManagerContainer = ref<string>('');
const uploadFilePath = ref<string>('/tmp');
const downloadFilePath = ref<string>('');
const fileList = ref<any[]>([]);
const uploadLoading = ref(false);
const downloadLoading = ref(false);
const uploadProgress = ref({
  show: false,
  current: 0,
  total: 0,
  percent: 0,
  status: 'active' as 'active' | 'success' | 'exception',
  currentFile: '',
});

// 文件管理相关方法
const handleContainerChange = (containerName: string) => {
  fileManagerContainer.value = containerName;
  // 重置文件列表和路径
  fileList.value = [];
  uploadFilePath.value = '/tmp';
  downloadFilePath.value = '';
};

const beforeUpload = (file: File) => {
  // 检查文件大小 (限制为100MB)
  const isLt100M = file.size / 1024 / 1024 < 100;
  if (!isLt100M) {
    message.error('文件大小不能超过 100MB!');
    return false;
  }

  // 添加到文件列表
  fileList.value.push({
    uid: file.name + Date.now(),
    name: file.name,
    status: 'done',
    originFileObj: file,
  });

  return false; // 阻止自动上传
};

const handleRemoveFile = (file: any) => {
  const index = fileList.value.findIndex((item) => item.uid === file.uid);
  if (index > -1) {
    fileList.value.splice(index, 1);
  }
};

const clearFileList = () => {
  fileList.value = [];
};

const handleUploadFiles = async () => {
  if (
    fileList.value.length === 0 ||
    !uploadFilePath.value ||
    !fileManagerContainer.value
  ) {
    message.warning('请选择文件和目标路径');
    return;
  }

  uploadLoading.value = true;
  uploadProgress.value = {
    show: true,
    current: 0,
    total: fileList.value.length,
    percent: 0,
    status: 'active',
    currentFile: '',
  };

  try {
    for (let i = 0; i < fileList.value.length; i++) {
      const fileItem = fileList.value[i];
      const file = fileItem.originFileObj;

      uploadProgress.value.current = i + 1;
      uploadProgress.value.currentFile = file.name;
      uploadProgress.value.percent = Math.round(
        (i / fileList.value.length) * 100,
      );

      await uploadFile(file, uploadFilePath.value, fileManagerContainer.value);
    }

    uploadProgress.value.percent = 100;
    uploadProgress.value.status = 'success';
    uploadProgress.value.currentFile = '';

    message.success(`成功上传 ${fileList.value.length} 个文件`);

    // 清空文件列表
    setTimeout(() => {
      fileList.value = [];
      uploadProgress.value.show = false;
    }, 2000);
  } catch (error) {
    uploadProgress.value.status = 'exception';
    if (shouldNotifyPageError(error)) message.error('文件上传失败');
  } finally {
    uploadLoading.value = false;
  }
};

const handleDownloadFile = async () => {
  if (!downloadFilePath.value || !fileManagerContainer.value) {
    message.warning('请输入文件路径和选择容器');
    return;
  }

  if (!downloadFilePath.value.trim()) {
    message.warning('请输入有效的文件路径');
    return;
  }

  downloadLoading.value = true;
  try {
    await downloadFile(
      downloadFilePath.value.trim(),
      fileManagerContainer.value,
    );
  } catch {
    // 错误已经在downloadFile函数中处理，这里不需要额外的错误消息
  } finally {
    downloadLoading.value = false;
  }
};

// 重写文件管理模态框关闭方法，添加状态清理
const handleCloseFileManagerModal = () => {
  // 清理文件管理状态
  fileManagerContainer.value = '';
  uploadFilePath.value = '/tmp';
  downloadFilePath.value = '';
  fileList.value = [];
  uploadLoading.value = false;
  downloadLoading.value = false;
  uploadProgress.value = {
    show: false,
    current: 0,
    total: 0,
    percent: 0,
    status: 'active',
    currentFile: '',
  };

  // 调用原始的关闭方法
  closeFileManagerModal();
};
</script>

<template>
  <OpsPage description="按集群和命名空间查询与维护 Pod" title="Pod 管理">
    <!-- 页面头部 -->
    <template #actions>
      <a-button
        :disabled="!filterClusterId"
        type="primary"
        @click="openCreateModal"
      >
        <template #icon><PlusOutlined aria-hidden="true" /></template>
        创建 Pod
      </a-button>
      <a-button
        :disabled="!filterClusterId"
        :loading="loading"
        @click="fetchPods"
      >
        <template #icon><ReloadOutlined aria-hidden="true" /></template>
        刷新数据
      </a-button>
    </template>

    <!-- 工具栏 -->
    <template #filters>
      <!-- 筛选和搜索区域 -->
      <div class="k8s-toolbar-filters">
        <div class="k8s-filter-group">
          <a-select
            v-model:value="filterClusterId"
            :disabled="clustersLoading"
            :loading="clustersLoading"
            allow-clear
            aria-label="选择集群"
            class="k8s-cluster-selector"
            placeholder="选择集群"
            @change="handleClusterChange"
            @popup-scroll="handleClusterDropdownScroll"
          >
            <template #suffixIcon>
              <DatabaseOutlined aria-hidden="true" />
            </template>
            <a-select-option
              v-for="cluster in clusters"
              :key="cluster.id"
              :value="cluster.id"
            >
              <div
                style="
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                "
              >
                <span>{{ cluster.name }}</span>
                <a-tag color="blue" size="small">
                  {{ getEnvText(cluster.env) }}
                </a-tag>
              </div>
            </a-select-option>
            <a-select-option
              v-if="clusters.length > 0 && clusters.length < clustersTotal"
              :value="'__load_more__'"
              disabled
              style="text-align: center; color: #999"
            >
              <a-spin :spinning="clustersLoading" size="small" />
              <span v-if="!clustersLoading">滚动加载更多...</span>
            </a-select-option>
          </a-select>

          <a-select
            v-model:value="filterNamespace"
            :disabled="!filterClusterId"
            :loading="namespacesLoading"
            allow-clear
            aria-label="选择命名空间"
            class="k8s-filter-select k8s-namespace-selector"
            placeholder="选择命名空间"
            @change="handleFilterChange"
          >
            <template #suffixIcon>
              <AppstoreOutlined aria-hidden="true" />
            </template>
            <a-select-option
              v-for="ns in namespaces"
              :key="ns.name"
              :value="ns.name"
            >
              {{ ns.name }}
            </a-select-option>
            <a-select-option
              v-if="
                namespaces.length > 0 && namespaces.length < namespacesTotal
              "
              :value="'__load_more_namespaces__'"
              disabled
              style="text-align: center; color: #999"
            >
              <a-button
                :loading="namespacesLoading"
                size="small"
                type="link"
                @click.stop="loadMoreNamespaces"
              >
                加载更多...
              </a-button>
            </a-select-option>
          </a-select>

          <a-select
            v-model:value="filterStatus"
            allow-clear
            class="k8s-filter-select"
            placeholder="状态筛选"
            @change="handleFilterChange"
          >
            <template #suffixIcon>
              <FilterOutlined aria-hidden="true" />
            </template>
            <a-select-option :value="K8sPodStatus.Pending">
              等待中
            </a-select-option>
            <a-select-option :value="K8sPodStatus.Running">
              运行中
            </a-select-option>
            <a-select-option :value="K8sPodStatus.Succeeded">
              已完成
            </a-select-option>
            <a-select-option :value="K8sPodStatus.Failed">失败</a-select-option>
            <a-select-option :value="K8sPodStatus.Unknown">
              未知
            </a-select-option>
          </a-select>

          <!-- 标签过滤器 -->
          <div class="pod-labels-filter">
            <a-button
              class="k8s-toolbar-btn"
              type="dashed"
              @click="openLabelsFilter"
            >
              <template #icon><TagsOutlined aria-hidden="true" /></template>
              标签过滤
              <a-tag
                v-if="Object.keys(filterLabels).length > 0"
                color="blue"
                size="small"
                style="margin-left: 8px"
              >
                {{ Object.keys(filterLabels).length }}
              </a-tag>
            </a-button>
            <div
              v-if="Object.keys(filterLabels).length > 0"
              class="active-filters"
              style="margin-top: 8px"
            >
              <a-tag
                v-for="(value, key) in filterLabels"
                :key="key"
                closable
                color="blue"
                size="small"
                style="margin-right: 4px; margin-bottom: 4px"
                @close="removeFilterLabel(key)"
              >
                {{ key }}: {{ value }}
              </a-tag>
            </div>
          </div>
        </div>

        <div class="k8s-search-group">
          <a-input
            v-model:value="searchText"
            allow-clear
            class="k8s-search-input"
            placeholder="搜索 Pod 名称"
            @input="onSearch"
            @pressEnter="onSearch"
          >
            <template #suffix>
              <SearchOutlined aria-hidden="true" class="k8s-search-icon" />
            </template>
          </a-input>
        </div>
      </div>

      <!-- 操作区域 -->
      <div class="k8s-toolbar-actions">
        <div class="k8s-action-buttons">
          <a-button
            @click="resetFilters"
            :disabled="
              !filterStatus &&
              !searchText &&
              !filterClusterId &&
              !filterNamespace &&
              Object.keys(filterLabels).length === 0
            "
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined aria-hidden="true" /></template>
            重置筛选
          </a-button>

          <a-button
            :disabled="!filterClusterId"
            class="k8s-toolbar-btn"
            title="通过YAML创建Pod"
            @click="openCreateYamlModal"
          >
            <template #icon><FileTextOutlined aria-hidden="true" /></template>
            YAML 创建
          </a-button>

          <a-button
            type="primary"
            danger
            @click="() => batchOperation('删除')"
            :disabled="!selectedRows.length"
            v-if="can('k8s.pod.batchDelete') && selectedRows.length > 0"
            class="k8s-toolbar-btn"
            title="批量删除选中的 Pod"
          >
            <template #icon><DeleteOutlined aria-hidden="true" /></template>
            删除 ({{ selectedRows.length }})
          </a-button>
        </div>
      </div>
    </template>

    <!-- 数据展示区域 -->
    <a-alert v-if="loadError" :message="loadError" show-icon type="error">
      <template #action>
        <a-button size="small" @click="fetchPods">重试</a-button>
      </template>
    </a-alert>
    <a-alert
      v-if="clustersError"
      :message="clustersError"
      show-icon
      type="error"
    >
      <template #action>
        <a-button size="small" @click="() => fetchClusters(true)">
          重试集群列表
        </a-button>
      </template>
    </a-alert>
    <a-alert
      v-if="namespacesError"
      :message="namespacesError"
      show-icon
      type="error"
    >
      <template #action>
        <a-button size="small" @click="() => fetchNamespaces(true)">
          重试命名空间
        </a-button>
      </template>
    </a-alert>
    <div class="k8s-data-display table-container">
      <a-table
        :columns="columns"
        :data-source="filteredPods"
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
        :row-key="namespacedResourceKey"
        :row-selection="rowSelection"
        :scroll="{ x: 2000 }"
        class="k8s-table pod-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, text, record }">
          <template v-if="column.key === 'status'">
            <a-badge
              :status="getStatusColor(text)"
              :text="getStatusText(text)"
            />
          </template>
          <template v-else-if="column.key === 'phase'">
            <a-tag :color="getStatusColor(text)">
              {{ getPhaseText(text) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'ready'">
            <div class="pod-ready">
              <span class="ready-text">{{ record.ready }}</span>
              <a-progress
                v-if="record.ready && record.ready.includes('/')"
                :percent="calculateReadyPercent(record.ready)"
                size="small"
                :show-info="false"
                :status="isFullyReady(record.ready) ? 'success' : 'active'"
                style="margin-top: 4px; max-width: 80px"
              />
            </div>
          </template>
          <template v-else-if="column.key === 'restart_count'">
            <a-tag :color="text > 0 ? 'warning' : 'success'">
              {{ text || 0 }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'node_name'">
            <a-tag v-if="text" color="cyan">{{ text }}</a-tag>
            <span v-else class="k8s-no-data">-</span>
          </template>
          <template v-else-if="column.key === 'pod_ip'">
            <code v-if="text" class="pod-ip">{{ text }}</code>
            <span v-else class="k8s-no-data">-</span>
          </template>
          <template v-else-if="column.key === 'qos_class'">
            <a-tag v-if="text" :color="getQosClassColor(text)">
              {{ text }}
            </a-tag>
            <span v-else class="k8s-no-data">-</span>
          </template>
          <template v-else-if="column.key === 'labels'">
            <div class="k8s-labels-display">
              <template v-if="Array.isArray(text)">
                <!-- 数组格式 -->
                <a-tooltip
                  v-for="label in text.slice(0, 3)"
                  :key="label.key"
                  :title="`${label.key}: ${label.value}`"
                >
                  <a-tag class="k8s-label-item">
                    {{ label.key }}: {{ label.value }}
                  </a-tag>
                </a-tooltip>
                <a-tooltip
                  v-if="text.length > 3"
                  :title="
                    text
                      .map((item: any) => `${item.key}: ${item.value}`)
                      .join('\n')
                  "
                >
                  <a-tag class="k8s-label-item">
                    {{ text.length }} 个标签
                  </a-tag>
                </a-tooltip>
                <span v-if="text.length === 0" class="k8s-no-data">-</span>
              </template>
              <template v-else-if="text && typeof text === 'object'">
                <!-- 对象格式 -->
                <a-tooltip
                  v-for="[key, value] in Object.entries(text).slice(0, 3)"
                  :key="key"
                  :title="`${key}: ${value}`"
                >
                  <a-tag class="k8s-label-item"> {{ key }}: {{ value }} </a-tag>
                </a-tooltip>
                <a-tooltip
                  v-if="Object.keys(text).length > 3"
                  :title="
                    Object.entries(text)
                      .map(([k, v]: [string, any]) => `${k}: ${v}`)
                      .join('\n')
                  "
                >
                  <a-tag class="k8s-label-item">
                    {{ Object.keys(text).length }} 个标签
                  </a-tag>
                </a-tooltip>
                <span v-if="Object.keys(text).length === 0" class="k8s-no-data"
                  >-</span
                >
              </template>
              <template v-else>
                <span class="k8s-no-data">-</span>
              </template>
            </div>
          </template>
          <template v-else-if="column.key === 'annotations'">
            <div class="k8s-annotations-display">
              <template v-if="Array.isArray(text)">
                <!-- 数组格式 -->
                <a-tooltip
                  v-if="text.length > 0"
                  :title="
                    text
                      .map((item: any) => `${item.key}: ${item.value}`)
                      .join('\n')
                  "
                >
                  <a-tag class="k8s-annotation-item" color="purple">
                    {{ text.length }} 个注解
                  </a-tag>
                </a-tooltip>
                <span v-else class="k8s-no-data">-</span>
              </template>
              <template v-else-if="text && typeof text === 'object'">
                <!-- 对象格式 -->
                <a-tooltip
                  v-if="Object.keys(text).length > 0"
                  :title="
                    Object.entries(text)
                      .map(([k, v]: [string, any]) => `${k}: ${v}`)
                      .join('\n')
                  "
                >
                  <a-tag class="k8s-annotation-item" color="purple">
                    {{ Object.keys(text).length }} 个注解
                  </a-tag>
                </a-tooltip>
                <span v-else class="k8s-no-data">-</span>
              </template>
              <template v-else>
                <span class="k8s-no-data">-</span>
              </template>
            </div>
          </template>
          <template v-else-if="column.key === 'uid'">
            <a-tooltip v-if="text" :title="text">
              <span
                class="k8s-uid-text"
                style="font-family: monospace; font-size: 11px; color: #666"
              >
                {{ text.substring(0, 8) }}...
              </span>
            </a-tooltip>
            <span v-else class="k8s-no-data">-</span>
          </template>
          <template v-else-if="column.key === 'created_at'">
            <div v-if="text" style="font-size: 12px; color: #666">
              <div>{{ formatDateTime(text) }}</div>
              <div style="color: #999; font-size: 11px; margin-top: 2px">
                {{ getRelativeTime(text) }}
              </div>
            </div>
            <span v-else class="k8s-no-data">-</span>
          </template>
          <template v-else-if="column.key === 'actions'">
            <div class="k8s-action-column">
              <a-tooltip title="查看详情">
                <a-button title="查看详情" @click="showPodDetail(record)">
                  <template #icon><EyeOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="查看 YAML">
                <a-button title="查看 YAML" @click="showYamlModal(record)">
                  <template #icon>
                    <FileTextOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="查看日志">
                <a-button title="查看日志" @click="showLogsModal(record)">
                  <template #icon>
                    <FileSearchOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="can('k8s.pod.exec')" title="执行命令">
                <a-button
                  :disabled="record.status !== 'Running'"
                  title="执行命令"
                  @click="showExecModal(record)"
                >
                  <template #icon><CodeOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="端口转发">
                <a-button
                  :disabled="record.status !== 'Running'"
                  title="端口转发"
                  @click="showPortForwardModal(record)"
                >
                  <template #icon><LinkOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="文件管理">
                <a-button
                  :disabled="record.status !== 'Running'"
                  title="文件管理"
                  @click="showFileManagerModal(record)"
                >
                  <template #icon>
                    <FolderOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="编辑">
                <a-button title="编辑" @click="openEditModal(record)">
                  <template #icon><EditOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="can('k8s.pod.delete')" title="删除">
                <a-button danger title="删除" @click="deletePod(record)">
                  <template #icon>
                    <DeleteOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
            </div>
          </template>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <ContainerOutlined aria-hidden="true" />
            <p>暂无 Pod 数据</p>
            <p v-if="!filterClusterId">请先选择集群</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建 Pod 模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="创建 Pod"
      width="900px"
      @cancel="closeCreateModal"
      @ok="submitCreateForm"
    >
      <a-form
        ref="formRef"
        :model="createFormModel"
        :rules="createFormRules"
        class="k8s-form"
        layout="vertical"
      >
        <!-- 基础配置 -->
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :required="true" label="Pod 名称" name="name">
              <a-input
                v-model:value="createFormModel.name"
                :maxlength="63"
                class="k8s-form-input"
                placeholder="请输入 Pod 名称（例如：my-pod）"
              />
              <div style="color: #999; font-size: 12px; margin-top: 4px">
                只能包含小写字母、数字和连字符，且不能以连字符开头或结尾
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :required="true" label="命名空间" name="namespace">
              <a-select
                v-model:value="createFormModel.namespace"
                :disabled="!filterClusterId"
                class="k8s-form-input"
                placeholder="请选择命名空间"
              >
                <a-select-option
                  v-for="ns in namespaces"
                  :key="ns.name"
                  :value="ns.name"
                >
                  {{ ns.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 容器配置 -->
        <a-form-item :required="true" label="容器配置">
          <div class="pod-containers-config">
            <div
              v-for="(container, index) in createFormModel.containers"
              :key="index"
              class="container-config-item"
            >
              <div class="container-header">
                <span>容器 {{ index + 1 }}</span>
                <a-button
                  :disabled="createFormModel.containers.length <= 1"
                  class="k8s-remove-btn"
                  danger
                  size="small"
                  type="text"
                  @click="removeContainerField(index)"
                >
                  <template #icon>
                    <DeleteOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </div>

              <a-row :gutter="16">
                <a-col :span="8">
                  <a-form-item label="容器名称">
                    <a-input
                      v-model:value="container.name"
                      placeholder="容器名称"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item label="镜像">
                    <a-input
                      v-model:value="container.image"
                      placeholder="例如：nginx:latest"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item label="镜像拉取策略">
                    <a-select v-model:value="container.image_pull_policy">
                      <a-select-option value="Always">Always</a-select-option>
                      <a-select-option value="IfNotPresent">
                        IfNotPresent
                      </a-select-option>
                      <a-select-option value="Never">Never</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
              </a-row>

              <!-- 环境变量 -->
              <a-form-item label="环境变量">
                <div class="env-vars-config">
                  <div
                    v-for="(env, envIndex) in container.envs || []"
                    :key="envIndex"
                    class="env-var-row"
                  >
                    <a-input
                      v-model:value="env.name"
                      placeholder="环境变量名"
                      style="width: 45%"
                    />
                    <a-input
                      v-model:value="env.value"
                      placeholder="环境变量值"
                      style="width: 45%"
                    />
                    <a-button
                      class="k8s-remove-btn"
                      danger
                      size="small"
                      type="text"
                      @click="removeEnvField(index, envIndex)"
                    >
                      <template #icon>
                        <DeleteOutlined aria-hidden="true" />
                      </template>
                    </a-button>
                  </div>
                  <a-button
                    style="width: 100%; margin-top: 8px"
                    type="dashed"
                    @click="addEnvField(index)"
                  >
                    <template #icon>
                      <PlusOutlined aria-hidden="true" />
                    </template>
                    添加环境变量
                  </a-button>
                </div>
              </a-form-item>

              <!-- 端口配置 -->
              <a-form-item label="端口配置">
                <div class="ports-config">
                  <div
                    v-for="(port, portIndex) in container.ports || []"
                    :key="portIndex"
                    class="port-row"
                  >
                    <a-input
                      v-model:value="port.name"
                      placeholder="端口名称"
                      style="width: 30%"
                    />
                    <a-input-number
                      v-model:value="port.container_port"
                      :max="65535"
                      :min="1"
                      placeholder="端口号"
                      style="width: 30%"
                    />
                    <a-select
                      v-model:value="port.protocol"
                      placeholder="协议"
                      style="width: 30%"
                    >
                      <a-select-option value="TCP">TCP</a-select-option>
                      <a-select-option value="UDP">UDP</a-select-option>
                    </a-select>
                    <a-button
                      class="k8s-remove-btn"
                      danger
                      size="small"
                      type="text"
                      @click="removePortField(index, portIndex)"
                    >
                      <template #icon>
                        <DeleteOutlined aria-hidden="true" />
                      </template>
                    </a-button>
                  </div>
                  <a-button
                    style="width: 100%; margin-top: 8px"
                    type="dashed"
                    @click="addPortField(index)"
                  >
                    <template #icon>
                      <PlusOutlined aria-hidden="true" />
                    </template>
                    添加端口
                  </a-button>
                </div>
              </a-form-item>

              <!-- 资源配置 -->
              <a-form-item label="资源配置">
                <a-row :gutter="16">
                  <a-col :span="12">
                    <h5>资源请求</h5>
                    <a-row :gutter="8">
                      <a-col :span="12">
                        <a-input
                          v-model:value="container.resources!.requests.cpu"
                          placeholder="CPU (如 100m)"
                        />
                      </a-col>
                      <a-col :span="12">
                        <a-input
                          v-model:value="container.resources!.requests.memory"
                          placeholder="内存 (如 128Mi)"
                        />
                      </a-col>
                    </a-row>
                  </a-col>
                  <a-col :span="12">
                    <h5>资源限制</h5>
                    <a-row :gutter="8">
                      <a-col :span="12">
                        <a-input
                          v-model:value="container.resources!.limits.cpu"
                          placeholder="CPU (如 500m)"
                        />
                      </a-col>
                      <a-col :span="12">
                        <a-input
                          v-model:value="container.resources!.limits.memory"
                          placeholder="内存 (如 512Mi)"
                        />
                      </a-col>
                    </a-row>
                  </a-col>
                </a-row>
              </a-form-item>
            </div>

            <a-button
              style="width: 100%; margin-top: 16px"
              type="dashed"
              @click="addContainerField"
            >
              <template #icon><PlusOutlined aria-hidden="true" /></template>
              添加容器
            </a-button>
          </div>
        </a-form-item>

        <!-- Pod 配置 -->
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="重启策略">
              <a-select v-model:value="createFormModel.restart_policy">
                <a-select-option value="Always">Always</a-select-option>
                <a-select-option value="OnFailure">OnFailure</a-select-option>
                <a-select-option value="Never">Never</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="DNS 策略">
              <a-select v-model:value="createFormModel.dns_policy">
                <a-select-option value="ClusterFirst">
                  ClusterFirst
                </a-select-option>
                <a-select-option value="Default">Default</a-select-option>
                <a-select-option value="None">None</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="服务账户">
              <a-input
                v-model:value="createFormModel.service_account"
                placeholder="服务账户名称"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="网络配置">
              <a-checkbox v-model:checked="createFormModel.host_network">
                使用主机网络
              </a-checkbox>
              <a-checkbox
                v-model:checked="createFormModel.host_pid"
                style="margin-left: 16px"
              >
                使用主机PID
              </a-checkbox>
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 标签配置 -->
        <a-form-item label="标签配置（可选）" name="labels">
          <div class="k8s-key-value-inputs">
            <div
              v-if="
                !createFormModel.labels ||
                Object.keys(createFormModel.labels).length === 0
              "
              style="text-align: center; color: #999; padding: 16px"
            >
              暂无标签，点击下方按钮添加
            </div>
            <div
              v-for="(_, key) in createFormModel.labels"
              :key="key"
              class="k8s-key-value-row"
            >
              <a-input
                :placeholder="`标签键: ${key}`"
                :value="key"
                class="k8s-form-input"
                disabled
              />
              <a-input
                v-model:value="createFormModel.labels[key]"
                :maxlength="200"
                class="k8s-form-input"
                placeholder="标签值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeLabelField(key)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px">
              <a-input
                v-model:value="newLabelKey"
                placeholder="输入标签键"
                style="flex: 1; margin-right: 8px"
                @press-enter="addNewLabel"
              />
              <a-button
                type="primary"
                @click="addNewLabel"
                :disabled="!newLabelKey.trim()"
              >
                <template #icon><PlusOutlined aria-hidden="true" /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <!-- 注解配置 -->
        <a-form-item label="注解配置（可选）" name="annotations">
          <div class="k8s-key-value-inputs">
            <div
              v-if="
                !createFormModel.annotations ||
                Object.keys(createFormModel.annotations).length === 0
              "
              style="text-align: center; color: #999; padding: 16px"
            >
              暂无注解，点击下方按钮添加
            </div>
            <div
              v-for="(_, key) in createFormModel.annotations"
              :key="key"
              class="k8s-key-value-row"
            >
              <a-input
                :placeholder="`注解键: ${key}`"
                :value="key"
                class="k8s-form-input"
                disabled
              />
              <a-input
                v-model:value="createFormModel.annotations[key]"
                :maxlength="500"
                class="k8s-form-input"
                placeholder="注解值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeAnnotationField(key)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px">
              <a-input
                v-model:value="newAnnotationKey"
                placeholder="输入注解键"
                style="flex: 1; margin-right: 8px"
                @press-enter="addNewAnnotation"
              />
              <a-button
                type="primary"
                @click="addNewAnnotation"
                :disabled="!newAnnotationKey.trim()"
              >
                <template #icon><PlusOutlined aria-hidden="true" /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 通过 YAML 创建 Pod 模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="通过 YAML 创建 Pod"
      width="900px"
      @cancel="closeCreateYamlModal"
      @ok="submitCreateYamlForm"
    >
      <a-form
        ref="createYamlFormRef"
        :model="createYamlFormModel"
        :rules="createYamlFormRules"
        class="k8s-form"
        layout="vertical"
      >
        <a-form-item name="yaml">
          <div class="yaml-toolbar">
            <a-button
              class="yaml-toolbar-btn yaml-btn-template"
              @click="insertYamlTemplate"
            >
              <template #icon><FileAddOutlined aria-hidden="true" /></template>
              插入模板
            </a-button>
            <a-button
              class="yaml-toolbar-btn yaml-btn-format"
              @click="formatYaml"
            >
              <template #icon>
                <FormatPainterOutlined aria-hidden="true" />
              </template>
              格式化
            </a-button>
            <a-button
              class="yaml-toolbar-btn yaml-btn-validate"
              @click="validateYaml"
            >
              <template #icon>
                <CheckCircleOutlined aria-hidden="true" />
              </template>
              检查格式
            </a-button>
            <a-button
              class="yaml-toolbar-btn yaml-btn-clear"
              @click="clearYaml"
            >
              <template #icon><ClearOutlined aria-hidden="true" /></template>
              清空
            </a-button>
          </div>
          <a-textarea
            v-model:value="createYamlFormModel.yaml"
            :rows="20"
            class="k8s-config-textarea"
            placeholder="请输入 Pod YAML 内容，或点击【插入模板】使用默认模板"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      :footer="null"
      :maskClosable="false"
      destroyOnClose
      title="Pod 详情"
      width="1200px"
      @cancel="closeDetailModal"
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentPodDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="基本信息">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">Pod 名称:</span>
                  <span class="k8s-detail-value">{{
                    currentPodDetail.name
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间:</span>
                  <span class="k8s-detail-value">{{
                    currentPodDetail.namespace
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">状态:</span>
                  <a-badge
                    :status="getStatusColor(currentPodDetail.status)"
                    :text="getStatusText(currentPodDetail.status)"
                  />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">阶段:</span>
                  <a-tag :color="getStatusColor(currentPodDetail.phase)">
                    {{ getPhaseText(currentPodDetail.phase) }}
                  </a-tag>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">集群ID:</span>
                  <span class="k8s-detail-value">{{
                    currentPodDetail.cluster_id
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{
                    currentPodDetail.uid || '-'
                  }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="运行信息">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">节点名称:</span>
                  <span class="k8s-detail-value">{{
                    currentPodDetail.node_name || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">Pod IP:</span>
                  <code class="k8s-detail-value">{{
                    currentPodDetail.pod_ip || '-'
                  }}</code>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">宿主机IP:</span>
                  <code class="k8s-detail-value">{{
                    currentPodDetail.host_ip || '-'
                  }}</code>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">QoS等级:</span>
                  <a-tag :color="getQosClassColor(currentPodDetail.qos_class)">
                    {{ currentPodDetail.qos_class || '-' }}
                  </a-tag>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">重启次数:</span>
                  <a-tag
                    :color="
                      currentPodDetail.restart_count > 0 ? 'warning' : 'success'
                    "
                  >
                    {{ currentPodDetail.restart_count || 0 }}
                  </a-tag>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">就绪状态:</span>
                  <span class="k8s-detail-value">{{
                    currentPodDetail.ready || '-'
                  }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="配置信息">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">服务账户:</span>
                  <span class="k8s-detail-value">{{
                    currentPodDetail.service_account || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">重启策略:</span>
                  <span class="k8s-detail-value">{{
                    currentPodDetail.restart_policy || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">DNS策略:</span>
                  <span class="k8s-detail-value">{{
                    currentPodDetail.dns_policy || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">资源版本:</span>
                  <span class="k8s-detail-value">{{
                    currentPodDetail.resource_version || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">生成版本号:</span>
                  <span class="k8s-detail-value">{{
                    currentPodDetail.generation || '-'
                  }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="时间信息">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">创建时间:</span>
                  <span class="k8s-detail-value">{{
                    formatK8sTime(currentPodDetail.created_at)
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">启动时间:</span>
                  <span class="k8s-detail-value">{{
                    formatK8sTime(currentPodDetail.start_time)
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">删除时间:</span>
                  <span class="k8s-detail-value">{{
                    formatK8sTime(currentPodDetail.deleted_at)
                  }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="标签信息">
                <div class="k8s-labels-display">
                  <a-tooltip
                    v-for="label in currentPodDetail.labels || []"
                    :key="label.key"
                    :title="`${label.key}: ${label.value}`"
                    placement="top"
                  >
                    <a-tag
                      class="k8s-label-item"
                      style="
                        margin-bottom: 8px;
                        max-width: 200px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                      "
                    >
                      {{ label.key }}: {{ label.value }}
                    </a-tag>
                  </a-tooltip>
                  <span
                    v-if="
                      !currentPodDetail.labels ||
                      currentPodDetail.labels.length === 0
                    "
                    class="k8s-no-data"
                  >
                    暂无标签
                  </span>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="注解信息">
                <div class="k8s-annotations-display">
                  <a-tooltip
                    v-for="annotation in currentPodDetail.annotations || []"
                    :key="annotation.key"
                    :title="`${annotation.key}: ${annotation.value}`"
                    placement="top"
                  >
                    <a-tag
                      class="k8s-annotation-item"
                      style="
                        margin-bottom: 8px;
                        max-width: 200px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                      "
                    >
                      {{ annotation.key }}: {{ annotation.value }}
                    </a-tag>
                  </a-tooltip>
                  <span
                    v-if="
                      !currentPodDetail.annotations ||
                      currentPodDetail.annotations.length === 0
                    "
                    class="k8s-no-data"
                  >
                    暂无注解
                  </span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <!-- 容器信息 -->
          <a-row :gutter="[24, 16]" style="margin-top: 16px">
            <a-col :span="24">
              <a-card class="k8s-detail-card" size="small" title="容器信息">
                <a-table
                  :data-source="currentPodDetail.containers || []"
                  :pagination="false"
                  class="k8s-table"
                  size="small"
                >
                  <a-table-column
                    key="name"
                    dataIndex="name"
                    title="容器名称"
                  />
                  <a-table-column key="image" dataIndex="image" title="镜像" />
                  <a-table-column key="ready" dataIndex="ready" title="状态">
                    <template #default="{ text }">
                      <a-tag :color="text ? 'success' : 'error'">
                        {{ text ? '就绪' : '未就绪' }}
                      </a-tag>
                    </template>
                  </a-table-column>
                  <a-table-column
                    key="restart_count"
                    dataIndex="restart_count"
                    title="重启次数"
                  />
                </a-table>
              </a-card>
            </a-col>
          </a-row>
        </div>
      </a-spin>
    </a-modal>

    <!-- YAML 模态框 -->
    <a-modal
      v-model:open="isYamlModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      :title="`查看/编辑 ${currentOperationPod?.name} YAML`"
      cancelText="取消"
      destroyOnClose
      okText="保存修改"
      width="900px"
      @cancel="closeYamlModal"
      @ok="submitYamlForm"
    >
      <a-form
        ref="yamlFormRef"
        :model="yamlFormModel"
        :rules="yamlFormRules"
        class="k8s-form"
        layout="vertical"
      >
        <a-form-item name="yaml">
          <div class="yaml-toolbar">
            <a-button
              class="yaml-toolbar-btn yaml-btn-format"
              @click="formatEditYaml"
            >
              <template #icon>
                <FormatPainterOutlined aria-hidden="true" />
              </template>
              格式化
            </a-button>
            <a-button
              class="yaml-toolbar-btn yaml-btn-validate"
              @click="validateEditYaml"
            >
              <template #icon>
                <CheckCircleOutlined aria-hidden="true" />
              </template>
              检查格式
            </a-button>
          </div>
          <a-textarea
            v-model:value="yamlFormModel.yaml"
            :rows="20"
            class="k8s-config-textarea"
            placeholder="YAML 内容"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑 Pod 模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="保存"
      title="编辑 Pod"
      width="800px"
      @cancel="closeEditModal"
      @ok="submitEditForm"
    >
      <a-form
        ref="formRef"
        :model="editFormModel"
        class="k8s-form"
        layout="vertical"
      >
        <a-alert
          description="Pod 创建后只能编辑标签和注解信息，其他配置需要重新创建 Pod。"
          message="编辑提示"
          show-icon
          style="margin-bottom: 24px"
          type="info"
        />

        <!-- 标签配置 -->
        <a-form-item label="标签配置" name="labels">
          <div class="k8s-key-value-inputs">
            <div
              v-if="
                !editFormModel.labels ||
                Object.keys(editFormModel.labels).length === 0
              "
              style="text-align: center; color: #999; padding: 16px"
            >
              暂无标签，点击下方按钮添加
            </div>
            <div
              v-for="(_, key) in editFormModel.labels"
              :key="key"
              class="k8s-key-value-row"
            >
              <a-input
                :placeholder="`标签键: ${key}`"
                :value="key"
                class="k8s-form-input"
                disabled
              />
              <a-input
                v-model:value="editFormModel.labels[key]"
                :maxlength="200"
                class="k8s-form-input"
                placeholder="标签值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeEditLabelField(key)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px">
              <a-input
                v-model:value="newEditLabelKey"
                placeholder="输入标签键"
                style="flex: 1; margin-right: 8px"
                @press-enter="addNewEditLabel"
              />
              <a-button
                type="primary"
                @click="addNewEditLabel"
                :disabled="!newEditLabelKey.trim()"
              >
                <template #icon><PlusOutlined aria-hidden="true" /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <!-- 注解配置 -->
        <a-form-item label="注解配置" name="annotations">
          <div class="k8s-key-value-inputs">
            <div
              v-if="
                !editFormModel.annotations ||
                Object.keys(editFormModel.annotations).length === 0
              "
              style="text-align: center; color: #999; padding: 16px"
            >
              暂无注解，点击下方按钮添加
            </div>
            <div
              v-for="(_, key) in editFormModel.annotations"
              :key="key"
              class="k8s-key-value-row"
            >
              <a-input
                :placeholder="`注解键: ${key}`"
                :value="key"
                class="k8s-form-input"
                disabled
              />
              <a-input
                v-model:value="editFormModel.annotations[key]"
                :maxlength="500"
                class="k8s-form-input"
                placeholder="注解值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeEditAnnotationField(key)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px">
              <a-input
                v-model:value="newEditAnnotationKey"
                placeholder="输入注解键"
                style="flex: 1; margin-right: 8px"
                @press-enter="addNewEditAnnotation"
              />
              <a-button
                type="primary"
                @click="addNewEditAnnotation"
                :disabled="!newEditAnnotationKey.trim()"
              >
                <template #icon><PlusOutlined aria-hidden="true" /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 日志查看模态框 -->
    <a-modal
      v-model:open="isLogsModalVisible"
      :footer="null"
      :maskClosable="false"
      :title="`${currentOperationPod?.name} 日志`"
      destroyOnClose
      width="1000px"
      @cancel="closeLogsModal"
    >
      <div class="pod-logs-content">
        <div class="logs-controls">
          <a-row :gutter="16" style="margin-bottom: 16px">
            <a-col :span="6">
              <a-select
                v-model:value="logsFormModel.container"
                placeholder="选择容器"
              >
                <a-select-option
                  v-for="container in podContainers"
                  :key="container.name"
                  :value="container.name"
                >
                  {{ container.name }}
                </a-select-option>
              </a-select>
            </a-col>
            <a-col :span="4">
              <a-input-number
                v-model:value="logsFormModel.tail_lines"
                :max="10000"
                :min="1"
                placeholder="行数"
              />
            </a-col>
            <a-col :span="6">
              <a-checkbox v-model:checked="logsFormModel.timestamps">
                显示时间戳
              </a-checkbox>
              <a-checkbox
                v-model:checked="logsFormModel.previous"
                style="margin-left: 16px"
              >
                前一个容器
              </a-checkbox>
            </a-col>
            <a-col :span="14">
              <!-- 实时流按钮 -->
              <a-button
                v-if="!isLogsStreaming"
                :disabled="!logsFormModel.container"
                :loading="logsLoading"
                type="primary"
                @click="fetchPodLogs"
              >
                <template #icon>
                  <PlayCircleOutlined aria-hidden="true" />
                </template>
                开始实时流
              </a-button>
              <a-button v-else danger type="primary" @click="stopLogsStream">
                <template #icon>
                  <PauseCircleOutlined aria-hidden="true" />
                </template>
                停止实时流
              </a-button>

              <a-button style="margin-left: 8px" @click="podLogs = ''">
                <template #icon><ClearOutlined aria-hidden="true" /></template>
                清空
              </a-button>
            </a-col>
          </a-row>
        </div>

        <!-- 连接状态栏 -->
        <div class="logs-status-bar">
          <a-row align="middle" justify="space-between">
            <a-col>
              <a-space>
                <a-badge
                  :status="isLogsStreaming ? 'processing' : 'default'"
                  :text="isLogsStreaming ? '实时连接中' : '未连接'"
                />
                <span v-if="isLogsStreaming" class="streaming-indicator">
                  <ReloadOutlined aria-hidden="true" spin /> 正在监听日志...
                </span>
              </a-space>
            </a-col>
            <a-col>
              <span class="logs-count">
                日志行数:
                {{ podLogs.split('\n').filter((line) => line.trim()).length }}
              </span>
            </a-col>
          </a-row>
        </div>

        <div class="logs-display">
          <pre
            class="logs-content"
            :class="{ 'streaming-logs': isLogsStreaming }"
            v-show="podLogs || isLogsStreaming"
            >{{ podLogs || '正在连接...' }}</pre
          >

          <!-- 空状态提示 -->
          <div v-show="!podLogs && !isLogsStreaming" class="logs-empty-state">
            <div class="empty-text">
              <p>暂无日志数据</p>
              <p>请选择容器并点击"开始实时流"按钮</p>
            </div>
          </div>
        </div>
      </div>
    </a-modal>

    <!-- 执行命令模态框 - 终端版本 -->
    <a-modal
      v-model:open="isExecModalVisible"
      :footer="null"
      :maskClosable="false"
      class="terminal-modal"
      destroyOnClose
      title="Pod 终端"
      width="1200px"
      @cancel="closeExecModal"
    >
      <div class="terminal-container">
        <!-- 连接配置区域 -->
        <div v-if="!isTerminalConnected" class="terminal-config">
          <a-form
            ref="execFormRef"
            :model="execFormModel"
            :rules="execFormRules"
            class="k8s-form"
            layout="inline"
          >
            <a-form-item :required="true" label="容器" name="container">
              <a-select
                v-model:value="execFormModel.container"
                placeholder="选择容器"
                style="width: 200px"
              >
                <a-select-option
                  v-for="container in podContainers"
                  :key="container.name"
                  :value="container.name"
                >
                  {{ container.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="Shell" name="shell">
              <a-select
                v-model:value="execFormModel.shell"
                style="width: 150px"
              >
                <a-select-option value="/bin/bash">/bin/bash</a-select-option>
                <a-select-option value="/bin/sh">/bin/sh</a-select-option>
                <a-select-option value="/bin/zsh">/bin/zsh</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item>
              <a-button
                v-if="can('k8s.pod.exec')"
                type="primary"
                @click="connectToTerminal"
                :loading="terminalLoading"
                :disabled="!execFormModel.container"
              >
                <template #icon>
                  <PlayCircleOutlined aria-hidden="true" />
                </template>
                连接终端
              </a-button>
            </a-form-item>
          </a-form>
        </div>

        <!-- 连接状态栏 -->
        <div
          v-if="isTerminalConnected || terminalLoading"
          class="terminal-status-bar"
        >
          <a-row align="middle" justify="space-between">
            <a-col>
              <a-space>
                <a-badge
                  :status="
                    isTerminalConnected
                      ? 'processing'
                      : terminalLoading
                        ? 'default'
                        : 'error'
                  "
                  :text="
                    isTerminalConnected
                      ? '已连接'
                      : terminalLoading
                        ? '连接中...'
                        : '未连接'
                  "
                />
                <span v-if="isTerminalConnected" class="connection-info">
                  <CodeOutlined aria-hidden="true" />
                  {{ execFormModel.container }} ({{ execFormModel.shell }})
                </span>
                <span v-if="terminalLoading" class="connecting-indicator">
                  <ReloadOutlined aria-hidden="true" spin /> 正在建立连接...
                </span>
              </a-space>
            </a-col>
            <a-col>
              <a-space>
                <a-button
                  v-if="isTerminalConnected"
                  danger
                  size="small"
                  type="text"
                  @click="disconnectTerminal"
                >
                  <template #icon>
                    <DisconnectOutlined aria-hidden="true" />
                  </template>
                  断开连接
                </a-button>
                <a-tooltip
                  title="终端支持完整的Shell交互，包括vi/nano编辑器、tab补全等"
                >
                  <a-button size="small" type="text">
                    <template #icon>
                      <QuestionCircleOutlined aria-hidden="true" />
                    </template>
                  </a-button>
                </a-tooltip>
              </a-space>
            </a-col>
          </a-row>
        </div>

        <!-- 终端显示区域 -->
        <div class="terminal-display">
          <div
            v-show="isTerminalConnected || terminalLoading"
            id="terminal-container"
            class="terminal-wrapper"
          ></div>

          <!-- 未连接状态提示 -->
          <div
            v-show="!isTerminalConnected && !terminalLoading"
            class="terminal-empty-state"
          >
            <div class="empty-text">
              <p>Pod 终端未连接</p>
              <p>请选择容器和Shell类型，然后点击"连接终端"按钮</p>
            </div>
          </div>

          <!-- 连接中状态 -->
          <div v-show="terminalLoading" class="terminal-loading-state">
            <div class="loading-icon">
              <a-spin size="large" />
            </div>
            <div class="loading-text">
              <p>正在连接到 Pod 终端...</p>
              <p>容器: {{ execFormModel.container }}</p>
            </div>
          </div>
        </div>
      </div>
    </a-modal>

    <!-- 端口转发模态框 -->
    <a-modal
      v-model:open="isPortForwardModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="设置转发"
      title="端口转发"
      width="600px"
      @cancel="closePortForwardModal"
      @ok="submitPortForward"
    >
      <div class="port-forward-config">
        <div
          v-for="(port, index) in portForwardFormModel.ports"
          :key="index"
          class="port-forward-row"
        >
          <a-input-number
            v-model:value="port.local_port"
            :max="65535"
            :min="1"
            placeholder="本地端口"
            style="width: 40%"
          />
          <span style="margin: 0 16px">→</span>
          <a-input-number
            v-model:value="port.remote_port"
            :max="65535"
            :min="1"
            placeholder="容器端口"
            style="width: 40%"
          />
          <a-button
            :disabled="portForwardFormModel.ports.length <= 1"
            class="k8s-remove-btn"
            danger
            size="small"
            type="text"
            @click="removePortForwardField(index)"
          >
            <template #icon><DeleteOutlined aria-hidden="true" /></template>
          </a-button>
        </div>
        <a-button
          style="width: 100%; margin-top: 16px"
          type="dashed"
          @click="addPortForwardField"
        >
          <template #icon><PlusOutlined aria-hidden="true" /></template>
          添加端口转发
        </a-button>
      </div>
    </a-modal>

    <!-- 文件管理模态框 -->
    <a-modal
      v-model:open="isFileManagerModalVisible"
      :footer="null"
      :maskClosable="false"
      destroyOnClose
      title="文件管理"
      width="900px"
      @cancel="handleCloseFileManagerModal"
    >
      <div class="file-manager-content">
        <a-alert
          description="此功能需要在 Pod 运行状态下使用，支持文件上传和下载操作。"
          message="文件管理功能"
          show-icon
          style="margin-bottom: 16px"
          type="info"
        />

        <!-- 容器选择 -->
        <div
          class="file-manager-container-selection"
          style="margin-bottom: 24px"
        >
          <h4 style="margin-bottom: 12px">选择容器</h4>
          <a-select
            v-model:value="fileManagerContainer"
            :disabled="!podContainers || podContainers.length === 0"
            placeholder="请选择容器"
            style="width: 100%"
            @change="handleContainerChange"
          >
            <a-select-option
              v-for="container in podContainers"
              :key="container.name"
              :value="container.name"
            >
              <div
                style="
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                "
              >
                <span>{{ container.name }}</span>
                <a-tag
                  :color="container.ready ? 'success' : 'error'"
                  size="small"
                >
                  {{ container.ready ? '就绪' : '未就绪' }}
                </a-tag>
              </div>
            </a-select-option>
          </a-select>
        </div>

        <!-- 文件上传区域 -->
        <div v-if="fileManagerContainer" class="file-upload-section">
          <h4 style="margin-bottom: 12px">文件上传</h4>

          <a-form layout="vertical" style="margin-bottom: 16px">
            <a-form-item label="目标路径" required>
              <a-input
                v-model:value="uploadFilePath"
                :maxlength="500"
                placeholder="请输入文件上传的目标路径，如：/tmp 或 /app/data"
              />
              <div style="color: #999; font-size: 12px; margin-top: 4px">
                文件将上传到容器中的此路径下，请确保路径存在且有写入权限
              </div>
            </a-form-item>
          </a-form>

          <!-- 文件上传组件 -->
          <a-upload-dragger
            :before-upload="beforeUpload"
            :disabled="
              !uploadFilePath || !fileManagerContainer || uploadLoading
            "
            :file-list="fileList"
            :multiple="true"
            :remove="handleRemoveFile"
            style="margin-bottom: 16px"
          >
            <p class="ant-upload-drag-icon">
              <UploadOutlined
                aria-hidden="true"
                style="font-size: 48px; color: #1890ff"
              />
            </p>
            <p class="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p class="ant-upload-hint">
              支持单个或批量上传。请确保目标路径存在且容器有写入权限。
            </p>
          </a-upload-dragger>

          <!-- 上传按钮 -->
          <div style="text-align: center; margin-bottom: 24px">
            <a-button
              :disabled="
                fileList.length === 0 ||
                !uploadFilePath ||
                !fileManagerContainer
              "
              :loading="uploadLoading"
              size="large"
              type="primary"
              @click="handleUploadFiles"
            >
              <template #icon><UploadOutlined aria-hidden="true" /></template>
              上传文件 ({{ fileList.length }})
            </a-button>
            <a-button
              :disabled="fileList.length === 0 || uploadLoading"
              style="margin-left: 8px"
              @click="clearFileList"
            >
              <template #icon><ClearOutlined aria-hidden="true" /></template>
              清空列表
            </a-button>
          </div>

          <!-- 上传进度 -->
          <div
            v-if="uploadProgress.show"
            class="upload-progress"
            style="margin-bottom: 16px"
          >
            <div style="margin-bottom: 8px">
              <span
                >上传进度: {{ uploadProgress.current }}/{{
                  uploadProgress.total
                }}</span
              >
            </div>
            <a-progress
              :percent="uploadProgress.percent"
              :show-info="true"
              :status="uploadProgress.status"
            />
            <div
              v-if="uploadProgress.currentFile"
              style="color: #666; font-size: 12px; margin-top: 4px"
            >
              正在上传: {{ uploadProgress.currentFile }}
            </div>
          </div>
        </div>

        <!-- 文件下载区域 -->
        <div v-if="fileManagerContainer" class="file-download-section">
          <a-divider />
          <h4 style="margin-bottom: 12px">文件下载</h4>

          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item label="文件路径">
              <a-input
                v-model:value="downloadFilePath"
                :maxlength="500"
                placeholder="请输入要下载的文件完整路径，如：/tmp/file.txt"
                style="width: 400px"
              />
            </a-form-item>
            <a-form-item>
              <a-button
                :disabled="!downloadFilePath || !fileManagerContainer"
                :loading="downloadLoading"
                type="primary"
                @click="handleDownloadFile"
              >
                <template #icon>
                  <DownloadOutlined aria-hidden="true" />
                </template>
                下载文件
              </a-button>
            </a-form-item>
          </a-form>

          <div style="color: #999; font-size: 12px">
            请输入容器中文件的完整路径。下载的文件将保存到您的下载文件夹中。
          </div>
        </div>

        <!-- 无容器提示 -->
        <div
          v-if="!fileManagerContainer"
          class="no-container-selected"
          style="text-align: center; padding: 40px; color: #999"
        >
          <p>请先选择一个容器来进行文件管理操作</p>
        </div>
      </div>
    </a-modal>

    <!-- 标签过滤模态框 -->
    <a-modal
      v-model:open="isLabelsFilterModalVisible"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="应用过滤"
      title="标签过滤设置"
      width="550px"
      @cancel="closeLabelsFilterModal"
      @ok="applyLabelsFilter"
    >
      <div class="labels-filter-form">
        <div
          class="current-filters"
          v-if="Object.keys(filterLabels).length > 0"
        >
          <h4>当前过滤条件：</h4>
          <div class="filter-tags">
            <a-tag
              v-for="(value, key) in filterLabels"
              :key="key"
              closable
              color="blue"
              style="margin-right: 8px; margin-bottom: 8px"
              @close="removeFilterLabel(key)"
            >
              {{ key }}: {{ value }}
            </a-tag>
          </div>
          <a-button
            danger
            style="padding: 0; margin-bottom: 16px"
            type="link"
            @click="clearFilterLabels"
          >
            清除所有过滤条件
          </a-button>
        </div>

        <div class="add-filter-section">
          <h4>添加过滤条件</h4>
          <div class="filter-input-row" style="gap: 8px">
            <a-input
              v-model:value="newFilterKey"
              placeholder="标签键"
              style="flex: 1"
            />
            <a-input
              v-model:value="newFilterValue"
              placeholder="标签值"
              style="flex: 1"
            />
            <a-button
              type="primary"
              @click="addNewFilterLabel"
              :disabled="!newFilterKey.trim()"
              size="small"
            >
              <template #icon><PlusOutlined aria-hidden="true" /></template>
            </a-button>
          </div>
        </div>
      </div>
    </a-modal>
  </OpsPage>
</template>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./Pod.css"></style>
