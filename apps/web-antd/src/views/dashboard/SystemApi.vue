<script lang="ts" setup>
import type { FormInstance } from 'ant-design-vue';

import type { CreateApiReq, UpdateApiReq } from '#/api/core/system/api';

import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

import { useUserStore } from '@vben/stores';

import { Icon } from '@iconify/vue';
import { message, Modal } from 'ant-design-vue';

import {
  createApiApi,
  deleteApiApi,
  getApiDetailApi,
  getApiStatisticsApi,
  listApisApi,
  updateApiApi,
} from '#/api/core/system/api';
import OpsPage from '#/components/ops/OpsPage.vue';
import { useAuthStore } from '#/store/auth';
import { usePermission } from '#/utils/permission';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';

interface ApiInfo {
  id: number;
  name: string;
  path: string;
  method: number;
  description?: string;
  version?: string;
  category?: number;
  is_public: number;
  created_at?: number | string;
}
interface ApiStatistics {
  public_count: number;
  private_count: number;
}
type FormMode = 'create' | 'edit';
type ActionKind = 'access' | 'delete' | 'edit';
interface ActionTicket {
  id: number;
  kind: ActionKind;
  owner: string;
  source: ApiInfo;
  fingerprint: string;
  query: string;
}
const CREATE = '/api/apis/create';
const UPDATE = '/api/apis/update/:id';
const DETAIL = '/api/apis/detail/:id';
const { can, hasPerm } = usePermission();
const userStore = useUserStore();
const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const tableColumns = [
  { fixed: 'left', key: 'api', title: 'API信息', width: 300 },
  {
    dataIndex: 'description',
    ellipsis: true,
    key: 'description',
    title: 'API描述',
  },
  { align: 'center', key: 'version', title: '版本', width: 100 },
  { align: 'center', key: 'category', title: '分类', width: 100 },
  { align: 'center', key: 'access', title: '访问权限', width: 100 },
  { key: 'created_at', title: '创建时间', width: 120 },
  { fixed: 'right', key: 'actions', title: '操作', width: 160 },
];

const loading = ref(false);
const submitLoading = ref(false);
const modalVisible = ref(false);
const viewModalVisible = ref(false);
const formMode = ref<FormMode>('create');
const modalTitle = computed(() =>
  formMode.value === 'create' ? '新建API' : '编辑API',
);
const formWindowKey = ref(0);
const viewWindowKey = ref(0);
const apiList = ref<ApiInfo[]>([]);
const viewApiData = ref<ApiInfo | null>(null);
const apiStatistics = ref<ApiStatistics>({ private_count: 0, public_count: 0 });
const actionLoading = reactive<Record<number, boolean>>({});
const searchParams = reactive({
  is_public: undefined as number | undefined,
  method: undefined as number | undefined,
  search: '',
});
const paginationConfig = reactive({
  current: 1,
  pageSize: 20,
  pageSizeOptions: ['10', '20', '50', '100'],
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (total: number, range: [number, number]) =>
    `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
  total: 0,
});
const initFormData = () => ({
  category: undefined as null | number | undefined,
  description: '',
  id: 0,
  is_public: 2,
  method: 1,
  name: '',
  path: '',
  version: '',
});
const formData = reactive(initFormData());
const formRules = {
  method: [{ message: '请选择请求方法', required: true, trigger: 'change' }],
  name: [{ message: '请输入API名称', required: true, trigger: 'blur' }],
  path: [{ message: '请输入API路径', required: true, trigger: 'blur' }],
};
let active = true;
let listRequest = 0;
let statisticsRequest = 0;
let editRequest = 0;
let viewRequest = 0;
let submitRequest = 0;
let listOwner = '';
let formOwner = '';
let formSource: ApiInfo | undefined;
let formSourceFingerprint = '';
const actions = new Map<number, ActionTicket>();
let deleteDialog:
  | { cancel: () => void; destroy: () => void; ticket: ActionTicket }
  | undefined;

function ownerKey() {
  const uid = userStore.userInfo?.userId;
  const generation = authStore.getAuthGeneration();
  if (
    uid === undefined ||
    uid === null ||
    !String(uid).trim() ||
    String(uid).trim() === '0' ||
    !Number.isSafeInteger(generation) ||
    generation < 0
  )
    return '';
  return JSON.stringify([String(uid).trim(), generation]);
}
function validId(id: unknown): id is number {
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
}
function supportedMethod(method: number) {
  return [1, 2, 3, 4].includes(method);
}
function readableRecord(record: ApiInfo) {
  return (
    validId(record.id) &&
    typeof record.name === 'string' &&
    !!record.name.trim() &&
    typeof record.path === 'string' &&
    !!record.path.trim() &&
    supportedMethod(record.method) &&
    [0, 1, 2].includes(record.is_public) &&
    (record.category === undefined || Number.isSafeInteger(record.category))
  );
}
function recordFingerprint(record: ApiInfo) {
  return JSON.stringify([
    record.id,
    record.name,
    record.path,
    record.method,
    record.description,
    record.version,
    record.category,
    record.is_public,
  ]);
}
function listParams() {
  return {
    page: paginationConfig.current,
    search: searchParams.search || '',
    size: paginationConfig.pageSize,
    ...(searchParams.method === undefined
      ? {}
      : { method: searchParams.method }),
    ...(searchParams.is_public === 1 || searchParams.is_public === 2
      ? { is_public: searchParams.is_public }
      : {}),
  };
}
function queryKey() {
  return JSON.stringify(listParams());
}
function currentSource(record: ApiInfo, owner: string) {
  return (
    active &&
    !!owner &&
    owner === ownerKey() &&
    owner === listOwner &&
    apiList.value.includes(record)
  );
}
function permitted(kind: ActionKind) {
  return kind === 'delete' ? can('system.api.delete') : hasPerm(UPDATE);
}
function ownsActionRow(ticket: ActionTicket) {
  // 未提交的筛选输入不改变行归属；回滚只认仍属于本次操作的同一行。
  return (
    actions.get(ticket.id) === ticket &&
    currentSource(ticket.source, ticket.owner) &&
    recordFingerprint(ticket.source) === ticket.fingerprint
  );
}
function currentAction(ticket: ActionTicket) {
  return (
    ownsActionRow(ticket) &&
    ticket.query === queryKey() &&
    permitted(ticket.kind)
  );
}
function releaseAction(ticket: ActionTicket) {
  if (actions.get(ticket.id) === ticket) {
    actions.delete(ticket.id);
    delete actionLoading[ticket.id];
  }
}
function beginAction(record: ApiInfo, kind: ActionKind) {
  const owner = ownerKey();
  if (
    !currentSource(record, owner) ||
    !readableRecord(record) ||
    !permitted(kind) ||
    actions.has(record.id)
  )
    return;
  const ticket: ActionTicket = {
    fingerprint: recordFingerprint(record),
    id: record.id,
    kind,
    owner,
    query: queryKey(),
    source: record,
  };
  actions.set(record.id, ticket);
  actionLoading[record.id] = true;
  return ticket;
}
function closeDeleteDialog() {
  const dialog = deleteDialog;
  deleteDialog = undefined;
  if (dialog) {
    dialog.cancel();
    dialog.destroy();
  }
}
function closeForm() {
  editRequest++;
  submitRequest++;
  formWindowKey.value++;
  formOwner = '';
  formSource = undefined;
  formSourceFingerprint = '';
  modalVisible.value = false;
  submitLoading.value = false;
  Object.assign(formData, initFormData());
}
function closeView() {
  viewRequest++;
  viewWindowKey.value++;
  viewModalVisible.value = false;
  viewApiData.value = null;
}
function beginWindowInteraction() {
  closeForm();
  closeView();
}
function formCurrent(owner: string, window: number, mode: FormMode) {
  return (
    active &&
    !!owner &&
    owner === ownerKey() &&
    owner === formOwner &&
    window === formWindowKey.value &&
    mode === formMode.value &&
    modalVisible.value
  );
}
function validPayload(payload: CreateApiReq) {
  return (
    typeof payload.name === 'string' &&
    !!payload.name.trim() &&
    typeof payload.path === 'string' &&
    !!payload.path.trim() &&
    supportedMethod(payload.method) &&
    (payload.category === undefined ||
      Number.isSafeInteger(payload.category)) &&
    [1, 2].includes(payload.is_public)
  );
}
const formatTime = (timestamp?: number | string) =>
  timestamp
    ? new Date(
        typeof timestamp === 'number' ? timestamp * 1000 : timestamp,
      ).toLocaleDateString('zh-CN')
    : '-';
const methodNames: Record<number, string> = {
  1: 'GET',
  2: 'POST',
  3: 'PUT',
  4: 'DELETE',
};
const getMethodName = (method: number) => methodNames[method] || '未知';
const methodColors: Record<number, string> = {
  1: '#1890ff',
  2: '#52c41a',
  3: '#faad14',
  4: '#f5222d',
};
const getMethodColor = (method: number) => methodColors[method] || '#d9d9d9';

async function fetchApiList() {
  const owner = ownerKey();
  if (!active || !owner || !hasPerm('/api/apis/list')) return;
  const params = listParams();
  const query = queryKey();
  if (!validId(params.page) || !validId(params.size)) return;
  const ticket = ++listRequest;
  const sameRequest = () =>
    active && ticket === listRequest && owner === ownerKey();
  const current = () =>
    sameRequest() && query === queryKey() && hasPerm('/api/apis/list');
  loading.value = true;
  try {
    const response = await listApisApi(params);
    if (!current()) return;
    apiList.value = response.items || [];
    paginationConfig.total = response.total || 0;
    listOwner = owner;
  } catch (error) {
    if (!current()) return;
    apiList.value = [];
    paginationConfig.total = 0;
    listOwner = '';
    if (shouldNotifyPageError(error)) message.error('获取API列表失败');
  } finally {
    if (sameRequest()) loading.value = false;
  }
}
async function fetchApiStatistics() {
  const owner = ownerKey();
  if (!active || !owner || !hasPerm('/api/apis/statistics')) return;
  const ticket = ++statisticsRequest;
  const current = () =>
    active && ticket === statisticsRequest && owner === ownerKey();
  try {
    const response = await getApiStatisticsApi();
    if (current()) apiStatistics.value = response;
  } catch {
    if (current()) apiStatistics.value = { private_count: 0, public_count: 0 };
  }
}
function handleSearch() {
  paginationConfig.current = 1;
  void fetchApiList();
}
function handleReset() {
  searchParams.search = '';
  searchParams.method = undefined;
  searchParams.is_public = undefined;
  paginationConfig.current = 1;
  void fetchApiList();
}
async function handleRefresh() {
  await Promise.all([fetchApiList(), fetchApiStatistics()]);
}
function handleTableChange(pagination: {
  current?: number;
  pageSize?: number;
}) {
  if (!validId(pagination.current) || !validId(pagination.pageSize)) return;
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  void fetchApiList();
}
function handleAdd() {
  const owner = ownerKey();
  if (!active || !owner || !hasPerm(CREATE)) return;
  beginWindowInteraction();
  formMode.value = 'create';
  formOwner = owner;
  modalVisible.value = true;
}
async function handleEdit(record: ApiInfo) {
  const owner = ownerKey();
  if (
    !currentSource(record, owner) ||
    !hasPerm(UPDATE) ||
    !hasPerm(DETAIL) ||
    actions.has(record.id)
  )
    return;
  if (!readableRecord(record)) {
    message.error('API数据无效');
    return;
  }
  beginWindowInteraction();
  formMode.value = 'edit';
  formOwner = owner;
  formSource = record;
  formSourceFingerprint = recordFingerprint(record);
  const ticket = ++editRequest;
  const window = formWindowKey.value;
  const current = () =>
    active &&
    ticket === editRequest &&
    owner === ownerKey() &&
    owner === formOwner &&
    window === formWindowKey.value &&
    currentSource(record, owner) &&
    recordFingerprint(record) === formSourceFingerprint &&
    hasPerm(UPDATE) &&
    hasPerm(DETAIL);
  try {
    const response: ApiInfo = await getApiDetailApi(record.id);
    if (!current()) return;
    if (!response || response.id !== record.id || !readableRecord(response)) {
      message.error('API数据无效');
      return;
    }
    Object.assign(formData, {
      category: response.category,
      description: response.description || '',
      id: response.id,
      is_public: response.is_public === 0 ? 2 : response.is_public,
      method: response.method,
      name: response.name,
      path: response.path,
      version: response.version || '',
    });
    modalVisible.value = true;
  } catch (error) {
    if (current() && shouldNotifyPageError(error))
      message.error('获取API详情失败');
  }
}
async function handleView(record: ApiInfo) {
  const owner = ownerKey();
  if (!currentSource(record, owner) || !validId(record.id) || !hasPerm(DETAIL))
    return;
  beginWindowInteraction();
  viewModalVisible.value = true;
  const ticket = ++viewRequest;
  const window = viewWindowKey.value;
  const current = () =>
    active &&
    ticket === viewRequest &&
    window === viewWindowKey.value &&
    owner === ownerKey() &&
    viewModalVisible.value &&
    hasPerm(DETAIL);
  try {
    const response: ApiInfo = await getApiDetailApi(record.id);
    if (!current()) return;
    if (!response || response.id !== record.id || !readableRecord(response)) {
      message.error('API数据无效');
      return;
    }
    viewApiData.value = response;
  } catch (error) {
    if (current() && shouldNotifyPageError(error))
      message.error('获取API详情失败');
  }
}
function handleDelete(record: ApiInfo) {
  if (actions.has(record.id)) return;
  closeDeleteDialog();
  const ticket = beginAction(record, 'delete');
  if (!ticket) return;
  const detailWindow = viewWindowKey.value;
  let used = false;
  const dialog = Modal.confirm({
    onCancel() {
      if (used) return;
      used = true;
      if (deleteDialog?.ticket === ticket) deleteDialog = undefined;
      releaseAction(ticket);
    },
    async onOk() {
      if (used) return;
      used = true;
      try {
        if (!currentAction(ticket)) return;
        await deleteApiApi(ticket.id);
        if (!currentAction(ticket)) return;
        message.success('删除成功');
        if (
          detailWindow === viewWindowKey.value &&
          viewApiData.value?.id === ticket.id
        )
          closeView();
        if (apiList.value.length === 1 && paginationConfig.current > 1)
          paginationConfig.current--;
        await handleRefresh();
      } catch (error) {
        if (currentAction(ticket) && shouldNotifyPageError(error))
          message.error('删除失败');
      } finally {
        if (deleteDialog?.ticket === ticket) deleteDialog = undefined;
        releaseAction(ticket);
      }
    },
    title: '确定要删除吗？',
  });
  deleteDialog = {
    cancel() {
      if (used) return;
      used = true;
      releaseAction(ticket);
    },
    destroy: () => dialog.destroy(),
    ticket,
  };
}
async function handleAccessChange(record: ApiInfo, newAccess: number) {
  if (!readableRecord(record) || ![1, 2].includes(newAccess)) {
    message.error('API数据无效');
    return;
  }
  const ticket = beginAction(record, 'access');
  if (!ticket) return;
  const original = record.is_public;
  record.is_public = newAccess;
  ticket.fingerprint = recordFingerprint(record);
  const payload: UpdateApiReq = {
    category: record.category,
    description: record.description || '',
    id: ticket.id,
    is_public: newAccess === 1 ? 1 : 2,
    method: record.method,
    name: record.name,
    path: record.path,
    version: record.version || '',
  };
  try {
    await updateApiApi(payload);
    if (!currentAction(ticket)) return;
    message.success('访问权限更新成功');
    await fetchApiStatistics();
  } catch (error) {
    if (!ownsActionRow(ticket)) return;
    const notify = currentAction(ticket);
    record.is_public = original;
    if (notify && shouldNotifyPageError(error))
      message.error('访问权限更新失败');
  } finally {
    releaseAction(ticket);
  }
}
async function handleSubmit() {
  const owner = ownerKey();
  const window = formWindowKey.value;
  const mode = formMode.value;
  const form = formRef.value;
  if (
    !formCurrent(owner, window, mode) ||
    submitLoading.value ||
    !hasPerm(mode === 'create' ? CREATE : UPDATE)
  )
    return;
  if (!form || typeof form.validate !== 'function') {
    message.error('表单尚未就绪');
    return;
  }
  const snapshot = { ...formData };
  const fingerprint = JSON.stringify(snapshot);
  const ticket = ++submitRequest;
  const sameSubmission = () =>
    formCurrent(owner, window, mode) && ticket === submitRequest;
  const current = () =>
    sameSubmission() &&
    hasPerm(mode === 'create' ? CREATE : UPDATE) &&
    JSON.stringify(formData) === fingerprint;
  submitLoading.value = true;
  let action: ActionTicket | undefined;
  try {
    await form.validate();
    if (
      !current() ||
      formRef.value !== form ||
      JSON.stringify(formData) !== fingerprint
    )
      return;
    const payload: CreateApiReq = {
      category: snapshot.category ?? undefined,
      description: snapshot.description,
      is_public: snapshot.is_public === 1 ? 1 : 2,
      method: snapshot.method,
      name: snapshot.name,
      path: snapshot.path,
      version: snapshot.version,
    };
    if (![1, 2].includes(snapshot.is_public) || !validPayload(payload)) {
      message.error('API表单数据无效');
      return;
    }
    if (mode === 'create') {
      await createApiApi(payload);
    } else {
      if (
        !formSource ||
        !validId(snapshot.id) ||
        formSource.id !== snapshot.id ||
        recordFingerprint(formSource) !== formSourceFingerprint
      )
        return;
      action = beginAction(formSource, 'edit');
      if (!action) return;
      await updateApiApi({ ...payload, id: snapshot.id });
    }
    if (!current() || (action && !currentAction(action))) return;
    message.success(mode === 'create' ? '创建成功' : '更新成功');
    closeForm();
    await handleRefresh();
  } catch (error) {
    if (!current()) return;
    const validation =
      typeof error === 'object' && error !== null && 'errorFields' in error;
    if (!validation && shouldNotifyPageError(error)) message.error('操作失败');
  } finally {
    if (action) releaseAction(action);
    if (sameSubmission()) submitLoading.value = false;
  }
}
function invalidateOwner() {
  listRequest++;
  statisticsRequest++;
  closeForm();
  closeView();
  closeDeleteDialog();
  actions.clear();
  for (const id of Object.keys(actionLoading)) delete actionLoading[Number(id)];
  loading.value = false;
  apiList.value = [];
  listOwner = '';
  paginationConfig.total = 0;
  apiStatistics.value = { private_count: 0, public_count: 0 };
}
watch(
  ownerKey,
  () => {
    // 登录世代可能先于资料清理更新，此处只失效，避免过渡身份发起读取。
    invalidateOwner();
  },
  { flush: 'sync' },
);
onMounted(() => {
  void handleRefresh();
});
onUnmounted(() => {
  active = false;
  invalidateOwner();
});
</script>

<template>
  <OpsPage title="API管理">
    <!-- 页面头部 -->
    <template #actions>
      <a-button @click="handleRefresh">
        <Icon icon="material-symbols:refresh" />
        刷新
      </a-button>
      <a-button v-if="hasPerm(CREATE)" type="primary" @click="handleAdd">
        <Icon icon="material-symbols:add" />
        新建API
      </a-button>
    </template>

    <!-- 统计卡片 -->
    <template #summary>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">{{ paginationConfig.total }}</div>
          <div class="stat-label">总API数</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{ apiStatistics.public_count || 0 }}</div>
          <div class="stat-label">公开API</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{ apiStatistics.private_count || 0 }}</div>
          <div class="stat-label">私有API</div>
        </div>
      </div>
    </template>

    <!-- 搜索筛选区域 -->
    <template #filters>
      <div class="ops-filter-row">
        <div class="search-left">
          <a-input
            v-model:value="searchParams.search"
            allow-clear
            aria-label="搜索API"
            class="search-input"
            placeholder="搜索API名称或路径"
            @press-enter="handleSearch"
          >
            <template #prefix>
              <Icon icon="material-symbols:search" />
            </template>
          </a-input>

          <a-select
            v-model:value="searchParams.method"
            allow-clear
            class="method-select"
            placeholder="请求方法"
          >
            <a-select-option :value="1">GET</a-select-option>
            <a-select-option :value="2">POST</a-select-option>
            <a-select-option :value="3">PUT</a-select-option>
            <a-select-option :value="4">DELETE</a-select-option>
          </a-select>

          <a-select
            v-model:value="searchParams.is_public"
            allow-clear
            class="access-select"
            placeholder="访问权限"
          >
            <a-select-option :value="1">公开</a-select-option>
            <a-select-option :value="2">私有</a-select-option>
          </a-select>
        </div>

        <div class="search-right">
          <a-button type="primary" @click="handleSearch">搜索</a-button>
          <a-button @click="handleReset">重置</a-button>
        </div>
      </div>
    </template>

    <!-- API表格 -->
    <div class="table-container">
      <a-table
        :columns="tableColumns"
        :data-source="apiList"
        :loading="loading"
        :pagination="paginationConfig"
        :scroll="{ x: 'max-content' }"
        row-key="id"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'api'">
            <div class="api-info">
              <div class="api-method">
                <a-tag
                  :color="getMethodColor(record.method)"
                  class="method-tag"
                >
                  {{ getMethodName(record.method) }}
                </a-tag>
              </div>
              <div>
                <div class="api-name">{{ record.name }}</div>
                <div class="api-path">{{ record.path }}</div>
              </div>
            </div>
          </template>

          <template v-if="column.key === 'version'">
            <a-tag v-if="record.version" color="blue">
              {{ record.version }}
            </a-tag>
            <span v-else class="no-version">-</span>
          </template>

          <template v-if="column.key === 'access'">
            <a-switch
              :checked="record.is_public === 1"
              :disabled="!hasPerm(UPDATE) || actionLoading[record.id]"
              :loading="actionLoading[record.id]"
              size="small"
              @change="
                (checked: boolean) =>
                  handleAccessChange(record, checked ? 1 : 2)
              "
            />
          </template>

          <template v-if="column.key === 'category'">
            <span v-if="record.category">{{ record.category }}</span>
            <span v-else class="no-category">-</span>
          </template>

          <template v-if="column.key === 'created_at'">
            {{ formatTime(record.created_at) }}
          </template>

          <template v-if="column.key === 'actions'">
            <div class="action-buttons">
              <a-button
                v-if="hasPerm(DETAIL)"
                size="small"
                type="text"
                @click="handleView(record)"
              >
                查看
              </a-button>
              <a-button
                v-if="hasPerm(UPDATE)"
                :disabled="actionLoading[record.id]"
                size="small"
                type="text"
                @click="handleEdit(record)"
              >
                编辑
              </a-button>
              <a-button
                v-if="can('system.api.delete')"
                :disabled="actionLoading[record.id]"
                danger
                size="small"
                type="text"
                @click="handleDelete(record)"
              >
                删除
              </a-button>
            </div>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 查看API详情 -->
    <a-modal
      :key="viewWindowKey"
      :footer="null"
      :open="viewModalVisible"
      title="API详情"
      width="700px"
      @cancel="closeView"
    >
      <div v-if="viewApiData" class="api-detail">
        <div class="detail-section">
          <h3>基本信息</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <label>API名称</label>
              <span>{{ viewApiData.name }}</span>
            </div>
            <div class="detail-item">
              <label>API路径</label>
              <span class="api-path-detail">{{ viewApiData.path }}</span>
            </div>
            <div class="detail-item">
              <label>请求方法</label>
              <a-tag :color="getMethodColor(viewApiData.method)">
                {{ getMethodName(viewApiData.method) }}
              </a-tag>
            </div>
            <div class="detail-item">
              <label>API版本</label>
              <span>{{ viewApiData.version || '-' }}</span>
            </div>
            <div class="detail-item">
              <label>访问权限</label>
              <a-tag :color="viewApiData.is_public === 1 ? 'green' : 'orange'">
                {{ viewApiData.is_public === 1 ? '公开' : '私有' }}
              </a-tag>
            </div>
            <div class="detail-item">
              <label>API分类</label>
              <span>{{ viewApiData.category || '-' }}</span>
            </div>
            <div v-if="viewApiData.description" class="detail-item">
              <label>API描述</label>
              <span>{{ viewApiData.description }}</span>
            </div>
            <div class="detail-item">
              <label>创建时间</label>
              <span>{{ formatTime(viewApiData.created_at) }}</span>
            </div>
          </div>
        </div>
      </div>
    </a-modal>

    <!-- 编辑API -->
    <a-modal
      :confirm-loading="submitLoading"
      :open="modalVisible"
      :title="modalTitle"
      width="800px"
      @cancel="closeForm"
      @ok="handleSubmit"
    >
      <a-form
        :key="formWindowKey"
        ref="formRef"
        :model="formData"
        :rules="formRules"
        layout="vertical"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="API名称" name="name">
              <a-input
                v-model:value="formData.name"
                placeholder="请输入API名称"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="API路径" name="path">
              <a-input
                v-model:value="formData.path"
                placeholder="例如: /api/users"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="请求方法" name="method">
              <a-select
                v-model:value="formData.method"
                placeholder="请选择请求方法"
              >
                <a-select-option :value="1">GET</a-select-option>
                <a-select-option :value="2">POST</a-select-option>
                <a-select-option :value="3">PUT</a-select-option>
                <a-select-option :value="4">DELETE</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="API版本" name="version">
              <a-input
                v-model:value="formData.version"
                placeholder="例如: v1.0"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="API分类" name="category">
              <a-input-number
                v-model:value="formData.category"
                :min="0"
                placeholder="分类ID"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="访问权限" name="is_public">
              <a-select v-model:value="formData.is_public">
                <a-select-option :value="1">公开</a-select-option>
                <a-select-option :value="2">私有</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="API描述" name="description">
          <a-textarea
            v-model:value="formData.description"
            :rows="3"
            placeholder="请输入API描述信息"
          />
        </a-form-item>

        <div v-if="formData.path && formData.method" class="api-preview">
          <div class="preview-title">
            <Icon icon="material-symbols:preview" />
            接口预览
          </div>
          <div class="preview-content">
            <a-tag
              :color="getMethodColor(formData.method)"
              class="preview-method-tag"
            >
              {{ getMethodName(formData.method) }}
            </a-tag>
            <span class="preview-path">{{ formData.path }}</span>
            <a-tag
              :color="formData.is_public === 1 ? 'green' : 'orange'"
              class="preview-access-tag"
            >
              {{ formData.is_public === 1 ? '公开' : '私有' }}
            </a-tag>
          </div>
        </div>
      </a-form>
    </a-modal>
  </OpsPage>
</template>

<style scoped>
@media (max-width: 1200px) {
  .search-left {
    flex-direction: column;
    gap: 12px;
  }

  .search-input {
    max-width: none;
  }

  .method-select,
  .access-select {
    width: 100%;
  }

  .search-right {
    justify-content: flex-end;
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .search-right {
    flex-direction: column;
    gap: 8px;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .action-buttons {
    flex-direction: column;
    width: 100%;
  }

  .api-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .preview-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--ops-surface);
  padding: 20px;
  border-radius: var(--ops-radius);
  text-align: center;
  border: 1px solid var(--ops-border);
}

.stat-number {
  font-size: 28px;
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: var(--ops-muted);
}

.search-left {
  display: flex;
  gap: 12px;
  flex: 1;
  align-items: flex-end;
}

.search-input {
  flex: 1;
  max-width: 300px;
}

.method-select,
.access-select {
  width: 140px;
}

.search-right {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.table-container {
  min-width: 0;
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  border: 1px solid var(--ops-border);
  overflow: hidden;
}

.table-container :deep(.ant-table-thead > tr > th) {
  background: var(--ops-ground);
  font-weight: 600;
  color: var(--ops-ink);
  border-bottom: 1px solid var(--ops-border);
}

.table-container :deep(.ant-table-tbody > tr:hover > td) {
  background: var(--ops-ground);
}

.api-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.api-method {
  flex-shrink: 0;
}

.method-tag {
  font-family: var(--ops-font-data);
  font-weight: 600;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  border: none;
}

.api-name {
  font-weight: 600;
  color: var(--ops-ink);
  margin-bottom: 2px;
}

.api-path {
  font-size: 12px;
  color: var(--ops-muted);
  font-family: var(--ops-font-data);
  background: var(--ops-ground);
  padding: 2px 6px;
  border-radius: 3px;
}

.api-path-detail {
  font-family: var(--ops-font-data);
  background: var(--ops-ground);
  padding: 4px 8px;
  border-radius: 4px;
  color: var(--ops-muted);
}

.no-version,
.no-category {
  color: #bfbfbf;
  font-style: italic;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

.api-detail {
  padding: 8px 0;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--ops-ink);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--ops-border);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.detail-item {
  padding: 12px;
  background: var(--ops-ground);
  border-radius: 6px;
  border: 1px solid var(--ops-border);
}

.detail-item label {
  display: block;
  font-size: 12px;
  color: var(--ops-muted);
  font-weight: 600;
  margin-bottom: 4px;
}

.detail-item span {
  font-size: 14px;
  color: var(--ops-ink);
}

.api-preview {
  margin-top: 24px;
  padding: 16px;
  background: var(--ops-ground);
  border: 1px dashed var(--ops-border);
  border-radius: 6px;
}

.preview-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--ops-ink);
  margin-bottom: 12px;
}

.preview-content {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: var(--ops-font-data);
}

.preview-method-tag {
  font-weight: 600;
  border: none;
}

.preview-path {
  flex: 1;
  font-size: 14px;
  color: var(--ops-ink);
  background: var(--ops-surface);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--ops-border);
}

.preview-access-tag {
  font-size: 12px;
}

.table-container :deep(.ant-btn-text) {
  color: #1890ff;
}

.table-container :deep(.ant-btn-text:hover) {
  color: #40a9ff;
  background: #f0f9ff;
}

.table-container :deep(.ant-btn-text.ant-btn-dangerous) {
  color: #ff4d4f;
}

.table-container :deep(.ant-btn-text.ant-btn-dangerous:hover) {
  color: #ff7875;
  background: #fff2f0;
}

/* 继承用户页面的样式风格 */
</style>
