<template>
  <div class="cloud-account-management">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="showCreateModal" class="btn-create">
          <template #icon>
            <plus-outlined />
          </template>
          <span class="btn-text">添加云账户</span>
        </a-button>
        <div class="search-filters">
          <a-input
            v-model:value="filterForm.search"
            placeholder="搜索账户名称"
            allow-clear
            class="filter-input"
            @pressEnter="handleSearch"
            @change="handleSearchChange"
          >
            <template #prefix>
              <search-outlined />
            </template>
          </a-input>
          <a-select
            v-model:value="filterForm.provider"
            placeholder="云厂商"
            allow-clear
            class="filter-select"
            @change="handleSearch"
          >
            <a-select-option :value="CloudProvider.AliCloud">阿里云</a-select-option>
            <a-select-option :value="CloudProvider.TencentCloud">腾讯云</a-select-option>
            <a-select-option :value="CloudProvider.HuaweiCloud">华为云</a-select-option>
            <a-select-option :value="CloudProvider.AWS">AWS</a-select-option>
            <a-select-option :value="CloudProvider.Azure">Azure</a-select-option>
            <a-select-option :value="CloudProvider.GCP">GCP</a-select-option>
          </a-select>
          <a-select
            v-model:value="filterForm.status"
            placeholder="账户状态"
            allow-clear
            class="filter-select"
            @change="handleSearch"
          >
            <a-select-option :value="CloudAccountStatus.Enabled">启用</a-select-option>
            <a-select-option :value="CloudAccountStatus.Disabled">禁用</a-select-option>
          </a-select>
          <a-button @click="resetFilter" class="reset-btn">
            重置
          </a-button>
        </div>
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
              :value="cloudAccounts.filter(item => item.status === CloudAccountStatus.Enabled).length" 
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
              :value="cloudAccounts.filter(item => item.provider === CloudProvider.AliCloud).length" 
              :value-style="{ color: '#faad14' }"
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
              title="腾讯云" 
              :value="cloudAccounts.filter(item => item.provider === CloudProvider.TencentCloud).length" 
              :value-style="{ color: '#1890ff' }"
            >
              <template #prefix>
                <cloud-outlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- 表格容器 -->
    <div class="table-container">
      <a-card>
        <a-table
          :columns="columns"
          :data-source="cloudAccounts"
          :loading="loading"
          :pagination="paginationConfig"
          @change="handleTableChange"
          row-key="id"
          :scroll="{ x: 1400 }"
          class="account-table"
          bordered
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="account-name-cell">
                <div class="account-badge" :class="getAccountStatusClass(record)"></div>
                <span class="account-name-text">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'provider'">
              <a-tag :color="getProviderColor(record.provider)" class="tech-tag">
                <cloud-outlined />
                {{ getProviderText(record.provider) }}
              </a-tag>
            </template>

            <template v-if="column.key === 'region'">
              <a-tag color="blue" class="tech-tag">
                <environment-outlined />
                {{ record.region }}
              </a-tag>
            </template>

            <template v-if="column.key === 'account_info'">
              <div class="account-info">
                <div class="info-item" v-if="record.account_id">
                  <span class="info-label">ID:</span>
                  <span class="info-value">{{ record.account_id }}</span>
                </div>
                <div class="info-item" v-if="record.account_name">
                  <span class="info-label">名称:</span>
                  <span class="info-value">{{ record.account_name }}</span>
                </div>
                <div class="info-item" v-if="record.account_alias">
                  <span class="info-label">别名:</span>
                  <span class="info-value">{{ record.account_alias }}</span>
                </div>
                <span v-if="!record.account_id && !record.account_name && !record.account_alias" class="empty-text">-</span>
              </div>
            </template>

            <template v-if="column.key === 'status'">
              <a-switch
                :checked="record.status === CloudAccountStatus.Enabled"
                :loading="switchLoading[record.id]"
                @change="(checked: boolean) => handleStatusChange(record, checked)"
              >
                <template #checkedChildren>启用</template>
                <template #unCheckedChildren>禁用</template>
              </a-switch>
            </template>

            <template v-if="column.key === 'creator'">
              <div class="creator-info">
                <a-avatar 
                  size="small" 
                  :style="{ backgroundColor: getAvatarColor(record.create_user_name || '') }"
                >
                  {{ getInitials(record.create_user_name || 'Admin') }}
                </a-avatar>
                <span class="creator-name">{{ record.create_user_name || 'Admin' }}</span>
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
                <a-button type="primary" size="small" @click="handleViewDetail(record)">
                  查看
                </a-button>
                <a-button type="default" size="small" @click="handleEdit(record)">
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu>
                      <a-menu-item key="verify" @click="handleVerify(record)">
                        <safety-certificate-outlined /> 验证凭证
                      </a-menu-item>
                      <a-menu-divider />
                      <a-menu-item key="delete" @click="handleDelete(record)" danger>
                        <delete-outlined /> 删除
                      </a-menu-item>
                    </a-menu>
                  </template>
                  <a-button size="small">
                    更多
                    <down-outlined />
                  </a-button>
                </a-dropdown>
              </div>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 创建/编辑云账户对话框 -->
    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? '编辑云账户' : '添加云账户'"
      :width="modalWidth"
      :footer="null"
      :destroy-on-close="true"
      class="responsive-modal account-modal"
    >
      <a-form
        :model="formData"
        :rules="formRules"
        layout="vertical"
        ref="formRef"
        class="account-form"
      >
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <div class="form-grid">
            <a-form-item label="账户名称" name="name" class="form-item">
              <a-input
                v-model:value="formData.name"
                placeholder="请输入云账户名称"
              />
            </a-form-item>
            <a-form-item label="云厂商" name="provider" class="form-item">
              <a-select v-model:value="formData.provider" placeholder="选择云厂商" :disabled="isEdit">
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
            <a-form-item label="地域" name="region" class="form-item">
              <a-input
                v-model:value="formData.region"
                placeholder="如: cn-hangzhou"
              />
            </a-form-item>
          </div>
        </div>

        <div class="form-section">
          <div class="section-title">凭证配置</div>
          <div class="form-grid">
            <a-form-item label="Access Key" name="access_key" class="form-item full-width">
              <a-input
                v-model:value="formData.access_key"
                placeholder="请输入 Access Key"
                autocomplete="off"
              />
            </a-form-item>
            <a-form-item label="Secret Key" name="secret_key" class="form-item full-width">
              <a-input-password
                v-model:value="formData.secret_key"
                placeholder="请输入 Secret Key"
                autocomplete="new-password"
              />
            </a-form-item>
          </div>
        </div>

        <div class="form-section">
          <div class="section-title">账户信息 (可选)</div>
          <div class="form-grid">
            <a-form-item label="账户ID" name="account_id" class="form-item">
              <a-input
                v-model:value="formData.account_id"
                placeholder="云厂商账户ID"
              />
            </a-form-item>
            <a-form-item label="账户名称" name="account_name" class="form-item">
              <a-input
                v-model:value="formData.account_name"
                placeholder="云厂商账户名称"
              />
            </a-form-item>
            <a-form-item label="账户别名" name="account_alias" class="form-item">
              <a-input
                v-model:value="formData.account_alias"
                placeholder="自定义别名"
              />
            </a-form-item>
          </div>
        </div>

        <div class="form-section">
          <div class="section-title">其他信息</div>
          <a-form-item label="描述信息">
            <a-textarea
              v-model:value="formData.description"
              placeholder="云账户用途描述"
              :rows="3"
            />
          </a-form-item>
        </div>

        <div class="form-actions">
          <a-button @click="modalVisible = false">取消</a-button>
          <a-button 
            type="primary" 
            @click="handleSubmit" 
            :loading="submitLoading"
            style="margin-left: 8px;"
          >
            {{ isEdit ? '更新' : '添加' }}
          </a-button>
          <a-button 
            v-if="!isEdit"
            @click="handleVerifyAndSubmit" 
            :loading="verifyLoading"
            style="margin-left: 8px;"
          >
            <safety-certificate-outlined /> 验证并添加
          </a-button>
        </div>
      </a-form>
    </a-modal>

    <!-- 云账户详情抽屉 -->
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
                <a-tag :color="getProviderColor(currentDetail.provider)" class="tech-tag">
                  <cloud-outlined />
                  {{ getProviderText(currentDetail.provider) }}
                </a-tag>
                <a-badge
                  :status="currentDetail.status === CloudAccountStatus.Enabled ? 'success' : 'error'"
                  :text="currentDetail.status === CloudAccountStatus.Enabled ? '已启用' : '已禁用'"
                />
              </div>
            </div>

            <a-descriptions bordered :column="1">
              <a-descriptions-item label="账户ID">
                {{ currentDetail.id }}
              </a-descriptions-item>
              <a-descriptions-item label="云厂商">
                <a-tag :color="getProviderColor(currentDetail.provider)" class="tech-tag">
                  {{ getProviderText(currentDetail.provider) }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="地域">
                {{ currentDetail.region }}
              </a-descriptions-item>
              <a-descriptions-item label="云账户ID">
                {{ currentDetail.account_id || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="云账户名称">
                {{ currentDetail.account_name || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="云账户别名">
                {{ currentDetail.account_alias || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="描述">
                {{ currentDetail.description || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="状态">
                <a-switch
                  v-if="currentDetail"
                  :checked="currentDetail.status === CloudAccountStatus.Enabled"
                  :loading="switchLoading[currentDetail.id]"
                  @change="(checked: boolean) => currentDetail && handleStatusChange(currentDetail, checked)"
                >
                  <template #checkedChildren>启用</template>
                  <template #unCheckedChildren>禁用</template>
                </a-switch>
              </a-descriptions-item>
              <a-descriptions-item label="创建人">
                {{ currentDetail.create_user_name || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="创建时间">
                {{ formatDateTime(currentDetail.created_at) }}
              </a-descriptions-item>
              <a-descriptions-item label="更新时间">
                {{ formatDateTime(currentDetail.updated_at) }}
              </a-descriptions-item>
            </a-descriptions>
            
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
  DownOutlined,
  CloudOutlined,
  SearchOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons-vue';
import { useWindowSize } from '@vueuse/core';

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

const loading = ref(false);
const detailLoading = ref(false);
const submitLoading = ref(false);
const verifyLoading = ref(false);
const modalVisible = ref(false);
const detailVisible = ref(false);
const isEdit = ref(false);
const switchLoading = ref<Record<number, boolean>>({});

const { width: windowWidth } = useWindowSize();

const formRef = ref();
const cloudAccounts = ref<CloudAccount[]>([]);
const currentDetail = ref<CloudAccount | null>(null);

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
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

const modalWidth = computed(() => {
  if (windowWidth.value < 768) return '95%';
  if (windowWidth.value < 1024) return '90%';
  return '900px';
});

const paginationConfig = computed(() => ({
  ...pagination,
  onChange: (page: number, pageSize: number) => handleTableChange({ current: page, pageSize }),
  onShowSizeChange: (current: number, size: number) => handleTableChange({ current, pageSize: size }),
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
  { title: '云厂商', dataIndex: 'provider', key: 'provider', width: 120 },
  { title: '地域', dataIndex: 'region', key: 'region', width: 150 },
  { title: '账户信息', dataIndex: 'account_info', key: 'account_info', width: 200 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '创建人', dataIndex: 'create_user_name', key: 'creator', width: 120 },
  { title: '创建时间', dataIndex: 'created_at', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', fixed: 'right' as const, width: 220, align: 'center' as const },
];

const getAccountStatusClass = (record: CloudAccount): string => {
  return record.status === CloudAccountStatus.Enabled ? 'status-enabled' : 'status-disabled';
};

const getProviderColor = (provider: CloudProvider): string => {
  const colorMap: Record<CloudProvider, string> = {
    [CloudProvider.AliCloud]: 'orange',
    [CloudProvider.TencentCloud]: 'blue',
    [CloudProvider.HuaweiCloud]: 'red',
    [CloudProvider.AWS]: 'gold',
    [CloudProvider.Azure]: 'cyan',
    [CloudProvider.GCP]: 'green',
  };
  return colorMap[provider] || 'default';
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
  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];
  return color || '#1890ff';
};

const getInitials = (name: string): string => {
  if (!name) return '';
  return name.slice(0, 2).toUpperCase();
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('zh-CN');
};

const formatTime = (dateString?: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const formatDateTime = (dateTime?: string): string => {
  if (!dateTime) return '-';
  try {
    return new Date(dateTime).toLocaleString('zh-CN');
  } catch {
    return dateTime;
  }
};

const fetchCloudAccounts = async (): Promise<void> => {
  loading.value = true;
  try {
    const params: GetCloudAccountListReq = {
      page: pagination.current,
      size: pagination.pageSize,
    };
    
    if (filterForm.search) {
      params.search = filterForm.search;
    }
    if (filterForm.provider) {
      params.provider = filterForm.provider;
    }
    if (filterForm.region) {
      params.region = filterForm.region;
    }
    if (filterForm.status !== undefined) {
      params.status = filterForm.status;
    }

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

const handleTableChange = (paginationData: any): void => {
  pagination.current = paginationData.current;
  pagination.pageSize = paginationData.pageSize;
  filterForm.page = paginationData.current;
  filterForm.size = paginationData.pageSize;
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
  fetchCloudAccounts();
  message.success('过滤条件已重置');
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
      
      if (formData.value.access_key) {
        updateData.access_key = formData.value.access_key;
      }
      if (formData.value.secret_key) {
        updateData.secret_key = formData.value.secret_key;
      }

      await updateCloudAccountApi(formData.value.id, updateData);
      message.success('云账户更新成功');
    } else {
      await createCloudAccountApi(formData.value as CreateCloudAccountReq);
      message.success('云账户创建成功');
    }

    modalVisible.value = false;
    fetchCloudAccounts();
  } catch (error: any) {
    if (error?.errorFields) {
      return;
    }
    message.error(isEdit.value ? '更新云账户失败' : '创建云账户失败');
  } finally {
    submitLoading.value = false;
  }
};

const handleVerifyAndSubmit = async (): Promise<void> => {
  try {
    await formRef.value?.validate();
    verifyLoading.value = true;

    // 先创建账户
    await createCloudAccountApi(formData.value as CreateCloudAccountReq);
    message.success('云账户创建成功');

    modalVisible.value = false;
    fetchCloudAccounts();
  } catch (error: any) {
    if (error?.errorFields) {
      return;
    }
    message.error('创建云账户失败');
  } finally {
    verifyLoading.value = false;
  }
};

const handleDelete = (record: CloudAccount): void => {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除云账户 "${record.name}" 吗？此操作不可恢复。`,
    okText: '确定',
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
    
    // 更新列表中的状态
    const index = cloudAccounts.value.findIndex(item => item.id === record.id);
    if (index !== -1 && cloudAccounts.value[index]) {
      cloudAccounts.value[index]!.status = newStatus;
    }
    
    // 更新详情中的状态
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

onMounted(() => {
  fetchCloudAccounts();
});
</script>

<style scoped lang="scss">
.cloud-account-management {
  padding: 16px;
  min-height: 100vh;
}

/* 页面头部样式 */
.page-header {
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.btn-create {
  background-color: #1677ff;
  border-color: #1677ff;
  flex-shrink: 0;
  box-shadow: none;
}

.btn-text {
  font-size: 14px;
}

.search-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.filter-input {
  width: 200px;
  min-width: 150px;
}

.filter-select {
  width: 120px;
  min-width: 100px;
}

.reset-btn {
  flex-shrink: 0;
}

/* 统计卡片样式 */
.stats-row {
  margin-bottom: 20px;
}

.stats-card {
  border-radius: 6px;
  border: 1px solid #f0f0f0;
  box-shadow: none;
  height: 100%;
}

.stats-card:hover {
  transform: none;
  box-shadow: none;
}

.stats-card :deep(.ant-statistic-title) {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.stats-card :deep(.ant-statistic-content) {
  font-size: 24px;
  font-weight: 600;
}

/* 表格容器样式 */
.table-container {
  margin-bottom: 24px;
}

.table-container :deep(.ant-card) {
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  box-shadow: none;
}

.account-table {
  border-radius: 8px;
}

.account-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.account-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-enabled {
  background-color: #52c41a;
}

.status-disabled {
  background-color: #d9d9d9;
}

.account-name-text {
  font-weight: 500;
  word-break: break-all;
}

.tech-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background: #fafafa;
  border: 1px solid #f0f0f0;
}

.tech-tag:hover {
  transform: none;
  box-shadow: none;
}

.account-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: #666;
}

.info-value {
  font-size: 12px;
  font-weight: 500;
  color: #333;
}

.tag-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.empty-text {
  color: #999;
  font-style: italic;
  font-size: 12px;
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
  color: #8c8c8c;
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
  color: #1a1a1a;
  margin-bottom: 16px;
  padding-left: 12px;
  border-left: 4px solid #1890ff;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.form-item {
  margin-bottom: 0;
}

.full-width {
  grid-column: 1 / -1;
}

.account-form {
  .form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #f0f0f0;
  }
}

/* 详情区域样式 */
.detail-content {
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
  color: #1f2937;
  word-break: break-all;
}

.detail-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.drawer-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .cloud-account-management {
    padding: 8px;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .search-filters {
    width: 100%;
  }

  .filter-input,
  .filter-select {
    width: 100%;
    min-width: auto;
  }

  .btn-text {
    display: none;
  }

  .btn-create {
    padding: 4px 8px;
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

  .form-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .account-form .form-actions {
    flex-direction: column;
    gap: 8px;
  }

  .account-form .form-actions .ant-btn {
    margin-left: 0 !important;
    width: 100%;
  }

  .drawer-actions {
    flex-direction: column;
    gap: 8px;
  }

  .drawer-actions .ant-btn-group {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .drawer-actions .ant-btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .header-actions {
    gap: 8px;
  }

  .stats-card {
    text-align: center;
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

/* 表格滚动优化 */
.table-container :deep(.ant-table-wrapper) {
  overflow: auto;
}

.table-container :deep(.ant-table-thead > tr > th) {
  white-space: nowrap;
  background-color: #fafafa;
}

.table-container :deep(.ant-table-tbody > tr > td) {
  word-break: break-word;
}

.table-container :deep(.ant-table-tbody > tr:hover > td) {
  background-color: #fafafa;
}

/* 对话框响应式优化 */
.responsive-modal :deep(.ant-modal) {
  max-width: calc(100vw - 16px);
  margin: 8px;
}

.responsive-modal :deep(.ant-modal-content) {
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .responsive-modal :deep(.ant-modal-body) {
    padding: 16px;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }
}

/* 动画效果 */
.stats-card, .tech-tag, .action-buttons .ant-btn {
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}

.btn-create:hover {
  transform: none;
  box-shadow: none;
}

/* 加载状态优化 */
.table-container :deep(.ant-spin-nested-loading) {
  border-radius: 8px;
}

/* 分页器样式 */
.table-container :deep(.ant-pagination) {
  margin: 16px;
  text-align: right;
}

@media (max-width: 768px) {
  .table-container :deep(.ant-pagination) {
    text-align: center;
  }
}
</style>

