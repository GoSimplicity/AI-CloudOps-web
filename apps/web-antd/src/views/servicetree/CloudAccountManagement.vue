<script setup lang="ts">
import OpsPage from '#/components/ops/OpsPage.vue';
import AccountRegionsEditor from './cloudaccountmanagement/AccountRegionsEditor.vue';
import { onBeforeUnmount } from 'vue';

import { ref, reactive, onMounted, computed } from 'vue';
import { message, Modal, type FormInstance } from 'ant-design-vue';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CloudOutlined,
  SearchOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  UserOutlined,
  KeyOutlined,
  LockOutlined,
  TagsOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  GlobalOutlined,
  ClearOutlined,
  ExportOutlined,
} from '@ant-design/icons-vue';

import {
  getCloudAccountListApi,
  getCloudAccountDetailApi,
  createCloudAccountApi,
  updateCloudAccountApi,
  deleteCloudAccountApi,
  updateCloudAccountStatusApi,
  verifyCloudAccountApi,
  CloudProvider,
  CloudAccountStatus,
  type CloudAccount,
  type CloudAccountRegionInput,
  type GetCloudAccountListReq,
  type CreateCloudAccountReq,
  type UpdateCloudAccountReq,
} from '#/api/core/tree/tree_account';
import { downloadCsv } from '#/utils/export-csv';

import { usePermission } from '#/utils/permission';

const { can } = usePermission();

const loadError = ref<string | null>(null);
let listRequest = 0;
let detailRequest = 0;
let formRequest = 0;
const formLoading = ref(false);
let originalRegions = '';

// ========== 状态定义 ==========
const loading = ref(false);
const detailLoading = ref(false);
const submitLoading = ref(false);
const modalVisible = ref(false);
const detailVisible = ref(false);
const isEdit = ref(false);
const switchLoading = ref<Record<number, boolean>>({});

const formRef = ref<FormInstance>();
const cloudAccounts = ref<CloudAccount[]>([]);
const currentDetail = ref<CloudAccount | null>(null);

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const filterForm = reactive<GetCloudAccountListReq>({
  page: 1,
  size: 10,
  search: undefined,
  provider: undefined,
  status: undefined,
});

const formData = ref<CreateCloudAccountReq & { id?: number }>({
  name: '',
  provider: CloudProvider.AliCloud,
  regions: [],
  access_key: '',
  secret_key: '',
  account_id: '',
  account_name: '',
  account_alias: '',
  description: '',
});

// ========== 计算属性 ==========
const enabledCount = computed(
  () =>
    cloudAccounts.value.filter(
      (item) => item.status === CloudAccountStatus.Enabled,
    ).length,
);

const aliCloudCount = computed(
  () =>
    cloudAccounts.value.filter(
      (item) => item.provider === CloudProvider.AliCloud,
    ).length,
);

const tencentCloudCount = computed(
  () =>
    cloudAccounts.value.filter(
      (item) => item.provider === CloudProvider.TencentCloud,
    ).length,
);

const paginationConfig = computed(() => ({
  current: pagination.current,
  pageSize: pagination.pageSize,
  total: pagination.total,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  pageSizeOptions: ['10', '20', '50', '100'],
}));

const formRules = computed(() => ({
  name: [
    { required: true, message: '请输入云账户名称', trigger: 'blur' },
    { min: 2, max: 100, message: '名称长度在2-100个字符之间', trigger: 'blur' },
  ],
  provider: [{ required: true, message: '请选择云厂商', trigger: 'change' }],
  regions: [
    {
      validator: async (_: unknown, value: CloudAccountRegionInput[]) => {
        if (!value?.length) throw new Error('至少添加一个授权地域');
        if (
          value.some((item) => !item.region.trim() || item.region.length > 50)
        )
          throw new Error('地域代码长度为1至50个字符');
      },
      trigger: 'change',
    },
  ],
  access_key: isEdit.value
    ? [
        {
          min: 10,
          max: 500,
          message: '新 Access Key 长度需为10至500位',
          trigger: 'blur',
        },
      ]
    : [
        { required: true, message: '请输入 Access Key', trigger: 'blur' },
        {
          min: 10,
          max: 500,
          message: 'Access Key 长度需为10至500位',
          trigger: 'blur',
        },
      ],
  secret_key: isEdit.value
    ? [
        {
          min: 10,
          max: 500,
          message: '新 Secret Key 长度需为10至500位',
          trigger: 'blur',
        },
      ]
    : [
        { required: true, message: '请输入 Secret Key', trigger: 'blur' },
        {
          min: 10,
          max: 500,
          message: 'Secret Key 长度需为10至500位',
          trigger: 'blur',
        },
      ],
}));

// 表格列定义
const columns = [
  { title: '账户名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '云厂商', dataIndex: 'provider', key: 'provider', width: 130 },
  { title: '地域', dataIndex: 'region', key: 'region', width: 150 },
  { title: '账户信息', key: 'account_info', width: 250 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '创建人', key: 'creator', width: 140 },
  { title: '创建时间', key: 'created_at', width: 180 },
  { title: '操作', key: 'action', width: 180, align: 'center' as const },
];

// ========== 辅助方法 ==========
const getProviderColor = (provider: CloudProvider): string => {
  const colorMap: Record<CloudProvider, string> = {
    [CloudProvider.AliCloud]: '#ff6a00',
    [CloudProvider.TencentCloud]: '#006eff',
    [CloudProvider.HuaweiCloud]: '#e60012',
    [CloudProvider.AWS]: '#ff9900',
    [CloudProvider.Azure]: '#0078d4',
    [CloudProvider.GCP]: '#4285f4',
  };
  return colorMap[provider] || '#1890ff';
};

const getProviderText = (provider: CloudProvider): string => {
  const textMap: Record<CloudProvider, string> = {
    [CloudProvider.AliCloud]: '阿里云',
    [CloudProvider.TencentCloud]: '腾讯云',
    [CloudProvider.HuaweiCloud]: '华为云',
    [CloudProvider.AWS]: 'AWS',
    [CloudProvider.Azure]: 'Azure',
    [CloudProvider.GCP]: 'GCP',
  };
  return textMap[provider] || '未知';
};

const getAvatarColor = (name: string): string => {
  const colors = [
    '#f56a00',
    '#7265e6',
    '#ffbf00',
    '#00a2ae',
    '#1890ff',
    '#52c41a',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length] || '#1890ff';
};

const getInitials = (name: string): string => {
  if (!name) return '?';
  return name.slice(0, 2).toUpperCase();
};

const formatDateTime = (dateTime?: string): string => {
  if (!dateTime) return '-';
  try {
    return new Date(dateTime).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateTime;
  }
};

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

const fetchCloudAccounts = async (): Promise<void> => {
  const ticket = ++listRequest;
  loadError.value = null;
  loading.value = true;
  try {
    const params: GetCloudAccountListReq = {
      page: pagination.current,
      size: pagination.pageSize,
    };

    // 使用过滤条件
    if (filterForm.search) params.search = filterForm.search;
    if (filterForm.provider) params.provider = filterForm.provider;
    if (filterForm.status !== undefined) params.status = filterForm.status;

    const response = await getCloudAccountListApi(params);
    if (ticket !== listRequest) return;
    cloudAccounts.value = response.items || [];
    pagination.total = response.total || 0;
  } catch (error) {
    if (ticket !== listRequest) return;
    loadError.value = '获取云账户列表失败，请重试';
    message.error('获取云账户列表失败');
    cloudAccounts.value = [];
    pagination.total = 0;
  } finally {
    if (ticket === listRequest) loading.value = false;
  }
};

// ========== 事件处理 ==========
const handleTableChange = (pag: any): void => {
  pagination.current = pag.current;
  pagination.pageSize = pag.pageSize;
  filterForm.page = pag.current;
  filterForm.size = pag.pageSize;
  fetchCloudAccounts();
};

const handleSearch = (): void => {
  pagination.current = 1;
  filterForm.page = 1;
  fetchCloudAccounts();
};

const handleSearchChange = (): void => {
  if (!filterForm.search) {
    handleSearch();
  }
};

const resetFilter = (): void => {
  filterForm.search = undefined;
  filterForm.provider = undefined;
  filterForm.status = undefined;
  pagination.current = 1;
  filterForm.page = 1;
  filterForm.size = pagination.pageSize; // 保持分页大小同步
  fetchCloudAccounts();
  message.success('筛选条件已重置');
};

const showCreateModal = (): void => {
  formRequest++;
  formLoading.value = false;
  originalRegions = '';
  isEdit.value = false;
  formData.value = {
    name: '',
    provider: CloudProvider.AliCloud,
    regions: [],
    access_key: '',
    secret_key: '',
    account_id: '',
    account_name: '',
    account_alias: '',
    description: '',
  };
  modalVisible.value = true;
};

const normalizeRegions = (regions: CloudAccountRegionInput[] = []) =>
  regions.map((item) => ({
    region: item.region,
    region_name: item.region_name ?? '',
    description: item.description ?? '',
    is_default: !!item.is_default,
  }));
const regionSignature = (regions: CloudAccountRegionInput[]) =>
  JSON.stringify(
    normalizeRegions(regions).sort((a, b) => a.region.localeCompare(b.region)),
  );
const closeForm = () => {
  formRequest++;
  modalVisible.value = false;
  formLoading.value = false;
  formData.value.access_key = '';
  formData.value.secret_key = '';
};
const handleEdit = async (record: CloudAccount): Promise<void> => {
  if (record.provider !== CloudProvider.AliCloud) return;
  const ticket = ++formRequest;
  formData.value = {
    name: '',
    provider: record.provider,
    regions: [],
    access_key: '',
    secret_key: '',
  };
  isEdit.value = true;
  formLoading.value = true;
  modalVisible.value = true;
  detailVisible.value = false;
  try {
    const current = await getCloudAccountDetailApi(record.id);
    if (ticket !== formRequest || !modalVisible.value) return;
    const regions = normalizeRegions(current.regions);
    originalRegions = regionSignature(regions);
    formData.value = {
      id: current.id,
      name: current.name,
      provider: current.provider,
      regions,
      access_key: '',
      secret_key: '',
      account_id: current.account_id ?? '',
      account_name: current.account_name ?? '',
      account_alias: current.account_alias ?? '',
      description: current.description ?? '',
    };
  } catch {
    if (ticket !== formRequest) return;
    message.error('获取账户详情失败，请重试');
    closeForm();
  } finally {
    if (ticket === formRequest) formLoading.value = false;
  }
};

const handleSubmit = async (): Promise<void> => {
  if (submitLoading.value || formLoading.value || !formRef.value) return;
  const ticket = formRequest;
  const editing = isEdit.value;
  submitLoading.value = true;
  try {
    await formRef.value?.validate();
    if (ticket !== formRequest || !modalVisible.value) return;
    const draft = {
      ...formData.value,
      regions: normalizeRegions(formData.value.regions),
    };
    if (draft.provider !== CloudProvider.AliCloud) { message.error('当前仅支持阿里云账户配置'); return; }
    if (editing && draft.id) {
      const updateData: Omit<UpdateCloudAccountReq, 'id'> = {
        name: draft.name,
        account_id: draft.account_id || undefined,
        account_name: draft.account_name || undefined,
        account_alias: draft.account_alias || undefined,
        description: draft.description || undefined,
      };
      if (draft.access_key) updateData.access_key = draft.access_key;
      if (draft.secret_key) updateData.secret_key = draft.secret_key;
      if (regionSignature(draft.regions) !== originalRegions)
        updateData.regions = draft.regions;
      await updateCloudAccountApi(draft.id, updateData);
    } else {
      const { id: _id, ...createData } = draft;
      await createCloudAccountApi(createData);
    }
    if (ticket !== formRequest) return;
    message.success(
      editing ? '云账户已更新' : '云账户已创建，可从列表显式验证凭据',
    );
    closeForm();
    void fetchCloudAccounts();
  } catch (error: any) {
    if (ticket !== formRequest || error?.errorFields) return;
    message.error(
      editing ? '更新云账户失败，已保留表单' : '创建云账户失败，已保留表单',
    );
  } finally {
    submitLoading.value = false;
  }
};

const handleDelete = (record: CloudAccount): void => {
  if (record.provider !== CloudProvider.AliCloud) return;
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除云账户 "${record.name}" 吗？此操作不可恢复。`,
    okText: '确定删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteCloudAccountApi(record.id);
        message.success('删除成功');
        detailVisible.value = false;
        fetchCloudAccounts();
      } catch (error) {
        message.error('删除失败');
      }
    },
  });
};

const handleStatusChange = async (
  record: CloudAccount,
  checked: boolean,
): Promise<void> => {
  if (record.provider !== CloudProvider.AliCloud) return;
  const newStatus = checked
    ? CloudAccountStatus.Enabled
    : CloudAccountStatus.Disabled;
  switchLoading.value[record.id] = true;

  try {
    await updateCloudAccountStatusApi(record.id, newStatus);
    message.success(`账户已${checked ? '启用' : '禁用'}`);

    const index = cloudAccounts.value.findIndex(
      (item) => item.id === record.id,
    );
    if (index !== -1 && cloudAccounts.value[index]) {
      cloudAccounts.value[index]!.status = newStatus;
    }

    if (currentDetail.value && currentDetail.value.id === record.id) {
      currentDetail.value.status = newStatus;
    }
  } catch (error) {
    message.error('状态更新失败');
  } finally {
    switchLoading.value[record.id] = false;
  }
};

const handleVerify = (record: CloudAccount): void => {
  if (record.provider !== CloudProvider.AliCloud) return;
  Modal.confirm({
    title: '验证云账户凭据',
    content: `将向阿里云验证账户“${record.name}”的凭据，验证失败不会删除账户`,
    okText: '开始验证',
    cancelText: '取消',
    onOk: async () => {
      const hide = message.loading('正在验证凭据...', 0);
      try {
        await verifyCloudAccountApi(record.id);
        message.success('凭据验证成功');
      } catch {
        message.error('凭据验证失败，账户配置已保留');
      } finally {
        hide();
      }
    },
  });
};

const handleViewDetail = async (record: CloudAccount): Promise<void> => {
  const ticket = ++detailRequest;
  currentDetail.value = null;
  detailVisible.value = true;
  detailLoading.value = true;

  try {
    const response = await getCloudAccountDetailApi(record.id);
    if (ticket !== detailRequest || !detailVisible.value) return;
    currentDetail.value = response;
  } catch (error) {
    if (ticket !== detailRequest) return;
    message.error('获取详情失败');
  } finally {
    if (ticket === detailRequest) detailLoading.value = false;
  }
};

// ========== 导出功能 ==========
const exportToExcel = (data: CloudAccount[]) => {
  if (!data || data.length === 0) {
    message.warning('没有可导出的数据');
    return;
  }

  // 准备导出数据
  const exportData = data.map((item) => ({
    账户名称: item.name,
    云厂商: getProviderText(item.provider),
    地域: (item.regions ?? []).map((region) => region.region).join(', '),
    账户ID: item.account_id || '-',
    账户别名: item.account_alias || '-',
    状态: item.status === CloudAccountStatus.Enabled ? '已启用' : '已禁用',
    创建人: item.create_user_name || '-',
    创建时间: formatDateTime(item.created_at),
    更新时间: formatDateTime(item.updated_at),
    描述: item.description || '-',
  }));

  // 导出文件
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .substring(0, 19);
  const filename = `云账户列表_${timestamp}.csv`;
  downloadCsv(filename, [
    Object.keys(exportData[0]!),
    ...exportData.map((row) => Object.values(row)),
  ]);
  message.success(`导出成功：${filename}`);
};

// ========== 生命周期 ==========
onMounted(() => {
  fetchCloudAccounts();
});
onBeforeUnmount(() => {
  listRequest++;
  detailRequest++;
  formRequest++;
});
const closeDetails = () => {
  detailRequest++;
  detailVisible.value = false;
  detailLoading.value = false;
  currentDetail.value = null;
};
</script>

<template>
  <OpsPage title="云账户" description="管理阿里云账户配置，其他云平台存量仅供查看" class="cmdb-console cloud-account-management">
    <a-alert v-if="loadError" :message="loadError" type="error" show-icon>
      <template #action><a-button @click="fetchCloudAccounts()">重试</a-button></template>
    </a-alert>
    <!-- 页面头部 -->
    <template #actions><a-space :size="12">
          <a-button type="primary" aria-label="添加账户" @click="showCreateModal" class="btn-create">
            <template #icon><plus-outlined /></template>
            <span class="btn-text">添加账户</span>
          </a-button>
          <a-button @click="exportToExcel(cloudAccounts)"><export-outlined /> 导出当前页</a-button>
        </a-space><a-button @click="fetchCloudAccounts()" :loading="loading">刷新</a-button></template>

    <!-- 统计卡片 -->
    <template #summary><div class="stats-row">
      <a-row :gutter="[16, 16]">
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic
              title="匹配账户数"
              :value="pagination.total"
            >
              <template #prefix>
                <cloud-outlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic
              title="本页已启用"
              :value="enabledCount"
            >
              <template #prefix>
                <check-circle-outlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic
              title="本页阿里云"
              :value="aliCloudCount"
            >
              <template #prefix>
                <cloud-server-outlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic
              title="本页腾讯云"
              :value="tencentCloudCount"
            >
              <template #prefix>
                <global-outlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>
    </div></template>

    <!-- 搜索筛选区 -->
    <template #filters><a-form layout="inline" class="filter-form">
          <a-form-item>
            <a-input
              v-model:value="filterForm.search"
              placeholder="搜索账户名称"
              allow-clear
              style="width: 220px"
              @pressEnter="handleSearch"
              @change="handleSearchChange"
            >
              <template #prefix><search-outlined /></template>
            </a-input>
          </a-form-item>
          <a-form-item label="云厂商">
            <a-select
              v-model:value="filterForm.provider"
              placeholder="全部厂商"
              allow-clear
              style="width: 150px"
              @change="handleSearch"
            >
              <a-select-option :value="CloudProvider.AliCloud">阿里云</a-select-option>
              <a-select-option :value="CloudProvider.TencentCloud">腾讯云</a-select-option>
              <a-select-option :value="CloudProvider.HuaweiCloud">华为云</a-select-option>
              <a-select-option :value="CloudProvider.AWS">AWS</a-select-option>
              <a-select-option :value="CloudProvider.Azure">Azure</a-select-option>
              <a-select-option :value="CloudProvider.GCP">GCP</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="账户状态">
            <a-select
              v-model:value="filterForm.status"
              placeholder="全部状态"
              allow-clear
              style="width: 130px"
              @change="handleSearch"
            >
              <a-select-option :value="CloudAccountStatus.Enabled">启用</a-select-option>
              <a-select-option :value="CloudAccountStatus.Disabled">禁用</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" @click="handleSearch">
                <search-outlined /> 查询
              </a-button>
              <a-button @click="resetFilter" class="reset-btn">
                <clear-outlined /> 重置
              </a-button>
            </a-space>
          </a-form-item>
        </a-form></template>

    <!-- 账户列表表格 -->
    <div class="table-section">
      <a-card class="table-card">
        <a-table
          :columns="columns"
          :data-source="cloudAccounts"
          :loading="loading"
          :pagination="paginationConfig"
          @change="handleTableChange"
          row-key="id"
          :scroll="{ x: 1400 }"
          class="account-table"
        >
          <template #bodyCell="{ column, record }">
            <!-- 账户名称列 -->
            <template v-if="column.key === 'name'">
              <div class="name-cell">
                <a-badge :status="record.status === CloudAccountStatus.Enabled ? 'success' : 'error'" />
                <a class="account-name" @click="handleViewDetail(record)">
                  {{ record.name }}
                </a>
              </div>
            </template>

            <!-- 云厂商列 -->
            <template v-else-if="column.key === 'provider'">
              <a-tag :color="getProviderColor(record.provider)" class="provider-tag">
                <cloud-outlined class="tag-icon" />
                {{ getProviderText(record.provider) }}
              </a-tag>
            </template>

            <!-- 地域列 -->
            <template v-else-if="column.key === 'region'">
              <div class="region-cell">
                <environment-outlined class="region-icon" />
                <a-space wrap><a-tag v-for="region in record.regions ?? []" :key="region.id">{{ region.region_name || region.region }}<span v-if="region.is_default">（默认）</span></a-tag><span v-if="!record.regions?.length">未配置</span></a-space>
              </div>
            </template>

            <!-- 账户信息列 -->
            <template v-else-if="column.key === 'account_info'">
              <div class="account-info">
                <div v-if="record.account_id" class="info-row">
                  <span class="info-label">ID:</span>
                  <a-typography-text :copyable="{ text: record.account_id }" class="info-value">
                    {{ truncateText(record.account_id, 20) }}
                  </a-typography-text>
                </div>
                <div v-if="record.account_name" class="info-row">
                  <span class="info-label">名称:</span>
                  <span class="info-value">{{ record.account_name }}</span>
                </div>
                <div v-if="record.account_alias" class="info-row">
                  <span class="info-label">别名:</span>
                  <span class="info-value">{{ record.account_alias }}</span>
                </div>
                <span v-if="!record.account_id && !record.account_name && !record.account_alias" class="empty-text">-</span>
              </div>
            </template>

            <!-- 状态列 -->
            <template v-else-if="column.key === 'status'">
              <a-switch
                :disabled="record.provider !== CloudProvider.AliCloud" :checked="record.status === CloudAccountStatus.Enabled"
                :loading="switchLoading[record.id]"
                @change="(checked: boolean) => handleStatusChange(record, checked)"
                checked-children="启用"
                un-checked-children="禁用"
              />
            </template>

            <!-- 创建人列 -->
            <template v-else-if="column.key === 'creator'">
              <div class="creator-cell">
                <a-avatar
                  size="small"
                  :style="{ backgroundColor: getAvatarColor(record.create_user_name || '') }"
                >
                  {{ getInitials(record.create_user_name || 'Admin') }}
                </a-avatar>
                <span class="creator-name">{{ record.create_user_name || 'Admin' }}</span>
              </div>
            </template>

            <!-- 创建时间列 -->
            <template v-else-if="column.key === 'created_at'">
              <div class="date-cell">
                <clock-circle-outlined class="date-icon" />
                {{ formatDateTime(record.created_at) }}
              </div>
            </template>

            <!-- 操作列 -->
            <template v-else-if="column.key === 'action'">
              <a-space :size="4" class="action-buttons">
                <a-tooltip title="查看详情">
                  <a-button type="text" size="small" @click="handleViewDetail(record)">
                    <eye-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="编辑">
                  <a-button type="text" size="small" :disabled="record.provider !== CloudProvider.AliCloud" @click="handleEdit(record)">
                    <edit-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="验证凭证">
                  <a-button type="text" size="small" :disabled="record.provider !== CloudProvider.AliCloud" @click="handleVerify(record)">
                    <safety-certificate-outlined />
                  </a-button>
                </a-tooltip>
                <a-popconfirm v-if="can('tree.cloudAccount.delete')"
                  title="确定删除此云账户吗？"
                  ok-text="确定"
                  cancel-text="取消"
                  @confirm="handleDelete(record)"
                >
                  <a-tooltip title="删除">
                    <a-button type="text" size="small" :disabled="record.provider !== CloudProvider.AliCloud" danger>
                      <delete-outlined />
                    </a-button>
                  </a-tooltip>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 创建/编辑对话框 -->
    <a-modal
      v-model:open="modalVisible"
      @cancel="closeForm"
      :mask-closable="!submitLoading"
      :closable="!submitLoading"
      :keyboard="!submitLoading"
      :title="isEdit ? '编辑云账户' : '添加云账户'"
      :width="800"
      :style="{ top: 'var(--ops-space-xl)' }"
      :body-style="{ maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto', paddingInline: 'var(--ops-space-sm)' }"
      @ok="handleSubmit"
      :confirm-loading="submitLoading"
      :destroy-on-close="true"
      class="modern-modal"
    >
      <a-form
        :disabled="formLoading || submitLoading"
        ref="formRef"
        :model="formData"
        :rules="formRules"
        layout="vertical"
        class="account-form"
      >
        <a-divider orientation="left">
          <info-circle-outlined /> 基本信息
        </a-divider>
        <a-row :gutter="16">
          <a-col :span="24">
            <a-form-item label="账户名称" name="name">
              <a-input
                v-model:value="formData.name"
                placeholder="请输入云账户名称"
                size="large"
              >
                <template #prefix><user-outlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12">
            <a-form-item label="云厂商" name="provider">
              <a-select
                v-model:value="formData.provider"
                placeholder="选择云厂商"
                :disabled="isEdit"
                size="large"
              >
                <a-select-option :value="CloudProvider.AliCloud">
                  <cloud-outlined /> 阿里云
                </a-select-option>
                <a-select-option disabled :value="CloudProvider.TencentCloud">
                  <cloud-outlined /> 腾讯云（暂不支持）
                </a-select-option>
                <a-select-option disabled :value="CloudProvider.HuaweiCloud">
                  <cloud-outlined /> 华为云（暂不支持）
                </a-select-option>
                <a-select-option disabled :value="CloudProvider.AWS">
                  <cloud-outlined /> AWS（暂不支持）
                </a-select-option>
                <a-select-option disabled :value="CloudProvider.Azure">
                  <cloud-outlined /> Azure（暂不支持）
                </a-select-option>
                <a-select-option disabled :value="CloudProvider.GCP">
                  <cloud-outlined /> GCP（暂不支持）
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12">
            <a-form-item label="授权地域" name="regions">
              <AccountRegionsEditor v-model="formData.regions" :disabled="formLoading || submitLoading" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">
          <safety-certificate-outlined /> 凭证配置
        </a-divider>
        <a-row :gutter="16">
          <a-col :span="24">
            <a-form-item label="Access Key" name="access_key">
              <a-input
                v-model:value="formData.access_key"
                placeholder="请输入 Access Key"
                autocomplete="off"
                size="large"
              >
                <template #prefix><key-outlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="Secret Key" name="secret_key">
              <a-input-password
                v-model:value="formData.secret_key"
                placeholder="请输入 Secret Key"
                autocomplete="new-password"
                size="large"
              >
                <template #prefix><lock-outlined /></template>
              </a-input-password>
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">
          <tags-outlined /> 账户信息（可选）
        </a-divider>
        <a-row :gutter="16">
          <a-col :xs="24" :sm="12">
            <a-form-item label="账户ID" name="account_id">
              <a-input
                v-model:value="formData.account_id"
                placeholder="云厂商账户ID"
                size="large"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12">
            <a-form-item label="账户名称" name="account_name">
              <a-input
                v-model:value="formData.account_name"
                placeholder="云厂商账户名称"
                size="large"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="账户别名" name="account_alias">
              <a-input
                v-model:value="formData.account_alias"
                placeholder="自定义别名"
                size="large"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="描述信息">
              <a-textarea
                v-model:value="formData.description"
                placeholder="云账户用途描述"
                :rows="3"
                :maxlength="500"
                show-count
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>

      <template #footer>
        <a-space>
          <a-button @click="closeForm" :disabled="submitLoading">取消</a-button>
          <a-button
            type="primary"
            @click="handleSubmit"
            :loading="submitLoading"
            :disabled="formLoading"
          >
            {{ isEdit ? '更新' : '添加' }}
          </a-button>

        </a-space>
      </template>
    </a-modal>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:open="detailVisible"
      @close="closeDetails"
      title="云账户详情"
      width="min(600px, 100vw)"
      :destroy-on-close="true"
      class="detail-drawer"
    >
      <a-skeleton :loading="detailLoading" active>
        <a-empty v-if="!detailLoading && !currentDetail" description="详情加载失败，请关闭后重试" />
        <template v-if="currentDetail">
          <div class="detail-content">
            <div class="detail-header">
              <h2>{{ currentDetail.name }}</h2>
              <div class="detail-badges">
                <a-badge
                  :status="currentDetail.status === CloudAccountStatus.Enabled ? 'success' : 'error'"
                  :text="currentDetail.status === CloudAccountStatus.Enabled ? '已启用' : '已禁用'"
                />
                <a-tag :color="getProviderColor(currentDetail.provider)">
                  {{ getProviderText(currentDetail.provider) }}
                </a-tag>
              </div>
            </div>

            <!-- 详细信息 -->
            <a-descriptions bordered :column="1" size="small" class="detail-descriptions" title="账户信息">
              <a-descriptions-item label="账户ID" :span="2">
                {{ currentDetail.id }}
              </a-descriptions-item>
              <a-descriptions-item label="云厂商" :span="1">
                <a-tag :color="getProviderColor(currentDetail.provider)">
                  {{ getProviderText(currentDetail.provider) }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="地域" :span="1">
                <a-space wrap><a-tag v-for="region in currentDetail.regions ?? []" :key="region.id">{{ region.region_name || region.region }} ({{ region.region }})<span v-if="region.is_default"> 默认</span><span v-if="region.status === 2"> 已停用</span></a-tag></a-space>
              </a-descriptions-item>
              <a-descriptions-item label="云账户ID" :span="2">
                <a-typography-text v-if="currentDetail.account_id" :copyable="{ text: currentDetail.account_id }">
                  {{ currentDetail.account_id }}
                </a-typography-text>
                <span v-else>-</span>
              </a-descriptions-item>
              <a-descriptions-item label="云账户名称" :span="2">
                {{ currentDetail.account_name || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="云账户别名" :span="2">
                {{ currentDetail.account_alias || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="描述信息" :span="2">
                {{ currentDetail.description || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="状态" :span="2">
                <a-switch
                  v-if="currentDetail"
                  :disabled="currentDetail.provider !== CloudProvider.AliCloud" :checked="currentDetail.status === CloudAccountStatus.Enabled"
                  :loading="switchLoading[currentDetail.id]"
                  @change="(checked: boolean) => currentDetail && handleStatusChange(currentDetail, checked)"
                  checked-children="启用"
                  un-checked-children="禁用"
                />
              </a-descriptions-item>
              <a-descriptions-item label="创建人" :span="1">
                <a-avatar
                  size="small"
                  :style="{ backgroundColor: getAvatarColor(currentDetail.create_user_name || '') }"
                >
                  {{ getInitials(currentDetail.create_user_name || 'Admin') }}
                </a-avatar>
                <span style="margin-left: 8px">{{ currentDetail.create_user_name || '-' }}</span>
              </a-descriptions-item>
              <a-descriptions-item label="创建时间" :span="1">
                {{ formatDateTime(currentDetail.created_at) }}
              </a-descriptions-item>
              <a-descriptions-item label="更新时间" :span="2">
                {{ formatDateTime(currentDetail.updated_at) }}
              </a-descriptions-item>
            </a-descriptions>

            <!-- 操作按钮 -->
            <div class="drawer-actions">
              <a-button-group>
                <a-button type="primary" :disabled="currentDetail.provider !== CloudProvider.AliCloud" @click="handleVerify(currentDetail)">
                  <safety-certificate-outlined /> 验证凭证
                </a-button>
                <a-button :disabled="currentDetail.provider !== CloudProvider.AliCloud" @click="handleEdit(currentDetail)">
                  <edit-outlined /> 编辑
                </a-button>
              </a-button-group>
              <a-button v-if="can('tree.cloudAccount.delete')" danger :disabled="currentDetail.provider !== CloudProvider.AliCloud" @click="handleDelete(currentDetail)">
                <delete-outlined /> 删除
              </a-button>
            </div>
          </div>
        </template>
      </a-skeleton>
    </a-drawer>
  </OpsPage>
</template>



<style scoped lang="scss">
.cloud-account-management {
  padding: 12px;
  min-height: 100vh;

  .page-header {
    margin-bottom: 20px;
  }

  .header-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }

  .btn-create {
    flex-shrink: 0;
  }

  .btn-text {
    margin-left: 4px;
  }

  .reset-btn {
    flex-shrink: 0;
  }

  .stats-row {
    margin-bottom: 20px;
  }

  .stats-card {
    border-radius: var(--ops-radius);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    height: 100%;
  }

  .filter-section {
    margin-bottom: 20px;

    .filter-card {
      border-radius: var(--ops-radius);
      border: 1px solid var(--ops-border);
      box-shadow: none;

      :deep(.ant-card-body) {
        padding: 16px;
      }
    }

    .filter-form {
      :deep(.ant-form-item) {
        margin-bottom: 0;
        margin-right: 16px;

        &:last-child {
          margin-right: 0;
        }
      }

      :deep(.ant-form-item-label) {
        font-weight: 500;
        color: #374151;
      }
    }
  }

  .table-section {
    margin-bottom: 24px;

    .table-card {
      border-radius: var(--ops-radius);
      border: 1px solid var(--ops-border);
      box-shadow: none;

      :deep(.ant-card-body) {
        padding: 0;
      }
    }

    .account-table {
      :deep(.ant-table) {
        border-radius: var(--ops-radius);
        overflow: hidden;
      }

      :deep(.ant-table-thead > tr > th) {
        white-space: nowrap;
        background-color: var(--ops-ground);
        font-weight: 600;
        color: #374151;
      }

      :deep(.ant-table-tbody > tr > td) {
        word-break: break-word;
      }

      :deep(.ant-table-tbody > tr:hover > td) {
        background-color: var(--ops-ground);
      }

      :deep(.ant-table-cell) {
        padding: 12px 16px;
      }
    }

    .name-cell {
      display: flex;
      align-items: center;
      gap: 8px;

      .account-name {
        font-weight: 500;
        color: #1890ff;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          color: #40a9ff;
          text-decoration: underline;
        }
      }
    }

    .provider-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      font-weight: 500;
      border-radius: 6px;

      .tag-icon {
        font-size: 14px;
      }
    }

    .region-cell {
      display: flex;
      align-items: center;
      gap: 6px;

      .region-icon {
        color: #1890ff;
      }
    }

    .account-info {
      font-size: 13px;

      .info-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;

        &:last-child {
          margin-bottom: 0;
        }
      }

      .info-label {
        color: var(--ops-muted);
        font-weight: 500;
      }

      .info-value {
        color: #374151;
      }
    }

    .creator-cell {
      display: flex;
      align-items: center;
      gap: 8px;

      .creator-name {
        font-size: 14px;
      }
    }

    .date-cell {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--ops-muted);

      .date-icon {
        color: #1890ff;
      }
    }

    .action-buttons {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;

      :deep(.ant-btn-text) {
        color: var(--ops-muted);
        transition: all 0.2s;

        &:hover {
          color: #1890ff;
          background: #e6f7ff;
        }

        &.ant-btn-dangerous:hover {
          color: #ff4d4f;
          background: #fff1f0;
        }
      }
    }

    .empty-text {
      color: #9ca3af;
      font-size: 13px;
    }
  }

  .modern-modal {
    :deep(.ant-modal) {
      max-width: calc(100vw - 16px);
      margin: 8px;
    }

    :deep(.ant-modal-content) {
      border-radius: var(--ops-radius);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }

    :deep(.ant-modal-header) {
      border-bottom: 1px solid var(--ops-border);
      padding: 16px 24px;
    }

    :deep(.ant-modal-title) {
      font-size: 16px;
      font-weight: 600;
      color: var(--ops-ink);
    }

    :deep(.ant-modal-body) {
      padding: 20px 24px;
    }

    :deep(.ant-divider-horizontal.ant-divider-with-text-left) {
      margin: 20px 0 12px 0;
      font-weight: 600;
      color: #374151;
    }

    .account-form {
      :deep(.ant-form-item-label > label) {
        font-weight: 500;
        color: #374151;
      }
    }
  }

  .detail-drawer {
    :deep(.ant-drawer-header) {
      border-bottom: 1px solid var(--ops-border);
      padding: 16px 24px;
    }

    :deep(.ant-drawer-title) {
      font-size: 18px;
      font-weight: 600;
      color: var(--ops-ink);
    }

    :deep(.ant-drawer-body) {
      padding: 20px;
    }

    .detail-content {
      margin-bottom: 20px;
    }

    .detail-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;

      h2 {
        margin: 0;
        font-size: 24px;
        color: var(--ops-ink);
        word-break: break-all;
      }
    }

    .detail-badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .detail-section {
      margin-top: 24px;

      .section-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--ops-ink);
        margin-bottom: 16px;
        padding-left: 12px;
        border-left: 1px solid var(--ops-border);
      }
    }

    .drawer-actions {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--ops-border);
    }
  }

  @media (max-width: 768px) {
    padding: 8px;

    .header-actions {
      flex-direction: column;
      align-items: stretch;

      .btn-text {
        display: inline;
      }
    }

    .stats-card :deep(.ant-statistic-title) {
      font-size: 12px;
    }

    .stats-card :deep(.ant-statistic-content) {
      font-size: 16px;
    }

    .filter-section {
      .filter-form {
        :deep(.ant-form-item) {
          margin-right: 0;
          margin-bottom: 12px;
          width: 100%;

          .ant-input,
          .ant-select {
            width: 100% !important;
          }
        }
      }
    }

    .action-buttons {
      gap: 2px;

      .ant-btn {
        padding: 0 4px;
        font-size: 12px;
      }
    }

    .drawer-actions {
      flex-direction: column;
      gap: 8px;

      .ant-btn-group {
        display: flex;
        flex-direction: column;
        width: 100%;
      }

      .ant-btn {
        width: 100%;
      }
    }

    .modern-modal :deep(.ant-modal-body) {
      padding: 16px;
      max-height: calc(100vh - 160px);
      overflow-y: auto;
    }
  }

  @media (max-width: 480px) {
    padding: 4px;

    .stats-card {
      text-align: center;
    }

    .modern-modal :deep(.ant-modal) {
      margin: 4px;
      max-width: calc(100vw - 8px);
    }
  }
}
</style>

<style scoped src="./shared/cmdb-console.css"></style>
