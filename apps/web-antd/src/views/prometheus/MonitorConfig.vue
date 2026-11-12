<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { DownOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
import { type FormInstance, message, Modal } from 'ant-design-vue';

import {
  ConfigStatus,
  ConfigType,
  createMonitorConfigApi,
  type CreateMonitorConfigParams,
  deleteMonitorConfigApi,
  getMonitorConfigApi,
  getMonitorConfigListApi,
  type GetMonitorConfigListParams,
  type MonitorConfigItem,
  updateMonitorConfigApi,
  type UpdateMonitorConfigParams,
} from '#/api/core/prometheus/prometheus_config';
import {
  getMonitorScrapePoolListApi,
  type MonitorScrapePool,
} from '#/api/core/prometheus/prometheus_scrape_pool';
import OpsPage from '#/components/ops/OpsPage.vue';
import { useAuthStore } from '#/store';
import { usePermission } from '#/utils/permission';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';

import { useListRequest } from './useListRequest';

const { can, hasPerm } = usePermission();
const CREATE_CONFIG_PERMISSION = '/api/monitor/configs/create';
const UPDATE_CONFIG_PERMISSION = '/api/monitor/configs/update/:id';

let disposed = false;
let addRevision = 0;
let editRevision = 0;
let detailRevision = 0;
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
  detailRevision += 1;
});

// 实例池接口
type PoolOption = { id: number } & Pick<MonitorScrapePool, 'name'>;

// 分页接口
interface PaginationConfig {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger: boolean;
  showQuickJumper: boolean;
  showTotal: (total: number) => string;
  size: 'default' | 'small';
}

// 统计数据接口
interface Stats {
  total: number;
  active: number;
  alertRules: number;
  instances: number;
}

// 表单数据接口
interface ConfigForm {
  id?: number;
  name: string;
  pool_id: number | undefined;
  instance_ip: string;
  config_type: ConfigType | undefined;
  config_content: string;
  status: ConfigStatus;
}

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
    title: '配置名称',
    width: 200,
  },
  {
    dataIndex: 'config_type',
    key: 'config_type',
    title: '配置类型',
    width: 150,
  },
  {
    dataIndex: 'instance_info',
    key: 'instance_info',
    title: '实例信息',
    width: 200,
  },
  {
    align: 'center' as const,
    dataIndex: 'status',
    key: 'status',
    title: '状态',
    width: 100,
  },
  {
    dataIndex: 'last_generated_time',
    key: 'last_generated_time',
    title: '最后生成时间',
    width: 180,
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

// 实例池数据
const poolOptions = ref<PoolOption[]>([]);

// 状态数据
const loading = ref(false);
const { beginRequest, loadError } = useListRequest(loading);
const data = ref<MonitorConfigItem[]>([]);
const searchText = ref('');
const searchPoolId = ref<number | undefined>(undefined);
const searchConfigType = ref<ConfigType | undefined>(undefined);
const searchStatus = ref<ConfigStatus | undefined>(undefined);

// 防抖处理
let searchTimeout: null | ReturnType<typeof setTimeout> = null;
onBeforeUnmount(() => {
  if (searchTimeout) clearTimeout(searchTimeout);
});

// 分页配置
const paginationConfig = reactive<PaginationConfig>({
  current: 1,
  pageSize: 10,
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  size: 'default',
  total: 0,
});

// 统计数据
const stats = reactive<Stats>({
  active: 0,
  alertRules: 0,
  instances: 0,
  total: 0,
});

// 模态框状态
const isAddModalVisible = ref(false);
const isEditModalVisible = ref(false);
const isPreviewModalVisible = ref(false);
const isDetailModalVisible = ref(false);
const previewConfig = ref<MonitorConfigItem | null>(null);
const detailConfig = ref<MonitorConfigItem | null>(null);

// 表单数据
const addFormRef = ref<FormInstance>();
const editFormRef = ref<FormInstance>();
const addForm = reactive<ConfigForm>({
  config_content: '',
  config_type: undefined,
  instance_ip: '',
  name: '',
  pool_id: undefined,
  status: ConfigStatus.Active,
});

const editForm = reactive<ConfigForm>({
  config_content: '',
  config_type: undefined,
  id: undefined,
  instance_ip: '',
  name: '',
  pool_id: undefined,
  status: ConfigStatus.Active,
});

// 表单验证规则
const formRules = {
  config_content: [
    { message: '请输入配置内容', required: true, trigger: 'blur' },
  ],
  config_type: [
    { message: '请选择配置类型', required: true, trigger: 'change' },
  ],
  instance_ip: [
    { message: '请输入实例IP', required: true, trigger: 'blur' },
    { max: 128, message: '长度应为1到128个字符', min: 1, trigger: 'blur' },
  ],
  name: [
    { message: '请输入配置名称', required: true, trigger: 'blur' },
    { max: 255, message: '长度应为1到255个字符', min: 1, trigger: 'blur' },
  ],
  pool_id: [{ message: '请选择实例池', required: true, trigger: 'change' }],
};

const SECRET_PLACEHOLDER = '<secret>';
const HIDDEN_CONFIG_CONTENT = '配置解析失败，已隐藏内容';
const secretKeepHint =
  '保留 <secret> 表示沿用原凭据，要改就填真实值。修改 Alertmanager 发送目标，或凭据位于自定义配置段时，需要重新填写真实凭据，不能保留 <secret>。';
const hiddenConfigHint =
  '原配置无法解析，内容已隐藏；不改内容直接保存会保留原配置，若在此填写新内容将整体替换原配置。';
const createSecretMessage = '创建配置不能包含凭据占位符，请填写真实凭据';
const createHiddenMessage = '配置内容为隐藏占位，请填写完整配置';

const containsSecretPlaceholder = (content: string) =>
  content.includes(SECRET_PLACEHOLDER);
const isHiddenConfigContent = (content: string) =>
  content.trim() === HIDDEN_CONFIG_CONTENT;
const editKeepsSecret = computed(() =>
  containsSecretPlaceholder(editForm.config_content),
);
const editContentHidden = computed(() =>
  isHiddenConfigContent(editForm.config_content),
);

const getConfigTypeName = (type: ConfigType): string => {
  const typeNames: Record<ConfigType, string> = {
    [ConfigType.AlertManager]: 'AlertManager',
    [ConfigType.AlertRule]: '告警规则',
    [ConfigType.Prometheus]: 'Prometheus',
    [ConfigType.RecordRule]: '预聚合规则',
    [ConfigType.WebhookFile]: 'Webhook文件',
  };
  return typeNames[type] || '未知';
};

const getConfigTypeColor = (type: ConfigType): string => {
  const typeColors: Record<ConfigType, string> = {
    [ConfigType.AlertManager]: 'alert-tag',
    [ConfigType.AlertRule]: 'rule-tag',
    [ConfigType.Prometheus]: 'prometheus-tag',
    [ConfigType.RecordRule]: 'record-tag',
    [ConfigType.WebhookFile]: 'webhook-tag',
  };
  return typeColors[type] || 'default-tag';
};

const getPoolName = (poolId: number): string => {
  const pool = poolOptions.value.find((p) => p.id === poolId);
  return pool?.name || `Pool-${poolId}`;
};

const formatDate = (input: number | string): string => {
  if (!input) return '';
  const date =
    typeof input === 'number' ? new Date(input * 1000) : new Date(input);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN');
};

const formatTime = (input: number | string): string => {
  if (!input) return '';
  const date =
    typeof input === 'number' ? new Date(input * 1000) : new Date(input);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFullDateTime = (input: number | string): string => {
  if (!input) return '';
  const date =
    typeof input === 'number' ? new Date(input * 1000) : new Date(input);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN');
};

// 更新统计数据
const updateStats = (): void => {
  stats.total = paginationConfig.total;
  stats.active = data.value.filter(
    (item: MonitorConfigItem) => item.status === ConfigStatus.Active,
  ).length;
  stats.alertRules = data.value.filter(
    (item: MonitorConfigItem) => item.config_type === ConfigType.AlertRule,
  ).length;
  stats.instances = new Set(
    data.value.map((item: MonitorConfigItem) => item.instance_ip),
  ).size;
};

// 数据加载
const fetchConfigs = async (): Promise<void> => {
  const request = beginRequest();
  try {
    const params: GetMonitorConfigListParams = {
      config_type: searchConfigType.value,
      page: paginationConfig.current,
      search: searchText.value || undefined,
      size: paginationConfig.pageSize,
      status: searchStatus.value,
    };

    const response = await getMonitorConfigListApi(params);
    if (!request.isCurrent()) return;
    if (response) {
      let items: MonitorConfigItem[] = response.items || [];
      // 客户端按实例池过滤（后端参数未定义）
      if (searchPoolId.value !== undefined) {
        items = items.filter(
          (item: MonitorConfigItem) => item.pool_id === searchPoolId.value,
        );
      }
      data.value = items;
      paginationConfig.total = (response.total ?? items.length) as number;
      updateStats();
    }
  } catch (error: any) {
    if (!request.fail(error, '加载配置列表失败')) return;
    data.value = [];
    paginationConfig.total = 0;
    updateStats();
    if (shouldNotifyPageError(error)) message.error(loadError.value);
  } finally {
    request.finish();
  }
};

// 加载实例池数据
let poolOptionsRevision = 0;
let poolOptionsOwner: string | undefined;
const loadPoolOptions = async (): Promise<void> => {
  const owner = operationOwner();
  const ticket = ++poolOptionsRevision;
  if (poolOptionsOwner !== owner) {
    poolOptionsOwner = owner;
    poolOptions.value = [];
  }
  const isCurrent = () =>
    !disposed && poolOptionsRevision === ticket && operationOwner() === owner;
  if (disposed || !owner) return;
  try {
    let allPools: MonitorScrapePool[] = [];
    let currentPage = 1;
    const pageSize = 10;
    let hasMore = true;

    while (hasMore) {
      const res = await getMonitorScrapePoolListApi({
        page: currentPage,
        size: pageSize,
      });

      if (!isCurrent()) return;
      if (res?.items && res.items.length > 0) {
        allPools = allPools.concat(res.items);

        // 检查是否还有更多数据
        hasMore =
          res.items.length === pageSize && allPools.length < (res.total || 0);
        currentPage++;
      } else {
        hasMore = false;
      }
    }

    if (!isCurrent()) return;
    poolOptions.value = allPools.flatMap((item) => {
      const id = item.id;
      return validPositiveId(id) ? [{ id, name: item.name }] : [];
    });
  } catch {
    if (isCurrent()) poolOptions.value = [];
  }
};

// 事件处理
const handleTableChange = (pagination: any): void => {
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  fetchConfigs();
};

const handleSearch = (): void => {
  paginationConfig.current = 1;
  fetchConfigs();
};

const handleSearchChange = (): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    paginationConfig.current = 1;
    fetchConfigs();
  }, 500);
};

const handleFilterChange = (): void => {
  paginationConfig.current = 1;
  fetchConfigs();
};

const handleReset = (): void => {
  searchText.value = '';
  searchPoolId.value = undefined;
  searchConfigType.value = undefined;
  searchStatus.value = undefined;
  paginationConfig.current = 1;
  fetchConfigs();
};

const errorText = (error: unknown, fallback = '未知错误'): string =>
  error &&
  typeof error === 'object' &&
  'message' in error &&
  typeof error.message === 'string' &&
  error.message
    ? error.message
    : fallback;

const confirmDelete = (record: MonitorConfigItem): void => {
  if (disposed) return;
  const id = record.id;
  const owner = operationOwner();
  if (!validPositiveId(id) || !owner) {
    message.warning('配置或账号标识无效，请刷新后重试');
    return;
  }
  const name = record.name;
  const isCurrent = () =>
    !disposed && record.id === id && operationOwner() === owner;
  let confirmationConsumed = false;
  Modal.confirm({
    cancelText: '取消',
    content: `确定要删除配置 "${name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    async onOk() {
      if (confirmationConsumed || !isCurrent()) return;
      confirmationConsumed = true;
      try {
        await deleteMonitorConfigApi({ id });
        if (!isCurrent()) return;
        message.success(`配置 "${name}" 已删除`);
        fetchConfigs();
      } catch (error: unknown) {
        if (isCurrent() && shouldNotifyPageError(error))
          message.error(errorText(error, '删除配置失败'));
      }
    },
    title: '警告',
  });
};

const showPreviewModal = (record: MonitorConfigItem): void => {
  previewConfig.value = record;
  isPreviewModalVisible.value = true;
};

const handleMenuClick = (command: string, record: MonitorConfigItem): void => {
  switch (command) {
    case 'delete': {
      confirmDelete(record);
      break;
    }
    case 'preview': {
      showPreviewModal(record);
      break;
    }
  }
};

const validConfigTypes = new Set<number>([
  ConfigType.AlertManager,
  ConfigType.AlertRule,
  ConfigType.Prometheus,
  ConfigType.RecordRule,
  ConfigType.WebhookFile,
]);
const validConfigType = (value: unknown): value is ConfigType =>
  typeof value === 'number' && validConfigTypes.has(value);

const validConfigStatuses = new Set<number>([
  ConfigStatus.Active,
  ConfigStatus.Inactive,
]);
const validConfigStatus = (value: unknown): value is ConfigStatus =>
  typeof value === 'number' && validConfigStatuses.has(value);

let editTarget: MonitorConfigItem | undefined;

const resetAddForm = (): void => {
  Object.assign(addForm, {
    config_content: '',
    config_type: undefined,
    instance_ip: '',
    name: '',
    pool_id: undefined,
    status: ConfigStatus.Active,
  });
};

const closeDetailModal = (): void => {
  detailRevision += 1;
  isDetailModalVisible.value = false;
  detailConfig.value = null;
};

const showAddModal = (): void => {
  if (!hasPerm(CREATE_CONFIG_PERMISSION)) {
    message.warning('没有新增配置权限');
    return;
  }
  const owner = operationOwner();
  if (disposed || !owner) return;
  closeDetailModal();
  addRevision += 1;
  addOwner = owner;
  if (poolOptionsOwner !== owner) loadPoolOptions();
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

const handleAdd = async (): Promise<void> => {
  if (disposed || addSubmitting.value || !isAddModalVisible.value) return;
  if (!hasPerm(CREATE_CONFIG_PERMISSION)) {
    message.warning('没有新增配置权限');
    return;
  }
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
    hasPerm(CREATE_CONFIG_PERMISSION) &&
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
    const configType = addForm.config_type;
    const status = addForm.status;
    if (
      !validPositiveId(poolId) ||
      !validConfigType(configType) ||
      !validConfigStatus(status)
    ) {
      message.warning('请选择有效的实例池、配置类型和状态');
      return;
    }
    if (containsSecretPlaceholder(addForm.config_content)) {
      message.warning(createSecretMessage);
      return;
    }
    if (isHiddenConfigContent(addForm.config_content)) {
      message.warning(createHiddenMessage);
      return;
    }
    const params: CreateMonitorConfigParams = {
      config_content: addForm.config_content,
      config_type: configType,
      instance_ip: addForm.instance_ip,
      name: addForm.name,
      pool_id: poolId,
      status,
    };
    await createMonitorConfigApi(params);
    if (!isCurrent()) return;
    closeAddModal();
    fetchConfigs();
    message.success('新增配置成功');
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error(`新增配置失败: ${errorText(error)}`);
  } finally {
    if (addRevision === ticket) addSubmitting.value = false;
  }
};

const showEditModal = (record: MonitorConfigItem): void => {
  if (!hasPerm(UPDATE_CONFIG_PERMISSION)) {
    message.warning('没有编辑配置权限');
    return;
  }
  const owner = operationOwner();
  if (disposed || !owner || !validPositiveId(record.id)) {
    message.warning('配置或账号标识无效，请刷新后重试');
    return;
  }
  closeDetailModal();
  editRevision += 1;
  editOwner = owner;
  if (poolOptionsOwner !== owner) loadPoolOptions();
  editTarget = record;
  editSubmitting.value = false;
  editForm.id = record.id;
  editForm.name = record.name;
  editForm.pool_id = record.pool_id;
  editForm.instance_ip = record.instance_ip;
  editForm.config_type = record.config_type;
  editForm.config_content = record.config_content;
  editForm.status = record.status;
  isEditModalVisible.value = true;
};

const showEditModalFromDetail = (record: MonitorConfigItem): void => {
  showEditModal(record);
};

const closeEditModal = (): void => {
  editRevision += 1;
  editOwner = undefined;
  editTarget = undefined;
  editSubmitting.value = false;
  isEditModalVisible.value = false;
};

const handleEdit = async (): Promise<void> => {
  if (disposed || editSubmitting.value || !isEditModalVisible.value) return;
  if (!hasPerm(UPDATE_CONFIG_PERMISSION)) {
    message.warning('没有编辑配置权限');
    return;
  }
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
    hasPerm(UPDATE_CONFIG_PERMISSION) &&
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
    const configType = editForm.config_type;
    const status = editForm.status;
    if (
      !validPositiveId(poolId) ||
      !validConfigType(configType) ||
      !validConfigStatus(status)
    ) {
      message.warning('请选择有效的实例池、配置类型和状态');
      return;
    }
    const params: UpdateMonitorConfigParams = {
      config_content: editForm.config_content,
      config_type: configType,
      id,
      instance_ip: editForm.instance_ip,
      name: editForm.name,
      pool_id: poolId,
      status,
    };
    await updateMonitorConfigApi(params);
    if (!isCurrent()) return;
    closeEditModal();
    fetchConfigs();
    message.success('更新配置成功');
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error(`更新配置失败: ${errorText(error)}`);
  } finally {
    if (editRevision === ticket) editSubmitting.value = false;
  }
};

const handleViewDetail = async (record: MonitorConfigItem): Promise<void> => {
  const owner = operationOwner();
  const id = record.id;
  if (disposed || !owner || !validPositiveId(id)) {
    message.warning('配置或账号标识无效，请刷新后重试');
    return;
  }
  const ticket = ++detailRevision;
  const isCurrent = () =>
    !disposed &&
    detailRevision === ticket &&
    operationOwner() === owner &&
    record.id === id;
  try {
    const detail = await getMonitorConfigApi({ id });
    if (!isCurrent()) return;
    if (detail?.id !== id) throw new Error('配置详情标识无效，请刷新后重试');
    detailConfig.value = detail;
    isDetailModalVisible.value = true;
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error(`获取配置详情失败: ${errorText(error)}`);
  }
};

const closePreviewModal = (): void => {
  isPreviewModalVisible.value = false;
  previewConfig.value = null;
};

// 生命周期
onMounted(() => {
  loadPoolOptions();
  fetchConfigs();
});
</script>

<template>
  <OpsPage description="管理配置版本、实例与生效状态" title="监控配置">
    <!-- 页面标题 -->
    <template #actions>
      <a-button
        v-if="hasPerm(CREATE_CONFIG_PERMISSION)"
        class="btn-create"
        type="primary"
        @click="showAddModal"
      >
        <template #icon>
          <PlusOutlined />
        </template>
        <span class="btn-text">新增监控配置</span>
      </a-button>
    </template>
    <template #filters>
      <div class="search-filters">
        <a-input-search
          v-model:value="searchText"
          allow-clear
          class="search-input"
          placeholder="搜索配置名称..."
          @change="handleSearchChange"
          @search="handleSearch"
        />
        <a-select
          v-model:value="searchPoolId"
          allow-clear
          class="filter-select"
          placeholder="实例池（本页）"
          @change="handleFilterChange"
        >
          <a-select-option :value="undefined">全部实例池</a-select-option>
          <a-select-option
            v-for="pool in poolOptions"
            :key="pool.id"
            :value="pool.id"
          >
            {{ pool.name }}
          </a-select-option>
        </a-select>
        <a-select
          v-model:value="searchConfigType"
          allow-clear
          class="filter-select"
          placeholder="全部类型"
          @change="handleFilterChange"
        >
          <a-select-option :value="undefined">全部类型</a-select-option>
          <a-select-option :value="ConfigType.Prometheus">
            Prometheus配置
          </a-select-option>
          <a-select-option :value="ConfigType.AlertManager">
            AlertManager配置
          </a-select-option>
          <a-select-option :value="ConfigType.AlertRule">
            告警规则配置
          </a-select-option>
          <a-select-option :value="ConfigType.RecordRule">
            预聚合规则配置
          </a-select-option>
          <a-select-option :value="ConfigType.WebhookFile">
            Webhook文件
          </a-select-option>
        </a-select>
        <a-select
          v-model:value="searchStatus"
          allow-clear
          class="filter-select"
          placeholder="全部状态"
          @change="handleFilterChange"
        >
          <a-select-option :value="undefined">全部状态</a-select-option>
          <a-select-option :value="ConfigStatus.Active">激活</a-select-option>
          <a-select-option :value="ConfigStatus.Inactive">
            非激活
          </a-select-option>
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
                title="总配置数"
              >
                <template #prefix>
                  <Icon icon="carbon:settings" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.active"
                :value-style="{ color: '#52c41a' }"
                title="本页激活配置"
              >
                <template #prefix>
                  <Icon icon="carbon:checkmark-filled" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.alertRules"
                :value-style="{ color: '#faad14' }"
                title="本页告警规则"
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
                :value="loadError ? '未知' : stats.instances"
                :value-style="{ color: '#cf1322' }"
                title="本页实例数"
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

    <!-- 表格容器 -->
    <a-alert
      v-if="loadError"
      :message="loadError"
      role="alert"
      show-icon
      type="error"
    >
      <template #action>
        <a-button :loading="loading" size="small" @click="fetchConfigs">
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
              <div class="config-name-cell">
                <div
                  :class="
                    record.status === ConfigStatus.Active
                      ? 'status-dot-active'
                      : 'status-dot-inactive'
                  "
                  class="status-dot"
                ></div>
                <span class="config-name">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'config_type'">
              <a-tag
                :class="getConfigTypeColor(record.config_type)"
                class="tech-tag"
              >
                {{ getConfigTypeName(record.config_type) }}
              </a-tag>
            </template>

            <template v-if="column.key === 'instance_info'">
              <div class="instance-info">
                <div class="instance-item">
                  实例池: {{ getPoolName(record.pool_id) }}
                </div>
                <div class="instance-item instance-ip">
                  IP: {{ record.instance_ip }}
                </div>
              </div>
            </template>

            <template v-if="column.key === 'status'">
              <a-tag
                :color="
                  record.status === ConfigStatus.Active ? 'success' : 'default'
                "
              >
                {{ record.status === ConfigStatus.Active ? '激活' : '非激活' }}
              </a-tag>
            </template>

            <template v-if="column.key === 'last_generated_time'">
              <div class="date-info">
                <span class="date">{{
                  formatDate(record.last_generated_time)
                }}</span>
                <span class="time">{{
                  formatTime(record.last_generated_time)
                }}</span>
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
                  @click="handleViewDetail(record)"
                >
                  查看
                </a-button>
                <a-button
                  v-if="hasPerm(UPDATE_CONFIG_PERMISSION)"
                  size="small"
                  type="default"
                  @click="showEditModal(record)"
                >
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleMenuClick(e.key, record)">
                      <a-menu-item key="preview">预览配置</a-menu-item>
                      <a-menu-item
                        v-if="can('monitor.config.delete')"
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

    <!-- 新增配置模态框 -->
    <a-modal
      :confirm-loading="addSubmitting"
      :destroy-on-close="true"
      :open="isAddModalVisible"
      :width="formDialogWidth"
      class="responsive-modal config-modal"
      title="新增监控配置"
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
            <a-col :sm="12" :xs="24">
              <a-form-item label="配置名称" name="name">
                <a-input
                  v-model:value="addForm.name"
                  placeholder="请输入配置名称"
                />
              </a-form-item>
            </a-col>
            <a-col :sm="12" :xs="24">
              <a-form-item
                :rules="[{ required: true, message: '请选择配置类型' }]"
                label="配置类型"
                name="config_type"
              >
                <a-select
                  v-model:value="addForm.config_type"
                  placeholder="请选择配置类型"
                >
                  <a-select-option :value="ConfigType.Prometheus">
                    Prometheus配置
                  </a-select-option>
                  <a-select-option :value="ConfigType.AlertManager">
                    AlertManager配置
                  </a-select-option>
                  <a-select-option :value="ConfigType.AlertRule">
                    告警规则配置
                  </a-select-option>
                  <a-select-option :value="ConfigType.RecordRule">
                    预聚合规则配置
                  </a-select-option>
                  <a-select-option :value="ConfigType.WebhookFile">
                    Webhook文件
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item
                :rules="[{ required: true, message: '请选择实例池' }]"
                label="实例池"
                name="pool_id"
              >
                <a-select
                  v-model:value="addForm.pool_id"
                  placeholder="请选择实例池"
                >
                  <a-select-option
                    v-for="pool in poolOptions"
                    :key="pool.id"
                    :value="pool.id"
                  >
                    {{ pool.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :sm="12" :xs="24">
              <a-form-item label="实例IP" name="instance_ip">
                <a-input
                  v-model:value="addForm.instance_ip"
                  placeholder="请输入实例IP"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">配置内容</div>
          <a-form-item
            :rules="[{ required: true, message: '请输入配置内容' }]"
            label="配置内容"
            name="config_content"
          >
            <a-textarea
              v-model:value="addForm.config_content"
              :rows="12"
              placeholder="请输入配置内容"
            />
          </a-form-item>
        </div>

        <div class="form-section">
          <div class="section-title">状态设置</div>
          <a-form-item label="状态" name="status">
            <a-switch
              v-model:checked="addForm.status"
              :checked-value="ConfigStatus.Active"
              :un-checked-value="ConfigStatus.Inactive"
              checked-children="激活"
              class="tech-switch"
              un-checked-children="非激活"
            />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <!-- 编辑配置模态框 -->
    <a-modal
      :confirm-loading="editSubmitting"
      :destroy-on-close="true"
      :open="isEditModalVisible"
      :width="formDialogWidth"
      class="responsive-modal config-modal"
      title="编辑监控配置"
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
            <a-col :sm="12" :xs="24">
              <a-form-item label="配置名称" name="name">
                <a-input
                  v-model:value="editForm.name"
                  placeholder="请输入配置名称"
                />
              </a-form-item>
            </a-col>
            <a-col :sm="12" :xs="24">
              <a-form-item
                :rules="[{ required: true, message: '请选择配置类型' }]"
                label="配置类型"
                name="config_type"
              >
                <a-select
                  v-model:value="editForm.config_type"
                  placeholder="请选择配置类型"
                >
                  <a-select-option :value="ConfigType.Prometheus">
                    Prometheus配置
                  </a-select-option>
                  <a-select-option :value="ConfigType.AlertManager">
                    AlertManager配置
                  </a-select-option>
                  <a-select-option :value="ConfigType.AlertRule">
                    告警规则配置
                  </a-select-option>
                  <a-select-option :value="ConfigType.RecordRule">
                    预聚合规则配置
                  </a-select-option>
                  <a-select-option :value="ConfigType.WebhookFile">
                    Webhook文件
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item
                :rules="[{ required: true, message: '请选择实例池' }]"
                label="实例池"
                name="pool_id"
              >
                <a-select
                  v-model:value="editForm.pool_id"
                  placeholder="请选择实例池"
                >
                  <a-select-option
                    v-for="pool in poolOptions"
                    :key="pool.id"
                    :value="pool.id"
                  >
                    {{ pool.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :sm="12" :xs="24">
              <a-form-item label="实例IP" name="instance_ip">
                <a-input
                  v-model:value="editForm.instance_ip"
                  placeholder="请输入实例IP"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">配置内容</div>
          <a-form-item
            :rules="[{ required: true, message: '请输入配置内容' }]"
            label="配置内容"
            name="config_content"
          >
            <a-textarea
              v-model:value="editForm.config_content"
              :rows="12"
              placeholder="请输入配置内容"
            />
            <a-alert
              v-if="editKeepsSecret"
              :message="secretKeepHint"
              class="config-content-alert"
              show-icon
              type="info"
            />
            <a-alert
              v-if="editContentHidden"
              :message="hiddenConfigHint"
              class="config-content-alert"
              show-icon
              type="warning"
            />
          </a-form-item>
        </div>

        <div class="form-section">
          <div class="section-title">状态设置</div>
          <a-form-item label="状态" name="status">
            <a-switch
              v-model:checked="editForm.status"
              :checked-value="ConfigStatus.Active"
              :un-checked-value="ConfigStatus.Inactive"
              checked-children="激活"
              class="tech-switch"
              un-checked-children="非激活"
            />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <!-- 配置预览模态框 -->
    <a-modal
      :footer="null"
      :open="isPreviewModalVisible"
      :width="previewDialogWidth"
      class="detail-dialog"
      title="配置内容预览"
      @cancel="closePreviewModal"
    >
      <div v-if="previewConfig" class="config-preview">
        <div class="preview-header">
          <h3 class="preview-name">{{ previewConfig.name }}</h3>
          <div class="preview-badges">
            <a-tag
              :class="getConfigTypeColor(previewConfig.config_type)"
              class="tech-tag"
            >
              {{ getConfigTypeName(previewConfig.config_type) }}
            </a-tag>
          </div>
        </div>

        <a-textarea
          :rows="20"
          :value="previewConfig.config_content"
          class="preview-textarea"
          readonly
        />

        <div class="detail-footer">
          <a-button @click="closePreviewModal">关闭</a-button>
        </div>
      </div>
    </a-modal>

    <!-- 详情模态框 -->
    <a-modal
      :footer="null"
      :open="isDetailModalVisible"
      :width="previewDialogWidth"
      class="detail-dialog"
      title="配置详情"
      @cancel="closeDetailModal"
    >
      <div v-if="detailConfig" class="config-details">
        <div class="detail-header">
          <h2>{{ detailConfig.name }}</h2>
          <div class="detail-badges">
            <a-tag
              :class="getConfigTypeColor(detailConfig.config_type)"
              class="tech-tag"
            >
              {{ getConfigTypeName(detailConfig.config_type) }}
            </a-tag>
            <a-tag
              :color="
                detailConfig.status === ConfigStatus.Active
                  ? 'success'
                  : 'default'
              "
            >
              {{
                detailConfig.status === ConfigStatus.Active ? '激活' : '非激活'
              }}
            </a-tag>
          </div>
        </div>

        <a-descriptions :column="1" :label-style="{ width: '150px' }" bordered>
          <a-descriptions-item label="ID">
            {{ detailConfig.id }}
          </a-descriptions-item>
          <a-descriptions-item label="实例池">
            {{ getPoolName(detailConfig.pool_id) }}
          </a-descriptions-item>
          <a-descriptions-item label="实例IP">
            {{ detailConfig.instance_ip }}
          </a-descriptions-item>
          <a-descriptions-item label="配置Hash">
            {{ detailConfig.config_hash }}
          </a-descriptions-item>
          <a-descriptions-item label="最后生成时间">
            {{ formatFullDateTime(detailConfig.last_generated_time) }}
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatFullDateTime(detailConfig.created_at) }}
          </a-descriptions-item>
          <a-descriptions-item label="更新时间">
            {{ formatFullDateTime(detailConfig.updated_at) }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="config-content-section">
          <h4 class="content-title">配置内容</h4>
          <a-textarea
            :rows="15"
            :value="detailConfig.config_content"
            class="preview-textarea"
            readonly
          />
        </div>

        <div class="detail-footer">
          <a-button @click="closeDetailModal">关闭</a-button>
          <a-button
            v-if="hasPerm(UPDATE_CONFIG_PERMISSION)"
            type="primary"
            @click="showEditModalFromDetail(detailConfig)"
          >
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
}

@media (max-width: 480px) {
  .stats-card {
    text-align: center;
  }

  .instance-info {
    text-align: center;
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

.config-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot-active {
  background-color: #52c41a;
}

.status-dot-inactive {
  background-color: var(--ops-border);
}

.config-name {
  font-weight: 500;
  word-break: break-all;
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

.alert-tag {
  background-color: #fff7e6;
  color: #d46b08;
  border-left: 1px solid #fa8c16;
}

.rule-tag {
  background-color: #fff1f0;
  color: #cf1322;
  border-left: 1px solid #ff4d4f;
}

.record-tag {
  background-color: #f6ffed;
  color: #389e0d;
  border-left: 1px solid #52c41a;
}

.webhook-tag {
  background-color: #f9f0ff;
  color: #722ed1;
  border-left: 1px solid #722ed1;
}

.default-tag {
  background-color: var(--ops-ground);
  color: var(--ops-muted);
  border-left: 1px solid var(--ops-border);
}

.instance-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.instance-item {
  font-size: 14px;
  color: rgb(0 0 0 / 85%);
}

.instance-ip {
  font-size: 12px;
  color: var(--ops-muted);
  font-family: monospace;
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

.tech-switch {
  background-color: rgb(0 0 0 / 25%);
}

.tech-switch.ant-switch-checked {
  background: var(--ops-accent);
}

/* 预览和详情样式 */
.config-preview,
.config-details {
  margin-bottom: 20px;
}

.preview-header,
.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.preview-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--ops-ink);
  margin: 0;
}

.detail-header h2 {
  margin: 0;
  font-size: 24px;
  color: var(--ops-ink);
  word-break: break-all;
}

.preview-badges,
.detail-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.preview-textarea {
  background-color: var(--ops-ground);
  font-family: monospace;
  cursor: default;
}

.config-content-section {
  margin-top: 24px;
}

.content-title {
  font-size: 14px;
  font-weight: 500;
  color: rgb(0 0 0 / 85%);
  margin-bottom: 12px;
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

.config-content-alert {
  margin-top: 12px;
}
</style>
