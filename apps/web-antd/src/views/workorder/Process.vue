<script setup lang="ts">
import OpsPage from '#/components/ops/OpsPage.vue';
import {
  computed,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  toRaw,
  watch,
} from 'vue';

import { useUserStore } from '@vben/stores';
import { cloneDeep } from '@vben/utils';

import { message, Modal } from 'ant-design-vue';
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  DownOutlined,
  EditOutlined,
  PlusOutlined,
  StopOutlined,
} from '@ant-design/icons-vue';

import {
  createDefaultProcessDefinition,
  createWorkorderProcess,
  type CreateWorkorderProcessReq,
  deleteWorkorderProcess,
  detailWorkorderProcess,
  listWorkorderProcess,
  type ListWorkorderProcessReq,
  ProcessStatus,
  updateWorkorderProcess,
  type WorkorderProcessItem,
} from '#/api/core/workorder/workorder_process';
import {
  listWorkorderCategory,
  type WorkorderCategoryItem,
} from '#/api/core/workorder/workorder_category';
import {
  FormDesignStatus,
  listWorkorderFormDesign,
  type WorkorderFormDesignItem,
} from '#/api/core/workorder/workorder_form_design';

import ProcessBasicConfig from './components/ProcessBasicConfig.vue';

import { useAuthStore } from '#/store/auth';
import { getAvatarColor as avatarColor } from '#/utils/avatar-color';
import { usePermission } from '#/utils/permission';
import {
  shouldNotifyPageError,
  shouldRecordPageError,
} from '#/utils/permission/request-notice';

const { can, hasPerm } = usePermission();
const userStore = useUserStore();
const authStore = useAuthStore();

let disposed = false;
let interactionRevision = 0;
let submitRevision = 0;
let listRevision = 0;
let categoryRevision = 0;
let formsRevision = 0;
let formOwner: string | undefined;
let deleteDialog: ReturnType<typeof Modal.confirm> | undefined;
const detailLoading = ref(false);
const submitLoading = ref(false);
const actionLoading = ref(false);
const formReady = ref(false);

const pageOwner = () =>
  JSON.stringify([
    userStore.userInfo?.userId ?? '',
    authStore.getAuthGeneration(),
  ]);
const validId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const validStatus = (value: number) =>
  value === ProcessStatus.Draft ||
  value === ProcessStatus.Published ||
  value === ProcessStatus.Archived;

const invalidateInteraction = () => {
  ++interactionRevision;
  ++submitRevision;
  formOwner = undefined;
  detailLoading.value = false;
  submitLoading.value = false;
  actionLoading.value = false;
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
  return {
    isCurrent: () =>
      !disposed &&
      revision === interactionRevision &&
      owner === pageOwner() &&
      hasPerm(permission),
    ownsInteraction: () =>
      !disposed && revision === interactionRevision && owner === pageOwner(),
  };
};

const capturePayload = (
  data: CreateWorkorderProcessReq | WorkorderProcessItem,
  nextStatus = data.status,
  nextDefault = data.is_default,
): CreateWorkorderProcessReq | undefined => {
  if (
    !validId(data.form_design_id) ||
    (data.category_id !== undefined &&
      data.category_id !== null &&
      !validId(data.category_id)) ||
    !validStatus(nextStatus) ||
    (nextDefault !== 1 && nextDefault !== 2) ||
    typeof data.name !== 'string' ||
    !data.name.trim() ||
    (data.tags !== undefined && data.tags !== null && !Array.isArray(data.tags))
  ) {
    message.warning('流程标识、关联字段或状态无效，请刷新后重试');
    return;
  }
  try {
    return {
      category_id: data.category_id,
      definition: cloneDeep(toRaw(data.definition)),
      description: data.description,
      form_design_id: data.form_design_id,
      is_default: nextDefault,
      name: data.name,
      status: nextStatus,
      tags:
        data.tags === undefined || data.tags === null
          ? data.tags
          : [...data.tags],
    };
  } catch {
    message.warning('流程定义无法读取，请刷新后重试');
  }
};

const initialProcessForm = (): CreateWorkorderProcessReq & { id?: number } => ({
  category_id: undefined,
  definition: createDefaultProcessDefinition(),
  description: '',
  form_design_id: 0,
  is_default: 2,
  name: '',
  status: ProcessStatus.Draft,
  tags: [],
});

// 列定义
const columns = [
  {
    dataIndex: 'name',
    key: 'name',
    title: '流程名称',
    width: 200,
  },
  {
    dataIndex: 'description',
    ellipsis: true,
    key: 'description',
    title: '描述',
    width: 200,
  },
  {
    dataIndex: 'form_design_id',
    key: 'form_design',
    title: '关联表单',
    width: 150,
  },
  {
    dataIndex: 'category_id',
    key: 'category',
    title: '分类',
    width: 120,
  },
  {
    align: 'center' as const,
    dataIndex: 'status',
    key: 'status',
    title: '状态',
    width: 120,
  },
  {
    align: 'center' as const,
    dataIndex: 'is_default',
    key: 'is_default',
    title: '默认流程',
    width: 100,
  },
  {
    dataIndex: 'tags',
    key: 'tags',
    title: '标签',
    width: 150,
  },
  {
    dataIndex: 'operator_name',
    key: 'operator',
    title: '操作人',
    width: 150,
  },
  {
    dataIndex: 'created_at',
    key: 'createdAt',
    title: '创建时间',
    width: 180,
  },
  {
    align: 'center' as const,
    key: 'action',
    title: '操作',
    width: 200,
  },
];

// 状态数据
const loading = ref(false);
const searchQuery = ref('');
const statusFilter = ref<null | number>(null);
const categoryFilter = ref<null | number>(null);
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);

// 编辑模式
const editMode = ref('basic');

// 组件引用
const basicConfigRef = ref<{ validate: () => Promise<boolean> }>();

// 统计数据
const stats = reactive({
  total: 0,
  published: 0,
  draft: 0,
  archived: 0,
});

// 数据列表
const processList = ref<WorkorderProcessItem[]>([]);
const categories = ref<WorkorderCategoryItem[]>([]);
const formDesigns = ref<WorkorderFormDesignItem[]>([]);

// 分页配置
const paginationConfig = computed(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
  pageSizeOptions: ['10', '20', '50', '100'],
}));

// 流程对话框
const processDialog = reactive({
  visible: false,
  isEdit: false,
  form: initialProcessForm(),
});

// 详情对话框
const detailDialog = reactive({
  visible: false,
  process: null as WorkorderProcessItem | null,
});

watch(
  pageOwner,
  () => {
    invalidateInteraction();
    ++listRevision;
    ++categoryRevision;
    ++formsRevision;
    loading.value = false;
    processDialog.visible = false;
    processDialog.form = initialProcessForm();
    detailDialog.visible = false;
    detailDialog.process = null;
    processList.value = [];
    categories.value = [];
    formDesigns.value = [];
    total.value = 0;
    Object.assign(stats, { archived: 0, draft: 0, published: 0, total: 0 });
  },
  { flush: 'sync' },
);
onUnmounted(() => {
  disposed = true;
  invalidateInteraction();
  ++listRevision;
  ++categoryRevision;
  ++formsRevision;
});

const formDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '90%';
    return '1000px';
  }
  return '1000px';
});

const previewDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '90%';
    return '80%';
  }
  return '80%';
});

/**
 * 加载流程列表数据 - 实现真分页
 */
const loadError = ref('');

const loadProcesses = async (
  stillCurrent: () => boolean = () => true,
): Promise<void> => {
  const revision = ++listRevision;
  const owner = pageOwner();
  const ownsRequest = () =>
    !disposed && revision === listRevision && owner === pageOwner();
  const isCurrent = () => ownsRequest() && stillCurrent();
  if (!isCurrent()) return;
  loading.value = true;
  loadError.value = '';
  try {
    const params: ListWorkorderProcessReq = {
      page: currentPage.value,
      size: pageSize.value,
      search: searchQuery.value || undefined,
      status: statusFilter.value || undefined,
      category_id: categoryFilter.value || undefined,
    };

    const res = (await listWorkorderProcess(params)) as any;
    if (!isCurrent()) return;
    if (res && res.items) {
      processList.value = res.items || [];
      total.value = res.total || 0;

      // 更新统计数据
      const allProcesses = res.items || [];
      stats.total = res.total || 0;
      stats.published = allProcesses.filter(
        (p: WorkorderProcessItem) => p.status === ProcessStatus.Published,
      ).length;
      stats.draft = allProcesses.filter(
        (p: WorkorderProcessItem) => p.status === ProcessStatus.Draft,
      ).length;
      stats.archived = allProcesses.filter(
        (p: WorkorderProcessItem) => p.status === ProcessStatus.Archived,
      ).length;
    }
  } catch (error: any) {
    if (!isCurrent()) return;
    processList.value = [];
    total.value = 0;
    Object.assign(stats, { total: 0, published: 0, draft: 0, archived: 0 });
    if (shouldRecordPageError(error)) loadError.value = '加载流程数据失败';
    if (shouldNotifyPageError(error)) message.error(loadError.value);
  } finally {
    if (ownsRequest()) loading.value = false;
  }
};

// 表格变化处理 - 实现真分页
const handleTableChange = (pagination: any): void => {
  if (pagination.current !== currentPage.value) {
    currentPage.value = pagination.current;
  }
  if (pagination.pageSize !== pageSize.value) {
    pageSize.value = pagination.pageSize;
    currentPage.value = 1; // 改变页大小时重置到第一页
  }
  loadProcesses();
};

/**
 * 加载分类数据 - 实现真分页
 */
const loadCategories = async (): Promise<void> => {
  const revision = ++categoryRevision;
  const owner = pageOwner();
  const isCurrent = () =>
    !disposed && revision === categoryRevision && owner === pageOwner();
  try {
    let allCategories: any[] = [];
    let currentPage = 1;
    const pageSize = 50;
    let hasMoreData = true;

    while (hasMoreData) {
      if (!isCurrent()) return;
      const params = {
        page: currentPage,
        size: pageSize,
        search: undefined,
      };

      const res = (await listWorkorderCategory(params)) as any;
      if (!isCurrent()) return;
      if (res && res.items && res.items.length > 0) {
        allCategories = [...allCategories, ...res.items];

        // 检查是否还有更多数据
        if (
          res.items.length < pageSize ||
          allCategories.length >= (res.total || 0)
        ) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }

    categories.value = allCategories;
  } catch {
    if (isCurrent()) categories.value = [];
  }
};

/**
 * 加载表单列表用于显示 - 实现真分页
 */
const loadFormDesigns = async (): Promise<void> => {
  const revision = ++formsRevision;
  const owner = pageOwner();
  const isCurrent = () =>
    !disposed && revision === formsRevision && owner === pageOwner();
  try {
    let allForms: any[] = [];
    let currentPage = 1;
    const pageSize = 50;
    let hasMoreData = true;

    while (hasMoreData) {
      if (!isCurrent()) return;
      const params = {
        page: currentPage,
        size: pageSize,
        search: undefined,
        status: FormDesignStatus.Published, // 只获取已发布的表单
      };

      const res = (await listWorkorderFormDesign(params)) as any;
      if (!isCurrent()) return;
      if (res && res.items && res.items.length > 0) {
        allForms = [...allForms, ...res.items];

        // 检查是否还有更多数据
        if (
          res.items.length < pageSize ||
          allForms.length >= (res.total || 0)
        ) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }

    formDesigns.value = allForms;
  } catch {
    if (isCurrent()) formDesigns.value = [];
  }
};

// 事件处理
const handleSearch = (): void => {
  currentPage.value = 1;
  loadProcesses();
};

const handleStatusChange = (): void => {
  currentPage.value = 1;
  loadProcesses();
};

const handleCategoryChange = (): void => {
  currentPage.value = 1;
  loadProcesses();
};

const closeProcessDialog = (): void => {
  if (!processDialog.visible) return;
  invalidateInteraction();
  processDialog.visible = false;
};

const closeDetailDialog = (): void => {
  if (!detailDialog.visible) return;
  invalidateInteraction();
  detailDialog.visible = false;
  detailDialog.process = null;
};

const handleCreateProcess = (): void => {
  if (!beginInteraction('/api/workorder/process/create')) return;
  formOwner = pageOwner();
  processDialog.isEdit = false;
  processDialog.form = initialProcessForm();
  editMode.value = 'basic';
  detailDialog.visible = false;
  detailDialog.process = null;
  formReady.value = true;
  processDialog.visible = true;
  loadCategories();
  loadFormDesigns();
};

const readProcess = async (
  row: WorkorderProcessItem,
  mode: 'edit' | 'view',
): Promise<void> => {
  const id = row.id;
  if (!validId(id)) {
    message.warning('流程标识无效，请刷新后重试');
    return;
  }
  const scope = beginInteraction(
    mode === 'edit'
      ? '/api/workorder/process/update/:id'
      : '/api/workorder/process/detail/:id',
  );
  if (!scope) return;
  const isCurrent = () => scope.isCurrent() && row.id === id;
  detailDialog.process = null;
  detailDialog.visible = mode === 'view';
  processDialog.visible = mode === 'edit';
  if (mode === 'edit') {
    formOwner = pageOwner();
    processDialog.isEdit = true;
    processDialog.form = { ...initialProcessForm(), id };
    editMode.value = 'basic';
  }
  detailLoading.value = true;
  try {
    const result: WorkorderProcessItem = await detailWorkorderProcess({ id });
    if (!isCurrent()) return;
    if (!result || result.id !== id) throw new Error('流程详情标识不匹配');
    if (mode === 'edit') {
      const payload = capturePayload(result);
      if (!payload) return;
      processDialog.form = {
        ...payload,
        definition: payload.definition || createDefaultProcessDefinition(),
        id,
        tags: payload.tags || [],
      };
      formReady.value = true;
      loadCategories();
      loadFormDesigns();
    } else {
      detailDialog.process = result;
    }
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error('获取流程详情失败');
  } finally {
    if (scope.ownsInteraction()) detailLoading.value = false;
  }
};

const handleEditProcess = (row: WorkorderProcessItem) =>
  readProcess(row, 'edit');
const handleViewProcess = (row: WorkorderProcessItem) =>
  readProcess(row, 'view');

type ProcessTransition = 'activate' | 'archive' | 'publish' | 'setDefault';
const transitionProcess = async (
  record: WorkorderProcessItem,
  action: ProcessTransition,
): Promise<void> => {
  const id = record.id;
  if (!validId(id) || actionLoading.value) return;
  const scope = beginInteraction('/api/workorder/process/update/:id');
  if (!scope) return;
  const status =
    action === 'setDefault'
      ? record.status
      : {
          activate: ProcessStatus.Draft,
          archive: ProcessStatus.Archived,
          publish: ProcessStatus.Published,
        }[action];
  const payload = capturePayload(
    record,
    status,
    action === 'setDefault' ? 1 : record.is_default,
  );
  if (!payload) return;
  const isCurrent = () => scope.isCurrent() && record.id === id;
  processDialog.visible = false;
  detailDialog.visible = false;
  actionLoading.value = true;
  try {
    await updateWorkorderProcess({
      ...payload,
      description: payload.description || '',
      id,
    });
    if (!isCurrent()) return;
    const resultText = {
      activate: '已激活',
      archive: '已归档',
      publish: '已发布',
      setDefault: '已设为默认',
    }[action];
    message.success(`流程 "${payload.name}" ${resultText}`);
    await loadProcesses(isCurrent);
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error(
        {
          activate: '激活流程失败',
          archive: '归档流程失败',
          publish: '发布流程失败',
          setDefault: '设置默认流程失败',
        }[action],
      );
  } finally {
    if (scope.ownsInteraction()) actionLoading.value = false;
  }
};

const confirmDelete = (record: WorkorderProcessItem): void => {
  const id = record.id;
  if (!validId(id)) return;
  const scope = beginInteraction('/api/workorder/process/delete/:id');
  if (!scope) return;
  const name = record.name;
  const page = currentPage.value;
  const items = processList.value;
  const isCurrent = () => scope.isCurrent() && record.id === id;
  processDialog.visible = false;
  detailDialog.visible = false;
  let consumed = false;
  deleteDialog = Modal.confirm({
    cancelText: '取消',
    content: `确定要删除流程 "${name}" 吗？这个操作不可恢复！`,
    okText: '删除',
    okType: 'danger',
    onCancel() {
      if (scope.ownsInteraction()) invalidateInteraction();
    },
    async onOk() {
      if (consumed || !isCurrent()) return;
      consumed = true;
      actionLoading.value = true;
      try {
        await deleteWorkorderProcess({ id });
        if (!isCurrent()) return;
        message.success(`流程 "${name}" 已删除`);
        if (
          currentPage.value === page &&
          processList.value === items &&
          items.length === 1 &&
          page > 1
        )
          currentPage.value = page - 1;
        await loadProcesses(isCurrent);
      } catch (error: unknown) {
        if (isCurrent() && shouldNotifyPageError(error))
          message.error('删除流程失败');
      } finally {
        if (scope.ownsInteraction()) actionLoading.value = false;
      }
    },
    title: '警告',
  });
};

const handleCommand = async (
  command: string,
  row: WorkorderProcessItem,
): Promise<void> => {
  if (command === 'delete') confirmDelete(row);
  else if (
    command === 'publish' ||
    command === 'archive' ||
    command === 'activate' ||
    command === 'setDefault'
  )
    await transitionProcess(row, command);
};

const formFingerprint = (): string | undefined => {
  try {
    return JSON.stringify(processDialog.form);
  } catch {
    return undefined;
  }
};

const saveProcess = async (): Promise<void> => {
  if (
    !processDialog.visible ||
    !formReady.value ||
    submitLoading.value ||
    disposed
  )
    return;
  const owner = formOwner;
  const form = basicConfigRef.value;
  if (!owner || owner !== pageOwner() || !userStore.userInfo?.userId) return;
  if (
    !form ||
    typeof form.validate !== 'function' ||
    editMode.value !== 'basic'
  ) {
    message.warning('表单尚未就绪，请稍后重试');
    return;
  }
  const data = processDialog.form;
  const isEdit = processDialog.isEdit;
  const id = data.id;
  if (isEdit && !validId(id)) {
    message.warning('流程标识无效，请刷新后重试');
    return;
  }
  let snapshot: typeof data;
  try {
    snapshot = cloneDeep(toRaw(data));
  } catch {
    message.warning('流程定义无法读取，请刷新后重试');
    return;
  }
  const fingerprint = formFingerprint();
  if (fingerprint === undefined) return;
  const revision = interactionRevision;
  const ticket = ++submitRevision;
  const permission = isEdit
    ? '/api/workorder/process/update/:id'
    : '/api/workorder/process/create';
  const ownsOperation = () =>
    !disposed &&
    revision === interactionRevision &&
    ticket === submitRevision &&
    owner === pageOwner();
  const isCurrent = () =>
    ownsOperation() &&
    hasPerm(permission) &&
    processDialog.visible &&
    processDialog.isEdit === isEdit &&
    processDialog.form === data &&
    data.id === id &&
    basicConfigRef.value === form &&
    editMode.value === 'basic' &&
    formFingerprint() === fingerprint;
  if (!isCurrent()) return;
  submitLoading.value = true;
  try {
    const valid = await form.validate();
    if (!isCurrent() || valid !== true) return;
    const payload = capturePayload(snapshot);
    if (!payload) return;
    if (isEdit) {
      if (!validId(id)) return;
      await updateWorkorderProcess({
        ...payload,
        description: payload.description || '',
        id,
      });
      if (!isCurrent()) return;
      message.success(`流程 "${payload.name}" 已更新`);
    } else {
      await createWorkorderProcess(payload);
      if (!isCurrent()) return;
      message.success(`流程 "${payload.name}" 已创建`);
      currentPage.value = 1;
    }
    processDialog.visible = false;
    await loadProcesses(() => ownsOperation() && hasPerm(permission));
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error(isEdit ? '更新流程失败' : '创建流程失败');
  } finally {
    if (ownsOperation()) submitLoading.value = false;
  }
};

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const formatTime = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const formatFullDateTime = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const isDefaultProcess = (value: number | undefined): boolean => value === 1;

const getInitials = (name: string | undefined): string => {
  if (!name) return '';
  return name.split('').slice(0, 2).join('').toUpperCase();
};

const getStatusClass = (status: number): string => {
  switch (status) {
    case ProcessStatus.Draft: {
      return 'status-draft';
    }
    case ProcessStatus.Published: {
      return 'status-published';
    }
    case ProcessStatus.Archived: {
      return 'status-archived';
    }
    default: {
      return '';
    }
  }
};

const getStatusColor = (status: number): string => {
  switch (status) {
    case ProcessStatus.Draft: {
      return 'orange';
    }
    case ProcessStatus.Published: {
      return 'green';
    }
    case ProcessStatus.Archived: {
      return 'default';
    }
    default: {
      return 'default';
    }
  }
};

const getStatusText = (status: number): string => {
  switch (status) {
    case ProcessStatus.Draft: {
      return '草稿';
    }
    case ProcessStatus.Published: {
      return '已发布';
    }
    case ProcessStatus.Archived: {
      return '已归档';
    }
    default: {
      return '未知';
    }
  }
};

const getAvatarColor = (name: string | undefined): string => {
  return avatarColor(name || '');
};

const getFormName = (formId: number | undefined): string => {
  if (!formId) return '未知表单';
  const form = formDesigns.value.find((f) => f.id === formId);
  return form ? form.name : `表单${formId}`;
};

const getCategoryName = (categoryId: number | undefined): string => {
  if (!categoryId) return '无分类';
  const category = categories.value.find((c) => c.id === categoryId);
  return category ? category.name : `分类${categoryId}`;
};

const formatDefinitionForDisplay = (definition: any): string => {
  if (!definition) return '{}';
  if (typeof definition === 'string') {
    try {
      return JSON.stringify(JSON.parse(definition), null, 2);
    } catch {
      return definition;
    }
  }
  return JSON.stringify(definition, null, 2);
};

// 初始化
onMounted(() => {
  loadProcesses();
  loadCategories();
  loadFormDesigns();
});
</script>

<template>
  <OpsPage title="流程管理">
    <template #actions>
      <a-button class="btn-create" type="primary" @click="handleCreateProcess">
        <template #icon>
          <PlusOutlined />
        </template>
        创建新流程
      </a-button>
    </template>
    <template #filters>
      <div class="search-filters">
        <a-input-search
          v-model:value="searchQuery"
          allow-clear
          class="search-input"
          placeholder="搜索流程..."
          @search="handleSearch"
        />
        <a-select
          v-model:value="statusFilter"
          class="status-filter"
          placeholder="状态"
          @change="handleStatusChange"
        >
          <a-select-option :value="null">全部</a-select-option>
          <a-select-option :value="ProcessStatus.Draft">草稿</a-select-option>
          <a-select-option :value="ProcessStatus.Published">
            已发布
          </a-select-option>
          <a-select-option :value="ProcessStatus.Archived">
            已归档
          </a-select-option>
        </a-select>
        <a-select
          v-model:value="categoryFilter"
          class="category-filter"
          placeholder="分类"
          @change="handleCategoryChange"
        >
          <a-select-option :value="null">全部分类</a-select-option>
          <a-select-option
            v-for="category in categories"
            :key="category.id"
            :value="category.id"
          >
            {{ category.name }}
          </a-select-option>
        </a-select>
      </div>
    </template>

    <template #summary>
      <div class="stats-row">
        <a-row :gutter="16">
          <a-col :md="6" :sm="12" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="stats.total"
                :value-style="{ color: '#3f8600' }"
                title="总流程数"
              >
                <template #prefix>
                  <ApartmentOutlined />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :md="6" :sm="12" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="stats.published"
                :value-style="{ color: '#52c41a' }"
                title="本页已发布"
              >
                <template #prefix>
                  <CheckCircleOutlined />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :md="6" :sm="12" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="stats.draft"
                :value-style="{ color: '#faad14' }"
                title="本页草稿"
              >
                <template #prefix>
                  <EditOutlined />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :md="6" :sm="12" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="stats.archived"
                :value-style="{ color: '#cf1322' }"
                title="本页已归档"
              >
                <template #prefix>
                  <StopOutlined />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
        </a-row>
      </div>
    </template>

    <a-alert v-if="loadError" :message="loadError" show-icon type="error">
      <template #action>
        <a-button size="small" @click="loadProcesses()">重试</a-button>
      </template>
    </a-alert>

    <div class="table-container">
      <a-card>
        <a-table
          :columns="columns"
          :data-source="processList"
          :loading="loading || actionLoading"
          :pagination="paginationConfig"
          :scroll="{ x: 1200 }"
          bordered
          row-key="id"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="process-name-cell">
                <div
                  class="process-badge"
                  :class="getStatusClass(record.status)"
                ></div>
                <span class="process-name-text">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'description'">
              <span class="description-text">{{
                record.description || '无描述'
              }}</span>
            </template>

            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ getStatusText(record.status) }}
              </a-tag>
            </template>

            <template v-if="column.key === 'form_design'">
              <span>{{ getFormName(record.form_design_id) }}</span>
            </template>

            <template v-if="column.key === 'category'">
              <span>{{ getCategoryName(record.category_id) }}</span>
            </template>

            <template v-if="column.key === 'operator'">
              <div class="creator-info">
                <a-avatar
                  size="small"
                  :style="{
                    backgroundColor: getAvatarColor(record.operator_name),
                  }"
                >
                  {{ getInitials(record.operator_name) }}
                </a-avatar>
                <span class="creator-name">{{ record.operator_name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'is_default'">
              <a-tag
                :color="
                  isDefaultProcess(record.is_default) ? 'green' : 'default'
                "
              >
                {{ isDefaultProcess(record.is_default) ? '是' : '否' }}
              </a-tag>
            </template>

            <template v-if="column.key === 'tags'">
              <div class="tags-container">
                <a-tag v-for="tag in record.tags" :key="tag" color="blue">
                  {{ tag }}
                </a-tag>
                <span
                  v-if="!record.tags || record.tags.length === 0"
                  class="no-tags"
                  >无标签</span
                >
              </div>
            </template>

            <template v-if="column.key === 'createdAt'">
              <div class="date-info">
                <span class="date">{{ formatDate(record.created_at) }}</span>
                <span class="time">{{ formatTime(record.created_at) }}</span>
              </div>
            </template>

            <template v-if="column.key === 'action'">
              <div class="action-buttons">
                <a-button
                  size="small"
                  type="primary"
                  @click="handleViewProcess(record)"
                >
                  查看
                </a-button>
                <a-button
                  size="small"
                  type="default"
                  @click="handleEditProcess(record)"
                >
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleCommand(e.key, record)">
                      <a-menu-item
                        v-if="record.status === ProcessStatus.Draft"
                        key="publish"
                      >
                        发布
                      </a-menu-item>
                      <a-menu-item
                        v-if="record.status === ProcessStatus.Published"
                        key="archive"
                      >
                        归档
                      </a-menu-item>
                      <a-menu-item
                        v-if="record.status === ProcessStatus.Archived"
                        key="activate"
                      >
                        激活
                      </a-menu-item>
                      <a-menu-item
                        key="setDefault"
                        v-if="!isDefaultProcess(record.is_default)"
                      >
                        设为默认
                      </a-menu-item>
                      <a-menu-divider v-if="can('workorder.process.delete')" />
                      <a-menu-item
                        v-if="can('workorder.process.delete')"
                        key="delete"
                        danger
                      >
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

    <!-- 流程创建/编辑对话框 -->
    <a-modal
      :confirm-loading="submitLoading"
      :destroy-on-close="true"
      :ok-button-props="{ disabled: !formReady }"
      :open="processDialog.visible"
      :title="processDialog.isEdit ? '编辑流程' : '创建流程'"
      :width="formDialogWidth"
      class="responsive-modal process-design-modal"
      @cancel="closeProcessDialog"
      @ok="saveProcess"
    >
      <a-spin v-if="detailLoading" />
      <a-alert
        v-else-if="!formReady"
        message="流程详情读取失败，请关闭后重新打开"
        show-icon
        type="error"
      />
      <div v-else class="modal-content">
        <!-- 流程编辑模式切换 -->
        <div class="edit-mode-tabs">
          <a-tabs v-model:activeKey="editMode" type="card">
            <a-tab-pane key="basic" tab="基本信息">
              <ProcessBasicConfig
                :key="interactionRevision"
                ref="basicConfigRef"
                v-model="processDialog.form"
                :categories="categories"
                :forms="formDesigns"
              />
            </a-tab-pane>
          </a-tabs>
        </div>
      </div>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal
      :footer="null"
      :open="detailDialog.visible"
      :width="previewDialogWidth"
      class="detail-dialog responsive-modal"
      title="流程详情"
      @cancel="closeDetailDialog"
    >
      <a-spin v-if="detailLoading" />
      <a-alert
        v-else-if="!detailDialog.process"
        message="流程详情读取失败，请关闭后重新打开"
        show-icon
        type="error"
      />
      <div v-else class="process-details">
        <div class="detail-header">
          <h2>{{ detailDialog.process.name }}</h2>
          <a-tag :color="getStatusColor(detailDialog.process.status)">
            {{ getStatusText(detailDialog.process.status) }}
          </a-tag>
        </div>

        <a-descriptions :column="2" bordered>
          <a-descriptions-item label="ID">
            {{ detailDialog.process.id }}
          </a-descriptions-item>
          <a-descriptions-item label="操作人">
            {{ detailDialog.process.operator_name }}
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatFullDateTime(detailDialog.process.created_at) }}
          </a-descriptions-item>
          <a-descriptions-item label="更新时间">
            {{ formatFullDateTime(detailDialog.process.updated_at) }}
          </a-descriptions-item>
          <a-descriptions-item label="关联表单">
            {{ getFormName(detailDialog.process.form_design_id) }}
          </a-descriptions-item>
          <a-descriptions-item label="分类">
            {{ getCategoryName(detailDialog.process.category_id) }}
          </a-descriptions-item>
          <a-descriptions-item label="是否默认">
            {{
              isDefaultProcess(detailDialog.process.is_default) ? '是' : '否'
            }}
          </a-descriptions-item>
          <a-descriptions-item label="标签">
            <div class="tags-container">
              <a-tag
                v-for="tag in detailDialog.process.tags"
                :key="tag"
                color="blue"
              >
                {{ tag }}
              </a-tag>
              <span
                v-if="
                  !detailDialog.process.tags ||
                  detailDialog.process.tags.length === 0
                "
                >无标签</span
              >
            </div>
          </a-descriptions-item>
          <a-descriptions-item :span="2" label="描述">
            {{ detailDialog.process.description || '无描述' }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="process-preview">
          <h3>流程定义</h3>
          <a-card>
            <pre class="definition-json">{{
              formatDefinitionForDisplay(detailDialog.process.definition)
            }}</pre>
          </a-card>
        </div>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button
            type="primary"
            @click="handleEditProcess(detailDialog.process)"
          >
            编辑
          </a-button>
        </div>
      </div>
    </a-modal>
  </OpsPage>
</template>

<style scoped>
.header-actions {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
}

@media (max-width: 768px) {
  .header-actions {
    grid-template-columns: 1fr;
  }
}

.btn-create {
  background: var(--ops-accent);
  border: none;
}

.search-filters {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
}

@media (max-width: 768px) {
  .search-filters {
    grid-template-columns: 1fr;
  }
}

.search-input {
  min-width: 200px;
}

.stats-row {
  margin-bottom: 20px;
}

.stats-card {
  border-radius: var(--ops-radius);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  height: 100%;
}

.table-container {
  min-width: 0;
  margin-bottom: 24px;
}

.process-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.process-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-draft {
  background-color: #faad14;
}

.status-published {
  background-color: #52c41a;
}

.status-archived {
  background-color: var(--ops-border);
}

.process-name-text {
  font-weight: 500;
}

.description-text {
  color: #606266;
}

.creator-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.creator-name {
  font-size: 14px;
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

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.no-tags {
  color: var(--ops-muted);
  font-style: italic;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.detail-dialog .process-details {
  margin-bottom: 20px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.detail-header h2 {
  margin: 0;
  font-size: 24px;
  color: var(--ops-ink);
}

.process-preview {
  margin-top: 24px;
}

.process-preview h3 {
  margin: 24px 0 16px 0;
  color: var(--ops-ink);
  font-size: 18px;
  font-weight: 600;
}

.definition-json {
  background: var(--ops-ground);
  padding: 16px;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

.detail-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

/* 模态框内容样式 */
.modal-content {
  max-height: 70vh;
  overflow-y: auto;
}

.edit-mode-tabs :deep(.ant-tabs-content-holder) {
  max-height: 60vh;
  overflow-y: auto;
}

.responsive-modal :deep(.ant-modal) {
  max-width: calc(100vw - 16px);
  margin: 8px;
}

.process-design-modal :deep(.ant-modal-body) {
  max-height: 80vh;
  overflow-y: auto;
  padding: 16px;
}

@media (max-width: 768px) {
  .search-input {
    min-width: auto;
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

  .responsive-modal :deep(.ant-modal-body) {
    padding: 12px;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }
}
</style>
