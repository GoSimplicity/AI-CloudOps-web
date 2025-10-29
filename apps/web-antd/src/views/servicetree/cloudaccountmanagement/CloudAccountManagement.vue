<template>
  <div class="cloud-account-management servicetree-container">
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
          class="account-table servicetree-table"
        >
          <template #bodyCell="{ column, record }">
            <!-- 账户名称列 -->
            <template v-if="column.key === 'name'">
              <div class="name-cell">
                <a-badge :status="record.status === CloudAccountStatus.Enabled ? 'success' : 'error'" />
                <a class="account-name item-name" @click="handleViewDetail(record)">
                  {{ record.name }}
                </a>
              </div>
            </template>

            <!-- 云厂商列 -->
            <template v-else-if="column.key === 'provider'">
              <a-tag :color="getProviderColor(record.provider)" class="provider-tag tag-cell">
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
              <div class="account-info info-cell">
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
        class="account-form servicetree-form"
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
import { useCloudAccountManagement } from './CloudAccountManagement';

const {
  // Icons
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
  
  // Enums
  CloudProvider,
  CloudAccountStatus,
  
  // States
  loading,
  detailLoading,
  submitLoading,
  verifyLoading,
  modalVisible,
  detailVisible,
  isEdit,
  switchLoading,
  formRef,
  cloudAccounts,
  currentDetail,
  pagination,
  filterForm,
  formData,
  
  // Computed
  enabledCount,
  aliCloudCount,
  tencentCloudCount,
  paginationConfig,
  formRules,
  columns,
  
  // Methods
  getProviderColor,
  getProviderText,
  getAvatarColor,
  getInitials,
  formatDateTime,
  truncateText,
  fetchCloudAccounts,
  handleTableChange,
  handleSearch,
  handleSearchChange,
  resetFilter,
  showCreateModal,
  handleEdit,
  handleSubmit,
  handleVerifyAndSubmit,
  handleDelete,
  handleStatusChange,
  handleVerify,
  handleViewDetail,
  handleExportMenuClick,
  exportToExcel,
  exportAllToExcel,
} = useCloudAccountManagement();
</script>

<style scoped lang="scss">
@import '../shared/servicetree-common.css';
@import './CloudAccountManagement.css';
</style>
