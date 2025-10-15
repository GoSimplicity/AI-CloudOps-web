<template>
  <div class="cloud-account-management">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-actions">
        <a-space :size="12">
          <a-button type="primary" @click="showCreateModal" class="btn-create">
            <template #icon><plus-outlined /></template>
            <span class="btn-text">添加账户</span>
          </a-button>
          <a-dropdown>
            <a-button>
              <export-outlined /> 导出数据
            </a-button>
            <template #overlay>
              <a-menu @click="handleExportMenuClick">
                <a-menu-item key="current">
                  <file-excel-outlined /> 导出当前页
                </a-menu-item>
                <a-menu-item key="all">
                  <file-excel-outlined /> 导出全部数据
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </a-space>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <a-row :gutter="[16, 16]">
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="总账户数" 
              :value="pagination.total" 
              :value-style="{ color: '#3f8600' }"
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
              title="已启用" 
              :value="enabledCount" 
              :value-style="{ color: '#52c41a' }"
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
              title="阿里云" 
              :value="aliCloudCount" 
              :value-style="{ color: '#faad14' }"
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
              title="腾讯云" 
              :value="tencentCloudCount" 
              :value-style="{ color: '#cf1322' }"
            >
              <template #prefix>
                <global-outlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- 搜索筛选区 -->
    <div class="filter-section">
      <a-card class="filter-card">
        <a-form layout="inline" class="filter-form">
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
        </a-form>
      </a-card>
    </div>

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
                <span>{{ record.region }}</span>
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
                :checked="record.status === CloudAccountStatus.Enabled"
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
                  <a-button type="text" size="small" @click="handleEdit(record)">
                    <edit-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="验证凭证">
                  <a-button type="text" size="small" @click="handleVerify(record)">
                    <safety-certificate-outlined />
                  </a-button>
                </a-tooltip>
                <a-popconfirm
                  title="确定删除此云账户吗？"
                  ok-text="确定"
                  cancel-text="取消"
                  @confirm="handleDelete(record)"
                >
                  <a-tooltip title="删除">
                    <a-button type="text" size="small" danger>
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
      :title="isEdit ? '编辑云账户' : '添加云账户'"
      :width="800"
      @ok="handleSubmit"
      @cancel="modalVisible = false"
      :confirm-loading="submitLoading"
      class="modern-modal"
    >
      <a-form
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
          <a-col :span="12">
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
                <a-select-option :value="CloudProvider.TencentCloud">
                  <cloud-outlined /> 腾讯云
                </a-select-option>
                <a-select-option :value="CloudProvider.HuaweiCloud">
                  <cloud-outlined /> 华为云
                </a-select-option>
                <a-select-option :value="CloudProvider.AWS">
                  <cloud-outlined /> AWS
                </a-select-option>
                <a-select-option :value="CloudProvider.Azure">
                  <cloud-outlined /> Azure
                </a-select-option>
                <a-select-option :value="CloudProvider.GCP">
                  <cloud-outlined /> GCP
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="地域" name="region">
              <a-input
                v-model:value="formData.region"
                placeholder="如: cn-hangzhou"
                size="large"
              >
                <template #prefix><environment-outlined /></template>
              </a-input>
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
          <a-col :span="12">
            <a-form-item label="账户ID" name="account_id">
              <a-input
                v-model:value="formData.account_id"
                placeholder="云厂商账户ID"
                size="large"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
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
          <a-button @click="modalVisible = false">取消</a-button>
          <a-button 
            type="primary" 
            @click="handleSubmit" 
            :loading="submitLoading"
          >
            {{ isEdit ? '更新' : '添加' }}
          </a-button>
          <a-button 
            v-if="!isEdit"
            type="primary"
            ghost
            @click="handleVerifyAndSubmit" 
            :loading="verifyLoading"
          >
            <safety-certificate-outlined /> 验证并添加
          </a-button>
        </a-space>
      </template>
    </a-modal>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:open="detailVisible"
      title="云账户详情"
      width="600"
      :destroy-on-close="true"
      class="detail-drawer"
    >
      <a-skeleton :loading="detailLoading" active>
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
                <environment-outlined /> {{ currentDetail.region }}
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
                  :checked="currentDetail.status === CloudAccountStatus.Enabled"
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
                <a-button type="primary" @click="handleVerify(currentDetail)">
                  <safety-certificate-outlined /> 验证凭证
                </a-button>
                <a-button @click="handleEdit(currentDetail)">
                  <edit-outlined /> 编辑
                </a-button>
              </a-button-group>
              <a-button danger @click="handleDelete(currentDetail)">
                <delete-outlined /> 删除
              </a-button>
            </div>
          </div>
        </template>
      </a-skeleton>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
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
  FileExcelOutlined,
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
  type GetCloudAccountListReq,
  type CreateCloudAccountReq,
  type UpdateCloudAccountReq,
} from '#/api/core/tree/tree_account';
import * as XLSX from 'xlsx';

// ========== 状态定义 ==========
const loading = ref(false);
const detailLoading = ref(false);
const submitLoading = ref(false);
const verifyLoading = ref(false);
const modalVisible = ref(false);
const detailVisible = ref(false);
const isEdit = ref(false);
const switchLoading = ref<Record<number, boolean>>({});

const formRef = ref();
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
  region: undefined,
  status: undefined,
});

const formData = ref<CreateCloudAccountReq & { id?: number }>({
  name: '',
  provider: CloudProvider.AliCloud,
  region: '',
  access_key: '',
  secret_key: '',
  account_id: '',
  account_name: '',
  account_alias: '',
  description: '',
});

// ========== 计算属性 ==========
const enabledCount = computed(() => 
  cloudAccounts.value.filter(item => item.status === CloudAccountStatus.Enabled).length
);

const aliCloudCount = computed(() => 
  cloudAccounts.value.filter(item => item.provider === CloudProvider.AliCloud).length
);

const tencentCloudCount = computed(() => 
  cloudAccounts.value.filter(item => item.provider === CloudProvider.TencentCloud).length
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
  region: [
    { required: true, message: '请输入地域', trigger: 'blur' },
    { min: 2, max: 50, message: '地域长度在2-50个字符之间', trigger: 'blur' },
  ],
  access_key: isEdit.value 
    ? []
    : [
        { required: true, message: '请输入 Access Key', trigger: 'blur' },
        { min: 10, message: 'Access Key 长度至少10位', trigger: 'blur' },
      ],
  secret_key: isEdit.value
    ? []
    : [
        { required: true, message: '请输入 Secret Key', trigger: 'blur' },
        { min: 10, message: 'Secret Key 长度至少10位', trigger: 'blur' },
      ],
}));

// 表格列定义
const columns = [
  { title: '账户名称', dataIndex: 'name', key: 'name', width: 200, fixed: 'left' as const },
  { title: '云厂商', dataIndex: 'provider', key: 'provider', width: 130 },
  { title: '地域', dataIndex: 'region', key: 'region', width: 150 },
  { title: '账户信息', key: 'account_info', width: 250 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '创建人', key: 'creator', width: 140 },
  { title: '创建时间', key: 'created_at', width: 180 },
  { title: '操作', key: 'action', fixed: 'right' as const, width: 180, align: 'center' as const },
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
  const colors = ['#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#1890ff', '#52c41a'];
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
  loading.value = true;
  try {
    const params: GetCloudAccountListReq = {
      page: pagination.current,
      size: pagination.pageSize,
    };
    
    // 使用过滤条件
    if (filterForm.search) params.search = filterForm.search;
    if (filterForm.provider) params.provider = filterForm.provider;
    if (filterForm.region) params.region = filterForm.region;
    if (filterForm.status !== undefined) params.status = filterForm.status;

    const response = await getCloudAccountListApi(params);
    cloudAccounts.value = response.items || [];
    pagination.total = response.total || 0;
  } catch (error) {
    message.error('获取云账户列表失败');
    cloudAccounts.value = [];
    pagination.total = 0;
  } finally {
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
  filterForm.region = undefined;
  filterForm.status = undefined;
  pagination.current = 1;
  filterForm.page = 1;
  filterForm.size = pagination.pageSize; // 保持分页大小同步
  fetchCloudAccounts();
  message.success('筛选条件已重置');
};

const showCreateModal = (): void => {
  isEdit.value = false;
  formData.value = {
    name: '',
    provider: CloudProvider.AliCloud,
    region: '',
    access_key: '',
    secret_key: '',
    account_id: '',
    account_name: '',
    account_alias: '',
    description: '',
  };
  modalVisible.value = true;
};

const handleEdit = (record: CloudAccount): void => {
  isEdit.value = true;
  formData.value = {
    id: record.id,
    name: record.name,
    provider: record.provider,
    region: record.region,
    access_key: '',
    secret_key: '',
    account_id: record.account_id || '',
    account_name: record.account_name || '',
    account_alias: record.account_alias || '',
    description: record.description || '',
  };
  modalVisible.value = true;
  detailVisible.value = false;
};

const handleSubmit = async (): Promise<void> => {
  try {
    await formRef.value?.validate();
    submitLoading.value = true;

    if (isEdit.value && formData.value.id) {
      const updateData: Omit<UpdateCloudAccountReq, 'id'> = {
        name: formData.value.name,
        account_id: formData.value.account_id || undefined,
        account_name: formData.value.account_name || undefined,
        account_alias: formData.value.account_alias || undefined,
        description: formData.value.description || undefined,
      };
      
      if (formData.value.access_key) updateData.access_key = formData.value.access_key;
      if (formData.value.secret_key) updateData.secret_key = formData.value.secret_key;

      await updateCloudAccountApi(formData.value.id, updateData);
      message.success('云账户更新成功');
    } else {
      await createCloudAccountApi(formData.value as CreateCloudAccountReq);
      message.success('云账户创建成功');
    }

    modalVisible.value = false;
    fetchCloudAccounts();
  } catch (error: any) {
    if (error?.errorFields) return;
    message.error(isEdit.value ? '更新云账户失败' : '创建云账户失败');
  } finally {
    submitLoading.value = false;
  }
};

const handleVerifyAndSubmit = async (): Promise<void> => {
  try {
    await formRef.value?.validate();
    verifyLoading.value = true;

    const hideCreating = message.loading('正在创建云账户...', 0);
    const createResponse = await createCloudAccountApi(formData.value as CreateCloudAccountReq);
    hideCreating();
    
    const accountId = createResponse?.id;
    if (!accountId) {
      message.error('创建云账户失败：未获取到账户ID');
      return;
    }

    try {
      const hideVerifying = message.loading('正在验证凭证...', 0);
      await verifyCloudAccountApi(accountId);
      hideVerifying();
      
      message.success('云账户创建并验证成功');
      modalVisible.value = false;
      fetchCloudAccounts();
    } catch (verifyError) {
      try {
        await deleteCloudAccountApi(accountId);
        message.error('凭证验证失败，账户已自动删除，请检查 Access Key 和 Secret Key');
      } catch (deleteError) {
        message.error('凭证验证失败，且删除账户失败，请手动删除该账户');
      }
      return;
    }
  } catch (error: any) {
    if (error?.errorFields) return;
    message.error('创建云账户失败');
  } finally {
    verifyLoading.value = false;
  }
};

const handleDelete = (record: CloudAccount): void => {
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

const handleStatusChange = async (record: CloudAccount, checked: boolean): Promise<void> => {
  const newStatus = checked ? CloudAccountStatus.Enabled : CloudAccountStatus.Disabled;
  switchLoading.value[record.id] = true;
  
  try {
    await updateCloudAccountStatusApi(record.id, newStatus);
    message.success(`账户已${checked ? '启用' : '禁用'}`);
    
    const index = cloudAccounts.value.findIndex(item => item.id === record.id);
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

const handleVerify = async (record: CloudAccount): Promise<void> => {
  const hide = message.loading('正在验证凭证...', 0);
  try {
    await verifyCloudAccountApi(record.id);
    hide();
    message.success('凭证验证成功');
  } catch (error) {
    hide();
    message.error('凭证验证失败，请检查 Access Key 和 Secret Key');
  }
};

const handleViewDetail = async (record: CloudAccount): Promise<void> => {
  detailVisible.value = true;
  detailLoading.value = true;
  
  try {
    const response = await getCloudAccountDetailApi(record.id);
    currentDetail.value = response;
  } catch (error) {
    message.error('获取详情失败');
    currentDetail.value = record;
  } finally {
    detailLoading.value = false;
  }
};

// ========== 导出功能 ==========
const handleExportMenuClick = ({ key }: { key: string }) => {
  if (key === 'current') {
    exportToExcel(cloudAccounts.value);
  } else if (key === 'all') {
    exportAllToExcel();
  }
};

const exportToExcel = (data: CloudAccount[]) => {
  if (!data || data.length === 0) {
    message.warning('没有可导出的数据');
    return;
  }

  // 准备导出数据
  const exportData = data.map((item) => ({
    '账户名称': item.name,
    '云厂商': getProviderText(item.provider),
    '地域': item.region,
    '账户ID': item.account_id || '-',
    '账户别名': item.account_alias || '-',
    '状态': item.status === CloudAccountStatus.Enabled ? '已启用' : '已禁用',
    '创建人': item.create_user_name || '-',
    '创建时间': formatDateTime(item.created_at),
    '更新时间': formatDateTime(item.updated_at),
    '描述': item.description || '-',
  }));

  // 创建工作簿和工作表
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '云账户列表');

  // 设置列宽
  const colWidths = [
    { wch: 20 }, // 账户名称
    { wch: 12 }, // 云厂商
    { wch: 15 }, // 地域
    { wch: 25 }, // 账户ID
    { wch: 20 }, // 账户别名
    { wch: 10 }, // 状态
    { wch: 15 }, // 创建人
    { wch: 20 }, // 创建时间
    { wch: 20 }, // 更新时间
    { wch: 30 }, // 描述
  ];
  worksheet['!cols'] = colWidths;

  // 导出文件
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `云账户列表_${timestamp}.xlsx`;
  XLSX.writeFile(workbook, filename);
  message.success(`导出成功：${filename}`);
};

const exportAllToExcel = async () => {
  const hide = message.loading('正在导出所有数据...', 0);
  try {
    // 获取所有数据
    const allData: CloudAccount[] = [];
    let currentPage = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const params: GetCloudAccountListReq = {
        page: currentPage,
        size: pageSize,
        search: filterForm.search,
        provider: filterForm.provider,
        region: filterForm.region,
        status: filterForm.status,
      };

      const response = await getCloudAccountListApi(params);
      const items = response.items || [];
      const total = response.total || 0;

      allData.push(...items);

      if (items.length < pageSize || allData.length >= total) {
        hasMore = false;
      } else {
        currentPage++;
      }
    }

    hide();
    exportToExcel(allData);
  } catch (error) {
    hide();
    message.error('导出失败');
  }
};

// ========== 生命周期 ==========
onMounted(() => {
  fetchCloudAccounts();
});
</script>

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
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    height: 100%;
  }

  .filter-section {
    margin-bottom: 20px;

    .filter-card {
      border-radius: 8px;
      border: 1px solid #f0f0f0;
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
      border-radius: 8px;
      border: 1px solid #f0f0f0;
      box-shadow: none;

      :deep(.ant-card-body) {
        padding: 0;
      }
    }

    .account-table {
      :deep(.ant-table) {
        border-radius: 8px;
        overflow: hidden;
      }

      :deep(.ant-table-thead > tr > th) {
        white-space: nowrap;
        background-color: #fafafa;
        font-weight: 600;
        color: #374151;
      }

      :deep(.ant-table-tbody > tr > td) {
        word-break: break-word;
      }

      :deep(.ant-table-tbody > tr:hover > td) {
        background-color: #fafafa;
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
        color: #6b7280;
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
      color: #6b7280;

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
        color: #6b7280;
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
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }

    :deep(.ant-modal-header) {
      border-bottom: 1px solid #f0f0f0;
      padding: 16px 24px;
    }

    :deep(.ant-modal-title) {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
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
      border-bottom: 1px solid #f0f0f0;
      padding: 16px 24px;
    }

    :deep(.ant-drawer-title) {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
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
        color: #1f2937;
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
        color: #1a1a1a;
        margin-bottom: 16px;
        padding-left: 12px;
        border-left: 4px solid #1890ff;
      }
    }

    .drawer-actions {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #f0f0f0;
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
