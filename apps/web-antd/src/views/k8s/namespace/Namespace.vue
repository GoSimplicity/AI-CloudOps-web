<script lang="ts" setup>
import OpsPage from '#/components/ops/OpsPage.vue';
import { onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useNamespacePage } from './Namespace';
import {
  AppstoreOutlined,
  CopyOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  EyeOutlined,
  FilterOutlined,
  FireOutlined,
  PlusOutlined,
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
  loading,
  loadError,
  clustersLoading,
  clustersError,
  searchText,
  filterStatus,
  filterClusterId,
  filterLabels,
  selectedRows,
  currentPage,
  pageSize,

  // modal state
  isLabelModalVisible,
  isCreateModalVisible,
  isDeleteModalVisible,
  isLabelEdit,
  submitLoading,

  // detail modal
  isDetailModalVisible,
  detailLoading,
  currentNamespaceDetail,

  // operation target
  currentOperationNamespace,

  // form models
  labelFormModel,
  createFormModel,
  deleteFormModel,

  // form refs
  labelFormRef,
  createFormRef,

  // form rules
  labelFormRules,
  createFormRules,

  // computed
  filteredNamespaces,
  rowSelection,

  // helpers
  getEnvText,
  getStatusText,
  getStatusColor,
  getPhaseText,
  getPhaseColor,
  getClusterName,

  // operations
  fetchClusters,
  fetchNamespaces,
  clearNamespaces,
  showNamespaceDetail,
  closeDetailModal,

  // create operations
  openCreateModal,
  closeCreateModal,
  submitCreateForm,

  // label operations
  openEditLabelModal,
  closeLabelModal,
  submitLabelForm,
  removeLabelField,
  removeAnnotationField,
  removeCreateLabelField,
  removeCreateAnnotationField,

  // delete operations
  deleteNamespace,
  forceDeleteNamespace,
  closeDeleteModal,
  submitDeleteForm,

  // filter operations
  addFilterLabel,
  removeFilterLabel,
  clearFilterLabels,

  // batch operations
  batchOperation,

  // cluster pagination
  loadMoreClusters,
  handlePageChange,

  // pagination state
  total,
  clustersTotal,

  // constants
  NamespaceStatus,
} = useNamespacePage();

// 添加新标签/注解的方法
const newLabelKey = ref('');
const newLabelValue = ref('');
const newAnnotationKey = ref('');
const newCreateLabelKey = ref('');
const newCreateAnnotationKey = ref('');

const addNewLabel = () => {
  if (newLabelKey.value && newLabelKey.value.trim()) {
    labelFormModel.value.labels[newLabelKey.value.trim()] =
      newLabelValue.value || '';
    newLabelKey.value = '';
    newLabelValue.value = '';
  }
};

const addNewAnnotation = () => {
  if (newAnnotationKey.value && newAnnotationKey.value.trim()) {
    labelFormModel.value.annotations[newAnnotationKey.value.trim()] = '';
    newAnnotationKey.value = '';
  }
};

const addNewCreateLabel = () => {
  if (newCreateLabelKey.value && newCreateLabelKey.value.trim()) {
    createFormModel.value.labels[newCreateLabelKey.value.trim()] = '';
    newCreateLabelKey.value = '';
  }
};

const addNewCreateAnnotation = () => {
  if (newCreateAnnotationKey.value && newCreateAnnotationKey.value.trim()) {
    createFormModel.value.annotations[newCreateAnnotationKey.value.trim()] = '';
    newCreateAnnotationKey.value = '';
  }
};

const onSearch = () => {
  currentPage.value = 1;
  fetchNamespaces();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchNamespaces();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  if (filterClusterId.value) {
    fetchNamespaces();
  } else {
    // 清空命名空间列表和选择状态
    clearNamespaces();
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
    // 当滚动到底部附近时加载更多
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
    title: '集群',
    dataIndex: 'cluster_id',
    key: 'cluster_id',
    width: 130,
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
    title: '操作',
    key: 'actions',
    width: 200,
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
  // 如果有待添加的标签，先添加
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
  clearFilterLabels();
  currentPage.value = 1;
  // 清空命名空间列表
  clearNamespaces();
  message.success('已重置所有筛选条件');
};

// 复制到剪贴板
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  } catch (error) {
    if (shouldNotifyPageError(error)) message.error('复制失败');
  }
};

onMounted(async () => {
  // 页面加载时首先获取集群列表
  await fetchClusters();
});
</script>

<template>
  <OpsPage
    description="选择集群后查询和维护 Kubernetes 命名空间"
    title="命名空间管理"
  >
    <!-- 页面头部 -->
    <template #actions>
      <a-button
        :disabled="!filterClusterId"
        type="primary"
        @click="openCreateModal"
      >
        <template #icon><PlusOutlined aria-hidden="true" /></template>
        创建命名空间
      </a-button>
      <a-button
        :disabled="!filterClusterId"
        :loading="loading"
        @click="fetchNamespaces"
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
            v-model:value="filterStatus"
            allow-clear
            class="k8s-filter-select"
            placeholder="状态筛选"
            @change="handleFilterChange"
          >
            <template #suffixIcon>
              <FilterOutlined aria-hidden="true" />
            </template>
            <a-select-option :value="NamespaceStatus.Active">
              活跃
            </a-select-option>
            <a-select-option :value="NamespaceStatus.Terminating">
              终止中
            </a-select-option>
            <a-select-option :value="NamespaceStatus.Unknown">
              未知
            </a-select-option>
          </a-select>

          <!-- 标签过滤器 -->
          <div class="namespace-labels-filter">
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
            placeholder="搜索命名空间名称"
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
            @click="() => resetFilters()"
            :disabled="
              !filterStatus &&
              !searchText &&
              !filterClusterId &&
              Object.keys(filterLabels).length === 0
            "
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined aria-hidden="true" /></template>
            重置筛选
          </a-button>

          <a-button
            type="primary"
            danger
            @click="() => batchOperation('删除')"
            :disabled="!selectedRows.length"
            v-if="can('k8s.namespace.batchDelete') && selectedRows.length > 0"
            class="k8s-toolbar-btn"
            title="批量删除选中的命名空间"
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
        <a-button size="small" @click="fetchNamespaces"> 重试 </a-button>
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
    <div class="k8s-data-display table-container">
      <a-table
        :columns="columns"
        :data-source="filteredNamespaces"
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
        :scroll="{ x: 1080 }"
        class="k8s-table namespace-table"
        row-key="name"
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
            <a-badge :status="getPhaseColor(text)" :text="getPhaseText(text)" />
          </template>
          <template v-else-if="column.key === 'cluster_id'">
            <span class="k8s-cluster-name" :title="getClusterName(text)">{{
              getClusterName(text)
            }}</span>
          </template>
          <template v-else-if="column.key === 'uid'">
            <div class="k8s-uid-display">
              <span :title="text" class="uid-text">{{ text }}</span>
              <a-button
                :title="'复制 UID'"
                class="uid-copy-btn"
                size="small"
                type="text"
                @click="() => copyToClipboard(text)"
              >
                <template #icon><CopyOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
          </template>
          <template v-else-if="column.key === 'labels'">
            <div class="k8s-labels-display">
              <template v-if="text && text.length > 0">
                <a-tooltip
                  v-for="label in text.slice(0, 2)"
                  :key="label.key"
                  :title="`${label.key}: ${label.value}`"
                >
                  <a-tag class="k8s-label-item" color="blue">
                    <span class="label-key">{{
                      label.key.split('/').pop()
                    }}</span>
                    <span class="label-separator">:</span>
                    <span class="label-value">{{ label.value }}</span>
                  </a-tag>
                </a-tooltip>
                <a-tooltip
                  v-if="text.length > 2"
                  :title="
                    text
                      .slice(2)
                      .map((item: any) => `${item.key}: ${item.value}`)
                      .join('\n')
                  "
                >
                  <a-tag class="k8s-label-count" color="blue">
                    +{{ text.length - 2 }} 更多
                  </a-tag>
                </a-tooltip>
              </template>
              <span v-else class="k8s-no-data">无标签</span>
            </div>
          </template>
          <template v-else-if="column.key === 'annotations'">
            <div class="k8s-annotations-display">
              <template v-if="text && text.length > 0">
                <a-tooltip
                  :title="
                    text
                      .map((item: any) => `${item.key}: ${item.value}`)
                      .join('\n')
                  "
                >
                  <a-tag class="k8s-annotation-count" color="purple">
                    {{ text.length }} 个注解
                  </a-tag>
                </a-tooltip>
              </template>
              <span v-else class="k8s-no-data">无注解</span>
            </div>
          </template>
          <template v-else-if="column.key === 'actions'">
            <div class="k8s-action-column">
              <a-tooltip title="查看详情">
                <a-button title="查看详情" @click="showNamespaceDetail(record)">
                  <template #icon><EyeOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="管理标签/注解">
                <a-button title="管理标签" @click="openEditLabelModal(record)">
                  <template #icon><TagsOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip
                v-if="can('k8s.namespace.delete')"
                title="删除命名空间"
              >
                <a-button
                  :disabled="
                    record.name === 'default' ||
                    record.name === 'kube-system' ||
                    record.name === 'kube-public' ||
                    record.name === 'kube-node-lease'
                  "
                  danger
                  title="删除"
                  @click="deleteNamespace(record)"
                >
                  <template #icon>
                    <DeleteOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip
                title="强制删除"
                v-if="
                  can('k8s.namespace.forceDelete') &&
                  record.status === NamespaceStatus.Terminating
                "
              >
                <a-button
                  :disabled="
                    record.name === 'default' ||
                    record.name === 'kube-system' ||
                    record.name === 'kube-public' ||
                    record.name === 'kube-node-lease'
                  "
                  danger
                  title="强制删除"
                  @click="forceDeleteNamespace(record)"
                >
                  <template #icon><FireOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
            </div>
          </template>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <AppstoreOutlined aria-hidden="true" />
            <p>暂无命名空间数据</p>
            <p v-if="!filterClusterId">请先选择集群</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建命名空间模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="创建命名空间"
      width="600px"
      @cancel="closeCreateModal"
      @ok="submitCreateForm"
    >
      <a-form
        ref="createFormRef"
        :model="createFormModel"
        :rules="createFormRules"
        class="create-form"
        layout="vertical"
      >
        <a-form-item :required="true" label="命名空间名称" name="name">
          <a-input
            v-model:value="createFormModel.name"
            :maxlength="63"
            class="form-input"
            placeholder="请输入命名空间名称（例如：my-namespace）"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px">
            只能包含小写字母、数字和连字符，且不能以连字符开头或结尾
          </div>
        </a-form-item>

        <a-form-item label="标签配置（可选）" name="labels">
          <div class="key-value-inputs">
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
              class="key-value-row"
            >
              <a-input
                :placeholder="`标签键: ${key}`"
                :value="key"
                class="form-input key-input"
                disabled
              />
              <a-input
                v-model:value="createFormModel.labels[key]"
                :maxlength="200"
                class="form-input value-input"
                placeholder="标签值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeCreateLabelField(key)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px">
              <a-input
                v-model:value="newCreateLabelKey"
                placeholder="输入标签键"
                style="flex: 1; margin-right: 8px"
                @press-enter="addNewCreateLabel"
              />
              <a-button
                type="primary"
                @click="addNewCreateLabel"
                :disabled="!newCreateLabelKey.trim()"
              >
                <template #icon><PlusOutlined aria-hidden="true" /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <a-form-item label="注解配置（可选）" name="annotations">
          <div class="key-value-inputs">
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
              class="key-value-row"
            >
              <a-input
                :placeholder="`注解键: ${key}`"
                :value="key"
                class="form-input key-input"
                disabled
              />
              <a-input
                v-model:value="createFormModel.annotations[key]"
                :maxlength="500"
                class="form-input value-input"
                placeholder="注解值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeCreateAnnotationField(key)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px">
              <a-input
                v-model:value="newCreateAnnotationKey"
                placeholder="输入注解键"
                style="flex: 1; margin-right: 8px"
                @press-enter="addNewCreateAnnotation"
              />
              <a-button
                type="primary"
                @click="addNewCreateAnnotation"
                :disabled="!newCreateAnnotationKey.trim()"
              >
                <template #icon><PlusOutlined aria-hidden="true" /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 标签/注解管理模态框 -->
    <a-modal
      v-model:open="isLabelModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      :title="isLabelEdit ? '编辑命名空间标签/注解' : '添加命名空间标签/注解'"
      cancelText="取消"
      destroyOnClose
      okText="保存"
      width="800px"
      @cancel="closeLabelModal"
      @ok="submitLabelForm"
    >
      <a-form
        ref="labelFormRef"
        :model="labelFormModel"
        :rules="labelFormRules"
        class="label-form"
        layout="vertical"
      >
        <a-form-item label="标签配置" name="labels">
          <div class="key-value-inputs">
            <div
              v-if="
                !labelFormModel.labels ||
                Object.keys(labelFormModel.labels).length === 0
              "
              style="text-align: center; color: #999; padding: 20px"
            >
              暂无标签，点击下方按钮添加
            </div>
            <div
              v-for="(_, key) in labelFormModel.labels"
              :key="key"
              class="key-value-row"
            >
              <a-input
                :placeholder="`标签键: ${key}`"
                :value="key"
                class="form-input key-input"
                disabled
              />
              <a-input
                v-model:value="labelFormModel.labels[key]"
                :maxlength="200"
                class="form-input value-input"
                placeholder="标签值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                type="text"
                @click="removeLabelField(key)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
                删除
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

        <a-form-item label="注解配置" name="annotations">
          <div class="key-value-inputs">
            <div
              v-if="
                !labelFormModel.annotations ||
                Object.keys(labelFormModel.annotations).length === 0
              "
              style="text-align: center; color: #999; padding: 20px"
            >
              暂无注解，点击下方按钮添加
            </div>
            <div
              v-for="(_, key) in labelFormModel.annotations"
              :key="key"
              class="key-value-row"
            >
              <a-input
                :placeholder="`注解键: ${key}`"
                :value="key"
                class="form-input key-input"
                disabled
              />
              <a-input
                v-model:value="labelFormModel.annotations[key]"
                :maxlength="500"
                class="form-input value-input"
                placeholder="注解值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                type="text"
                @click="removeAnnotationField(key)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
                删除
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

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      :footer="null"
      :maskClosable="false"
      destroyOnClose
      title="命名空间详情"
      width="1000px"
      @cancel="closeDetailModal"
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentNamespaceDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="基本信息">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间名称:</span>
                  <span class="k8s-detail-value">{{
                    currentNamespaceDetail.name
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{
                    currentNamespaceDetail.uid || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">状态:</span>
                  <a-badge
                    :status="getStatusColor(currentNamespaceDetail.status)"
                    :text="getStatusText(currentNamespaceDetail.status)"
                  />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">阶段:</span>
                  <a-badge
                    :status="getPhaseColor(currentNamespaceDetail.phase)"
                    :text="getPhaseText(currentNamespaceDetail.phase)"
                  />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">集群:</span>
                  <span class="k8s-detail-value">{{
                    getClusterName(currentNamespaceDetail.cluster_id)
                  }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="标签信息">
                <div class="k8s-detail-labels-list">
                  <template
                    v-if="
                      currentNamespaceDetail.labels &&
                      currentNamespaceDetail.labels.length > 0
                    "
                  >
                    <div
                      v-for="label in currentNamespaceDetail.labels"
                      :key="label.key"
                      class="k8s-detail-label-item"
                    >
                      <span class="detail-label-key">{{ label.key }}</span>
                      <span class="detail-label-separator">=</span>
                      <span class="detail-label-value">{{ label.value }}</span>
                    </div>
                  </template>
                  <span v-else class="k8s-no-data">暂无标签</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px">
            <a-col :xs="24">
              <a-card class="k8s-detail-card" size="small" title="注解信息">
                <div class="k8s-detail-annotations-list">
                  <template
                    v-if="
                      currentNamespaceDetail.annotations &&
                      currentNamespaceDetail.annotations.length > 0
                    "
                  >
                    <div
                      v-for="annotation in currentNamespaceDetail.annotations"
                      :key="annotation.key"
                      class="k8s-detail-annotation-item"
                    >
                      <span class="detail-annotation-key">{{
                        annotation.key
                      }}</span>
                      <span class="detail-annotation-separator">=</span>
                      <span class="detail-annotation-value">{{
                        annotation.value
                      }}</span>
                    </div>
                  </template>
                  <span v-else class="k8s-no-data">暂无注解</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row style="margin-top: 16px">
            <a-col :span="24">
              <a-card class="k8s-detail-card" size="small" title="详细信息">
                <a-descriptions
                  :column="{ xxl: 3, xl: 3, lg: 2, md: 2, sm: 1, xs: 1 }"
                  bordered
                  size="small"
                >
                  <a-descriptions-item label="命名空间">
                    {{ currentNamespaceDetail.name }}
                  </a-descriptions-item>
                  <a-descriptions-item label="集群">
                    {{ getClusterName(currentNamespaceDetail.cluster_id) }}
                  </a-descriptions-item>
                  <a-descriptions-item label="状态">
                    <a-badge
                      :status="getStatusColor(currentNamespaceDetail.status)"
                      :text="getStatusText(currentNamespaceDetail.status)"
                    />
                  </a-descriptions-item>
                  <a-descriptions-item label="阶段">
                    <a-badge
                      :status="getPhaseColor(currentNamespaceDetail.phase)"
                      :text="getPhaseText(currentNamespaceDetail.phase)"
                    />
                  </a-descriptions-item>
                  <a-descriptions-item label="UID">
                    {{ currentNamespaceDetail.uid || '-' }}
                  </a-descriptions-item>
                </a-descriptions>
              </a-card>
            </a-col>
          </a-row>
        </div>
      </a-spin>
    </a-modal>

    <!-- 删除命名空间模态框 -->
    <a-modal
      v-model:open="isDeleteModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="确认删除"
      okType="danger"
      title="删除命名空间"
      width="500px"
      @cancel="closeDeleteModal"
      @ok="submitDeleteForm"
    >
      <div class="delete-form">
        <a-alert
          :description="`您即将删除命名空间 '${currentOperationNamespace?.name}'，此操作不可逆！`"
          message="警告"
          show-icon
          style="margin-bottom: 24px"
          type="warning"
        />

        <a-form class="delete-config-form" layout="vertical">
          <a-form-item label="删除方式">
            <a-radio-group v-model:value="deleteFormModel.force">
              <a-radio :value="2" style="display: block; margin-bottom: 12px">
                <div style="margin-left: 20px">
                  <div style="font-weight: 500">优雅删除（推荐）</div>
                  <div style="color: #666; font-size: 12px; margin-top: 2px">
                    给予资源时间完成清理
                  </div>
                </div>
              </a-radio>
              <a-radio :value="1">
                <div style="margin-left: 20px">
                  <div style="font-weight: 500; color: #ff4d4f">强制删除</div>
                  <div style="color: #666; font-size: 12px; margin-top: 2px">
                    立即删除，仅在优雅删除失败时使用
                  </div>
                </div>
              </a-radio>
            </a-radio-group>
          </a-form-item>

          <a-form-item
            v-if="deleteFormModel.force === 2"
            label="优雅删除时间（秒）"
          >
            <a-input-number
              v-model:value="deleteFormModel.grace_period_seconds"
              :max="3600"
              :min="0"
              :step="10"
              placeholder="30"
              style="width: 100%"
            />
            <div style="color: #999; font-size: 12px; margin-top: 4px">
              默认30秒，最大3600秒
            </div>
          </a-form-item>
        </a-form>
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

<style scoped src="./Namespace.css"></style>
