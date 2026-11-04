<script setup lang="ts">
import OpsPage from '#/components/ops/OpsPage.vue';
import { useListRequest } from './useListRequest';

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { type FormInstance, message, Modal } from 'ant-design-vue';
import {
  DownOutlined,
  MinusCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
import { useDebounceFn } from '@vueuse/core';
import {
  AlertRuleSeverity,
  createMonitorAlertRuleApi,
  type CreateMonitorAlertRuleReq,
  deleteMonitorAlertRuleApi,
  getMonitorAlertRuleListApi,
  type GetMonitorAlertRuleListReq,
  type MonitorAlertRule,
  promqlExprCheckApi,
  updateMonitorAlertRuleApi,
  type UpdateMonitorAlertRuleReq,
} from '#/api/core/prometheus/prometheus_alert_rule';
import {
  getMonitorScrapePoolDetailApi,
  getMonitorScrapePoolListApi,
  type MonitorScrapePool,
} from '#/api/core/prometheus/prometheus_scrape_pool';
import {
  getMonitorSendGroupDetailApi,
  getMonitorSendGroupListApi,
  type MonitorSendGroup,
} from '#/api/core/prometheus/prometheus_send_group';

import { useAuthStore } from '#/store';
import { getAvatarColor } from '#/utils/avatar-color';
import { usePermission } from '#/utils/permission';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';

const { can } = usePermission();

let disposed = false;
let addRevision = 0;
let editRevision = 0;
let addOwner: string | undefined;
let editOwner: string | undefined;
const addSubmitting = ref(false);
const editSubmitting = ref(false);

const operationOwner = (): string | undefined => {
  const userId = Number(useUserStore().userInfo?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) return undefined;
  return JSON.stringify([userId, useAuthStore().getAuthGeneration()]);
};

const validPositiveId = (id: unknown): id is number =>
  typeof id === 'number' && Number.isSafeInteger(id) && id > 0;

onBeforeUnmount(() => {
  disposed = true;
  addRevision += 1;
  editRevision += 1;
});

const ENABLE_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
} as const;

// --- 类型定义 ---
interface LabelOrAnnotationItem {
  key: number;
  labelKey: string;
  labelValue: string;
  unparsedEntry?: string;
}

// --- 分页状态 ---
// The API uses the first '=' as its separator. Historical malformed entries stay
// unparsed until explicitly corrected; commas are ordinary key/value content.
function parseRuleEntry(entry: string): Omit<LabelOrAnnotationItem, 'key'> {
  const separator = entry.indexOf('=');
  if (separator < 0)
    return { labelKey: entry, labelValue: '', unparsedEntry: entry };
  return {
    labelKey: entry.slice(0, separator),
    labelValue: entry.slice(separator + 1),
  };
}

const poolPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
});

const sendGroupPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
});

const poolLoading = ref(false);
const sendGroupLoading = ref(false);

const createInitialForm = () => ({
  name: '',
  pool_id: undefined as number | undefined,
  send_group_id: undefined as number | undefined,
  ip: '',
  port: '',
  expr: '',
  severity: undefined as AlertRuleSeverity | undefined,
  for_time: '10s',
  labels: [
    { key: Date.now(), labelKey: '', labelValue: '' },
  ] as LabelOrAnnotationItem[],
  annotations: [
    { key: Date.now(), labelKey: '', labelValue: '' },
  ] as LabelOrAnnotationItem[],
  grafana_link: '',
});

const handleApiError = (error: unknown, defaultMessage: string): void => {
  if (!shouldNotifyPageError(error)) return;
  let errorMessage = defaultMessage;
  if (error && typeof error === 'object') {
    if (
      'message' in error &&
      typeof error.message === 'string' &&
      error.message
    )
      errorMessage = error.message;
    const response = 'response' in error ? error.response : undefined;
    const data =
      response && typeof response === 'object' && 'data' in response
        ? response.data
        : undefined;
    if (
      data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof data.message === 'string' &&
      data.message
    )
      errorMessage = data.message;
  }
  message.error(errorMessage);
};

// --- 响应式状态 ---
const loading = ref(false);
const { beginRequest, loadError } = useListRequest(loading);
const data = ref<MonitorAlertRule[]>([]);
const scrapePools = ref<MonitorScrapePool[]>([]);
const poolSearch = ref('');
const sendGroups = ref<MonitorSendGroup[]>([]);
const addFormRef = ref<FormInstance>();
const editFormRef = ref<FormInstance>();
const currentRecord = ref<MonitorAlertRule | null>(null);

// --- 筛选与分页 ---
const searchParams = reactive({
  search: '',
  severity: undefined as AlertRuleSeverity | undefined,
  enable: undefined as number | undefined,
});

const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  size: 'default' as const,
});

// --- 统计数据 ---
const stats = computed(() => ({
  total: paginationConfig.total,
  critical: data.value.filter(
    (item) => item.severity === AlertRuleSeverity.Critical,
  ).length,
  warning: data.value.filter(
    (item) => item.severity === AlertRuleSeverity.Warning,
  ).length,
  enabled: data.value.filter((item) => item.enable === ENABLE_STATUS.ENABLED)
    .length,
}));

// --- 模态框状态 ---
const isAddModalVisible = ref(false);
const isEditModalVisible = ref(false);
const detailModalVisible = ref(false);

// --- 表单 ---
const addForm = reactive(createInitialForm());

const editForm = reactive({
  id: 0,
  name: '',
  pool_id: undefined as number | undefined,
  send_group_id: undefined as number | undefined,
  ip: '',
  port: '',
  enableSwitch: true,
  expr: '',
  severity: undefined as AlertRuleSeverity | undefined,
  for_time: '',
  labels: [] as LabelOrAnnotationItem[],
  annotations: [] as LabelOrAnnotationItem[],
  grafana_link: '',
});

const formRules = {
  name: [{ message: '请输入名称', required: true, trigger: 'blur' }],
  pool_id: [{ message: '请选择所属实例池', required: true, trigger: 'change' }],
  ip_address: [
    {
      required: true,
      validator: () => {
        const form = isEditModalVisible.value ? editForm : addForm;
        if (!form.ip || !form.port) {
          return Promise.reject('请输入IP地址和端口');
        }
        return Promise.resolve();
      },
      trigger: 'blur',
    },
  ],
  expr: [{ message: '请输入PromQL表达式', required: true, trigger: 'blur' }],
  send_group_id: [
    { message: '请选择发送组', required: true, trigger: 'change' },
  ],
  severity: [{ message: '请选择严重性', required: true, trigger: 'change' }],
  for_time: [{ message: '请输入持续时间', required: true, trigger: 'blur' }],
};

// --- 响应式布局 ---
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

// --- 列定义 ---
const columns = [
  {
    dataIndex: 'name',
    fixed: 'left',
    key: 'name',
    title: 'AlertRule名称',
    width: 200,
  },
  {
    dataIndex: 'expr',
    ellipsis: true,
    key: 'expr',
    title: '表达式',
    width: 250,
  },
  {
    align: 'center' as const,
    dataIndex: 'severity',
    key: 'severity',
    title: '严重性',
    width: 100,
  },
  {
    align: 'center' as const,
    dataIndex: 'enable',
    key: 'enable',
    title: '启用状态',
    width: 100,
  },
  { dataIndex: 'labels', key: 'labels', title: '标签', width: 220 },
  { dataIndex: 'annotations', key: 'annotations', title: '注解', width: 220 },
  { key: 'pool_config', title: '实例配置', width: 180 },
  {
    dataIndex: 'create_user_name',
    key: 'creator',
    title: '创建人',
    width: 120,
  },
  { dataIndex: 'created_at', key: 'createdAt', title: '创建时间', width: 180 },
  {
    align: 'center' as const,
    fixed: 'right',
    key: 'action',
    title: '操作',
    width: 200,
  },
];

// --- 标签显示函数 ---
const getDisplayLabels = (labels: string[]) => {
  if (!labels || labels.length === 0 || labels[0] === '') return [];
  return labels.slice(0, 2);
};

const getDisplayAnnotations = (annotations: string[]) => {
  if (!annotations || annotations.length === 0 || annotations[0] === '')
    return [];
  return annotations.slice(0, 2);
};

// --- API 调用 ---
const fetchAlertRules = async () => {
  const request = beginRequest();
  try {
    const params: GetMonitorAlertRuleListReq = {
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      search: searchParams.search || undefined,
      severity: searchParams.severity,
      enable: searchParams.enable,
    };
    const response = await getMonitorAlertRuleListApi(params);
    if (!request.isCurrent()) return;
    data.value = response.items || [];
    paginationConfig.total = response.total || 0;
  } catch (error: any) {
    if (!request.fail(error, '加载告警规则列表失败')) return;
    data.value = [];
    paginationConfig.total = 0;
    if (shouldNotifyPageError(error)) message.error(loadError.value);
  } finally {
    request.finish();
  }
};

let optionsOwner: string | undefined;
let poolRequestRevision = 0;
let sendRequestRevision = 0;

const ensureOptionOwner = (): string | undefined => {
  const owner = operationOwner();
  if (optionsOwner !== owner) {
    optionsOwner = owner;
    poolRequestRevision += 1;
    sendRequestRevision += 1;
    scrapePools.value = [];
    sendGroups.value = [];
    poolPagination.total = 0;
    poolPagination.current = 1;
    poolSearch.value = '';
    sendGroupPagination.total = 0;
    sendGroupPagination.current = 1;
    poolLoading.value = false;
    sendGroupLoading.value = false;
  }
  return owner;
};

const fetchScrapePools = async (page = 1, size = 20): Promise<void> => {
  const owner = ensureOptionOwner();
  if (disposed || !owner) return;
  const ticket = ++poolRequestRevision;
  const isCurrent = () =>
    !disposed &&
    poolRequestRevision === ticket &&
    optionsOwner === owner &&
    operationOwner() === owner;
  poolLoading.value = true;
  try {
    const response = await getMonitorScrapePoolListApi({
      page,
      size,
      ...(poolSearch.value ? { search: poolSearch.value } : {}),
    });
    if (!isCurrent()) return;
    const items: MonitorScrapePool[] = (response.items || []).filter(
      (pool: MonitorScrapePool) => validPositiveId(pool.id),
    );
    if (page === 1) {
      const selected = scrapePools.value.filter(
        (pool) =>
          (isAddModalVisible.value &&
            addOwner === owner &&
            pool.id === addForm.pool_id) ||
          (isEditModalVisible.value &&
            editOwner === owner &&
            pool.id === editForm.pool_id),
      );
      scrapePools.value = [
        ...items,
        ...selected.filter(
          (pool) => !items.some((item) => item.id === pool.id),
        ),
      ];
    } else {
      scrapePools.value.push(
        ...items.filter(
          (pool) => !scrapePools.value.some((item) => item.id === pool.id),
        ),
      );
    }
    poolPagination.total = response.total || 0;
    poolPagination.current = page;
  } catch (error: unknown) {
    if (isCurrent()) handleApiError(error, '获取实例池数据失败');
  } finally {
    if (isCurrent()) poolLoading.value = false;
  }
};

const fetchSendGroups = async (page = 1, size = 20): Promise<void> => {
  const owner = ensureOptionOwner();
  if (disposed || !owner) return;
  const ticket = ++sendRequestRevision;
  const isCurrent = () =>
    !disposed &&
    sendRequestRevision === ticket &&
    optionsOwner === owner &&
    operationOwner() === owner;
  sendGroupLoading.value = true;
  try {
    const response = await getMonitorSendGroupListApi({ page, size });
    if (!isCurrent()) return;
    const items: MonitorSendGroup[] = (response.items || []).filter(
      (group: MonitorSendGroup) => validPositiveId(group.id),
    );
    if (page === 1) {
      const selected = sendGroups.value.filter(
        (group) =>
          (isAddModalVisible.value &&
            addOwner === owner &&
            group.id === addForm.send_group_id) ||
          (isEditModalVisible.value &&
            editOwner === owner &&
            group.id === editForm.send_group_id),
      );
      sendGroups.value = [
        ...items,
        ...selected.filter(
          (group) => !items.some((item) => item.id === group.id),
        ),
      ];
    } else {
      sendGroups.value.push(
        ...items.filter(
          (group) => !sendGroups.value.some((item) => item.id === group.id),
        ),
      );
    }
    sendGroupPagination.total = response.total || 0;
    sendGroupPagination.current = page;
  } catch (error: unknown) {
    if (isCurrent()) handleApiError(error, '获取发送组数据失败');
  } finally {
    if (isCurrent()) sendGroupLoading.value = false;
  }
};

// --- 分页处理 ---
const handlePoolScroll = (e: any) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  if (
    scrollTop + clientHeight >= scrollHeight - 10 &&
    !poolLoading.value &&
    poolPagination.current * poolPagination.pageSize < poolPagination.total
  ) {
    fetchScrapePools(poolPagination.current + 1, poolPagination.pageSize);
  }
};

const handleSendGroupScroll = (e: any) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  if (
    scrollTop + clientHeight >= scrollHeight - 10 &&
    !sendGroupLoading.value &&
    sendGroups.value.length < sendGroupPagination.total
  ) {
    fetchSendGroups(
      sendGroupPagination.current + 1,
      sendGroupPagination.pageSize,
    );
  }
};

const handlePoolSearch = (search: string) => {
  poolSearch.value = search;
  void fetchScrapePools(1, poolPagination.pageSize);
};

const onPoolDropdownChange = (open: boolean) => {
  if (open) ensureOptionOwner();
  if (open) {
    poolSearch.value = '';
    fetchScrapePools(1, poolPagination.pageSize);
  }
};

const onSendGroupDropdownChange = (open: boolean) => {
  if (open) ensureOptionOwner();
  if (open && sendGroups.value.length === 0) {
    fetchSendGroups(1, sendGroupPagination.pageSize);
  }
};

// --- 事件处理 ---
const handleTableChange = (pagination: {
  current: number;
  pageSize: number;
}) => {
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  fetchAlertRules();
};

const handleSearch = useDebounceFn(() => {
  paginationConfig.current = 1;
  fetchAlertRules();
}, 300);

const handleReset = () => {
  searchParams.search = '';
  searchParams.severity = undefined;
  searchParams.enable = undefined;
  paginationConfig.current = 1;
  fetchAlertRules();
};

const validSeverities = new Set<number>([
  AlertRuleSeverity.Critical,
  AlertRuleSeverity.Info,
  AlertRuleSeverity.Warning,
]);
const validSeverity = (value: unknown): value is AlertRuleSeverity =>
  typeof value === 'number' && validSeverities.has(value);

let editTarget: MonitorAlertRule | undefined;
let expressionRevision = 0;

const handleDelete = (record: MonitorAlertRule): void => {
  const id = record.id;
  const owner = operationOwner();
  if (disposed || !validPositiveId(id) || !owner) {
    message.warning('告警规则或账号标识无效，请刷新后重试');
    return;
  }
  const isCurrent = () =>
    !disposed && record.id === id && operationOwner() === owner;
  let confirmationConsumed = false;
  Modal.confirm({
    cancelText: '取消',
    content: '您确定要删除这条告警规则吗？此操作不可撤销。',
    okText: '确认',
    onOk: async () => {
      if (confirmationConsumed || !isCurrent()) return;
      confirmationConsumed = true;
      try {
        await deleteMonitorAlertRuleApi(id);
        if (!isCurrent()) return;
        message.success('删除成功');
        fetchAlertRules();
      } catch (error: unknown) {
        if (isCurrent()) handleApiError(error, '删除失败');
      }
    },
    title: '确认删除',
  });
};

const handleMenuClick = (key: string, record: MonitorAlertRule): void => {
  if (key === 'delete') handleDelete(record);
};

const resetAddForm = (): void => {
  Object.assign(addForm, createInitialForm());
};

const showAddModal = (): void => {
  const owner = ensureOptionOwner();
  if (disposed || !owner) return;
  addRevision += 1;
  addOwner = owner;
  addSubmitting.value = false;
  resetAddForm();
  isAddModalVisible.value = true;
};

const closeAddModal = (): void => {
  addRevision += 1;
  addOwner = undefined;
  addSubmitting.value = false;
  isAddModalVisible.value = false;
};

const closeEditModal = (): void => {
  editRevision += 1;
  editOwner = undefined;
  editTarget = undefined;
  editSubmitting.value = false;
  isEditModalVisible.value = false;
};

const showDetailModal = (record: MonitorAlertRule): void => {
  currentRecord.value = record;
  detailModalVisible.value = true;
};

const closeDetailModal = (): void => {
  detailModalVisible.value = false;
  currentRecord.value = null;
};

const showEditModal = async (record: MonitorAlertRule): Promise<void> => {
  const id = record.id;
  const owner = ensureOptionOwner();
  if (disposed || !owner || !validPositiveId(id)) {
    message.warning('告警规则或账号标识无效，请刷新后重试');
    return;
  }
  const ticket = ++editRevision;
  editOwner = owner;
  editTarget = record;
  editSubmitting.value = false;
  const isCurrent = () =>
    !disposed &&
    isEditModalVisible.value &&
    editRevision === ticket &&
    editOwner === owner &&
    operationOwner() === owner &&
    editTarget === record &&
    record.id === id &&
    editForm.id === id;
  const [ip, port] = record.ip_address?.split(':') || ['', ''];
  const parseItems = (items: string[] | undefined) =>
    items?.length
      ? items.map((item) => ({
          key: Date.now() + Math.random(),
          ...parseRuleEntry(item),
        }))
      : [{ key: Date.now(), labelKey: '', labelValue: '' }];
  // 先绑定原记录；关联选项的慢请求不能延后覆盖另一条记录的表单。
  Object.assign(editForm, {
    id,
    name: record.name,
    pool_id: record.pool_id,
    send_group_id: record.send_group_id,
    ip,
    port,
    enableSwitch: record.enable === ENABLE_STATUS.ENABLED,
    expr: record.expr,
    severity: record.severity,
    for_time: record.for_time,
    labels: parseItems(record.labels),
    annotations: parseItems(record.annotations),
    grafana_link: record.grafana_link || '',
  });
  isEditModalVisible.value = true;
  closeDetailModal();

  const poolId = record.pool_id;
  const groupId = record.send_group_id;
  if (
    validPositiveId(poolId) &&
    !scrapePools.value.some((pool) => pool.id === poolId)
  ) {
    try {
      const pool = await getMonitorScrapePoolDetailApi(poolId);
      if (!isCurrent()) return;
      if (pool?.id !== poolId) throw new Error('实例池详情标识无效');
      scrapePools.value.unshift(pool);
    } catch (error: unknown) {
      if (!isCurrent()) return;
      handleApiError(error, '加载实例池详情失败');
    }
  }
  if (!isCurrent()) return;
  if (
    validPositiveId(groupId) &&
    !sendGroups.value.some((group) => group.id === groupId)
  ) {
    try {
      const group = await getMonitorSendGroupDetailApi(groupId);
      if (!isCurrent()) return;
      if (group?.id !== groupId) throw new Error('发送组详情标识无效');
      sendGroups.value.unshift(group);
    } catch (error: unknown) {
      if (isCurrent()) handleApiError(error, '加载发送组详情失败');
    }
  }
};

const formatItemsForApi = (items: LabelOrAnnotationItem[]): string[] => {
  const entries: string[] = [];
  for (const item of items) {
    if (
      item.unparsedEntry !== undefined &&
      item.labelKey === item.unparsedEntry &&
      item.labelValue === ''
    ) {
      entries.push(item.unparsedEntry);
      continue;
    }
    if (item.labelKey === '' && item.labelValue === '') continue;
    if (item.labelKey.includes('='))
      throw new Error('标签或注解名称不能包含等号，请将其放在值中');
    entries.push(`${item.labelKey}=${item.labelValue}`);
  }
  return entries;
};

const handleAdd = async (): Promise<void> => {
  if (disposed || addSubmitting.value || !isAddModalVisible.value) return;
  const owner = addOwner;
  const form = addFormRef.value;
  if (!owner || operationOwner() !== owner) return;
  if (!form || typeof form.validate !== 'function') {
    message.warning('表单尚未就绪，请稍后重试');
    return;
  }
  const ticket = addRevision;
  const fingerprint = JSON.stringify(addForm);
  const isCurrent = () =>
    !disposed &&
    isAddModalVisible.value &&
    addRevision === ticket &&
    addOwner === owner &&
    operationOwner() === owner &&
    JSON.stringify(addForm) === fingerprint;
  addSubmitting.value = true;
  try {
    await form.validate();
    if (!isCurrent()) return;
    const poolId = addForm.pool_id;
    const groupId = addForm.send_group_id;
    const severity = addForm.severity;
    if (
      !validPositiveId(poolId) ||
      !validPositiveId(groupId) ||
      !validSeverity(severity)
    ) {
      message.warning('请选择有效的实例池、发送组和严重性');
      return;
    }
    const apiData: CreateMonitorAlertRuleReq = {
      ...addForm,
      ip_address: `${addForm.ip}:${addForm.port}`,
      pool_id: poolId,
      send_group_id: groupId,
      severity,
      labels: formatItemsForApi(addForm.labels),
      annotations: formatItemsForApi(addForm.annotations),
      grafana_link: addForm.grafana_link,
    };
    await createMonitorAlertRuleApi(apiData);
    if (!isCurrent()) return;
    message.success('新增成功');
    closeAddModal();
    fetchAlertRules();
  } catch (error: unknown) {
    if (isCurrent()) handleApiError(error, '操作失败');
  } finally {
    if (addRevision === ticket) addSubmitting.value = false;
  }
};

const handleEdit = async (): Promise<void> => {
  if (disposed || editSubmitting.value || !isEditModalVisible.value) return;
  const owner = editOwner;
  const form = editFormRef.value;
  const record = editTarget;
  const id = editForm.id;
  if (
    !owner ||
    operationOwner() !== owner ||
    !record ||
    record.id !== id ||
    !validPositiveId(id)
  )
    return;
  if (!form || typeof form.validate !== 'function') {
    message.warning('表单尚未就绪，请稍后重试');
    return;
  }
  const ticket = editRevision;
  const fingerprint = JSON.stringify(editForm);
  const isCurrent = () =>
    !disposed &&
    isEditModalVisible.value &&
    editRevision === ticket &&
    editOwner === owner &&
    operationOwner() === owner &&
    editTarget === record &&
    record.id === id &&
    editForm.id === id &&
    JSON.stringify(editForm) === fingerprint;
  editSubmitting.value = true;
  try {
    await form.validate();
    if (!isCurrent()) return;
    const poolId = editForm.pool_id;
    const groupId = editForm.send_group_id;
    const severity = editForm.severity;
    if (
      !validPositiveId(poolId) ||
      !validPositiveId(groupId) ||
      !validSeverity(severity)
    ) {
      message.warning('请选择有效的实例池、发送组和严重性');
      return;
    }
    const apiData: UpdateMonitorAlertRuleReq = {
      ...editForm,
      id,
      ip_address: `${editForm.ip}:${editForm.port}`,
      enable: editForm.enableSwitch
        ? ENABLE_STATUS.ENABLED
        : ENABLE_STATUS.DISABLED,
      pool_id: poolId,
      send_group_id: groupId,
      severity,
      labels: formatItemsForApi(editForm.labels),
      annotations: formatItemsForApi(editForm.annotations),
      grafana_link: editForm.grafana_link,
    };
    await updateMonitorAlertRuleApi(apiData);
    if (!isCurrent()) return;
    message.success('更新成功');
    closeEditModal();
    fetchAlertRules();
  } catch (error: unknown) {
    if (isCurrent()) handleApiError(error, '操作失败');
  } finally {
    if (editRevision === ticket) editSubmitting.value = false;
  }
};

const validateExpression = async (
  expr: string,
  mode: 'add' | 'edit',
): Promise<void> => {
  const owner = mode === 'add' ? addOwner : editOwner;
  const ticket = mode === 'add' ? addRevision : editRevision;
  const version = ++expressionRevision;
  const isCurrent = () =>
    !disposed &&
    owner !== undefined &&
    operationOwner() === owner &&
    expressionRevision === version &&
    (mode === 'add'
      ? isAddModalVisible.value &&
        addRevision === ticket &&
        addOwner === owner &&
        addForm.expr === expr
      : isEditModalVisible.value &&
        editRevision === ticket &&
        editOwner === owner &&
        editForm.expr === expr);
  if (!isCurrent()) return;
  if (!expr) {
    message.warning('请输入表达式');
    return;
  }
  try {
    await promqlExprCheckApi({ promql_expr: expr });
    if (isCurrent()) message.success('表达式验证通过');
  } catch (error: unknown) {
    if (isCurrent()) handleApiError(error, '表达式验证失败');
  }
};

// --- 动态表单项 ---
const addLabel = () =>
  addForm.labels.push({ key: Date.now(), labelKey: '', labelValue: '' });
const removeLabel = (item: LabelOrAnnotationItem) => {
  const index = addForm.labels.indexOf(item);
  if (index !== -1) addForm.labels.splice(index, 1);
};
const addAnnotation = () =>
  addForm.annotations.push({ key: Date.now(), labelKey: '', labelValue: '' });
const removeAnnotation = (item: LabelOrAnnotationItem) => {
  const index = addForm.annotations.indexOf(item);
  if (index !== -1) addForm.annotations.splice(index, 1);
};
const addEditLabel = () =>
  editForm.labels.push({ key: Date.now(), labelKey: '', labelValue: '' });
const removeEditLabel = (item: LabelOrAnnotationItem) => {
  const index = editForm.labels.indexOf(item);
  if (index !== -1) editForm.labels.splice(index, 1);
};
const addEditAnnotation = () =>
  editForm.annotations.push({ key: Date.now(), labelKey: '', labelValue: '' });
const removeEditAnnotation = (item: LabelOrAnnotationItem) => {
  const index = editForm.annotations.indexOf(item);
  if (index !== -1) editForm.annotations.splice(index, 1);
};

const severityText = (
  severity: AlertRuleSeverity | undefined,
): 'critical' | 'info' | 'warning' => {
  if (severity === AlertRuleSeverity.Critical) return 'critical';
  if (severity === AlertRuleSeverity.Warning) return 'warning';
  return 'info';
};

const severityLabel = (severity: AlertRuleSeverity | undefined): string => {
  const text = severityText(severity);
  if (text === 'critical') return 'Critical';
  if (text === 'warning') return 'Warning';
  return 'Info';
};

const getAlertStatusClass = (record: MonitorAlertRule): string => {
  if (
    record.enable === ENABLE_STATUS.ENABLED &&
    record.severity === AlertRuleSeverity.Critical
  )
    return 'status-critical';
  if (
    record.enable === ENABLE_STATUS.ENABLED &&
    record.severity === AlertRuleSeverity.Warning
  )
    return 'status-warning';
  if (record.enable === ENABLE_STATUS.ENABLED) return 'status-enabled';
  return 'status-disabled';
};

const getPoolName = (poolId?: number) =>
  scrapePools.value.find((p) => p.id === poolId)?.name || `ID: ${poolId}`;

const getSendGroupName = (groupId?: number) =>
  sendGroups.value.find((g) => g.id === groupId)?.name || `ID: ${groupId}`;

const getInitials = (name?: string): string => {
  if (!name) return '';
  return name.slice(0, 2).toUpperCase();
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('zh-CN');
};

const formatTime = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFullDateTime = (dateString?: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('zh-CN');
};

// --- 生命周期 ---
onMounted(() => {
  fetchAlertRules();
});
</script>

<template>
  <OpsPage description="维护告警表达式、严重性与通知分组" title="告警规则">
    <!-- 页面标题 -->
    <template #actions>
      <a-button class="btn-create" type="primary" @click="showAddModal">
        <template #icon>
          <PlusOutlined />
        </template>
        <span class="btn-text">新建告警规则</span>
      </a-button>
    </template>
    <template #filters>
      <div class="search-filters">
        <a-input-search
          v-model:value="searchParams.search"
          allow-clear
          class="search-input"
          placeholder="搜索规则名称..."
          @search="handleSearch"
        />
        <a-select
          v-model:value="searchParams.severity"
          allow-clear
          class="filter-select"
          placeholder="严重性"
          @change="handleSearch"
        >
          <a-select-option :value="AlertRuleSeverity.Critical">
            Critical
          </a-select-option>
          <a-select-option :value="AlertRuleSeverity.Warning">
            Warning
          </a-select-option>
          <a-select-option :value="AlertRuleSeverity.Info">
            Info
          </a-select-option>
        </a-select>
        <a-select
          v-model:value="searchParams.enable"
          allow-clear
          class="filter-select"
          placeholder="启用状态"
          @change="handleSearch"
        >
          <a-select-option :value="1">启用</a-select-option>
          <a-select-option :value="2">禁用</a-select-option>
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
                title="总规则"
              >
                <template #prefix>
                  <Icon icon="carbon:container-registry" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.critical"
                :value-style="{ color: '#cf1322' }"
                title="本页Critical"
              >
                <template #prefix>
                  <Icon icon="carbon:warning-alt" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.warning"
                :value-style="{ color: '#faad14' }"
                title="本页Warning"
              >
                <template #prefix>
                  <Icon icon="carbon:notification" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.enabled"
                :value-style="{ color: '#1890ff' }"
                title="本页已启用"
              >
                <template #prefix>
                  <Icon icon="carbon:checkmark-outline" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
        </a-row>
      </div>
    </template>

    <!-- 表格容器 -->
    <a-alert
      v-if="loadError"
      :message="loadError"
      role="alert"
      show-icon
      type="error"
    >
      <template #action>
        <a-button :loading="loading" size="small" @click="fetchAlertRules">
          重试
        </a-button>
      </template>
    </a-alert>

    <div class="table-container">
      <a-card>
        <a-table
          :columns="columns"
          :data-source="data"
          :loading="loading"
          :pagination="paginationConfig"
          :scroll="{ x: 1400 }"
          bordered
          row-key="id"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="rule-name-cell">
                <div
                  class="rule-badge"
                  :class="getAlertStatusClass(record)"
                ></div>
                <span class="rule-name-text">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'expr'">
              <div :title="record.expr" class="expr-container">
                {{ record.expr }}
              </div>
            </template>

            <template v-if="column.key === 'labels'">
              <div class="tag-container">
                <template
                  v-if="record.labels?.length && record.labels[0] !== ''"
                >
                  <template
                    v-for="label in getDisplayLabels(record.labels)"
                    :key="label"
                  >
                    <a-tag class="tech-tag label-tag">
                      <span class="label-key">{{
                        parseRuleEntry(label).labelKey
                      }}</span>
                      <span class="label-separator">:</span>
                      <span class="label-value">{{
                        parseRuleEntry(label).labelValue
                      }}</span>
                    </a-tag>
                  </template>
                  <a-popover
                    v-if="record.labels.length > 2"
                    placement="topLeft"
                    title="所有标签"
                    trigger="hover"
                  >
                    <template #content>
                      <div class="all-tags-container">
                        <a-tag
                          v-for="label in record.labels"
                          :key="label"
                          class="tech-tag label-tag"
                        >
                          <span class="label-key">{{
                            parseRuleEntry(label).labelKey
                          }}</span>
                          <span class="label-separator">:</span>
                          <span class="label-value">{{
                            parseRuleEntry(label).labelValue
                          }}</span>
                        </a-tag>
                      </div>
                    </template>
                    <a-tag class="tech-tag more-tag">
                      +{{ record.labels.length - 2 }}
                    </a-tag>
                  </a-popover>
                </template>
                <span v-else class="empty-text">无标签</span>
              </div>
            </template>

            <template v-if="column.key === 'annotations'">
              <div class="tag-container">
                <template
                  v-if="
                    record.annotations?.length && record.annotations[0] !== ''
                  "
                >
                  <template
                    v-for="annotation in getDisplayAnnotations(
                      record.annotations,
                    )"
                    :key="annotation"
                  >
                    <a-tag class="tech-tag annotation-tag">
                      <span class="label-key">{{
                        parseRuleEntry(annotation).labelKey
                      }}</span>
                      <span class="label-separator">:</span>
                      <span class="label-value">{{
                        parseRuleEntry(annotation).labelValue
                      }}</span>
                    </a-tag>
                  </template>
                  <a-popover
                    v-if="record.annotations.length > 2"
                    placement="topLeft"
                    title="所有注解"
                    trigger="hover"
                  >
                    <template #content>
                      <div class="all-tags-container">
                        <a-tag
                          v-for="annotation in record.annotations"
                          :key="annotation"
                          class="tech-tag annotation-tag"
                        >
                          <span class="label-key">{{
                            parseRuleEntry(annotation).labelKey
                          }}</span>
                          <span class="label-separator">:</span>
                          <span class="label-value">{{
                            parseRuleEntry(annotation).labelValue
                          }}</span>
                        </a-tag>
                      </div>
                    </template>
                    <a-tag class="tech-tag more-tag">
                      +{{ record.annotations.length - 2 }}
                    </a-tag>
                  </a-popover>
                </template>
                <span v-else class="empty-text">无注解</span>
              </div>
            </template>

            <template v-if="column.key === 'severity'">
              <a-tag
                :class="[
                  'tech-tag',
                  `severity-${severityText(record.severity)}`,
                ]"
              >
                {{ severityLabel(record.severity) }}
              </a-tag>
            </template>

            <template v-if="column.key === 'enable'">
              <a-tag :color="record.enable === 1 ? 'success' : 'default'">
                {{ record.enable === 1 ? '启用' : '禁用' }}
              </a-tag>
            </template>

            <template v-if="column.key === 'pool_config'">
              <div class="config-info">
                <div class="config-item">
                  <span class="config-label">实例池:</span>
                  <span class="config-value">{{
                    getPoolName(record.pool_id)
                  }}</span>
                </div>
                <div class="config-item">
                  <span class="config-label">发送组:</span>
                  <span class="config-value">{{
                    getSendGroupName(record.send_group_id)
                  }}</span>
                </div>
              </div>
            </template>

            <template v-if="column.key === 'creator'">
              <div class="creator-info">
                <a-avatar
                  size="small"
                  :style="{
                    backgroundColor: getAvatarColor(
                      record.create_user_name || '',
                    ),
                  }"
                >
                  {{ getInitials(record.create_user_name) }}
                </a-avatar>
                <span class="creator-name">{{ record.create_user_name }}</span>
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
                  @click="showDetailModal(record)"
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
                <a-dropdown v-if="can('monitor.alertRule.delete')">
                  <template #overlay>
                    <a-menu @click="(e: any) => handleMenuClick(e.key, record)">
                      <a-menu-divider />
                      <a-menu-item key="delete" danger> 删除 </a-menu-item>
                    </a-menu>
                  </template>
                  <a-button size="small"> 更多 <DownOutlined /> </a-button>
                </a-dropdown>
              </div>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 新建告警规则对话框 -->
    <a-modal
      :confirm-loading="addSubmitting"
      :destroy-on-close="true"
      :open="isAddModalVisible"
      :width="formDialogWidth"
      class="responsive-modal alert-rule-modal"
      title="新建告警规则"
      @cancel="closeAddModal"
      @ok="handleAdd"
    >
      <a-form
        ref="addFormRef"
        :model="addForm"
        :rules="formRules"
        layout="vertical"
      >
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="名称" name="name">
                <a-input
                  v-model:value="addForm.name"
                  placeholder="请输入名称"
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item label="所属实例池" name="pool_id">
                <a-select
                  v-model:value="addForm.pool_id"
                  :filter-option="false"
                  :loading="poolLoading"
                  placeholder="请选择所属实例池"
                  show-search
                  @dropdown-visible-change="onPoolDropdownChange"
                  @popupScroll="handlePoolScroll"
                  @search="handlePoolSearch"
                >
                  <a-select-option
                    v-for="pool in scrapePools"
                    :key="pool.id"
                    :value="pool.id"
                  >
                    {{ pool.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :sm="12" :xs="24">
              <a-form-item label="发送组" name="send_group_id">
                <a-select
                  v-model:value="addForm.send_group_id"
                  :loading="sendGroupLoading"
                  placeholder="请选择发送组"
                  @dropdown-visible-change="onSendGroupDropdownChange"
                  @popupScroll="handleSendGroupScroll"
                >
                  <a-select-option
                    v-for="group in sendGroups"
                    :key="group.id"
                    :value="group.id"
                  >
                    {{ group.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item label="IP地址" name="ip">
                <a-input
                  v-model:value="addForm.ip"
                  class="ip-input"
                  placeholder="请输入IP地址"
                />
              </a-form-item>
            </a-col>
            <a-col :sm="12" :xs="24">
              <a-form-item label="端口" name="port">
                <a-input
                  v-model:value="addForm.port"
                  class="port-input"
                  placeholder="端口"
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item label="Grafana链接" name="grafana_link">
                <a-input
                  v-model:value="addForm.grafana_link"
                  placeholder="请输入Grafana链接"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">规则配置</div>
          <a-form-item label="表达式" name="expr">
            <a-textarea
              v-model:value="addForm.expr"
              :rows="4"
              placeholder="请输入PromQL表达式"
            />
          </a-form-item>
          <a-form-item>
            <a-button
              type="primary"
              @click="validateExpression(addForm.expr, 'add')"
            >
              验证表达式
            </a-button>
          </a-form-item>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item label="严重性" name="severity">
                <a-select
                  v-model:value="addForm.severity"
                  placeholder="请选择严重性"
                >
                  <a-select-option :value="AlertRuleSeverity.Critical">
                    Critical
                  </a-select-option>
                  <a-select-option :value="AlertRuleSeverity.Warning">
                    Warning
                  </a-select-option>
                  <a-select-option :value="AlertRuleSeverity.Info">
                    Info
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :sm="12" :xs="24">
              <a-form-item label="持续时间" name="for_time">
                <a-input
                  v-model:value="addForm.for_time"
                  placeholder="例如: 10s"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">标签配置</div>
          <a-form-item
            v-for="(label, index) in addForm.labels"
            :key="label.key"
            :label="index === 0 ? '分组标签' : ''"
          >
            <div class="label-input-group">
              <a-input
                v-model:value="label.labelKey"
                class="label-key-input"
                placeholder="标签名"
              />
              <div class="label-separator">:</div>
              <a-input
                v-model:value="label.labelValue"
                class="label-value-input"
                placeholder="标签值"
              />
              <MinusCircleOutlined
                v-if="addForm.labels.length > 1"
                class="dynamic-delete-button"
                @click="removeLabel(label)"
              />
            </div>
          </a-form-item>
          <a-form-item>
            <a-button
              class="add-dynamic-button"
              type="dashed"
              @click="addLabel"
            >
              <PlusOutlined /> 添加标签
            </a-button>
          </a-form-item>
        </div>

        <div class="form-section">
          <div class="section-title">注解配置</div>
          <a-form-item
            v-for="(annotation, index) in addForm.annotations"
            :key="annotation.key"
            :label="index === 0 ? '注解' : ''"
          >
            <div class="label-input-group">
              <a-input
                v-model:value="annotation.labelKey"
                class="label-key-input"
                placeholder="注解名"
              />
              <div class="label-separator">:</div>
              <a-input
                v-model:value="annotation.labelValue"
                class="label-value-input"
                placeholder="注解值"
              />
              <MinusCircleOutlined
                v-if="addForm.annotations.length > 1"
                class="dynamic-delete-button"
                @click="removeAnnotation(annotation)"
              />
            </div>
          </a-form-item>
          <a-form-item>
            <a-button
              class="add-dynamic-button"
              type="dashed"
              @click="addAnnotation"
            >
              <PlusOutlined /> 添加注解
            </a-button>
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <!-- 编辑AlertRule对话框 -->
    <a-modal
      :confirm-loading="editSubmitting"
      :destroy-on-close="true"
      :open="isEditModalVisible"
      :width="formDialogWidth"
      class="responsive-modal alert-rule-modal"
      title="编辑AlertRule"
      @cancel="closeEditModal"
      @ok="handleEdit"
    >
      <a-form
        ref="editFormRef"
        :model="editForm"
        :rules="formRules"
        layout="vertical"
      >
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="名称" name="name">
                <a-input
                  v-model:value="editForm.name"
                  placeholder="请输入名称"
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item label="所属实例池" name="pool_id">
                <a-select
                  v-model:value="editForm.pool_id"
                  :filter-option="false"
                  :loading="poolLoading"
                  placeholder="请选择所属实例池"
                  show-search
                  @dropdown-visible-change="onPoolDropdownChange"
                  @popupScroll="handlePoolScroll"
                  @search="handlePoolSearch"
                >
                  <a-select-option
                    v-for="pool in scrapePools"
                    :key="pool.id"
                    :value="pool.id"
                  >
                    {{ pool.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :sm="12" :xs="24">
              <a-form-item label="发送组" name="send_group_id">
                <a-select
                  v-model:value="editForm.send_group_id"
                  :loading="sendGroupLoading"
                  placeholder="请选择发送组"
                  @dropdown-visible-change="onSendGroupDropdownChange"
                  @popupScroll="handleSendGroupScroll"
                >
                  <a-select-option
                    v-for="group in sendGroups"
                    :key="group.id"
                    :value="group.id"
                  >
                    {{ group.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item label="IP地址" name="ip">
                <a-input
                  v-model:value="editForm.ip"
                  class="ip-input"
                  placeholder="请输入IP地址"
                />
              </a-form-item>
            </a-col>
            <a-col :sm="12" :xs="24">
              <a-form-item label="端口" name="port">
                <a-input
                  v-model:value="editForm.port"
                  class="port-input"
                  placeholder="端口"
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item label="Grafana链接" name="grafana_link">
                <a-input
                  v-model:value="editForm.grafana_link"
                  placeholder="请输入Grafana链接"
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="启用状态" name="enable">
                <a-switch
                  v-model:checked="editForm.enableSwitch"
                  class="tech-switch"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">规则配置</div>
          <a-form-item label="表达式" name="expr">
            <a-textarea
              v-model:value="editForm.expr"
              :rows="4"
              placeholder="请输入PromQL表达式"
            />
          </a-form-item>
          <a-form-item>
            <a-button
              type="primary"
              @click="validateExpression(editForm.expr, 'edit')"
            >
              验证表达式
            </a-button>
          </a-form-item>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item label="严重性" name="severity">
                <a-select
                  v-model:value="editForm.severity"
                  placeholder="请选择严重性"
                >
                  <a-select-option :value="AlertRuleSeverity.Critical">
                    Critical
                  </a-select-option>
                  <a-select-option :value="AlertRuleSeverity.Warning">
                    Warning
                  </a-select-option>
                  <a-select-option :value="AlertRuleSeverity.Info">
                    Info
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :sm="12" :xs="24">
              <a-form-item label="持续时间" name="for_time">
                <a-input
                  v-model:value="editForm.for_time"
                  placeholder="例如: 10s"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">标签配置</div>
          <a-form-item
            v-for="(label, index) in editForm.labels"
            :key="label.key"
            :label="index === 0 ? '分组标签' : ''"
          >
            <div class="label-input-group">
              <a-input
                v-model:value="label.labelKey"
                class="label-key-input"
                placeholder="标签名"
              />
              <div class="label-separator">:</div>
              <a-input
                v-model:value="label.labelValue"
                class="label-value-input"
                placeholder="标签值"
              />
              <MinusCircleOutlined
                v-if="
                  editForm.labels.length > 1 ||
                  label.unparsedEntry !== undefined
                "
                class="dynamic-delete-button"
                @click="removeEditLabel(label)"
              />
            </div>
          </a-form-item>
          <a-form-item>
            <a-button
              class="add-dynamic-button"
              type="dashed"
              @click="addEditLabel"
            >
              <PlusOutlined /> 添加标签
            </a-button>
          </a-form-item>
        </div>

        <div class="form-section">
          <div class="section-title">注解配置</div>
          <a-form-item
            v-for="(annotation, index) in editForm.annotations"
            :key="annotation.key"
            :label="index === 0 ? '注解' : ''"
          >
            <div class="label-input-group">
              <a-input
                v-model:value="annotation.labelKey"
                class="label-key-input"
                placeholder="注解名"
              />
              <div class="label-separator">:</div>
              <a-input
                v-model:value="annotation.labelValue"
                class="label-value-input"
                placeholder="注解值"
              />
              <MinusCircleOutlined
                v-if="
                  editForm.annotations.length > 1 ||
                  annotation.unparsedEntry !== undefined
                "
                class="dynamic-delete-button"
                @click="removeEditAnnotation(annotation)"
              />
            </div>
          </a-form-item>
          <a-form-item>
            <a-button
              class="add-dynamic-button"
              type="dashed"
              @click="addEditAnnotation"
            >
              <PlusOutlined /> 添加注解
            </a-button>
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal
      :footer="null"
      :open="detailModalVisible"
      :width="previewDialogWidth"
      class="detail-dialog"
      title="AlertRule详情"
      @cancel="closeDetailModal"
    >
      <div v-if="currentRecord" class="pool-details">
        <div class="detail-header">
          <h2>{{ currentRecord.name }}</h2>
          <div class="detail-badges">
            <a-tag
              :class="[
                'tech-tag',
                `severity-${severityText(currentRecord.severity)}`,
              ]"
            >
              {{ severityLabel(currentRecord.severity) }}
            </a-tag>
            <a-tag :color="currentRecord.enable === 1 ? 'success' : 'default'">
              {{ currentRecord.enable === 1 ? '启用' : '禁用' }}
            </a-tag>
          </div>
        </div>

        <a-descriptions :column="1" :label-style="{ width: '150px' }" bordered>
          <a-descriptions-item label="ID">
            {{ currentRecord.id }}
          </a-descriptions-item>
          <a-descriptions-item label="表达式">
            {{ currentRecord.expr }}
          </a-descriptions-item>
          <a-descriptions-item label="持续时间">
            {{ currentRecord.for_time }}
          </a-descriptions-item>
          <a-descriptions-item label="目标地址">
            {{ currentRecord.ip_address }}
          </a-descriptions-item>
          <a-descriptions-item label="实例池">
            {{ getPoolName(currentRecord.pool_id) }}
          </a-descriptions-item>
          <a-descriptions-item label="发送组">
            {{ getSendGroupName(currentRecord.send_group_id) }}
          </a-descriptions-item>
          <a-descriptions-item label="创建人">
            {{ currentRecord.create_user_name }}
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatFullDateTime(currentRecord.created_at) }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-footer">
          <a-button @click="closeDetailModal">关闭</a-button>
          <a-button
            type="primary"
            @click="currentRecord && showEditModal(currentRecord)"
          >
            编辑
          </a-button>
        </div>
      </div>
    </a-modal>
  </OpsPage>
</template>

<style scoped>
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

.table-container {
  margin-bottom: 24px;
}

.rule-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rule-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-critical {
  background-color: #cf1322;
}

.status-warning {
  background-color: #faad14;
}

.status-enabled {
  background-color: #52c41a;
}

.status-disabled {
  background-color: var(--ops-border);
}

.rule-name-text {
  font-weight: 500;
  word-break: break-all;
}

.expr-container {
  max-width: 250px;
  word-break: break-all;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Monaco', 'Menlo', monospace;
  background: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
  border-left: 1px solid #1890ff;
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
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.severity-critical {
  background-color: #fff1f0;
  color: #cf1322;
  border-left: 1px solid #ff4d4f;
}

.severity-warning {
  background-color: #fff7e6;
  color: #d46b08;
  border-left: 1px solid #fa8c16;
}

.severity-info {
  background-color: #e6f7ff;
  color: #0958d9;
  border-left: 1px solid #1890ff;
}

.label-tag {
  background-color: #f6ffed;
  color: #389e0d;
  border-left: 1px solid #52c41a;
}

.annotation-tag {
  background-color: #f0f5ff;
  color: #1d39c4;
  border-left: 1px solid #2f54eb;
}

.more-tag {
  background-color: var(--ops-ground);
  color: var(--ops-muted);
  border-left: 1px solid var(--ops-border);
  cursor: pointer;
}

.empty-text {
  color: #999;
  font-style: italic;
  font-size: 12px;
}

.label-key {
  font-weight: 600;
}

.label-separator {
  margin: 0 4px;
  color: var(--ops-muted);
}

.label-value {
  color: var(--ops-muted);
}

.all-tags-container {
  max-width: 400px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.config-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.config-label {
  font-size: 12px;
  color: var(--ops-muted);
}

.config-value {
  font-size: 12px;
  font-weight: 500;
  color: var(--ops-ink);
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
  background-color: rgba(0, 0, 0, 0.25);
}

.tech-switch.ant-switch-checked {
  background: var(--ops-accent);
}

.dynamic-input-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dynamic-input {
  width: 100%;
}

.dynamic-delete-button {
  cursor: pointer;
  color: #ff4d4f;
  font-size: 18px;
  transition: all 0.3s;
}

.dynamic-delete-button:hover {
  color: #cf1322;
  transform: scale(1.1);
}

.add-dynamic-button {
  width: 100%;
  margin-top: 8px;
  background: var(--ops-ground);
  border: 1px dashed var(--ops-border);
  color: var(--ops-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.add-dynamic-button:hover {
  color: #1890ff;
  border-color: #1890ff;
  background: #f0f7ff;
}

.label-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label-key-input,
.label-value-input {
  flex: 1;
}

.label-separator {
  font-weight: bold;
  color: var(--ops-muted);
}

.ip-port-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ip-input {
  flex: 3;
}

.port-input {
  flex: 1;
}

.separator {
  font-weight: bold;
  color: #1890ff;
  font-size: 16px;
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

.detail-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .search-filters {
    width: 100%;
  }

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
}

@media (max-width: 480px) {
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

@media (max-width: 768px) {
  .responsive-modal :deep(.ant-modal-body) {
    padding: 16px;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }
}
</style>
