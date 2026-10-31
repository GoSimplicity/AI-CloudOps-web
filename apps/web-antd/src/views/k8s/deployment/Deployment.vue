<script lang="ts" setup>
import OpsPage from '#/components/ops/OpsPage.vue';
import { namespacedResourceKey } from '../shared/utils';
import { onMounted, ref } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { useDeploymentPage } from './Deployment';
import { rollbackDeploymentApi } from '#/api/core/k8s/k8s_deployment';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  ContainerOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  EditOutlined,
  ExpandOutlined,
  EyeOutlined,
  FileAddOutlined,
  FileTextOutlined,
  FilterOutlined,
  FormatPainterOutlined,
  HistoryOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RedoOutlined,
  ReloadOutlined,
  SearchOutlined,
  TagsOutlined,
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
  isScaleModalVisible,
  isYamlModalVisible,
  isPodModalVisible,
  isHistoryModalVisible,
  submitLoading,
  detailLoading,

  // operation targets
  currentOperationDeployment,
  currentDeploymentDetail,
  deploymentPods,
  deploymentHistory,

  // form models
  createFormModel,
  editFormModel,
  createYamlFormModel,
  scaleFormModel,
  yamlFormModel,

  // form refs
  formRef,
  editFormRef,
  scaleFormRef,
  yamlFormRef,
  createYamlFormRef,

  // form rules
  createFormRules,
  editFormRules,
  scaleFormRules,
  yamlFormRules,
  createYamlFormRules,

  // computed
  filteredDeployments,
  rowSelection,

  // helpers
  getEnvText,
  getStatusText,
  getStatusColor,

  // operations
  fetchClusters,
  fetchNamespaces,
  fetchDeployments,
  clearDeployments,
  clearNamespaces,
  loadMoreClusters,
  loadMoreNamespaces,

  // detail operations
  showDeploymentDetail,
  closeDetailModal,

  // YAML operations
  showYamlModal,
  closeYamlModal,
  submitYamlForm,

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

  // deployment operations
  deleteDeployment,
  restartDeployment,
  pauseDeployment,
  resumeDeployment,

  // scale operations
  openScaleModal,
  closeScaleModal,
  submitScaleForm,

  // pod operations
  showPodModal,
  closePodModal,

  // history operations
  showHistoryModal,
  closeHistoryModal,

  // filter operations
  addFilterLabel,
  removeFilterLabel,
  clearFilterLabels,

  // batch operations
  batchOperation,

  // pagination operations
  handlePageChange,

  // form field operations
  addImageField,
  removeImageField,
  removeLabelField,
  removeAnnotationField,

  // yaml operations
  insertYamlTemplate,
  formatYaml,
  validateYaml,
  clearYaml,
  formatEditYaml,
  validateEditYaml,

  // constants
  K8sDeploymentStatus,
} = useDeploymentPage();

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

// 编辑表单的辅助函数
const addEditImageField = () => {
  editFormModel.value.images.push('');
};

const removeEditImageField = (index: number) => {
  if (editFormModel.value.images.length > 1) {
    editFormModel.value.images.splice(index, 1);
  }
};

const removeEditLabelField = (key: string) => {
  delete editFormModel.value.labels[key];
};

const removeEditAnnotationField = (key: string) => {
  delete editFormModel.value.annotations[key];
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

// 时间格式化函数
const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// 相对时间函数
const getRelativeTime = (dateStr: string) => {
  if (!dateStr) return '';
  const now = new Date().getTime();
  const past = new Date(dateStr).getTime();
  const diff = now - past;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years}年前`;
  if (months > 0) return `${months}个月前`;
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  if (seconds > 0) return `${seconds}秒前`;
  return '刚刚';
};

const onSearch = () => {
  currentPage.value = 1;
  fetchDeployments();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchDeployments();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearNamespaces();
  clearDeployments();

  if (filterClusterId.value) {
    fetchNamespaces(true); // 重置命名空间分页
    fetchDeployments();
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
    title: '部署策略',
    key: 'strategyDetails',
    width: 180,
    align: 'center',
  },
  {
    title: '镜像',
    dataIndex: 'images',
    key: 'images',
    width: 200,
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
    title: '选择器',
    dataIndex: 'selector',
    key: 'selector',
    width: 150,
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
    width: 450,
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
  clearDeployments();
  clearNamespaces();
  message.success('已重置所有筛选条件');
};

// 快速回滚到指定版本
const rollbackToVersion = (revision: number) => {
  if (!currentOperationDeployment.value) return;

  Modal.confirm({
    title: '回滚确认',
    content: `确定要将 Deployment "${currentOperationDeployment.value.name}" 回滚到版本 ${revision} 吗？`,
    okText: '确认回滚',
    okType: 'primary',
    cancelText: '取消',
    centered: true,
    onOk: async () => {
      try {
        const clusterId =
          currentOperationDeployment.value!.cluster_id || filterClusterId.value;
        if (!clusterId || clusterId === 0) {
          message.error('无效的集群ID，请重新选择集群');
          return;
        }

        await rollbackDeploymentApi(
          clusterId,
          currentOperationDeployment.value!.namespace,
          currentOperationDeployment.value!.name,
          { revision },
        );
        message.success(`Deployment 回滚到版本 ${revision} 成功`);
        closeHistoryModal();
        await fetchDeployments();
      } catch (err) {
        if (shouldNotifyPageError(err))
          message.error(`Deployment 回滚到版本 ${revision} 失败`);
      }
    },
  });
};

onMounted(async () => {
  await fetchClusters();
});
</script>

<template>
  <OpsPage
    description="按集群和命名空间查询与维护 Deployment"
    title="Deployment 管理"
  >
    <!-- 页面头部 -->
    <template #actions>
      <a-button
        :disabled="!filterClusterId"
        type="primary"
        @click="openCreateModal"
      >
        <template #icon><PlusOutlined aria-hidden="true" /></template>
        创建 Deployment
      </a-button>
      <a-button
        :disabled="!filterClusterId"
        :loading="loading"
        @click="fetchDeployments"
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
              <DeploymentUnitOutlined aria-hidden="true" />
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
            <a-select-option :value="K8sDeploymentStatus.Running">
              运行中
            </a-select-option>
            <a-select-option :value="K8sDeploymentStatus.Stopped">
              已停止
            </a-select-option>
            <a-select-option :value="K8sDeploymentStatus.Paused">
              已暂停
            </a-select-option>
            <a-select-option :value="K8sDeploymentStatus.Error">
              异常
            </a-select-option>
          </a-select>

          <!-- 标签过滤器 -->
          <div class="k8s-labels-filter">
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
            placeholder="搜索 Deployment 名称"
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
            title="通过YAML创建Deployment"
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
            v-if="can('k8s.deployment.batchDelete') && selectedRows.length > 0"
            class="k8s-toolbar-btn"
            title="批量删除选中的 Deployment"
          >
            <template #icon><DeleteOutlined aria-hidden="true" /></template>
            删除 ({{ selectedRows.length }})
          </a-button>

          <a-button
            v-if="selectedRows.length > 0"
            :disabled="!selectedRows.length"
            class="k8s-toolbar-btn"
            title="批量重启选中的 Deployment"
            @click="() => batchOperation('重启')"
          >
            <template #icon><RedoOutlined aria-hidden="true" /></template>
            重启 ({{ selectedRows.length }})
          </a-button>
        </div>
      </div>
    </template>

    <!-- 数据展示区域 -->
    <a-alert v-if="loadError" :message="loadError" show-icon type="error">
      <template #action>
        <a-button size="small" @click="fetchDeployments"> 重试 </a-button>
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
        :data-source="filteredDeployments"
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
        :scroll="{ x: 2080 }"
        class="k8s-table deployment-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, text, record }">
          <template v-if="column.key === 'status'">
            <a-badge
              :status="getStatusColor(text)"
              :text="getStatusText(text)"
            />
          </template>
          <template v-else-if="column.key === 'strategyDetails'">
            <div
              class="k8s-strategy-display"
              style="
                display: flex;
                flex-direction: column;
                gap: 4px;
                font-size: 12px;
              "
            >
              <div v-if="record.strategy">
                <a-tag color="geekblue">{{ record.strategy }}</a-tag>
              </div>
              <div
                v-if="record.max_unavailable"
                style="display: flex; align-items: center; gap: 4px"
              >
                <span style="color: #999">不可用:</span>
                <a-tag color="orange" size="small">
                  {{ record.max_unavailable }}
                </a-tag>
              </div>
              <div
                v-if="record.max_surge"
                style="display: flex; align-items: center; gap: 4px"
              >
                <span style="color: #999">超出:</span>
                <a-tag color="cyan" size="small">{{ record.max_surge }}</a-tag>
              </div>
              <span
                v-if="
                  !record.strategy &&
                  !record.max_unavailable &&
                  !record.max_surge
                "
                class="k8s-no-data"
                >-</span>
            </div>
          </template>
          <template v-else-if="column.key === 'images'">
            <div class="k8s-images-display">
              <a-tag
                v-for="(image, index) in (Array.isArray(text)
                  ? text
                  : []
                ).slice(0, 2)"
                :key="index"
                class="k8s-image-tag"
              >
                {{ image.split('/').pop()?.split(':')[0] || image }}
              </a-tag>
              <a-tooltip
                v-if="(Array.isArray(text) ? text : []).length > 2"
                :title="(Array.isArray(text) ? text : []).join('\n')"
              >
                <a-tag class="k8s-image-tag">
                  +{{ (Array.isArray(text) ? text : []).length - 2 }} 更多
                </a-tag>
              </a-tooltip>
              <span
                v-if="!text || !Array.isArray(text) || text.length === 0"
                class="k8s-no-data"
                >-</span>
            </div>
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
                <span v-if="Object.keys(text).length === 0" class="k8s-no-data">-</span>
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
          <template v-else-if="column.key === 'selector'">
            <div class="k8s-selector-display">
              <template v-if="text && typeof text === 'object'">
                <a-tooltip
                  v-if="Object.keys(text).length > 0"
                  :title="
                    Object.entries(text)
                      .map(([k, v]: [string, any]) => `${k}: ${v}`)
                      .join('\n')
                  "
                >
                  <a-tag class="k8s-selector-item" color="cyan">
                    {{ Object.keys(text).length }} 个选择器
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
                <a-button
                  title="查看详情"
                  @click="showDeploymentDetail(record)"
                >
                  <template #icon><EyeOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="编辑">
                <a-button title="编辑" @click="openEditModal(record)">
                  <template #icon><EditOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="查看 YAML">
                <a-button title="查看 YAML" @click="showYamlModal(record)">
                  <template #icon>
                    <FileTextOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="伸缩">
                <a-button title="伸缩" @click="openScaleModal(record)">
                  <template #icon>
                    <ExpandOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="重启">
                <a-button title="重启" @click="restartDeployment(record)">
                  <template #icon><RedoOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip
                v-if="record.status === K8sDeploymentStatus.Running"
                title="暂停"
              >
                <a-button title="暂停" @click="pauseDeployment(record)">
                  <template #icon>
                    <PauseCircleOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip
                v-if="record.status === K8sDeploymentStatus.Paused"
                title="恢复"
              >
                <a-button title="恢复" @click="resumeDeployment(record)">
                  <template #icon>
                    <PlayCircleOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="查看 Pod">
                <a-button title="查看 Pod" @click="showPodModal(record)">
                  <template #icon>
                    <ContainerOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="版本历史">
                <a-button title="版本历史" @click="showHistoryModal(record)">
                  <template #icon>
                    <HistoryOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="can('k8s.deployment.delete')" title="删除">
                <a-button danger title="删除" @click="deleteDeployment(record)">
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
            <DeploymentUnitOutlined aria-hidden="true" />
            <p>暂无 Deployment 数据</p>
            <p v-if="!filterClusterId">请先选择集群</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 编辑 Deployment 模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="保存"
      title="编辑 Deployment"
      width="800px"
      @cancel="closeEditModal"
      @ok="submitEditForm"
    >
      <a-form
        ref="editFormRef"
        :model="editFormModel"
        :rules="editFormRules"
        class="k8s-form"
        layout="vertical"
      >
        <a-form-item label="Deployment 名称" name="name">
          <a-input
            v-model:value="editFormModel.name"
            class="k8s-form-input"
            disabled
            placeholder="Deployment 名称"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px">
            名称不可修改
          </div>
        </a-form-item>

        <a-form-item label="命名空间" name="namespace">
          <a-input
            v-model:value="editFormModel.namespace"
            class="k8s-form-input"
            disabled
            placeholder="命名空间"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px">
            命名空间不可修改
          </div>
        </a-form-item>

        <a-form-item :required="true" label="副本数量" name="replicas">
          <a-input-number
            v-model:value="editFormModel.replicas"
            :max="100"
            :min="0"
            class="k8s-form-input"
            placeholder="副本数量"
          />
        </a-form-item>

        <a-form-item label="容器镜像">
          <div class="k8s-key-value-inputs">
            <div
              v-for="(_, index) in editFormModel.images"
              :key="index"
              class="k8s-key-value-row"
            >
              <a-input
                v-model:value="editFormModel.images[index]"
                class="k8s-form-input"
                placeholder="容器镜像（例如：nginx:latest）"
              />
              <a-button
                :disabled="editFormModel.images.length <= 1"
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeEditImageField(index)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <a-button
              style="margin-top: 8px"
              type="dashed"
              @click="addEditImageField"
            >
              <template #icon><PlusOutlined aria-hidden="true" /></template>
              添加镜像
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="标签配置（可选）">
          <a-form-item-rest>
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
                  <template #icon>
                    <DeleteOutlined aria-hidden="true" />
                  </template>
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
          </a-form-item-rest>
        </a-form-item>

        <a-form-item label="注解配置（可选）">
          <a-form-item-rest>
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
                  <template #icon>
                    <DeleteOutlined aria-hidden="true" />
                  </template>
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
          </a-form-item-rest>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 创建 Deployment 模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="创建 Deployment"
      width="800px"
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
        <a-form-item :required="true" label="Deployment 名称" name="name">
          <a-input
            v-model:value="createFormModel.name"
            :maxlength="63"
            class="k8s-form-input"
            placeholder="请输入 Deployment 名称（例如：my-app）"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px">
            只能包含小写字母、数字和连字符，且不能以连字符开头或结尾
          </div>
        </a-form-item>

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
            <a-select-option
              v-if="
                namespaces.length > 0 && namespaces.length < namespacesTotal
              "
              :value="'__load_more_namespaces_create__'"
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
        </a-form-item>

        <a-form-item :required="true" label="副本数量" name="replicas">
          <a-input-number
            v-model:value="createFormModel.replicas"
            :max="100"
            :min="0"
            class="k8s-form-input"
            placeholder="副本数量"
          />
        </a-form-item>

        <a-form-item label="容器镜像">
          <div class="k8s-key-value-inputs">
            <div
              v-for="(_, index) in createFormModel.images"
              :key="index"
              class="k8s-key-value-row"
            >
              <a-input
                v-model:value="createFormModel.images[index]"
                class="k8s-form-input"
                placeholder="容器镜像（例如：nginx:latest）"
              />
              <a-button
                :disabled="createFormModel.images.length <= 1"
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeImageField(index)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <a-button
              style="margin-top: 8px"
              type="dashed"
              @click="addImageField"
            >
              <template #icon><PlusOutlined aria-hidden="true" /></template>
              添加镜像
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="标签配置（可选）">
          <a-form-item-rest>
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
                  <template #icon>
                    <DeleteOutlined aria-hidden="true" />
                  </template>
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
          </a-form-item-rest>
        </a-form-item>

        <a-form-item label="注解配置（可选）">
          <a-form-item-rest>
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
                  <template #icon>
                    <DeleteOutlined aria-hidden="true" />
                  </template>
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
          </a-form-item-rest>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 通过 YAML 创建 Deployment 模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="通过 YAML 创建 Deployment"
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
            placeholder="请输入 Deployment YAML 内容，或点击【插入模板】使用默认模板"
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
      title="Deployment 详情"
      width="1000px"
      @cancel="closeDetailModal"
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentDeploymentDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="基本信息">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">Deployment 名称:</span>
                  <span class="k8s-detail-value">{{
                    currentDeploymentDetail.name
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间:</span>
                  <span class="k8s-detail-value">{{
                    currentDeploymentDetail.namespace
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">状态:</span>
                  <a-badge
                    :status="getStatusColor(currentDeploymentDetail.status)"
                    :text="getStatusText(currentDeploymentDetail.status)"
                  />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">集群ID:</span>
                  <span class="k8s-detail-value">{{
                    currentDeploymentDetail.cluster_id
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{
                    currentDeploymentDetail.uid || '-'
                  }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="副本信息">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">期望副本数:</span>
                  <span class="k8s-detail-value">{{
                    currentDeploymentDetail.replicas
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">就绪副本数:</span>
                  <span class="k8s-detail-value">{{
                    currentDeploymentDetail.ready_replicas
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">可用副本数:</span>
                  <span class="k8s-detail-value">{{
                    currentDeploymentDetail.available_replicas
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">更新副本数:</span>
                  <span class="k8s-detail-value">{{
                    currentDeploymentDetail.updated_replicas
                  }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="部署策略">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">策略类型:</span>
                  <span class="k8s-detail-value">{{
                    currentDeploymentDetail.strategy || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">最大不可用:</span>
                  <span class="k8s-detail-value">{{
                    currentDeploymentDetail.max_unavailable || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">最大超出:</span>
                  <span class="k8s-detail-value">{{
                    currentDeploymentDetail.max_surge || '-'
                  }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="容器镜像">
                <div class="k8s-images-display">
                  <a-tag
                    v-for="(image, index) in currentDeploymentDetail.images ||
                    []"
                    :key="index"
                    class="k8s-image-tag"
                    style="margin-bottom: 8px"
                  >
                    {{ image }}
                  </a-tag>
                  <span
                    v-if="
                      !currentDeploymentDetail.images ||
                      currentDeploymentDetail.images.length === 0
                    "
                    class="k8s-no-data"
                  >
                    暂无镜像信息
                  </span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="标签信息">
                <div class="k8s-labels-display">
                  <a-tooltip
                    v-for="label in currentDeploymentDetail.labels || []"
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
                      !currentDeploymentDetail.labels ||
                      currentDeploymentDetail.labels.length === 0
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
                    v-for="annotation in currentDeploymentDetail.annotations ||
                    []"
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
                      !currentDeploymentDetail.annotations ||
                      currentDeploymentDetail.annotations.length === 0
                    "
                    class="k8s-no-data"
                  >
                    暂无注解
                  </span>
                </div>
              </a-card>
            </a-col>
          </a-row>
        </div>
      </a-spin>
    </a-modal>

    <!-- 伸缩模态框 -->
    <a-modal
      v-model:open="isScaleModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="确认伸缩"
      title="伸缩 Deployment"
      width="500px"
      @cancel="closeScaleModal"
      @ok="submitScaleForm"
    >
      <a-form
        ref="scaleFormRef"
        :model="scaleFormModel"
        :rules="scaleFormRules"
        class="k8s-form"
        layout="vertical"
      >
        <a-alert
          :description="`即将对 Deployment '${currentOperationDeployment?.name}' 进行伸缩操作`"
          message="伸缩操作"
          show-icon
          style="margin-bottom: 24px"
          type="info"
        />

        <a-form-item :required="true" label="副本数量" name="replicas">
          <a-input-number
            v-model:value="scaleFormModel.replicas"
            :max="100"
            :min="0"
            class="k8s-form-input"
            placeholder="请输入副本数量"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px">
            当前副本数：{{ currentOperationDeployment?.replicas }}
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- YAML 模态框 -->
    <a-modal
      v-model:open="isYamlModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      :title="`查看/编辑 ${currentOperationDeployment?.name} YAML`"
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

    <!-- Pod 列表模态框 -->
    <a-modal
      v-model:open="isPodModalVisible"
      :footer="null"
      :maskClosable="false"
      :title="`${currentOperationDeployment?.name} Pod 列表`"
      destroyOnClose
      width="1000px"
      @cancel="closePodModal"
    >
      <a-table
        :data-source="deploymentPods"
        :loading="submitLoading"
        :pagination="false"
        class="k8s-table"
        size="small"
      >
        <a-table-column key="name" dataIndex="name" title="Pod 名称" />
        <a-table-column key="status" dataIndex="status" title="状态">
          <template #default="{ text }">
            <a-badge
              :status="text === 'Running' ? 'success' : 'error'"
              :text="text"
            />
          </template>
        </a-table-column>
        <a-table-column
          key="restart_count"
          dataIndex="restart_count"
          title="重启次数"
        />
        <a-table-column
          key="created_at"
          dataIndex="created_at"
          title="创建时间"
        />
      </a-table>
    </a-modal>

    <!-- 版本历史模态框 -->
    <a-modal
      v-model:open="isHistoryModalVisible"
      :footer="null"
      :maskClosable="false"
      :title="`${currentOperationDeployment?.name} 版本历史`"
      destroyOnClose
      width="800px"
      @cancel="closeHistoryModal"
    >
      <a-table
        :data-source="deploymentHistory"
        :loading="submitLoading"
        :pagination="false"
        class="k8s-table"
        size="small"
      >
        <a-table-column key="revision" dataIndex="revision" title="版本" />
        <a-table-column key="date" dataIndex="date" title="日期" />
        <a-table-column key="message" dataIndex="message" title="变更说明" />
        <a-table-column key="actions" title="操作" width="100">
          <template #default="{ record }">
            <a-button
              :disabled="record.revision === 1"
              size="small"
              type="link"
              @click="rollbackToVersion(record.revision)"
            >
              回滚到此版本
            </a-button>
          </template>
        </a-table-column>
      </a-table>
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

<style scoped src="./Deployment.css"></style>
