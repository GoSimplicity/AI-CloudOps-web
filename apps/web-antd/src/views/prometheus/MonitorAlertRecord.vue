<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { useUserStore } from '@vben/stores';

import { DownOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
import { message, Modal } from 'ant-design-vue';

import {
  createMonitorRecordRuleApi,
  deleteMonitorRecordRuleApi,
  getMonitorRecordRuleApi,
  getMonitorRecordRuleListApi,
  type MonitorRecordRule,
  updateMonitorRecordRuleApi,
} from '#/api/core/prometheus/prometheus_alert_record';
import { promqlExprCheckApi } from '#/api/core/prometheus/prometheus_alert_rule';
import { getMonitorScrapePoolListApi } from '#/api/core/prometheus/prometheus_scrape_pool';
import OpsPage from '#/components/ops/OpsPage.vue';
import { useAuthStore } from '#/store';
import { getAvatarColor } from '#/utils/avatar-color';
import { usePermission } from '#/utils/permission';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';

import { useListRequest } from './useListRequest';

const { can, hasPerm } = usePermission();

// 定义 Pool 类型
interface Pool {
  id: number;
  name: string;
}

let disposed = false;
let detailRevision = 0;
const mutationVersions = new Map<number, number>();
let mutationRevision = 0;
onBeforeUnmount(() => {
  disposed = true;
  detailRevision += 1;
  mutationVersions.clear();
});

const operationOwner = (): string | undefined => {
  const userId = Number(useUserStore().userInfo?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) return undefined;
  return JSON.stringify([userId, useAuthStore().getAuthGeneration()]);
};

const validRecordId = (id: unknown): id is number =>
  typeof id === 'number' && Number.isSafeInteger(id) && id > 0;

// 响应式对话框宽度
const formDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '90%';
    return '900px';
  }
  return '900px';
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

// 列定义
const columns = [
  {
    dataIndex: 'name',
    fixed: 'left',
    key: 'name',
    title: '记录名称',
    width: 200,
  },
  { dataIndex: 'pool_name', key: 'pool_name', title: '关联实例池', width: 180 },
  { dataIndex: 'ip_address', key: 'ip_address', title: 'IP地址', width: 200 },
  {
    align: 'center' as const,
    dataIndex: 'enable',
    key: 'enable',
    title: '是否启用',
    width: 100,
  },
  { dataIndex: 'expr', key: 'expr', title: '表达式', width: 250 },
  {
    dataIndex: 'create_user_name',
    key: 'creator',
    title: '创建人',
    width: 120,
  },
  { dataIndex: 'created_at', key: 'created_at', title: '创建时间', width: 180 },
  {
    align: 'center' as const,
    fixed: 'right',
    key: 'action',
    title: '操作',
    width: 200,
  },
];

// 状态数据
const loading = ref(false);
const {
  beginRequest,
  invalidate: invalidateList,
  loadError,
} = useListRequest(loading);
const submitLoading = ref(false);
const validatingExpr = ref(false);
const searchText = ref('');
const enabledFilter = ref<1 | 2 | undefined>(undefined);
const data = ref<MonitorRecordRule[]>([]);
const poolOptions = ref<Pool[]>([]);
const poolNameCache = new Map<number, string>();
let poolCacheOwner: string | undefined;
const showPoolPagination = ref(false);

// 防抖处理
let searchTimeout: null | ReturnType<typeof setTimeout> = null;
let poolSearchTimeout: null | ReturnType<typeof setTimeout> = null;
onBeforeUnmount(() => {
  if (searchTimeout) clearTimeout(searchTimeout);
  if (poolSearchTimeout) clearTimeout(poolSearchTimeout);
});

// 分页配置
const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  size: 'default' as const,
  total: 0,
});

// Prometheus实例池分页配置
const poolPagination = reactive({
  current: 1,
  pageSize: 10,
  search: '',
  total: 0,
});

// 统计数据
const stats = reactive({
  disabled: 0,
  enabled: 0,
  pools: 0,
  total: 0,
});

// 对话框状态
const isAddModalVisible = ref(false);
const isEditModalVisible = ref(false);
const detailDialogVisible = ref(false);

// 表单引用
const addFormRef = ref<FormInstance>();
const editFormRef = ref<FormInstance>();

// 新增表单
const addForm = reactive({
  enable: 2 as 1 | 2,
  expr: '',
  ip_address: '',
  labels: [] as string[],
  name: '',
  pool_id: 0,
});

// 编辑表单
const editForm = reactive({
  enable: 1 as 1 | 2,
  expr: '',
  id: 0,
  ip_address: '',
  labels: [] as string[],
  name: '',
  pool_id: 0,
});

// 详情对话框数据
const detailDialog = reactive({
  form: null as MonitorRecordRule | null,
});

type RecordFormMode = 'add' | 'edit';
const formRevision = ref(0);
let submissionRevision = 0;
let expressionRevision = 0;
let poolRevision = 0;
let formOwner: string | undefined;
const formPermission = (mode: RecordFormMode) =>
  hasPerm(
    `/api/monitor/record_rules/${mode === 'add' ? 'create' : 'update/:id'}`,
  );
const clearFormScope = () => {
  formRevision.value += 1;
  submissionRevision += 1;
  expressionRevision += 1;
  poolRevision += 1;
  formOwner = undefined;
  isAddModalVisible.value = false;
  isEditModalVisible.value = false;
  submitLoading.value = false;
  validatingExpr.value = false;
  showPoolPagination.value = false;
  poolOptions.value = [];
  poolPagination.current = 1;
  poolPagination.search = '';
  poolPagination.total = 0;
  if (poolSearchTimeout) clearTimeout(poolSearchTimeout);
  poolSearchTimeout = null;
};
const captureFormScope = (mode: RecordFormMode) => {
  const owner = formOwner;
  const revision = formRevision.value;
  const model = mode === 'add' ? addForm : editForm;
  const visible = () =>
    mode === 'add' ? isAddModalVisible.value : isEditModalVisible.value;
  if (
    disposed ||
    !owner ||
    owner !== operationOwner() ||
    !visible() ||
    !formPermission(mode)
  )
    return;
  return {
    isCurrent: () =>
      !disposed &&
      visible() &&
      formRevision.value === revision &&
      formOwner === owner &&
      operationOwner() === owner &&
      formPermission(mode),
    mode,
    model,
    owner,
    revision,
  };
};

// 表单验证规则
const formRules = {
  expr: [{ message: '请输入表达式', required: true, trigger: 'blur' }],
  ip_address: [
    {
      trigger: 'blur',
      validator: (_rule: any, value: string) => {
        if (!value) {
          return Promise.resolve();
        }
        // 支持 IP:PORT 格式，如 192.168.1.100:9090 或 localhost:9090
        const ipPortPattern =
          /^(([\dA-Za-z]|[\dA-Za-z][\dA-Za-z\-]*[\dA-Za-z])\.)*([\dA-Za-z]|[\dA-Za-z][\dA-Za-z\-]*[\dA-Za-z])(:\d+)?$/;
        if (!ipPortPattern.test(value)) {
          return Promise.reject(
            '请输入有效的IP地址，如 192.168.1.100:9090 或 localhost:9090',
          );
        }
        // 如果包含端口，验证端口范围
        if (value.includes(':')) {
          const portStr = value.split(':')[1];
          if (portStr) {
            const port = parseInt(portStr);
            if (port < 1 || port > 65_535) {
              return Promise.reject('端口必须在1-65535之间');
            }
          }
        }
        return Promise.resolve();
      },
    },
  ],
  name: [
    { message: '请输入记录名称', required: true, trigger: 'blur' },
    { max: 50, message: '长度应为1到50个字符', min: 1, trigger: 'blur' },
  ],
  pool_id: [
    {
      required: true,
      trigger: 'change',
      validator: (_rule: unknown, value: unknown) =>
        validRecordId(value)
          ? Promise.resolve()
          : Promise.reject(new Error('请选择有效的实例池')),
    },
  ],
};

const getRecordStatusClass = (record: MonitorRecordRule): string => {
  return record.enable === 1 ? 'status-full' : 'status-none';
};

const getInitials = (name: string): string => {
  if (!name) return '';
  return name.slice(0, 2).toUpperCase();
};

const formatDate = (timestamp: number | string): string => {
  if (!timestamp) return '';
  return new Date(
    typeof timestamp === 'string' ? timestamp : timestamp * 1000,
  ).toLocaleDateString('zh-CN');
};

const formatTime = (timestamp: number | string): string => {
  if (!timestamp) return '';
  return new Date(
    typeof timestamp === 'string' ? timestamp : timestamp * 1000,
  ).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const formatFullDateTime = (timestamp: string): string => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('zh-CN');
};

const truncateText = (text: string, maxLength: number): string => {
  if (!text) return '';
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

// 更新统计数据
const updateStats = () => {
  stats.total = paginationConfig.total;
  stats.enabled = data.value.filter((item) => item.enable === 1).length;
  stats.disabled = data.value.filter((item) => item.enable === 2).length;
  stats.pools = new Set(data.value.map((item) => item.pool_id)).size;
};

// 数据加载
const fetchRecordRulesForScope = async (
  stillCurrent: () => boolean = () => true,
): Promise<void> => {
  const owner = operationOwner();
  if (disposed || !owner || !stillCurrent()) return;
  const request = beginRequest();
  const isCurrent = () =>
    request.isCurrent() && owner === operationOwner() && stillCurrent();
  try {
    const response = await getMonitorRecordRuleListApi({
      enable: enabledFilter.value,
      page: paginationConfig.current,
      search: searchText.value || undefined,
      size: paginationConfig.pageSize,
    });
    if (!isCurrent()) return;
    data.value = response.items || [];
    paginationConfig.total = response.total || 0;
    updateStats();
  } catch (error: any) {
    if (
      !isCurrent() ||
      !request.fail(new Error('加载记录规则列表失败'), '加载记录规则列表失败')
    )
      return;
    data.value = [];
    paginationConfig.total = 0;
    updateStats();
    if (shouldNotifyPageError(error)) message.error(loadError.value);
  } finally {
    request.finish();
  }
};

const fetchRecordRules = () => fetchRecordRulesForScope();

// Keep only a current selection's known label when paging or reopening.
const setPoolOptions = (items: Pool[], owner: string) => {
  if (poolCacheOwner !== owner) {
    poolNameCache.clear();
    poolCacheOwner = owner;
  }
  for (const pool of items) {
    if (
      validRecordId(pool.id) &&
      typeof pool.name === 'string' &&
      pool.name.trim()
    ) {
      poolNameCache.set(pool.id, pool.name);
    }
  }
  let selectedId: number | undefined;
  if (isEditModalVisible.value) selectedId = editForm.pool_id;
  else if (isAddModalVisible.value) selectedId = addForm.pool_id;
  const name = validRecordId(selectedId)
    ? poolNameCache.get(selectedId)
    : undefined;
  poolOptions.value =
    validRecordId(selectedId) &&
    name !== undefined &&
    !items.some((pool) => pool.id === selectedId)
      ? [{ id: selectedId, name }, ...items]
      : items;
};

// 获取Prometheus实例池数据（支持分页和搜索）
const loadPools = async () => {
  const owner = operationOwner();
  const revision = formRevision.value;
  if (disposed || !owner) return;
  const ticket = ++poolRevision;
  const isCurrent = () =>
    !disposed &&
    owner === operationOwner() &&
    revision === formRevision.value &&
    ticket === poolRevision;
  try {
    const response = await getMonitorScrapePoolListApi({
      page: poolPagination.current,
      search: poolPagination.search,
      size: poolPagination.pageSize,
    });
    if (!isCurrent()) return;
    setPoolOptions(
      (response.items || []).filter((pool: Pool) => validRecordId(pool.id)),
      owner,
    );
    poolPagination.total = response.total;
  } catch (error: unknown) {
    if (!isCurrent()) return;
    setPoolOptions([], owner);
    poolPagination.total = 0;
    if (shouldNotifyPageError(error))
      message.error('获取实例池数据失败，请稍后重试');
  }
};

// 处理实例池搜索
const handlePoolSearch = (value: string) => {
  poolRevision += 1;
  if (poolSearchTimeout) {
    clearTimeout(poolSearchTimeout);
  }
  const owner = operationOwner();
  const revision = formRevision.value;
  poolSearchTimeout = setTimeout(() => {
    if (
      disposed ||
      owner !== operationOwner() ||
      revision !== formRevision.value
    )
      return;
    poolPagination.search = value;
    poolPagination.current = 1;
    loadPools();
  }, 300);
};

// 处理实例池下拉框显示/隐藏
const handlePoolDropdownChange = (open: boolean) => {
  showPoolPagination.value = open;
  if (open && poolOptions.value.length === 0) {
    loadPools();
  }
};

// 事件处理
const handleTableChange = (pagination: any): void => {
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  fetchRecordRules();
};

const handleSearch = (): void => {
  paginationConfig.current = 1;
  fetchRecordRules();
};

const handleSearchChange = (): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    paginationConfig.current = 1;
    fetchRecordRules();
  }, 500);
};

const handleEnabledFilterChange = (): void => {
  paginationConfig.current = 1;
  fetchRecordRules();
};

const handleReset = (): void => {
  searchText.value = '';
  enabledFilter.value = undefined;
  paginationConfig.current = 1;
  fetchRecordRules();
};

// 查看记录详情
const handleViewRecord = async (record: MonitorRecordRule): Promise<void> => {
  if (disposed) return;
  const id = record.id;
  const owner = operationOwner();
  if (!validRecordId(id) || !owner) {
    message.warning('记录规则或账号标识无效，请刷新后重试');
    return;
  }
  const ticket = ++detailRevision;
  const isCurrent = () =>
    !disposed &&
    record.id === id &&
    detailRevision === ticket &&
    operationOwner() === owner;
  try {
    const response = await getMonitorRecordRuleApi(id);
    if (!isCurrent()) return;
    if (response?.id !== id)
      throw new Error('记录规则详情标识无效，请刷新后重试');
    detailDialog.form = response;
    detailDialogVisible.value = true;
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error)) {
      message.error(
        error instanceof Error && error.message
          ? error.message
          : '获取记录详情失败',
      );
    }
  }
};

// 每条记录的最新写入回执只更新原详情窗口，不触碰后来打开的记录。
const setRecordEnabled = async (
  record: MonitorRecordRule,
  enable: 1 | 2,
): Promise<void> => {
  if (disposed) return;
  const id = record.id;
  const owner = operationOwner();
  if (!validRecordId(id) || !owner) {
    message.warning('记录规则或账号标识无效，请刷新后重试');
    return;
  }
  const ticket = ++mutationRevision;
  mutationVersions.set(id, ticket);
  const detailTicket = detailRevision;
  const isCurrent = () =>
    !disposed &&
    record.id === id &&
    operationOwner() === owner &&
    mutationVersions.get(id) === ticket;
  const name = record.name;
  try {
    const payload = {
      enable,
      expr: record.expr,
      id,
      ip_address: record.ip_address,
      labels: record.labels,
      name,
      pool_id: record.pool_id,
    };
    await updateMonitorRecordRuleApi(payload);
    if (!isCurrent()) return;
    message.success(`记录规则 "${name}" 已${enable === 1 ? '启用' : '禁用'}`);
    fetchRecordRules();
    if (
      detailDialogVisible.value &&
      detailRevision === detailTicket &&
      detailDialog.form?.id === id
    ) {
      detailDialog.form.enable = enable;
    }
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error)) {
      message.error(
        error instanceof Error && error.message
          ? error.message
          : `${enable === 1 ? '启用' : '禁用'}记录规则失败`,
      );
    }
  } finally {
    if (mutationVersions.get(id) === ticket) {
      mutationVersions.delete(id);
    }
  }
};

const handleEnableRecord = (record: MonitorRecordRule): Promise<void> =>
  setRecordEnabled(record, 1);
const handleDisableRecord = (record: MonitorRecordRule): Promise<void> =>
  setRecordEnabled(record, 2);

// 处理删除记录规则
const handleDelete = (record: MonitorRecordRule): void => {
  if (disposed) return;
  const id = record.id;
  const owner = operationOwner();
  if (!validRecordId(id) || !owner) {
    message.warning('记录规则或账号标识无效，请刷新后重试');
    return;
  }
  const inScope = () =>
    !disposed && record.id === id && operationOwner() === owner;
  let confirmationConsumed = false;
  Modal.confirm({
    cancelText: '取消',
    content: `确定要删除记录规则 "${record.name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      if (confirmationConsumed || !inScope()) return;
      confirmationConsumed = true;
      const ticket = ++mutationRevision;
      mutationVersions.set(id, ticket);
      const isCurrent = () => inScope() && mutationVersions.get(id) === ticket;
      try {
        await deleteMonitorRecordRuleApi(id);
        if (!isCurrent()) return;
        message.success('记录规则已删除');
        fetchRecordRules();
      } catch (error: unknown) {
        if (isCurrent() && shouldNotifyPageError(error)) {
          message.error(
            error instanceof Error && error.message
              ? error.message
              : '删除记录规则失败',
          );
        }
      } finally {
        if (mutationVersions.get(id) === ticket) {
          mutationVersions.delete(id);
        }
      }
    },
    title: '警告',
  });
};

// 菜单点击处理
const handleMenuClick = (command: string, record: MonitorRecordRule): void => {
  switch (command) {
    case 'delete': {
      handleDelete(record);
      break;
    }
    case 'disable': {
      handleDisableRecord(record);
      break;
    }
    case 'enable': {
      handleEnableRecord(record);
      break;
    }
  }
};

const closeDetailDialog = (): void => {
  detailRevision += 1;
  detailDialogVisible.value = false;
};

// 重置新增表单
const resetAddForm = (): void => {
  addForm.name = '';
  addForm.pool_id = 0;
  addForm.ip_address = '';
  addForm.enable = 2 as 1 | 2;
  addForm.expr = '';
  addForm.labels = [];
};

// 模态框操作
const showAddModal = (): void => {
  const owner = operationOwner();
  if (disposed || !owner || !formPermission('add')) return;
  clearFormScope();
  closeDetailDialog();
  formOwner = owner;
  resetAddForm();
  isAddModalVisible.value = true;
  loadPools();
};

const closeAddModal = (): void => {
  if (isAddModalVisible.value) clearFormScope();
};

const showEditModal = (record: MonitorRecordRule): void => {
  const owner = operationOwner();
  if (disposed || !owner || !formPermission('edit')) return;
  if (!validRecordId(record.id)) {
    message.warning('记录规则标识无效，请刷新后重试');
    return;
  }
  clearFormScope();
  formOwner = owner;
  detailRevision += 1;
  Object.assign(editForm, {
    enable: record.enable,
    expr: record.expr,
    id: record.id,
    ip_address: record.ip_address,
    labels: Array.isArray(record.labels) ? [...record.labels] : [],
    name: record.name,
    pool_id: record.pool_id,
  });
  isEditModalVisible.value = true;
  detailDialogVisible.value = false;
  const selected =
    validRecordId(record.pool_id) &&
    typeof record.pool_name === 'string' &&
    record.pool_name.trim()
      ? [{ id: record.pool_id, name: record.pool_name }]
      : [];
  setPoolOptions(selected, owner);
  loadPools();
};

const closeEditModal = (): void => {
  if (isEditModalVisible.value) clearFormScope();
};

// Validation and API callbacks only own the window that started them.
const submitRecordForm = async (mode: RecordFormMode): Promise<void> => {
  const context = captureFormScope(mode);
  if (!context || submitLoading.value) return;
  const form = mode === 'add' ? addFormRef.value : editFormRef.value;
  if (!form || typeof form.validate !== 'function') return;
  const id = mode === 'edit' ? editForm.id : undefined;
  if (mode === 'edit' && !validRecordId(id)) {
    message.warning('记录规则标识无效，请刷新后重试');
    return;
  }
  const { model } = context;
  if (
    !validRecordId(model.pool_id) ||
    ![1, 2].includes(model.enable) ||
    !Array.isArray(model.labels) ||
    model.labels.some((value) => typeof value !== 'string')
  ) {
    message.warning('记录规则配置无效，请重新检查');
    return;
  }
  const fingerprint = JSON.stringify(model);
  const payload = {
    enable: model.enable,
    expr: model.expr,
    ip_address: model.ip_address,
    labels: [...model.labels],
    name: model.name,
    pool_id: model.pool_id,
  };
  const ticket = ++submissionRevision;
  const isCurrent = () =>
    context.isCurrent() &&
    ticket === submissionRevision &&
    (mode === 'add' ? addFormRef.value : editFormRef.value) === form &&
    JSON.stringify(model) === fingerprint &&
    (mode === 'add' || editForm.id === id);
  submitLoading.value = true;
  try {
    try {
      await form.validate();
    } catch {
      return;
    }
    if (!isCurrent()) return;
    if (mode === 'edit' && validRecordId(id))
      await updateMonitorRecordRuleApi({ ...payload, id });
    else if (mode === 'add') await createMonitorRecordRuleApi(payload);
    else return;
    if (!isCurrent()) return;
    message.success(mode === 'add' ? '新增记录成功' : '更新记录规则成功');
    await fetchRecordRulesForScope(isCurrent);
    if (isCurrent()) clearFormScope();
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error(mode === 'add' ? '新增记录失败' : '更新记录规则失败');
  } finally {
    if (submissionRevision === ticket) submitLoading.value = false;
  }
};
const handleAdd = () => submitRecordForm('add');
const handleUpdate = () => submitRecordForm('edit');

const validateExpression = async (mode: RecordFormMode) => {
  const context = captureFormScope(mode);
  if (!context || validatingExpr.value) return;
  const expression = context.model.expr;
  if (!expression) {
    message.error('表达式不能为空');
    return;
  }
  const ticket = ++expressionRevision;
  const isCurrent = () =>
    context.isCurrent() &&
    ticket === expressionRevision &&
    context.model.expr === expression;
  validatingExpr.value = true;
  try {
    await promqlExprCheckApi({ promql_expr: expression });
    if (isCurrent()) message.success('表达式验证成功');
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error('表达式验证失败，请稍后重试');
  } finally {
    if (ticket === expressionRevision) validatingExpr.value = false;
  }
};
const validateAddExpression = () => validateExpression('add');
const validateEditExpression = () => validateExpression('edit');

watch(
  operationOwner,
  () => {
    clearFormScope();
    poolNameCache.clear();
    poolCacheOwner = undefined;
    detailRevision += 1;
    detailDialogVisible.value = false;
    detailDialog.form = null;
    mutationVersions.clear();
    invalidateList();
    data.value = [];
    paginationConfig.total = 0;
    updateStats();
  },
  { flush: 'sync' },
);
onBeforeUnmount(() => {
  clearFormScope();
  poolNameCache.clear();
  poolCacheOwner = undefined;
});

// 生命周期钩子
onMounted(() => {
  fetchRecordRules();
  loadPools();
});
</script>

<template>
  <OpsPage description="维护记录表达式、实例池与启用状态" title="记录规则">
    <!-- 页面标题 -->
    <template #actions>
      <a-button class="btn-create" type="primary" @click="showAddModal">
        <template #icon>
          <PlusOutlined />
        </template>
        <span class="btn-text">新增记录</span>
      </a-button>
    </template>
    <template #filters>
      <div class="search-filters">
        <a-input-search
          v-model:value="searchText"
          allow-clear
          class="search-input"
          placeholder="搜索记录名称..."
          @change="handleSearchChange"
          @search="handleSearch"
        />
        <a-select
          v-model:value="enabledFilter"
          allow-clear
          class="filter-select"
          placeholder="启用状态"
          @change="handleEnabledFilterChange"
        >
          <a-select-option :value="undefined">全部</a-select-option>
          <a-select-option :value="1">已启用</a-select-option>
          <a-select-option :value="2">已禁用</a-select-option>
        </a-select>
        <a-button class="reset-btn" @click="handleReset"> 重置 </a-button>
      </div>
    </template>

    <!-- 统计卡片 -->
    <template #summary>
      <div class="stats-row">
        <a-row :gutter="[16, 16]">
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.total"
                :value-style="{ color: '#3f8600' }"
                title="总记录"
              >
                <template #prefix>
                  <Icon icon="carbon:data-table" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.enabled"
                :value-style="{ color: '#52c41a' }"
                title="本页已启用"
              >
                <template #prefix>
                  <Icon icon="carbon:check-mark" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.disabled"
                :value-style="{ color: '#faad14' }"
                title="本页已禁用"
              >
                <template #prefix>
                  <Icon icon="carbon:close-filled" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.pools"
                :value-style="{ color: '#cf1322' }"
                title="本页实例池"
              >
                <template #prefix>
                  <Icon icon="carbon:server" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
        </a-row>
      </div>
    </template>

    <a-alert
      v-if="loadError"
      :message="loadError"
      role="alert"
      show-icon
      type="error"
    >
      <template #action>
        <a-button :loading="loading" size="small" @click="fetchRecordRules">
          重试
        </a-button>
      </template>
    </a-alert>

    <!-- 表格容器 -->
    <div class="table-container">
      <a-card>
        <a-table
          :columns="columns"
          :data-source="data"
          :loading="loading"
          :pagination="paginationConfig"
          :scroll="{ x: 1500 }"
          bordered
          row-key="id"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="pool-name-cell">
                <div
                  :class="getRecordStatusClass(record)"
                  class="pool-badge"
                ></div>
                <span class="pool-name-text">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'pool_name'">
              <div class="tag-container">
                <a-tag v-if="record.pool_name" class="tech-tag prometheus-tag">
                  {{ record.pool_name }}
                </a-tag>
                <span v-else class="empty-text">无关联池</span>
              </div>
            </template>

            <template v-if="column.key === 'ip_address'">
              <span>{{ record.ip_address || '' }}</span>
            </template>

            <template v-if="column.key === 'enable'">
              <a-tag :color="record.enable === 1 ? 'success' : 'default'">
                {{ record.enable === 1 ? '启用' : '禁用' }}
              </a-tag>
            </template>

            <template v-if="column.key === 'expr'">
              <div class="expr-content">
                <span :title="record.expr" class="expr-text">{{
                  truncateText(record.expr, 50)
                }}</span>
              </div>
            </template>

            <template v-if="column.key === 'creator'">
              <div class="creator-info">
                <a-avatar
                  :style="{
                    backgroundColor: getAvatarColor(
                      record.create_user_name || '',
                    ),
                  }"
                  size="small"
                >
                  {{ getInitials(record.create_user_name) }}
                </a-avatar>
                <span class="creator-name">{{ record.create_user_name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'created_at'">
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
                  @click="handleViewRecord(record)"
                >
                  查看
                </a-button>
                <a-button
                  size="small"
                  type="default"
                  @click="showEditModal(record)"
                >
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleMenuClick(e.key, record)">
                      <a-menu-item v-if="record.enable === 2" key="enable">
                        启用
                      </a-menu-item>
                      <a-menu-item v-if="record.enable === 1" key="disable">
                        禁用
                      </a-menu-item>
                      <a-menu-item
                        v-if="can('monitor.recordRule.delete')"
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

    <!-- 新增记录规则模态框 -->
    <a-modal
      :confirm-loading="submitLoading"
      :destroy-on-close="true"
      :open="isAddModalVisible"
      :width="formDialogWidth"
      class="responsive-modal scrape-pool-modal"
      title="新增记录规则"
      @cancel="closeAddModal"
      @ok="handleAdd"
    >
      <a-form
        :key="formRevision"
        ref="addFormRef"
        :model="addForm"
        :rules="formRules"
        layout="vertical"
      >
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="记录名称" name="name">
                <a-input
                  v-model:value="addForm.name"
                  placeholder="请输入记录名称"
                />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="Prometheus 实例池" name="pool_id">
                <a-select
                  v-model:value="addForm.pool_id"
                  :filter-option="false"
                  class="full-width"
                  placeholder="请选择实例池"
                  show-search
                  @dropdown-visible-change="handlePoolDropdownChange"
                  @search="handlePoolSearch"
                >
                  <a-select-option
                    v-for="pool in poolOptions"
                    :key="pool.id"
                    :value="pool.id"
                  >
                    {{ pool.name }}
                  </a-select-option>
                </a-select>
                <!-- Prometheus实例池分页 -->
                <div v-if="showPoolPagination" class="pool-pagination">
                  <a-pagination
                    v-model:current="poolPagination.current"
                    v-model:page-size="poolPagination.pageSize"
                    :total="poolPagination.total"
                    simple
                    size="small"
                    @change="loadPools"
                  />
                </div>
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="IP地址" name="ip_address">
                <a-input
                  v-model:value="addForm.ip_address"
                  placeholder="例如: 192.168.1.100:9090 或 localhost:9090"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">规则配置</div>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item label="是否启用" name="enable">
                <a-switch
                  :checked="addForm.enable === 1"
                  class="tech-switch"
                  @change="
                    (checked: boolean) => (addForm.enable = checked ? 1 : 2)
                  "
                />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="表达式" name="expr">
                <a-textarea
                  v-model:value="addForm.expr"
                  :rows="3"
                  placeholder="请输入表达式"
                />
              </a-form-item>
              <a-form-item>
                <a-button
                  :loading="validatingExpr"
                  class="validate-button"
                  type="primary"
                  @click="validateAddExpression"
                >
                  <template #icon>
                    <Icon icon="mdi:check-circle-outline" />
                  </template>
                  验证表达式
                </a-button>
              </a-form-item>
            </a-col>
          </a-row>
        </div>
      </a-form>
    </a-modal>

    <!-- 编辑记录规则模态框 -->
    <a-modal
      :confirm-loading="submitLoading"
      :destroy-on-close="true"
      :open="isEditModalVisible"
      :width="formDialogWidth"
      class="responsive-modal scrape-pool-modal"
      title="编辑记录规则"
      @cancel="closeEditModal"
      @ok="handleUpdate"
    >
      <a-form
        :key="formRevision"
        ref="editFormRef"
        :model="editForm"
        :rules="formRules"
        layout="vertical"
      >
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="记录名称" name="name">
                <a-input
                  v-model:value="editForm.name"
                  placeholder="请输入记录名称"
                />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="Prometheus 实例池" name="pool_id">
                <a-select
                  v-model:value="editForm.pool_id"
                  :filter-option="false"
                  class="full-width"
                  placeholder="请选择实例池"
                  show-search
                  @dropdown-visible-change="handlePoolDropdownChange"
                  @search="handlePoolSearch"
                >
                  <a-select-option
                    v-for="pool in poolOptions"
                    :key="pool.id"
                    :value="pool.id"
                  >
                    {{ pool.name }}
                  </a-select-option>
                </a-select>
                <!-- Prometheus实例池分页 -->
                <div v-if="showPoolPagination" class="pool-pagination">
                  <a-pagination
                    v-model:current="poolPagination.current"
                    v-model:page-size="poolPagination.pageSize"
                    :total="poolPagination.total"
                    simple
                    size="small"
                    @change="loadPools"
                  />
                </div>
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="IP地址" name="ip_address">
                <a-input
                  v-model:value="editForm.ip_address"
                  placeholder="例如: 192.168.1.100:9090 或 localhost:9090"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">规则配置</div>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item label="是否启用" name="enable">
                <a-switch
                  :checked="editForm.enable === 1"
                  class="tech-switch"
                  @change="
                    (checked: boolean) => (editForm.enable = checked ? 1 : 2)
                  "
                />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="表达式" name="expr">
                <a-textarea
                  v-model:value="editForm.expr"
                  :rows="3"
                  placeholder="请输入表达式"
                />
              </a-form-item>
              <a-form-item>
                <a-button
                  :loading="validatingExpr"
                  class="validate-button"
                  type="primary"
                  @click="validateEditExpression"
                >
                  <template #icon>
                    <Icon icon="mdi:check-circle-outline" />
                  </template>
                  验证表达式
                </a-button>
              </a-form-item>
            </a-col>
          </a-row>
        </div>
      </a-form>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal
      :footer="null"
      :open="detailDialogVisible"
      :width="previewDialogWidth"
      class="detail-dialog"
      title="记录规则详情"
      @cancel="closeDetailDialog"
    >
      <div v-if="detailDialog.form" class="pool-details">
        <div class="detail-header">
          <h2>{{ detailDialog.form.name }}</h2>
          <div class="detail-badges">
            <a-tag
              :color="detailDialog.form.enable === 1 ? 'success' : 'default'"
            >
              {{ detailDialog.form.enable === 1 ? '已启用' : '已禁用' }}
            </a-tag>
          </div>
        </div>

        <a-descriptions :column="1" :label-style="{ width: '150px' }" bordered>
          <a-descriptions-item label="ID">
            {{ detailDialog.form.id }}
          </a-descriptions-item>
          <a-descriptions-item label="记录名称">
            {{ detailDialog.form.name }}
          </a-descriptions-item>
          <a-descriptions-item label="关联实例池">
            {{ detailDialog.form.pool_name || '无关联池' }}
          </a-descriptions-item>
          <a-descriptions-item label="IP地址">
            {{ detailDialog.form.ip_address || '' }}
          </a-descriptions-item>
          <a-descriptions-item label="是否启用">
            {{ detailDialog.form.enable === 1 ? '启用' : '禁用' }}
          </a-descriptions-item>
          <a-descriptions-item label="表达式">
            <div class="expr-detail">{{ detailDialog.form.expr }}</div>
          </a-descriptions-item>
          <a-descriptions-item label="创建人">
            {{ detailDialog.form.create_user_name }}
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatFullDateTime(detailDialog.form?.created_at || '') }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button
            v-if="detailDialog.form.enable === 2"
            type="primary"
            @click="handleEnableRecord(detailDialog.form)"
          >
            启用
          </a-button>
          <a-button type="primary" @click="showEditModal(detailDialog.form)">
            编辑
          </a-button>
        </div>
      </div>
    </a-modal>
  </OpsPage>
</template>

<style scoped>
/* 响应式设计 */
@media (max-width: 768px) {
  .search-input {
    width: 100%;
    min-width: auto;
  }

  .filter-select {
    width: 100%;
    min-width: auto;
  }

  .stats-card :deep(.ant-statistic-title) {
    font-size: 12px;
  }

  .stats-card :deep(.ant-statistic-content) {
    font-size: 16px;
  }

  .action-buttons {
    gap: 2px;
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

  .creator-info {
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }

  .creator-name {
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

@media (max-width: 480px) {
  .stats-card {
    text-align: center;
  }
}

@media (max-width: 768px) {
  .responsive-modal :deep(.ant-modal-body) {
    padding: 16px;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }
}

.search-input {
  width: 250px;
  min-width: 200px;
}

.filter-select {
  width: 120px;
  min-width: 100px;
}

.reset-btn {
  flex-shrink: 0;
}

.stats-row {
  margin-bottom: 20px;
}

.stats-card {
  border-radius: var(--ops-radius);
  box-shadow: 0 2px 8px rgb(0 0 0 / 5%);
  height: 100%;
}

.table-container {
  margin-bottom: 24px;
}

.pool-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pool-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-full {
  background-color: #52c41a;
}

.status-none {
  background-color: var(--ops-border);
}

.pool-name-text {
  font-weight: 500;
  word-break: break-all;
}

.tag-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tech-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  box-shadow: 0 1px 4px rgb(0 0 0 / 10%);
}

.prometheus-tag {
  background-color: #e6f7ff;
  color: #0958d9;
  border-left: 1px solid #1890ff;
}

.empty-text {
  color: #999;
  font-style: italic;
  font-size: 12px;
}

.expr-content {
  max-width: 250px;
}

.expr-text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: help;
}

.creator-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.creator-name {
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
  gap: 4px;
  justify-content: center;
  flex-wrap: wrap;
}

/* 表单样式 */
.form-section {
  margin-bottom: 28px;
  padding: 0;
  position: relative;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ops-ink);
  margin-bottom: 16px;
  padding-left: 12px;
  border-left: 1px solid #1890ff;
}

.full-width {
  width: 100%;
}

.tech-switch {
  background-color: rgb(0 0 0 / 25%);
}

.tech-switch.ant-switch-checked {
  background: var(--ops-accent);
}

.validate-button {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #52c41a;
  border: none;
  box-shadow: 0 2px 6px rgb(82 196 26 / 40%);
  transition: all 0.3s;
}

.validate-button:hover {
  background: #389e0d;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgb(82 196 26 / 50%);
}

.pool-pagination {
  margin-top: 8px;
  text-align: center;
}

/* 详情对话框样式 */
.detail-dialog .pool-details {
  margin-bottom: 20px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.detail-header h2 {
  margin: 0;
  font-size: 24px;
  color: var(--ops-ink);
  word-break: break-all;
}

.detail-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.expr-detail {
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--ops-ground);
  padding: 8px;
  border-radius: 4px;
  font-family: monospace;
  max-height: 200px;
  overflow-y: auto;
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
.responsive-modal :deep(.ant-modal) {
  max-width: calc(100vw - 16px);
  margin: 8px;
}
</style>
