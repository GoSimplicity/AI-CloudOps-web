<script setup lang="ts">
import OpsPage from '#/components/ops/OpsPage.vue';

import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

import { useUserStore } from '@vben/stores';

import { type FormInstance, message, Modal } from 'ant-design-vue';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  DownOutlined,
  FolderOutlined,
  PlusOutlined,
  StopOutlined,
} from '@ant-design/icons-vue';

import {
  CategoryStatus,
  createWorkorderCategory,
  type CreateWorkorderCategoryReq,
  deleteWorkorderCategory,
  type DeleteWorkorderCategoryReq,
  detailWorkorderCategory,
  type DetailWorkorderCategoryReq,
  listWorkorderCategory,
  type ListWorkorderCategoryReq,
  updateWorkorderCategory,
  type UpdateWorkorderCategoryReq,
  type WorkorderCategoryItem,
} from '#/api/core/workorder/workorder_category';

import { useAuthStore } from '#/store/auth';
import { getAvatarColor } from '#/utils/avatar-color';
import { usePermission } from '#/utils/permission';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';

const { can, hasPerm } = usePermission();
const userStore = useUserStore();
const authStore = useAuthStore();

/**
 * 表格列配置
 */
const tableColumns = [
  {
    dataIndex: 'name',
    ellipsis: true,
    key: 'name',
    title: '分类名称',
    width: 200,
  },
  {
    dataIndex: 'description',
    ellipsis: true,
    key: 'description',
    title: '描述',
    width: 250,
  },
  {
    align: 'center' as const,
    dataIndex: 'status',
    key: 'status',
    title: '状态',
    width: 100,
  },
  {
    dataIndex: 'operator_name',
    key: 'operator',
    title: '操作人',
    width: 150,
  },
  {
    dataIndex: 'created_at',
    key: 'created_at',
    title: '创建时间',
    width: 180,
  },
  {
    align: 'center' as const,
    fixed: 'right' as const,
    key: 'action',
    title: '操作',
    width: 200,
  },
];

/**
 * 响应式状态
 */
const loading = ref<boolean>(false);
const submitLoading = ref<boolean>(false);
const detailLoading = ref(false);
const formReady = ref(false);
let disposed = false;
let interactionRevision = 0;
let submitRevision = 0;
let listRevision = 0;
let formOwner: string | undefined;
let deleteDialog: ReturnType<typeof Modal.confirm> | undefined;

const pageOwner = () =>
  JSON.stringify([
    userStore.userInfo?.userId ?? '',
    authStore.getAuthGeneration(),
  ]);

const validId = (id: number | undefined): id is number =>
  typeof id === 'number' && Number.isSafeInteger(id) && id > 0;

const invalidateInteraction = () => {
  ++interactionRevision;
  ++submitRevision;
  formOwner = undefined;
  detailLoading.value = false;
  submitLoading.value = false;
  formReady.value = false;
  const dialog = deleteDialog;
  deleteDialog = undefined;
  dialog?.destroy();
};

const beginInteraction = (permission: string) => {
  if (disposed || !userStore.userInfo?.userId || !hasPerm(permission)) return;
  invalidateInteraction();
  const revision = interactionRevision;
  const owner = pageOwner();
  return () =>
    !disposed &&
    revision === interactionRevision &&
    owner === pageOwner() &&
    hasPerm(permission);
};

// 搜索和筛选
const searchQuery = ref<string>('');
const statusFilter = ref<number | undefined>();

// 分页配置
const currentPage = ref<number>(1);
const pageSize = ref<number>(10);
const total = ref<number>(0);

// 数据列表
const categoryList = ref<WorkorderCategoryItem[]>([]);

// 统计数据
const statistics = reactive({
  total: 0,
  enabled: 0,
  disabled: 0,
});

// 表单引用
const formRef = ref<FormInstance>();

// 响应式对话框宽度
const dialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '80%';
    return '600px';
  }
  return '600px';
});

// 分页配置
const paginationConfig = computed(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  pageSizeOptions: ['10', '20', '50', '100'],
}));

/**
 * 对话框状态管理
 */
const formDialog = reactive({
  visible: false,
  isEdit: false,
  data: {
    name: '',
    description: '',
    status: CategoryStatus.Enabled,
  } as CreateWorkorderCategoryReq & { id?: number },
});

const detailDialog = reactive({
  visible: false,
  data: null as WorkorderCategoryItem | null,
});

watch(
  pageOwner,
  () => {
    invalidateInteraction();
    ++listRevision;
    loading.value = false;
    formDialog.visible = false;
    formDialog.data = {
      description: '',
      name: '',
      status: CategoryStatus.Enabled,
    };
    detailDialog.visible = false;
    detailDialog.data = null;
    categoryList.value = [];
    total.value = 0;
    Object.assign(statistics, { disabled: 0, enabled: 0, total: 0 });
  },
  { flush: 'sync' },
);
onUnmounted(() => {
  disposed = true;
  invalidateInteraction();
  ++listRevision;
});

/**
 * 表单验证规则
 */
const formRules = {
  name: [
    { message: '请输入分类名称', required: true, trigger: 'blur' },
    { max: 100, message: '分类名称长度为2-100个字符', min: 2, trigger: 'blur' },
  ],
  status: [{ message: '请选择状态', required: true, trigger: 'change' }],
};

/**
 * 更新统计数据
 */
const updateStatistics = (): void => {
  statistics.total = total.value;
  statistics.enabled = categoryList.value.filter(
    (item) => item.status === CategoryStatus.Enabled,
  ).length;
  statistics.disabled = categoryList.value.filter(
    (item) => item.status === CategoryStatus.Disabled,
  ).length;
};

/**
 * 核心数据加载方法 - 使用真分页
 */
const loadCategoryList = async (
  stillCurrent: () => boolean = () => true,
): Promise<void> => {
  const owner = pageOwner();
  const revision = ++listRevision;
  const ownsRequest = () =>
    !disposed && revision === listRevision && owner === pageOwner();
  const isCurrent = () => ownsRequest() && stillCurrent();
  if (!isCurrent()) return;
  loading.value = true;
  try {
    const params: ListWorkorderCategoryReq = {
      page: currentPage.value,
      size: pageSize.value,
    };

    // 添加搜索条件
    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim();
    }

    // 添加状态筛选
    if (statusFilter.value !== undefined) {
      params.status = statusFilter.value;
    }

    const response = await listWorkorderCategory(params);
    if (!isCurrent()) return;

    if (response) {
      categoryList.value = response.items || [];
      total.value = response.total || 0;

      // 更新统计数据
      updateStatistics();
    } else {
      categoryList.value = [];
      total.value = 0;
    }
  } catch (error) {
    if (!isCurrent()) return;
    if (shouldNotifyPageError(error)) message.error('加载分类列表失败');
    categoryList.value = [];
    total.value = 0;
  } finally {
    if (ownsRequest()) loading.value = false;
  }
};

/**
 * 表格变化处理 - 真分页
 */
const handleTableChange = (pagination: any): void => {
  if (pagination.current !== currentPage.value) {
    currentPage.value = pagination.current;
  }
  if (pagination.pageSize !== pageSize.value) {
    pageSize.value = pagination.pageSize;
    currentPage.value = 1; // 切换页面大小时重置到第一页
  }
  loadCategoryList();
};

/**
 * 搜索处理 - 重新分页
 */
const handleSearch = (): void => {
  currentPage.value = 1; // 搜索时重置到第一页
  loadCategoryList();
};

/**
 * 状态筛选变化 - 重新分页
 */
const handleStatusChange = (): void => {
  currentPage.value = 1; // 筛选时重置到第一页
  loadCategoryList();
};

/**
 * 操作处理方法
 */
const closeFormDialog = (): void => {
  if (!formDialog.visible) return;
  invalidateInteraction();
  formDialog.visible = false;
  formRef.value?.resetFields();
};

const closeDetailDialog = (): void => {
  if (!detailDialog.visible) return;
  invalidateInteraction();
  detailDialog.visible = false;
  detailDialog.data = null;
};

const handleCreate = (): void => {
  if (!beginInteraction('/api/workorder/category/create')) return;
  formOwner = pageOwner();
  detailDialog.visible = false;
  detailDialog.data = null;
  formDialog.isEdit = false;
  formDialog.data = {
    name: '',
    description: '',
    status: CategoryStatus.Enabled,
  };
  formReady.value = true;
  formDialog.visible = true;
};

const readCategoryDetail = async (
  record: WorkorderCategoryItem,
  mode: 'edit' | 'view',
): Promise<void> => {
  const id = record.id;
  if (!validId(id)) {
    message.warning('分类标识无效，请刷新后重试');
    return;
  }
  const isCurrent = beginInteraction(
    mode === 'edit'
      ? '/api/workorder/category/update/:id'
      : '/api/workorder/category/detail/:id',
  );
  if (!isCurrent) return;
  const readRevision = interactionRevision;
  const readOwner = pageOwner();
  detailDialog.data = null;
  detailDialog.visible = mode === 'view';
  formDialog.visible = mode === 'edit';
  if (mode === 'edit') {
    formOwner = pageOwner();
    formDialog.isEdit = true;
    formDialog.data = {
      description: '',
      id,
      name: '',
      status: CategoryStatus.Enabled,
    };
  }
  detailLoading.value = true;
  try {
    const params: DetailWorkorderCategoryReq = { id };
    const response = await detailWorkorderCategory(params);
    if (!isCurrent()) return;
    if (!response || response.id !== id) throw new Error('分类详情标识不匹配');
    if (mode === 'edit') {
      formDialog.isEdit = true;
      formDialog.data = {
        description: response.description || '',
        id: response.id,
        name: response.name,
        status: response.status,
      };
      formReady.value = true;
    } else {
      detailDialog.data = response;
    }
  } catch (error) {
    if (!isCurrent()) return;
    if (shouldNotifyPageError(error)) message.error('加载分类详情失败');
  } finally {
    if (
      !disposed &&
      interactionRevision === readRevision &&
      pageOwner() === readOwner
    )
      detailLoading.value = false;
  }
};

const handleEdit = (record: WorkorderCategoryItem) =>
  readCategoryDetail(record, 'edit');

const handleView = (record: WorkorderCategoryItem) =>
  readCategoryDetail(record, 'view');

/**
 * 状态切换
 */
const handleToggleStatus = async (
  record: WorkorderCategoryItem,
): Promise<void> => {
  const id = record.id;
  if (!validId(id)) return;
  const isCurrent = beginInteraction('/api/workorder/category/update/:id');
  if (!isCurrent) return;
  formDialog.visible = false;
  detailDialog.visible = false;
  const name = record.name;
  const newStatus =
    record.status === CategoryStatus.Enabled
      ? CategoryStatus.Disabled
      : CategoryStatus.Enabled;
  const params: UpdateWorkorderCategoryReq = {
    description: record.description,
    id,
    name,
    status: newStatus,
  };
  try {
    await updateWorkorderCategory(params);
    if (!isCurrent()) return;

    const statusText = newStatus === CategoryStatus.Enabled ? '启用' : '禁用';
    message.success(`分类 "${name}" 已${statusText}`);

    // 重新加载当前页数据
    await loadCategoryList(isCurrent);
  } catch (error) {
    if (!isCurrent()) return;
    if (shouldNotifyPageError(error)) message.error('更新分类状态失败');
  }
};

/**
 * 删除分类
 */
const handleDelete = (record: WorkorderCategoryItem): void => {
  const id = record.id;
  if (!validId(id)) return;
  const isCurrent = beginInteraction('/api/workorder/category/delete/:id');
  if (!isCurrent) return;
  formDialog.visible = false;
  detailDialog.visible = false;
  const name = record.name;
  let confirmed = false;
  deleteDialog = Modal.confirm({
    title: '确认删除',
    content: `确定要删除分类 "${name}" 吗？删除后不可恢复。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onCancel() {
      if (isCurrent()) invalidateInteraction();
    },
    async onOk() {
      if (!isCurrent() || confirmed) return;
      confirmed = true;
      try {
        const params: DeleteWorkorderCategoryReq = { id };
        await deleteWorkorderCategory(params);
        if (!isCurrent()) return;
        message.success(`分类 "${name}" 已删除`);

        // 如果当前页删除后没有数据且不是第一页，回到上一页
        if (categoryList.value.length === 1 && currentPage.value > 1) {
          currentPage.value = currentPage.value - 1;
        }

        await loadCategoryList(isCurrent);
      } catch (error) {
        if (!isCurrent()) return;
        if (shouldNotifyPageError(error)) message.error('删除分类失败');
      }
    },
  });
};

const handleMenuAction = (key: string, record: WorkorderCategoryItem): void => {
  switch (key) {
    case 'toggleStatus': {
      handleToggleStatus(record);
      break;
    }
    case 'delete': {
      handleDelete(record);
      break;
    }
  }
};

/**
 * 表单提交
 */
const handleSubmit = async (): Promise<void> => {
  const form = formRef.value;
  if (!form || !formDialog.visible || !formReady.value || submitLoading.value)
    return;
  const owner = formOwner;
  if (!owner || owner !== pageOwner() || !userStore.userInfo?.userId) return;
  const data = formDialog.data;
  const isEdit = formDialog.isEdit;
  const id = data.id;
  if (isEdit && !validId(id)) return;
  const revision = interactionRevision;
  const ticket = ++submitRevision;
  const permission = isEdit
    ? '/api/workorder/category/update/:id'
    : '/api/workorder/category/create';
  const snapshot: CreateWorkorderCategoryReq = {
    description: data.description,
    name: data.name,
    status: data.status,
  };
  const ownsOperation = () =>
    !disposed &&
    ticket === submitRevision &&
    revision === interactionRevision &&
    owner === pageOwner() &&
    formDialog.visible &&
    formDialog.isEdit === isEdit &&
    formDialog.data === data &&
    data.id === id;
  const isCurrent = () =>
    ownsOperation() &&
    hasPerm(permission) &&
    data.name === snapshot.name &&
    data.description === snapshot.description &&
    data.status === snapshot.status &&
    formRef.value === form;
  if (!isCurrent()) return;
  submitLoading.value = true;

  try {
    await form.validate();
  } catch {
    if (ownsOperation()) submitLoading.value = false;
    return;
  }
  if (!isCurrent()) {
    if (ownsOperation()) submitLoading.value = false;
    return;
  }
  try {
    if (isEdit && validId(id)) {
      // 更新分类
      const params: UpdateWorkorderCategoryReq = {
        ...snapshot,
        id,
      };

      await updateWorkorderCategory(params);
      if (!isCurrent()) return;
      message.success(`分类 "${snapshot.name}" 更新成功`);
    } else {
      // 创建分类
      await createWorkorderCategory(snapshot);
      if (!isCurrent()) return;
      message.success(`分类 "${snapshot.name}" 创建成功`);

      // 创建成功后跳转到第一页
      currentPage.value = 1;
    }

    formDialog.visible = false;
    formRef.value?.resetFields();
    // The completed operation owns this refresh; closing the saved form is expected.
    await loadCategoryList(
      () =>
        !disposed &&
        revision === interactionRevision &&
        owner === pageOwner() &&
        hasPerm(permission),
    );
  } catch (error) {
    if (!isCurrent()) return;
    if (shouldNotifyPageError(error)) message.error('保存分类失败');
  } finally {
    if (
      !disposed &&
      ticket === submitRevision &&
      revision === interactionRevision &&
      owner === pageOwner()
    )
      submitLoading.value = false;
  }
};

/**
 * 辅助工具方法
 */
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('zh-CN');
};

const formatTime = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFullDateTime = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('zh-CN');
};

const getInitials = (name: string): string => {
  if (!name) return '';
  const words = name.trim().split('');
  return words.slice(0, 2).join('').toUpperCase();
};

/**
 * 监听搜索条件变化，自动触发搜索
 */
watch([searchQuery, statusFilter], (_value, _oldValue, onCleanup) => {
  // 防抖处理，避免频繁请求
  const timeoutId = setTimeout(() => {
    if (searchQuery.value.trim() !== '' || statusFilter.value !== undefined) {
      handleSearch();
    }
  }, 500);

  onCleanup(() => clearTimeout(timeoutId));
});

/**
 * 组件挂载时初始化数据
 */
onMounted(() => {
  loadCategoryList();
});
</script>

<template>
  <OpsPage title="工单分类">
    <!-- 页面头部操作区 -->
    <template #actions>
      <a-button class="create-btn" type="primary" @click="handleCreate">
        <template #icon>
          <PlusOutlined />
        </template>
        创建分类
      </a-button>
    </template>
    <template #filters>
      <div class="search-filters">
        <a-input-search
          v-model:value="searchQuery"
          allow-clear
          class="search-input"
          placeholder="搜索分类名称..."
          @search="handleSearch"
        />
        <a-select
          v-model:value="statusFilter"
          allow-clear
          class="status-filter"
          placeholder="状态筛选"
          @change="handleStatusChange"
        >
          <a-select-option :value="CategoryStatus.Enabled">
            启用
          </a-select-option>
          <a-select-option :value="CategoryStatus.Disabled">
            禁用
          </a-select-option>
        </a-select>
      </div>
    </template>

    <!-- 统计卡片 -->
    <template #summary>
      <div class="stats-grid">
        <a-card class="stats-card">
          <a-statistic
            :value="statistics.total"
            :value-style="{ color: '#1890ff' }"
            title="总分类数"
          >
            <template #prefix>
              <FolderOutlined />
            </template>
          </a-statistic>
        </a-card>

        <a-card class="stats-card">
          <a-statistic
            :value="statistics.enabled"
            :value-style="{ color: '#52c41a' }"
            title="启用分类"
          >
            <template #prefix>
              <CheckCircleOutlined />
            </template>
          </a-statistic>
        </a-card>

        <a-card class="stats-card">
          <a-statistic
            :value="statistics.disabled"
            :value-style="{ color: '#ff4d4f' }"
            title="禁用分类"
          >
            <template #prefix>
              <StopOutlined />
            </template>
          </a-statistic>
        </a-card>
      </div>
    </template>

    <!-- 数据表格 -->
    <div class="table-container">
      <a-card>
        <a-table
          :columns="tableColumns"
          :data-source="categoryList"
          :loading="loading"
          :pagination="paginationConfig"
          :scroll="{ x: 'max-content' }"
          bordered
          row-key="id"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="name-cell">
                <span class="category-name">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'status'">
              <a-tag
                :color="
                  record.status === CategoryStatus.Enabled ? 'green' : 'default'
                "
              >
                {{ record.status === CategoryStatus.Enabled ? '启用' : '禁用' }}
              </a-tag>
            </template>

            <template v-if="column.key === 'operator'">
              <div class="operator-info">
                <a-avatar
                  size="small"
                  :style="{
                    backgroundColor: getAvatarColor(record.operator_name),
                  }"
                >
                  {{ getInitials(record.operator_name) }}
                </a-avatar>
                <span class="operator-name">{{ record.operator_name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'created_at'">
              <div class="date-info">
                <div class="date">{{ formatDate(record.created_at) }}</div>
                <div class="time">{{ formatTime(record.created_at) }}</div>
              </div>
            </template>

            <template v-if="column.key === 'action'">
              <div class="action-buttons">
                <a-button
                  size="small"
                  type="primary"
                  @click="handleView(record)"
                >
                  查看
                </a-button>
                <a-button
                  size="small"
                  type="default"
                  @click="handleEdit(record)"
                >
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu
                      @click="({ key }: any) => handleMenuAction(key, record)"
                    >
                      <a-menu-item key="toggleStatus">
                        <template
                          v-if="record.status === CategoryStatus.Enabled"
                        >
                          <StopOutlined />
                          禁用
                        </template>
                        <template v-else>
                          <CheckCircleOutlined />
                          启用
                        </template>
                      </a-menu-item>
                      <a-menu-divider v-if="can('workorder.category.delete')" />
                      <a-menu-item
                        v-if="can('workorder.category.delete')"
                        key="delete"
                        danger
                      >
                        <DeleteOutlined />
                        删除
                      </a-menu-item>
                    </a-menu>
                  </template>
                  <a-button size="small">
                    更多
                    <DownOutlined />
                  </a-button>
                </a-dropdown>
              </div>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 创建/编辑对话框 -->
    <a-modal
      :confirm-loading="submitLoading"
      :ok-button-props="{ disabled: !formReady }"
      :open="formDialog.visible"
      :title="formDialog.isEdit ? '编辑分类' : '创建分类'"
      :width="dialogWidth"
      destroy-on-close
      @cancel="closeFormDialog"
      @ok="handleSubmit"
    >
      <a-spin v-if="detailLoading" />
      <a-alert
        v-else-if="!formReady"
        message="分类详情读取失败，请关闭后重新打开"
        show-icon
        type="error"
      />
      <a-form
        v-show="formReady"
        ref="formRef"
        :disabled="!formReady"
        :model="formDialog.data"
        :rules="formRules"
        layout="vertical"
      >
        <a-form-item label="分类名称" name="name">
          <a-input
            v-model:value="formDialog.data.name"
            :maxlength="100"
            placeholder="请输入分类名称"
          />
        </a-form-item>

        <a-form-item label="分类描述" name="description">
          <a-textarea
            v-model:value="formDialog.data.description"
            :maxlength="500"
            :rows="3"
            placeholder="请输入分类描述（可选）"
          />
        </a-form-item>

        <a-form-item label="状态" name="status">
          <a-radio-group v-model:value="formDialog.data.status">
            <a-radio :value="CategoryStatus.Enabled">启用</a-radio>
            <a-radio :value="CategoryStatus.Disabled">禁用</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal
      :footer="null"
      :open="detailDialog.visible"
      :width="dialogWidth"
      title="分类详情"
      @cancel="closeDetailDialog"
    >
      <a-spin v-if="detailLoading" />
      <a-alert
        v-else-if="!detailDialog.data"
        message="分类详情读取失败，请关闭后重新打开"
        show-icon
        type="error"
      />
      <div v-else class="detail-content">
        <a-descriptions :column="1" bordered>
          <a-descriptions-item label="分类ID">
            {{ detailDialog.data.id }}
          </a-descriptions-item>
          <a-descriptions-item label="分类名称">
            {{ detailDialog.data.name }}
          </a-descriptions-item>
          <a-descriptions-item label="分类描述">
            {{ detailDialog.data.description || '无描述' }}
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag
              :color="
                detailDialog.data.status === CategoryStatus.Enabled
                  ? 'green'
                  : 'default'
              "
            >
              {{
                detailDialog.data.status === CategoryStatus.Enabled
                  ? '启用'
                  : '禁用'
              }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="操作人">
            {{ detailDialog.data.operator_name }}
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatFullDateTime(detailDialog.data.created_at) }}
          </a-descriptions-item>
          <a-descriptions-item label="更新时间">
            {{ formatFullDateTime(detailDialog.data.updated_at) }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button type="primary" @click="handleEdit(detailDialog.data)">
            编辑
          </a-button>
        </div>
      </div>
    </a-modal>
  </OpsPage>
</template>

<style scoped>
.create-btn {
  background: var(--ops-accent);
  border: none;
  flex-shrink: 0;
}

.search-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.search-input {
  width: 250px;
  min-width: 200px;
}

.status-filter {
  width: 120px;
  min-width: 100px;
}

.stats-grid {
  margin-bottom: 20px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.table-container {
  margin-bottom: 24px;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.category-name {
  font-weight: 500;
  word-break: break-all;
}

.operator-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.operator-name {
  font-size: 14px;
  word-break: break-all;
}

.date-info {
  display: flex;
  flex-direction: column;
}

.date {
  font-weight: 500;
  font-size: 14px;
}

.time {
  font-size: 12px;
  color: var(--ops-muted);
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.detail-content {
  margin-bottom: 20px;
}

.detail-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

/* 表格滚动优化 */
.table-container :deep(.ant-table-wrapper) {
  overflow: auto;
}

.table-container :deep(.ant-table-thead > tr > th) {
  white-space: nowrap;
}

.table-container :deep(.ant-table-tbody > tr > td) {
  word-break: break-word;
}

/* 对话框响应式优化 */
:deep(.ant-modal) {
  max-width: calc(100vw - 16px);
  margin: 8px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .search-filters {
    width: 100%;
  }

  .search-input {
    width: 100%;
    min-width: auto;
  }

  .status-filter {
    width: 100%;
    min-width: auto;
  }

  .create-btn {
    padding: 4px 8px;
    min-width: auto;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .stats-card :deep(.ant-statistic-title) {
    font-size: 12px;
  }

  .stats-card :deep(.ant-statistic-content) {
    font-size: 16px;
  }

  .action-buttons {
    gap: 4px;
  }

  .action-buttons .ant-btn {
    padding: 0 4px;
    font-size: 12px;
  }

  .detail-footer {
    justify-content: center;
  }

  .detail-footer .ant-btn {
    flex: 1;
    max-width: 120px;
  }

  :deep(.ant-modal-body) {
    padding: 16px;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }
}

/* 平板端适配 */
@media (max-width: 1024px) and (min-width: 769px) {
  .search-input {
    width: 200px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 超小屏幕适配 */
@media (max-width: 480px) {
  .operator-info {
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }

  .operator-name {
    font-size: 12px;
  }

  .date-info {
    text-align: center;
  }

  .date {
    font-size: 12px;
  }

  .time {
    font-size: 10px;
  }
}

/* 大屏幕优化 */
@media (min-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
