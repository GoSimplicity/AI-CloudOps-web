<script setup lang="ts">
import { useUserStore } from '@vben/stores';

import OpsPage from '#/components/ops/OpsPage.vue';
import AccountRegionsEditor from './cloudaccountmanagement/AccountRegionsEditor.vue';
import {
  CLOUD_ACCOUNT_PERMISSIONS,
  computeProviderName,
  isSupportedAccountProvider,
} from './cloudaccountmanagement/provider';
import { onBeforeUnmount } from 'vue';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { type FormInstance, message, Modal } from 'ant-design-vue';
import {
  CheckCircleOutlined,
  ClearOutlined,
  ClockCircleOutlined,
  CloudOutlined,
  CloudServerOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  ExportOutlined,
  EyeOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LockOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TagsOutlined,
  UserOutlined,
} from '@ant-design/icons-vue';

import {
  type CloudAccount,
  type CloudAccountRegionInput,
  CloudAccountStatus,
  type CloudCredentialType,
  CloudProvider,
  createCloudAccountApi,
  type CreateCloudAccountReq,
  deleteCloudAccountApi,
  getCloudAccountDetailApi,
  getCloudAccountListApi,
  type GetCloudAccountListReq,
  type ProviderCredentialInput,
  updateCloudAccountApi,
  type UpdateCloudAccountReq,
  updateCloudAccountStatusApi,
  verifyCloudAccountApi,
} from '#/api/core/tree/tree_account';
import { useAuthStore } from '#/store';
import { downloadCsv } from '#/utils/export-csv';

import { usePermission } from '#/utils/permission';
import {
  shouldNotifyPageError,
  shouldRecordPageError,
} from '#/utils/permission/request-notice';

const { can, hasPerm } = usePermission();

const loadError = ref<null | string>(null);
let listRequest = 0;
let detailRequest = 0;
let formRequest = 0;
let active = true;
let listOwner = '';
let detailOwner = '';
let formOwner = '';
const formLoading = ref(false);
let originalRegions = '';

// ========== 状态定义 ==========
const loading = ref(false);
const detailLoading = ref(false);
const submitLoading = ref(false);
const modalVisible = ref(false);
const detailVisible = ref(false);
const isEdit = ref(false);
const editAccountStatus = ref<CloudAccountStatus>(CloudAccountStatus.Enabled);
const originalCredentialType = ref<CloudCredentialType>('long_term');
const savedCredentialExpiry = ref<string>();
const switchLoading = ref<Record<number, boolean>>({});

const formRef = ref<FormInstance>();
const cloudAccounts = ref<CloudAccount[]>([]);
const currentDetail = ref<CloudAccount | null>(null);

interface AccountActionTicket {
  detail: CloudAccount | null;
  detailRequest: number;
  detailVisible: boolean;
  id: number;
  list: CloudAccount[];
  listRequest: number;
  owner: string;
  provider: CloudProvider;
  record: CloudAccount;
  source: CloudAccount;
  sourceIsDetail: boolean;
}

const statusTickets = new Map<number, AccountActionTicket>();
const deleteTickets = new Map<number, AccountActionTicket>();
const verifyTickets = new Map<number, AccountActionTicket>();

function actionOwner(): string {
  const id = useUserStore().userInfo?.userId;
  const generation = useAuthStore().getAuthGeneration();
  if (
    (typeof id !== 'string' && typeof id !== 'number') ||
    !String(id).trim() ||
    String(id).trim() === '0' ||
    !Number.isSafeInteger(generation) ||
    generation < 0
  )
    return '';
  return JSON.stringify([String(id).trim(), generation]);
}

function validAccountId(id: unknown): id is number {
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
}

function accountAction(record: CloudAccount): AccountActionTicket | undefined {
  const owner = actionOwner();
  const id = record.id;
  const provider = record.provider;
  const row = cloudAccounts.value.find(
    (item) => item.id === id && item.provider === provider,
  );
  const sourceIsDetail =
    detailVisible.value &&
    currentDetail.value === record &&
    detailOwner === owner;
  if (
    !active ||
    !owner ||
    owner !== listOwner ||
    !validAccountId(id) ||
    !isSupportedAccountProvider(provider) ||
    !row ||
    (row !== record && !sourceIsDetail)
  )
    return;
  return {
    detail: currentDetail.value,
    detailRequest,
    detailVisible: detailVisible.value,
    id,
    listRequest,
    owner,
    provider,
    record: row,
    source: record,
    sourceIsDetail,
    list: cloudAccounts.value,
  };
}

function currentAccountAction(ticket: AccountActionTicket) {
  return (
    active &&
    ticket.owner === actionOwner() &&
    ticket.owner === listOwner &&
    ticket.listRequest === listRequest &&
    ticket.list === cloudAccounts.value &&
    ticket.record.id === ticket.id &&
    ticket.record.provider === ticket.provider &&
    cloudAccounts.value.includes(ticket.record) &&
    (!ticket.sourceIsDetail ||
      (detailVisible.value &&
        detailOwner === ticket.owner &&
        ticket.detailRequest === detailRequest &&
        ticket.source === currentDetail.value))
  );
}

function sameActionDetail(ticket: AccountActionTicket) {
  return (
    ticket.detailVisible &&
    detailVisible.value &&
    detailOwner === ticket.owner &&
    ticket.detailRequest === detailRequest &&
    ticket.detail === currentDetail.value &&
    currentDetail.value?.id === ticket.id &&
    currentDetail.value.provider === ticket.provider
  );
}

function clearAccountActions() {
  statusTickets.clear();
  deleteTickets.clear();
  verifyTickets.clear();
  switchLoading.value = {};
}
watch(
  () => cloudAccounts.value.map((record) => [record.id, record.provider]),
  clearAccountActions,
  { flush: 'sync' },
);

const closeDetails = () => {
  detailRequest++;
  detailOwner = '';
  detailVisible.value = false;
  detailLoading.value = false;
  currentDetail.value = null;
};

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

const formData = ref<
  CreateCloudAccountReq & {
    access_key: string;
    id?: number;
    secret_key: string;
  }
>({
  status: CloudAccountStatus.Enabled,
  name: '',
  provider: CloudProvider.AliCloud,
  regions: [],
  access_key: '',
  secret_key: '',
  credential_type: 'long_term',
  session_token: '',
  credential_expires_at: '',
  account_id: '',
  account_name: '',
  account_alias: '',
  description: '',
});

// Provider credentials are write-only and never populated from account details.
const providerCredentialDraft = reactive({
  tenant_id: '',
  client_id: '',
  client_secret: '',
  subscription_id: '',
  project_id: '',
  service_account_json: '',
});
const structuredProvider = computed(
  () =>
    formData.value.provider === CloudProvider.Azure ||
    formData.value.provider === CloudProvider.GCP,
);
function clearProviderCredentials() {
  Object.assign(providerCredentialDraft, {
    tenant_id: '',
    client_id: '',
    client_secret: '',
    subscription_id: '',
    project_id: '',
    service_account_json: '',
  });
}
function buildProviderCredentials(
  provider: CloudProvider,
  editing: boolean,
): ProviderCredentialInput | undefined {
  if (provider === CloudProvider.Azure) {
    const { tenant_id, client_id, client_secret, subscription_id } =
      providerCredentialDraft;
    if (
      editing &&
      !tenant_id &&
      !client_id &&
      !client_secret &&
      !subscription_id
    )
      return undefined;
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      ![tenant_id, client_id, subscription_id].every((value) =>
        uuid.test(value),
      ) ||
      !client_secret.trim() ||
      new TextEncoder().encode(client_secret).length > 8192
    )
      throw new Error('请完整填写有效的租户 ID、应用 ID、订阅 ID 和客户端密钥');
    return { tenant_id, client_id, client_secret, subscription_id };
  }
  const { project_id, service_account_json } = providerCredentialDraft;
  if (editing && !project_id && !service_account_json) return undefined;
  if (
    !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project_id) ||
    !service_account_json ||
    new TextEncoder().encode(service_account_json).length > 16384
  )
    throw new Error('请完整填写有效的 GCP 项目 ID 和服务账号 JSON');
  let parsed: unknown;
  try {
    parsed = JSON.parse(service_account_json);
  } catch {
    throw new Error('服务账号 JSON 格式无效');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('服务账号 JSON 格式无效');
  const account = parsed as Record<string, unknown>;
  if (
    account.type !== 'service_account' ||
    account.token_uri !== 'https://oauth2.googleapis.com/token' ||
    typeof account.private_key !== 'string' ||
    typeof account.client_email !== 'string' ||
    typeof account.project_id !== 'string'
  )
    throw new Error('服务账号 JSON 缺少必要字段或令牌地址无效');
  return { project_id, service_account_json };
}

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

const tencentAndAwsCount = computed(
  () =>
    cloudAccounts.value.filter(
      (item) =>
        item.provider === CloudProvider.TencentCloud ||
        item.provider === CloudProvider.AWS,
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
  status: [
    {
      required: true,
      type: 'enum' as const,
      enum: [CloudAccountStatus.Enabled, CloudAccountStatus.Disabled],
      message: '请选择初始状态',
    },
  ],
  regions: [
    {
      validator: async (_: unknown, value: CloudAccountRegionInput[]) => {
        if (!value?.length) throw new Error('至少添加一个授权地域');
        if (
          value.some((item) => !item.region.trim() || item.region.length > 50)
        )
          throw new Error('地域代码长度为1至50个字符');
        const changedRegions =
          !isEdit.value || regionSignature(value) !== originalRegions;
        if (
          changedRegions &&
          formData.value.provider === CloudProvider.Azure &&
          value.some((item) => !/^[a-z0-9]+$/.test(item.region))
        )
          throw new Error('Azure 地域代码格式无效，例如 eastus');
        if (
          changedRegions &&
          formData.value.provider === CloudProvider.GCP &&
          value.some(
            (item) => !/^[a-z][a-z0-9-]{1,48}-[a-z]$/.test(item.region),
          )
        )
          throw new Error('GCP 需要填写可用区，例如 us-central1-a');
        if (
          formData.value.provider === CloudProvider.HuaweiCloud &&
          (!isEdit.value || regionSignature(value) !== originalRegions)
        ) {
          if (
            value.some(
              (item) => !/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(item.region),
            )
          )
            throw new Error('华为云地域代码格式无效');
          if (
            value.some(
              (item) => !/^[a-zA-Z0-9_-]{1,64}$/.test(item.project_id ?? ''),
            )
          )
            throw new Error('华为云每个地域必须填写有效的项目 ID');
        }
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
  { dataIndex: 'name', key: 'name', title: '账户名称', width: 200 },
  { dataIndex: 'provider', key: 'provider', title: '云厂商', width: 130 },
  { dataIndex: 'region', key: 'region', title: '地域', width: 150 },
  { key: 'account_info', title: '账户信息', width: 250 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 120 },
  { key: 'creator', title: '创建人', width: 140 },
  { key: 'created_at', title: '创建时间', width: 180 },
  { align: 'center' as const, key: 'action', title: '操作', width: 180 },
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
  const owner = actionOwner();
  if (!active || !owner) return;
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
    if (!active || ticket !== listRequest || owner !== actionOwner()) return;
    listOwner = owner;
    cloudAccounts.value = response.items || [];
    pagination.total = response.total || 0;
  } catch (error) {
    if (!active || ticket !== listRequest || owner !== actionOwner()) return;
    if (shouldRecordPageError(error))
      loadError.value = '获取云账户列表失败，请重试';
    if (shouldNotifyPageError(error)) message.error('获取云账户列表失败');
    cloudAccounts.value = [];
    listOwner = '';
    pagination.total = 0;
  } finally {
    if (active && ticket === listRequest && owner === actionOwner())
      loading.value = false;
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
  clearProviderCredentials();
  if (!hasPerm(CLOUD_ACCOUNT_PERMISSIONS.create)) return;
  const owner = actionOwner();
  if (!active || !owner) return;
  formOwner = owner;
  isEdit.value = false;
  editAccountStatus.value = CloudAccountStatus.Enabled;
  originalCredentialType.value = 'long_term';
  savedCredentialExpiry.value = undefined;
  formData.value = {
    status: CloudAccountStatus.Enabled,
    name: '',
    provider: CloudProvider.AliCloud,
    regions: [],
    access_key: '',
    secret_key: '',
    credential_type: 'long_term',
    session_token: '',
    credential_expires_at: '',
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
    ...(item.project_id !== undefined ? { project_id: item.project_id } : {}),
  }));
const regionSignature = (regions: CloudAccountRegionInput[]) =>
  JSON.stringify(
    normalizeRegions(regions).sort((a, b) => a.region.localeCompare(b.region)),
  );
const closeForm = () => {
  formRequest++;
  formOwner = '';
  modalVisible.value = false;
  formLoading.value = false;
  submitLoading.value = false;
  formData.value.access_key = '';
  formData.value.secret_key = '';
  formData.value.session_token = '';
  formData.value.credential_expires_at = '';
  savedCredentialExpiry.value = undefined;
  clearProviderCredentials();
};
const handleEdit = async (record: CloudAccount): Promise<void> => {
  const owner = actionOwner();
  if (
    !active ||
    !owner ||
    owner !== listOwner ||
    !isSupportedAccountProvider(record.provider) ||
    !hasPerm(CLOUD_ACCOUNT_PERMISSIONS.edit) ||
    !hasPerm(CLOUD_ACCOUNT_PERMISSIONS.detail)
  )
    return;
  const ticket = ++formRequest;
  formOwner = owner;
  clearProviderCredentials();
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
    if (
      !active ||
      ticket !== formRequest ||
      !modalVisible.value ||
      owner !== actionOwner()
    )
      return;
    if (
      !hasPerm(CLOUD_ACCOUNT_PERMISSIONS.edit) ||
      !hasPerm(CLOUD_ACCOUNT_PERMISSIONS.detail)
    ) {
      closeForm();
      return;
    }
    if (
      current.credential_type &&
      !['long_term', 'temporary'].includes(current.credential_type)
    ) {
      message.error('账户凭据类型不受支持');
      closeForm();
      return;
    }
    editAccountStatus.value = current.status;
    originalCredentialType.value = current.credential_type || 'long_term';
    savedCredentialExpiry.value = current.credential_expires_at;
    const regions = normalizeRegions(current.regions);
    originalRegions = regionSignature(regions);
    formData.value = {
      id: current.id,
      name: current.name,
      provider: current.provider,
      regions,
      access_key: '',
      secret_key: '',
      credential_type: originalCredentialType.value,
      session_token: '',
      credential_expires_at: '',
      account_id: current.account_id ?? '',
      account_name: current.account_name ?? '',
      account_alias: current.account_alias ?? '',
      description: current.description ?? '',
    };
  } catch (error) {
    if (!active || ticket !== formRequest || owner !== actionOwner()) return;
    if (shouldNotifyPageError(error)) message.error('获取账户详情失败，请重试');
    closeForm();
  } finally {
    if (active && ticket === formRequest && owner === actionOwner())
      formLoading.value = false;
  }
};

function changeProvider() {
  clearProviderCredentials();
  formData.value.regions = [];
  formData.value.access_key = '';
  formData.value.secret_key = '';
  formData.value.session_token = '';
  formData.value.credential_expires_at = '';
  formData.value.credential_type = 'long_term';
}

function changeCredentialType() {
  formData.value.session_token = '';
  formData.value.credential_expires_at = '';
}

function isFutureUTC(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))
    return false;
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time <= Date.now()) return false;
  const normalized = value.replace(
    /(?:\.(\d{1,3}))?Z$/,
    (_, fraction: string | undefined) => `.${(fraction ?? '').padEnd(3, '0')}Z`,
  );
  return new Date(time).toISOString() === normalized;
}

watch(
  () => [
    modalVisible.value,
    isEdit.value,
    hasPerm(CLOUD_ACCOUNT_PERMISSIONS.create),
    hasPerm(CLOUD_ACCOUNT_PERMISSIONS.edit),
    hasPerm(CLOUD_ACCOUNT_PERMISSIONS.detail),
  ],
  () => {
    if (
      modalVisible.value &&
      (!hasPerm(
        isEdit.value
          ? CLOUD_ACCOUNT_PERMISSIONS.edit
          : CLOUD_ACCOUNT_PERMISSIONS.create,
      ) ||
        (isEdit.value && !hasPerm(CLOUD_ACCOUNT_PERMISSIONS.detail)))
    )
      closeForm();
  },
);

const handleSubmit = async (): Promise<void> => {
  const owner = formOwner;
  if (!active || !owner || owner !== actionOwner()) {
    closeForm();
    return;
  }
  if (
    submitLoading.value ||
    formLoading.value ||
    !formRef.value ||
    !hasPerm(
      isEdit.value
        ? CLOUD_ACCOUNT_PERMISSIONS.edit
        : CLOUD_ACCOUNT_PERMISSIONS.create,
    )
  )
    return;
  const ticket = formRequest;
  const editing = isEdit.value;
  submitLoading.value = true;
  try {
    await formRef.value?.validate();
    if (owner !== actionOwner()) {
      if (ticket === formRequest) closeForm();
      return;
    }
    if (
      ticket !== formRequest ||
      !modalVisible.value ||
      !hasPerm(
        editing
          ? CLOUD_ACCOUNT_PERMISSIONS.edit
          : CLOUD_ACCOUNT_PERMISSIONS.create,
      ) ||
      (editing && !hasPerm(CLOUD_ACCOUNT_PERMISSIONS.detail))
    )
      return;
    const draft = {
      ...formData.value,
      regions: normalizeRegions(formData.value.regions),
    };
    if (!isSupportedAccountProvider(draft.provider)) {
      message.error('当前不支持该云厂商');
      return;
    }
    let providerCredentials: ProviderCredentialInput | undefined;
    if (
      draft.provider === CloudProvider.Azure ||
      draft.provider === CloudProvider.GCP
    ) {
      try {
        providerCredentials = buildProviderCredentials(draft.provider, editing);
      } catch (error) {
        message.error(
          error instanceof Error ? error.message : '专用凭据格式无效',
        );
        return;
      }
    }
    const mode = draft.credential_type || 'long_term';
    const token = draft.session_token || '';
    const expiry = draft.credential_expires_at || '';
    const changed =
      !!(draft.access_key || draft.secret_key || token || expiry) ||
      mode !== originalCredentialType.value;
    if (
      !structuredProvider.value &&
      mode === 'temporary' &&
      ![CloudProvider.AWS, CloudProvider.TencentCloud].includes(draft.provider)
    ) {
      message.error('当前云厂商不支持临时凭据');
      return;
    }
    if (
      !structuredProvider.value &&
      (!editing || changed) &&
      (mode === 'temporary' ||
        (editing &&
          (originalCredentialType.value === 'temporary' ||
            mode !== originalCredentialType.value)))
    ) {
      if (!draft.access_key || !draft.secret_key) {
        message.error('轮换或切换凭据时必须填写完整 Access Key 和 Secret Key');
        return;
      }
      if (
        mode === 'temporary' &&
        (!token.trim() ||
          new TextEncoder().encode(token).length > 8192 ||
          !isFutureUTC(expiry))
      ) {
        message.error('临时凭据需填写令牌和未来的 UTC 到期时间');
        return;
      }
    }
    if (
      mode === 'long_term' &&
      draft.provider === CloudProvider.AWS &&
      draft.access_key.startsWith('ASIA')
    ) {
      message.error('AWS 临时 Access Key 需要选择临时凭据并提供令牌');
      return;
    }
    if (editing && draft.id) {
      const updateData: Omit<UpdateCloudAccountReq, 'id'> = {
        name: draft.name,
        account_id: draft.account_id || undefined,
        account_name: draft.account_name || undefined,
        account_alias: draft.account_alias || undefined,
        description: draft.description || undefined,
      };
      if (providerCredentials)
        updateData.provider_credentials = providerCredentials;
      if (draft.access_key) updateData.access_key = draft.access_key;
      if (draft.secret_key) updateData.secret_key = draft.secret_key;
      if (
        !structuredProvider.value &&
        changed &&
        (mode !== originalCredentialType.value || mode === 'temporary')
      )
        updateData.credential_type = mode;
      if (!structuredProvider.value && changed && mode === 'temporary') {
        updateData.session_token = token;
        updateData.credential_expires_at = expiry;
      }
      if (regionSignature(draft.regions) !== originalRegions)
        updateData.regions = draft.regions;
      await updateCloudAccountApi(draft.id, updateData);
    } else {
      const { id: _id, ...rawCreateData } = draft;
      const createData: CreateCloudAccountReq = rawCreateData;
      if (mode === 'long_term' || structuredProvider.value) {
        delete createData.session_token;
        delete createData.credential_expires_at;
      }
      if (structuredProvider.value) {
        delete createData.access_key;
        delete createData.secret_key;
        delete createData.credential_type;
        createData.provider_credentials = providerCredentials;
      }
      await createCloudAccountApi(createData);
    }
    if (!active || ticket !== formRequest || owner !== actionOwner()) return;
    message.success(
      editing ? '云账户已更新' : '云账户已创建，可从列表显式验证凭据',
    );
    closeForm();
    void fetchCloudAccounts();
  } catch (error: any) {
    if (
      !active ||
      ticket !== formRequest ||
      owner !== actionOwner() ||
      error?.errorFields
    )
      return;
    if (shouldNotifyPageError(error))
      message.error(
        editing ? '更新云账户失败，已保留表单' : '创建云账户失败，已保留表单',
      );
  } finally {
    if (active && ticket === formRequest && owner === actionOwner())
      submitLoading.value = false;
  }
};

const handleDelete = (record: CloudAccount): void => {
  if (
    !isSupportedAccountProvider(record.provider) ||
    !can('tree.cloudAccount.delete')
  )
    return;
  const ticket = accountAction(record);
  if (!ticket) return;
  deleteTickets.set(ticket.id, ticket);
  let submitted = false;
  const current = () =>
    deleteTickets.get(ticket.id) === ticket &&
    currentAccountAction(ticket) &&
    can('tree.cloudAccount.delete');
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除云账户 "${record.name}" 吗？此操作不可恢复。`,
    okText: '确定删除',
    okType: 'danger',
    cancelText: '取消',
    onCancel: () => {
      if (deleteTickets.get(ticket.id) === ticket)
        deleteTickets.delete(ticket.id);
    },
    onOk: async () => {
      if (submitted || !current()) return;
      submitted = true;
      try {
        await deleteCloudAccountApi(ticket.id);
        if (!current()) return;
        message.success('删除成功');
        if (sameActionDetail(ticket)) closeDetails();
        void fetchCloudAccounts();
      } catch (error) {
        if (current() && shouldNotifyPageError(error))
          message.error('删除失败');
      } finally {
        if (deleteTickets.get(ticket.id) === ticket)
          deleteTickets.delete(ticket.id);
      }
    },
  });
};

const handleStatusChange = async (
  record: CloudAccount,
  checked: boolean,
): Promise<void> => {
  if (
    typeof checked !== 'boolean' ||
    !isSupportedAccountProvider(record.provider) ||
    !hasPerm(CLOUD_ACCOUNT_PERMISSIONS.status)
  )
    return;
  const ticket = accountAction(record);
  if (!ticket) return;
  statusTickets.set(ticket.id, ticket);
  const loadingState = switchLoading.value;
  const latest = () =>
    active &&
    ticket.owner === actionOwner() &&
    statusTickets.get(ticket.id) === ticket &&
    loadingState === switchLoading.value;
  const current = () =>
    latest() &&
    currentAccountAction(ticket) &&
    hasPerm(CLOUD_ACCOUNT_PERMISSIONS.status);
  const newStatus = checked
    ? CloudAccountStatus.Enabled
    : CloudAccountStatus.Disabled;
  loadingState[ticket.id] = true;

  try {
    await updateCloudAccountStatusApi(ticket.id, newStatus);
    if (!current()) return;
    message.success(`账户已${checked ? '启用' : '禁用'}`);
    ticket.record.status = newStatus;
    if (sameActionDetail(ticket) && currentDetail.value) {
      currentDetail.value.status = newStatus;
    }
  } catch (error) {
    if (current() && shouldNotifyPageError(error))
      message.error('状态更新失败');
  } finally {
    if (latest()) {
      loadingState[ticket.id] = false;
      statusTickets.delete(ticket.id);
    }
  }
};

const handleVerify = (record: CloudAccount): void => {
  if (
    !isSupportedAccountProvider(record.provider) ||
    record.status !== CloudAccountStatus.Enabled ||
    !hasPerm(CLOUD_ACCOUNT_PERMISSIONS.verify)
  )
    return;
  const ticket = accountAction(record);
  if (!ticket) return;
  const status = record.status;
  verifyTickets.set(ticket.id, ticket);
  let submitted = false;
  const current = () =>
    verifyTickets.get(ticket.id) === ticket &&
    currentAccountAction(ticket) &&
    status === CloudAccountStatus.Enabled &&
    ticket.record.status === status &&
    hasPerm(CLOUD_ACCOUNT_PERMISSIONS.verify);
  Modal.confirm({
    title: '验证云账户凭据',
    content: `将向${computeProviderName(record.provider)}验证账户“${record.name}”的凭据，验证失败不会删除账户`,
    okText: '开始验证',
    cancelText: '取消',
    onCancel: () => {
      if (verifyTickets.get(ticket.id) === ticket)
        verifyTickets.delete(ticket.id);
    },
    onOk: async () => {
      if (submitted || !current()) return;
      submitted = true;
      const hide = message.loading('正在验证凭据...', 0);
      try {
        await verifyCloudAccountApi(ticket.id);
        if (!current()) return;
        message.success('凭据验证成功');
      } catch (error) {
        if (current() && shouldNotifyPageError(error))
          message.error('凭据验证失败，账户配置已保留');
      } finally {
        hide();
        if (verifyTickets.get(ticket.id) === ticket)
          verifyTickets.delete(ticket.id);
      }
    },
  });
};

const handleViewDetail = async (record: CloudAccount): Promise<void> => {
  if (!hasPerm(CLOUD_ACCOUNT_PERMISSIONS.detail)) return;
  const owner = actionOwner();
  const id = record.id;
  const provider = record.provider;
  if (!active || !owner || owner !== listOwner || !validAccountId(id)) return;
  const ticket = ++detailRequest;
  detailOwner = owner;
  currentDetail.value = null;
  detailVisible.value = true;
  detailLoading.value = true;

  try {
    const response = await getCloudAccountDetailApi(id);
    if (
      !active ||
      ticket !== detailRequest ||
      !detailVisible.value ||
      owner !== actionOwner()
    )
      return;
    if (!hasPerm(CLOUD_ACCOUNT_PERMISSIONS.detail)) {
      detailVisible.value = false;
      return;
    }
    if (response.id !== id || response.provider !== provider) {
      message.error('获取详情失败');
      closeDetails();
      return;
    }
    currentDetail.value = response;
  } catch (error) {
    if (!active || ticket !== detailRequest || owner !== actionOwner()) return;
    if (shouldNotifyPageError(error)) message.error('获取详情失败');
  } finally {
    if (active && ticket === detailRequest && owner === actionOwner())
      detailLoading.value = false;
  }
};

// ========== 导出功能 ==========
const exportToExcel = (data: CloudAccount[]) => {
  if (!data || data.length === 0) {
    message.warning('没有可导出的数据');
    return;
  }
  if (!active || !listOwner || listOwner !== actionOwner()) {
    message.warning('账户会话已变化，请刷新列表后导出');
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
  const firstRow = exportData[0];
  if (!firstRow) return;
  downloadCsv(filename, [
    Object.keys(firstRow),
    ...exportData.map((row) => Object.values(row)),
  ]);
  message.success(`导出成功：${filename}`);
};

// ========== 生命周期 ==========
onMounted(() => {
  fetchCloudAccounts();
});
onBeforeUnmount(() => {
  active = false;
  clearAccountActions();
  listOwner = '';
  formOwner = '';
  listRequest++;
  detailRequest++;
  formRequest++;
  formData.value.access_key = '';
  formData.value.secret_key = '';
  formData.value.session_token = '';
  formData.value.credential_expires_at = '';
  clearProviderCredentials();
});

watch(
  actionOwner,
  () => {
    listRequest++;
    listOwner = '';
    cloudAccounts.value = [];
    pagination.total = 0;
    loadError.value = null;
    loading.value = false;
    clearAccountActions();
    closeDetails();
    closeForm();
  },
  { flush: 'sync' },
);
</script>

<template>
  <OpsPage
    class="cmdb-console cloud-account-management"
    description="管理云账户和授权地域，验证操作需显式发起"
    title="云账户"
  >
    <a-alert v-if="loadError" :message="loadError" show-icon type="error">
      <template #action>
        <a-button @click="fetchCloudAccounts()">重试</a-button>
      </template>
    </a-alert>
    <!-- 页面头部 -->
    <template #actions>
      <a-space :size="12">
        <a-button
          v-if="hasPerm(CLOUD_ACCOUNT_PERMISSIONS.create)"
          type="primary"
          aria-label="添加账户"
          @click="showCreateModal"
          class="btn-create"
        >
          <template #icon><PlusOutlined /></template>
          <span class="btn-text">添加账户</span>
        </a-button>
        <a-button @click="exportToExcel(cloudAccounts)">
          <ExportOutlined /> 导出当前页
        </a-button> </a-space
      ><a-button :loading="loading" @click="fetchCloudAccounts()">
        刷新
      </a-button>
    </template>

    <!-- 统计卡片 -->
    <template #summary>
      <div class="stats-row">
        <a-row :gutter="[16, 16]">
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic :value="pagination.total" title="匹配账户数">
                <template #prefix>
                  <CloudOutlined />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic :value="enabledCount" title="本页已启用">
                <template #prefix>
                  <CheckCircleOutlined />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic :value="aliCloudCount" title="本页阿里云">
                <template #prefix>
                  <CloudServerOutlined />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic :value="tencentAndAwsCount" title="本页腾讯云 / AWS">
                <template #prefix>
                  <GlobalOutlined />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
        </a-row>
      </div>
    </template>

    <!-- 搜索筛选区 -->
    <template #filters>
      <a-form class="filter-form" layout="inline">
        <a-form-item>
          <a-input
            v-model:value="filterForm.search"
            allow-clear
            placeholder="搜索账户名称"
            style="width: 220px"
            @change="handleSearchChange"
            @pressEnter="handleSearch"
          >
            <template #prefix><SearchOutlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item label="云厂商">
          <a-select
            v-model:value="filterForm.provider"
            allow-clear
            placeholder="全部厂商"
            style="width: 150px"
            @change="handleSearch"
          >
            <a-select-option :value="CloudProvider.AliCloud">
              阿里云
            </a-select-option>
            <a-select-option :value="CloudProvider.TencentCloud">
              腾讯云
            </a-select-option>
            <a-select-option :value="CloudProvider.HuaweiCloud">
              华为云
            </a-select-option>
            <a-select-option :value="CloudProvider.AWS">AWS</a-select-option>
            <a-select-option :value="CloudProvider.Azure">
              Azure
            </a-select-option>
            <a-select-option :value="CloudProvider.GCP">GCP</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="账户状态">
          <a-select
            v-model:value="filterForm.status"
            allow-clear
            placeholder="全部状态"
            style="width: 130px"
            @change="handleSearch"
          >
            <a-select-option :value="CloudAccountStatus.Enabled">
              启用
            </a-select-option>
            <a-select-option :value="CloudAccountStatus.Disabled">
              禁用
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleSearch">
              <SearchOutlined /> 查询
            </a-button>
            <a-button class="reset-btn" @click="resetFilter">
              <ClearOutlined /> 重置
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </template>

    <!-- 账户列表表格 -->
    <div class="table-section">
      <a-card class="table-card">
        <a-table
          :columns="columns"
          :data-source="cloudAccounts"
          :loading="loading"
          :pagination="paginationConfig"
          :scroll="{ x: 1400 }"
          class="account-table"
          row-key="id"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <!-- 账户名称列 -->
            <template v-if="column.key === 'name'">
              <div class="name-cell">
                <a-badge
                  :status="
                    record.status === CloudAccountStatus.Enabled
                      ? 'success'
                      : 'error'
                  "
                />
                <a
                  v-if="hasPerm(CLOUD_ACCOUNT_PERMISSIONS.detail)"
                  class="account-name"
                  @click="handleViewDetail(record)"
                  >{{ record.name }}</a
                >
                <span v-else class="account-name">{{ record.name }}</span>
              </div>
            </template>

            <!-- 云厂商列 -->
            <template v-else-if="column.key === 'provider'">
              <a-tag
                :color="getProviderColor(record.provider)"
                class="provider-tag"
              >
                <CloudOutlined class="tag-icon" />
                {{ getProviderText(record.provider) }}
              </a-tag>
            </template>

            <!-- 地域列 -->
            <template v-else-if="column.key === 'region'">
              <div class="region-cell">
                <EnvironmentOutlined class="region-icon" />
                <a-space wrap>
                  <a-tag
                    v-for="region in record.regions ?? []"
                    :key="region.id"
                  >
                    {{ region.region_name || region.region
                    }}<span v-if="region.is_default">（默认）</span> </a-tag
                  ><span v-if="!record.regions?.length">未配置</span>
                </a-space>
              </div>
            </template>

            <!-- 账户信息列 -->
            <template v-else-if="column.key === 'account_info'">
              <div class="account-info">
                <div v-if="record.account_id" class="info-row">
                  <span class="info-label">ID:</span>
                  <a-typography-text
                    :copyable="{ text: record.account_id }"
                    class="info-value"
                  >
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
                <span
                  v-if="
                    !record.account_id &&
                    !record.account_name &&
                    !record.account_alias
                  "
                  class="empty-text"
                  >-</span
                >
              </div>
            </template>

            <!-- 状态列 -->
            <template v-else-if="column.key === 'status'">
              <a-switch
                :disabled="
                  !isSupportedAccountProvider(record.provider) ||
                  !hasPerm(CLOUD_ACCOUNT_PERMISSIONS.status)
                "
                :checked="record.status === CloudAccountStatus.Enabled"
                :loading="switchLoading[record.id]"
                @change="
                  (checked: boolean) => handleStatusChange(record, checked)
                "
                checked-children="启用"
                un-checked-children="禁用"
              />
            </template>

            <!-- 创建人列 -->
            <template v-else-if="column.key === 'creator'">
              <div class="creator-cell">
                <a-avatar
                  size="small"
                  :style="{
                    backgroundColor: getAvatarColor(
                      record.create_user_name || '',
                    ),
                  }"
                >
                  {{ getInitials(record.create_user_name || 'Admin') }}
                </a-avatar>
                <span class="creator-name">{{
                  record.create_user_name || 'Admin'
                }}</span>
              </div>
            </template>

            <!-- 创建时间列 -->
            <template v-else-if="column.key === 'created_at'">
              <div class="date-cell">
                <ClockCircleOutlined class="date-icon" />
                {{ formatDateTime(record.created_at) }}
              </div>
            </template>

            <!-- 操作列 -->
            <template v-else-if="column.key === 'action'">
              <a-space :size="4" class="action-buttons">
                <a-tooltip
                  v-if="hasPerm(CLOUD_ACCOUNT_PERMISSIONS.detail)"
                  title="查看详情"
                >
                  <a-button
                    size="small"
                    type="text"
                    @click="handleViewDetail(record)"
                  >
                    <EyeOutlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip
                  v-if="
                    hasPerm(CLOUD_ACCOUNT_PERMISSIONS.edit) &&
                    hasPerm(CLOUD_ACCOUNT_PERMISSIONS.detail)
                  "
                  title="编辑"
                >
                  <a-button
                    type="text"
                    size="small"
                    :disabled="!isSupportedAccountProvider(record.provider)"
                    @click="handleEdit(record)"
                  >
                    <EditOutlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip
                  v-if="hasPerm(CLOUD_ACCOUNT_PERMISSIONS.verify)"
                  title="验证凭证"
                >
                  <a-button
                    type="text"
                    size="small"
                    :disabled="
                      !isSupportedAccountProvider(record.provider) ||
                      record.status !== CloudAccountStatus.Enabled
                    "
                    @click="handleVerify(record)"
                  >
                    <SafetyCertificateOutlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip v-if="can('tree.cloudAccount.delete')" title="删除">
                  <a-button
                    type="text"
                    size="small"
                    :disabled="!isSupportedAccountProvider(record.provider)"
                    danger
                    @click="handleDelete(record)"
                  >
                    <DeleteOutlined />
                  </a-button>
                </a-tooltip>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 创建/编辑对话框 -->
    <a-modal
      v-model:open="modalVisible"
      :body-style="{
        maxHeight: 'calc(100dvh - 200px)',
        overflowY: 'auto',
        paddingInline: 'var(--ops-space-sm)',
      }"
      :closable="!submitLoading"
      :confirm-loading="submitLoading"
      :destroy-on-close="true"
      :keyboard="!submitLoading"
      :mask-closable="!submitLoading"
      :style="{ top: 'var(--ops-space-xl)' }"
      :title="isEdit ? '编辑云账户' : '添加云账户'"
      :width="800"
      class="modern-modal"
      @cancel="closeForm"
      @ok="handleSubmit"
    >
      <a-form
        ref="formRef"
        :disabled="formLoading || submitLoading"
        :model="formData"
        :rules="formRules"
        class="account-form"
        layout="vertical"
      >
        <a-divider orientation="left">
          <InfoCircleOutlined /> 基本信息
        </a-divider>
        <a-row :gutter="16">
          <a-col :span="24">
            <a-form-item label="账户名称" name="name">
              <a-input
                v-model:value="formData.name"
                placeholder="请输入云账户名称"
                size="large"
              >
                <template #prefix><UserOutlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :sm="12" :xs="24">
            <a-form-item label="云厂商" name="provider">
              <a-select
                v-model:value="formData.provider"
                :disabled="isEdit"
                placeholder="选择云厂商"
                size="large"
                @change="changeProvider"
              >
                <a-select-option :value="CloudProvider.AliCloud">
                  <CloudOutlined /> 阿里云
                </a-select-option>
                <a-select-option :value="CloudProvider.TencentCloud">
                  <CloudOutlined /> 腾讯云
                </a-select-option>
                <a-select-option :value="CloudProvider.HuaweiCloud">
                  <CloudOutlined /> 华为云
                </a-select-option>
                <a-select-option :value="CloudProvider.AWS">
                  <CloudOutlined /> AWS
                </a-select-option>
                <a-select-option :value="CloudProvider.Azure">
                  <CloudOutlined /> Azure
                </a-select-option>
                <a-select-option :value="CloudProvider.GCP">
                  <CloudOutlined /> GCP
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col v-if="!isEdit" :sm="12" :xs="24">
            <a-form-item
              extra="停用仅保存配置，可在核对后启用并显式同步。"
              label="初始状态"
              name="status"
            >
              <a-select
                id="cloud-account-create-status"
                v-model:value="formData.status"
                aria-label="初始状态"
                size="large"
              >
                <a-select-option :value="CloudAccountStatus.Enabled">
                  启用
                </a-select-option>
                <a-select-option :value="CloudAccountStatus.Disabled">
                  停用（仅保存）
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :sm="12" :xs="24">
            <a-form-item label="授权地域" name="regions">
              <AccountRegionsEditor
                v-model="formData.regions"
                :disabled="formLoading || submitLoading || !modalVisible"
                :provider="formData.provider"
                :account-id="isEdit ? formData.id : undefined"
                :account-enabled="
                  editAccountStatus === CloudAccountStatus.Enabled
                "
                :can-read="hasPerm(CLOUD_ACCOUNT_PERMISSIONS.regions)"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">
          <SafetyCertificateOutlined /> 凭证配置
        </a-divider>
        <a-form-item
          v-if="
            formData.provider === CloudProvider.AWS ||
            formData.provider === CloudProvider.TencentCloud
          "
          label="凭据类型"
        >
          <a-select
            id="cloud-credential-type"
            v-model:value="formData.credential_type"
            aria-label="凭据类型"
            @change="changeCredentialType"
          >
            <a-select-option value="long_term">长期凭据</a-select-option>
            <a-select-option value="temporary">临时凭据</a-select-option>
          </a-select>
        </a-form-item>
        <a-alert
          v-if="!structuredProvider && formData.credential_type === 'temporary'"
          message="临时凭据需提供完整密钥、令牌和 UTC 到期时间；暂不支持全量同步。"
          show-icon
          type="info"
        />
        <a-alert
          v-if="formData.provider === CloudProvider.HuaweiCloud"
          message="华为云仅支持指定实例 ID 的增量同步；每个地域必须配置对应项目 ID。"
          show-icon
          type="info"
        />
        <a-alert
          v-if="structuredProvider"
          message="Azure 和 GCP 仅支持指定实例 ID 的增量同步，不支持全量或无 ID 同步。"
          show-icon
          type="info"
        />
        <p v-if="structuredProvider && isEdit" class="form-hint">
          已保存凭据不会回显；全部留空保留现有凭据，修改任一项时需完整填写。
        </p>
        <p
          v-if="
            isEdit &&
            originalCredentialType === 'temporary' &&
            !structuredProvider
          "
          class="form-hint"
        >
          当前到期时间：{{
            savedCredentialExpiry || '未知'
          }}。凭据全部留空可保留；轮换时需完整填写。
        </p>
        <a-row v-if="!structuredProvider" :gutter="16">
          <a-col :span="24">
            <a-form-item label="Access Key" name="access_key">
              <a-input
                v-model:value="formData.access_key"
                autocomplete="off"
                placeholder="请输入 Access Key"
                size="large"
              >
                <template #prefix><KeyOutlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="Secret Key" name="secret_key">
              <a-input-password
                v-model:value="formData.secret_key"
                autocomplete="new-password"
                placeholder="请输入 Secret Key"
                size="large"
              >
                <template #prefix><LockOutlined /></template>
              </a-input-password>
            </a-form-item>
          </a-col>
          <template v-if="formData.credential_type === 'temporary'">
            <a-col :span="24">
              <a-form-item label="Session Token">
                <a-input-password
                  v-model:value="formData.session_token"
                  :maxlength="8192"
                  autocomplete="new-password"
                  placeholder="请输入 Session Token"
                  size="large"
                />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="到期时间（UTC）">
                <a-input
                  v-model:value="formData.credential_expires_at"
                  autocomplete="off"
                  placeholder="例如 2027-01-01T00:00:00Z"
                  size="large"
                />
              </a-form-item>
            </a-col>
          </template>
        </a-row>

        <a-row v-if="formData.provider === CloudProvider.Azure" :gutter="16">
          <a-col :sm="12" :xs="24">
            <a-form-item label="租户 ID">
              <a-input
                v-model:value="providerCredentialDraft.tenant_id"
                :disabled="submitLoading || formLoading"
                autocomplete="off"
                placeholder="请输入租户 ID"
              />
            </a-form-item>
          </a-col>
          <a-col :sm="12" :xs="24">
            <a-form-item label="应用（客户端）ID">
              <a-input
                v-model:value="providerCredentialDraft.client_id"
                :disabled="submitLoading || formLoading"
                autocomplete="off"
                placeholder="请输入应用 ID"
              />
            </a-form-item>
          </a-col>
          <a-col :sm="12" :xs="24">
            <a-form-item label="订阅 ID">
              <a-input
                v-model:value="providerCredentialDraft.subscription_id"
                :disabled="submitLoading || formLoading"
                autocomplete="off"
                placeholder="请输入订阅 ID"
              />
            </a-form-item>
          </a-col>
          <a-col :sm="12" :xs="24">
            <a-form-item label="客户端密钥">
              <a-input-password
                v-model:value="providerCredentialDraft.client_secret"
                :disabled="submitLoading || formLoading"
                autocomplete="new-password"
                placeholder="请输入客户端密钥"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row v-if="formData.provider === CloudProvider.GCP" :gutter="16">
          <a-col :span="24">
            <a-form-item label="资源项目 ID">
              <a-input
                v-model:value="providerCredentialDraft.project_id"
                :disabled="submitLoading || formLoading"
                autocomplete="off"
                placeholder="请输入 GCP 资源项目 ID"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="服务账号 JSON">
              <a-input-password
                v-model:value="providerCredentialDraft.service_account_json"
                :disabled="submitLoading || formLoading"
                autocomplete="new-password"
                placeholder="粘贴服务账号 JSON"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <p class="form-hint">
              资源项目可以与服务账号所属项目不同。JSON
              仅用于保存凭据，不会回显。
            </p>
          </a-col>
        </a-row>

        <a-divider orientation="left">
          <TagsOutlined /> 账户信息（可选）
        </a-divider>
        <a-row :gutter="16">
          <a-col :sm="12" :xs="24">
            <a-form-item label="账户ID" name="account_id">
              <a-input
                v-model:value="formData.account_id"
                placeholder="云厂商账户ID"
                size="large"
              />
            </a-form-item>
          </a-col>
          <a-col :sm="12" :xs="24">
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
                :maxlength="500"
                :rows="3"
                placeholder="云账户用途描述"
                show-count
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>

      <template #footer>
        <a-space>
          <a-button :disabled="submitLoading" @click="closeForm">取消</a-button>
          <a-button
            :disabled="formLoading"
            :loading="submitLoading"
            type="primary"
            @click="handleSubmit"
          >
            {{ isEdit ? '更新' : '添加' }}
          </a-button>
        </a-space>
      </template>
    </a-modal>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:open="detailVisible"
      :destroy-on-close="true"
      class="detail-drawer"
      title="云账户详情"
      width="min(600px, 100vw)"
      @close="closeDetails"
    >
      <a-skeleton :loading="detailLoading" active>
        <a-empty
          v-if="!detailLoading && !currentDetail"
          description="详情加载失败，请关闭后重试"
        />
        <template v-if="currentDetail">
          <div class="detail-content">
            <div class="detail-header">
              <h2>{{ currentDetail.name }}</h2>
              <div class="detail-badges">
                <a-badge
                  :status="
                    currentDetail.status === CloudAccountStatus.Enabled
                      ? 'success'
                      : 'error'
                  "
                  :text="
                    currentDetail.status === CloudAccountStatus.Enabled
                      ? '已启用'
                      : '已禁用'
                  "
                />
                <a-tag :color="getProviderColor(currentDetail.provider)">
                  {{ getProviderText(currentDetail.provider) }}
                </a-tag>
              </div>
            </div>

            <!-- 详细信息 -->
            <a-descriptions
              :column="1"
              bordered
              class="detail-descriptions"
              size="small"
              title="账户信息"
            >
              <a-descriptions-item :span="2" label="账户ID">
                {{ currentDetail.id }}
              </a-descriptions-item>
              <a-descriptions-item :span="1" label="云厂商">
                <a-tag :color="getProviderColor(currentDetail.provider)">
                  {{ getProviderText(currentDetail.provider) }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item :span="1" label="地域">
                <a-space wrap>
                  <a-tag
                    v-for="region in currentDetail.regions ?? []"
                    :key="region.id"
                  >
                    {{ region.region_name || region.region }} ({{
                      region.region
                    }})<span v-if="region.project_id">
                      · 项目 {{ region.project_id }}</span
                    ><span v-if="region.is_default"> 默认</span
                    ><span v-if="region.status === 2"> 已停用</span>
                  </a-tag>
                </a-space>
              </a-descriptions-item>
              <a-descriptions-item label="凭据类型">
                {{
                  currentDetail.credential_type === 'temporary'
                    ? '临时凭据'
                    : !currentDetail.credential_type ||
                        currentDetail.credential_type === 'long_term'
                      ? '长期凭据'
                      : '未知'
                }}
              </a-descriptions-item>
              <a-descriptions-item
                v-if="currentDetail.credential_type === 'temporary'"
                label="到期时间（UTC）"
              >
                {{ currentDetail.credential_expires_at || '未知' }}
              </a-descriptions-item>
              <a-descriptions-item :span="2" label="云账户ID">
                <a-typography-text
                  v-if="currentDetail.account_id"
                  :copyable="{ text: currentDetail.account_id }"
                >
                  {{ currentDetail.account_id }}
                </a-typography-text>
                <span v-else>-</span>
              </a-descriptions-item>
              <a-descriptions-item :span="2" label="云账户名称">
                {{ currentDetail.account_name || '-' }}
              </a-descriptions-item>
              <a-descriptions-item :span="2" label="云账户别名">
                {{ currentDetail.account_alias || '-' }}
              </a-descriptions-item>
              <a-descriptions-item :span="2" label="描述信息">
                {{ currentDetail.description || '-' }}
              </a-descriptions-item>
              <a-descriptions-item :span="2" label="状态">
                <a-switch
                  v-if="currentDetail"
                  :disabled="
                    !isSupportedAccountProvider(currentDetail.provider) ||
                    !hasPerm(CLOUD_ACCOUNT_PERMISSIONS.status)
                  "
                  :checked="currentDetail.status === CloudAccountStatus.Enabled"
                  :loading="switchLoading[currentDetail.id]"
                  @change="
                    (checked: boolean) =>
                      currentDetail &&
                      handleStatusChange(currentDetail, checked)
                  "
                  checked-children="启用"
                  un-checked-children="禁用"
                />
              </a-descriptions-item>
              <a-descriptions-item :span="1" label="创建人">
                <a-avatar
                  size="small"
                  :style="{
                    backgroundColor: getAvatarColor(
                      currentDetail.create_user_name || '',
                    ),
                  }"
                >
                  {{ getInitials(currentDetail.create_user_name || 'Admin') }}
                </a-avatar>
                <span style="margin-left: 8px">{{
                  currentDetail.create_user_name || '-'
                }}</span>
              </a-descriptions-item>
              <a-descriptions-item :span="1" label="创建时间">
                {{ formatDateTime(currentDetail.created_at) }}
              </a-descriptions-item>
              <a-descriptions-item :span="2" label="更新时间">
                {{ formatDateTime(currentDetail.updated_at) }}
              </a-descriptions-item>
            </a-descriptions>

            <!-- 操作按钮 -->
            <div class="drawer-actions">
              <a-button-group>
                <a-button
                  v-if="hasPerm(CLOUD_ACCOUNT_PERMISSIONS.verify)"
                  type="primary"
                  :disabled="
                    !isSupportedAccountProvider(currentDetail.provider) ||
                    currentDetail.status !== CloudAccountStatus.Enabled
                  "
                  @click="handleVerify(currentDetail)"
                >
                  <SafetyCertificateOutlined /> 验证凭证
                </a-button>
                <a-button
                  v-if="
                    hasPerm(CLOUD_ACCOUNT_PERMISSIONS.edit) &&
                    hasPerm(CLOUD_ACCOUNT_PERMISSIONS.detail)
                  "
                  :disabled="
                    !isSupportedAccountProvider(currentDetail.provider)
                  "
                  @click="handleEdit(currentDetail)"
                >
                  <EditOutlined /> 编辑
                </a-button>
              </a-button-group>
              <a-button
                v-if="can('tree.cloudAccount.delete')"
                danger
                :disabled="!isSupportedAccountProvider(currentDetail.provider)"
                @click="handleDelete(currentDetail)"
              >
                <DeleteOutlined /> 删除
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
