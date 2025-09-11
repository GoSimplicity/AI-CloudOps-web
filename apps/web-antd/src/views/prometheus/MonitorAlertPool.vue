<template>
  <div class="alert-pool-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="showAddModal" class="btn-create">
          <template #icon>
            <PlusOutlined />
          </template>
          <span class="btn-text">新增AlertManager实例池</span>
        </a-button>
        <div class="search-filters">
          <a-input-search
            v-model:value="searchText"
            placeholder="搜索实例池名称..."
            class="search-input"
            @search="handleSearch"
            @change="handleSearchChange"
            allow-clear
          />
          <a-button @click="handleReset" class="reset-btn"> 重置 </a-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <a-row :gutter="[16, 16]">
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic title="总实例池" :value="stats.total" :value-style="{ color: '#3f8600' }">
              <template #prefix>
                <Icon icon="carbon:container-registry" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic title="告警实例" :value="stats.alertInstances" :value-style="{ color: '#52c41a' }">
              <template #prefix>
                <Icon icon="carbon:warning-alt" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic title="活跃实例池" :value="stats.active" :value-style="{ color: '#faad14' }">
              <template #prefix>
                <Icon icon="carbon:data-table" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic title="分组标签" :value="stats.groupLabels" :value-style="{ color: '#cf1322' }">
              <template #prefix>
                <Icon icon="carbon:server" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- 表格容器 -->
    <div class="table-container">
      <a-card>
        <a-table :data-source="data" :columns="columns" :pagination="paginationConfig" :loading="loading" row-key="id"
          bordered :scroll="{ x: 1400 }" @change="handleTableChange">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="pool-name-cell">
                <div class="pool-badge status-active"></div>
                <span class="pool-name-text">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'alert_manager_instances'">
              <div class="tag-container">
                <a-tag 
                  v-for="instance in record.alert_manager_instances" 
                  :key="instance" 
                  class="tech-tag alert-tag"
                >
                  {{ instance }}
                </a-tag>
                <span v-if="!record.alert_manager_instances?.length" class="empty-text">无实例</span>
              </div>
            </template>

            <template v-if="column.key === 'group_by'">
              <div class="tag-container">
                <template v-if="record.group_by?.length">
                  <a-tag 
                    v-for="label in record.group_by" 
                    :key="label" 
                    class="tech-tag label-tag"
                  >
                    {{ label }}
                  </a-tag>
                </template>
                <span v-else class="empty-text">无分组</span>
              </div>
            </template>

            <template v-if="column.key === 'timing_config'">
              <div class="config-info">
                <div class="config-item">
                  <span class="config-label">等待:</span>
                  <span class="config-value">{{ record.group_wait }}</span>
                </div>
                <div class="config-item">
                  <span class="config-label">间隔:</span>
                  <span class="config-value">{{ record.group_interval }}</span>
                </div>
              </div>
            </template>

            <template v-if="column.key === 'receiver'">
              <a-tag color="blue" class="receiver-tag">{{ record.receiver }}</a-tag>
            </template>

            <template v-if="column.key === 'creator'">
              <div class="creator-info">
                <a-avatar 
                  size="small" 
                  :style="{ backgroundColor: getAvatarColor(record.create_user_name || '') }"
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
                <a-button type="primary" size="small" @click="handleViewPool(record)">
                  查看
                </a-button>
                <a-button type="default" size="small" @click="showEditModal(record)">
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleMenuClick(e.key, record)">
                      <a-menu-item key="delete" danger>删除</a-menu-item>
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

    <!-- 新增AlertManager实例池模态框 -->
    <a-modal :open="isAddModalVisible" title="新增AlertManager实例池" :width="formDialogWidth" @ok="handleAdd"
      @cancel="closeAddModal" :destroy-on-close="true" class="responsive-modal alert-pool-modal">
      <a-form ref="addFormRef" :model="addForm" :rules="formRules" layout="vertical">
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="实例池名称" name="name" :rules="[{ required: true, message: '请输入实例池名称' }]">
                <a-input v-model:value="addForm.name" placeholder="请输入实例池名称" />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">实例配置</div>
          <!-- 动态AlertManager实例表单项 -->
          <a-form-item v-for="(instance, index) in addForm.alert_manager_instances" :key="instance.key"
            :label="index === 0 ? 'AlertManager实例' : ''" :name="['alert_manager_instances', index, 'value']"
            :rules="{ required: true, message: '请输入AlertManager实例IP' }">
            <div class="dynamic-input-container">
              <a-input v-model:value="instance.value" placeholder="请输入AlertManager实例IP" class="dynamic-input" />
              <MinusCircleOutlined v-if="addForm.alert_manager_instances.length > 1" class="dynamic-delete-button"
                @click="removeAlertManagerInstance(instance)" />
            </div>
          </a-form-item>
          <a-form-item>
            <a-button type="dashed" class="add-dynamic-button" @click="addAlertManagerInstance">
              <PlusOutlined />
              添加AlertManager实例
            </a-button>
          </a-form-item>
        </div>

        <div class="form-section">
          <div class="section-title">标签配置</div>
          <!-- 动态标签表单项 -->
          <a-form-item v-for="(label, index) in addForm.group_by" :key="label.key" :label="index === 0 ? '分组标签' : ''">
            <div class="label-input-group">
              <a-input v-model:value="label.labelKey" placeholder="请输入标签Key" class="label-key-input" />
              <div class="label-separator">:</div>
              <a-input v-model:value="label.labelValue" placeholder="请输入标签Value" class="label-value-input" />
              <MinusCircleOutlined v-if="addForm.group_by.length > 1" class="dynamic-delete-button"
                @click="removeLabel(label)" />
            </div>
          </a-form-item>
          <a-form-item>
            <a-button type="dashed" class="add-dynamic-button" @click="addLabel">
              <PlusOutlined />
              添加标签
            </a-button>
          </a-form-item>
        </div>

        <div class="form-section">
          <div class="section-title">告警配置</div>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="默认恢复时间" name="resolve_timeout">
                <a-input v-model:value="addForm.resolve_timeout" placeholder="例如: 5s" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="默认分组第一次等待时间" name="group_wait">
                <a-input v-model:value="addForm.group_wait" placeholder="例如: 5s" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="默认分组等待间隔" name="group_interval">
                <a-input v-model:value="addForm.group_interval" placeholder="例如: 5s" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="默认重复发送时间" name="repeat_interval">
                <a-input v-model:value="addForm.repeat_interval" placeholder="例如: 5s" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="兜底接收者" name="receiver">
                <a-input-group compact>
                  <a-input v-model:value="addForm.receiver" placeholder="请选择兜底接收者" style="width: calc(100% - 100px)" />
                  <a-button type="primary" @click="showUserModal('add')">选择用户</a-button>
                </a-input-group>
              </a-form-item>
            </a-col>
          </a-row>
        </div>
      </a-form>
    </a-modal>

    <!-- 编辑AlertManager实例池模态框 -->
    <a-modal :open="isEditModalVisible" title="编辑AlertManager实例池" :width="formDialogWidth" @ok="handleEdit"
      @cancel="closeEditModal" :destroy-on-close="true" class="responsive-modal alert-pool-modal">
      <a-form ref="editFormRef" :model="editForm" :rules="formRules" layout="vertical">
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="实例池名称" name="name" :rules="[{ required: true, message: '请输入实例池名称' }]">
                <a-input v-model:value="editForm.name" placeholder="请输入实例池名称" />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">实例配置</div>
          <!-- 动态AlertManager实例表单项 -->
          <a-form-item v-for="(instance, index) in editForm.alert_manager_instances" :key="instance.key"
            :label="index === 0 ? 'AlertManager实例' : ''" :name="['alert_manager_instances', index, 'value']"
            :rules="{ required: true, message: '请输入AlertManager实例IP' }">
            <div class="dynamic-input-container">
              <a-input v-model:value="instance.value" placeholder="请输入AlertManager实例IP" class="dynamic-input" />
              <MinusCircleOutlined v-if="editForm.alert_manager_instances.length > 1" class="dynamic-delete-button"
                @click="removeEditAlertManagerInstance(instance)" />
            </div>
          </a-form-item>
          <a-form-item>
            <a-button type="dashed" class="add-dynamic-button" @click="addEditAlertManagerInstance">
              <PlusOutlined />
              添加AlertManager实例
            </a-button>
          </a-form-item>
        </div>

        <div class="form-section">
          <div class="section-title">标签配置</div>
          <!-- 动态标签表单项 -->
          <a-form-item v-for="(label, index) in editForm.group_by" :key="label.key" :label="index === 0 ? '分组标签' : ''">
            <div class="label-input-group">
              <a-input v-model:value="label.labelKey" placeholder="请输入标签Key" class="label-key-input" />
              <div class="label-separator">:</div>
              <a-input v-model:value="label.labelValue" placeholder="请输入标签Value" class="label-value-input" />
              <MinusCircleOutlined v-if="editForm.group_by.length > 1" class="dynamic-delete-button"
                @click="removeEditLabel(label)" />
            </div>
          </a-form-item>
          <a-form-item>
            <a-button type="dashed" class="add-dynamic-button" @click="addEditLabel">
              <PlusOutlined />
              添加标签
            </a-button>
          </a-form-item>
        </div>

        <div class="form-section">
          <div class="section-title">告警配置</div>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="默认恢复时间" name="resolve_timeout">
                <a-input v-model:value="editForm.resolve_timeout" placeholder="例如: 5s" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="默认分组第一次等待时间" name="group_wait">
                <a-input v-model:value="editForm.group_wait" placeholder="例如: 5s" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="默认分组等待间隔" name="group_interval">
                <a-input v-model:value="editForm.group_interval" placeholder="例如: 5s" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="默认重复发送时间" name="repeat_interval">
                <a-input v-model:value="editForm.repeat_interval" placeholder="例如: 5s" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="兜底接收者" name="receiver">
                <a-input-group compact>
                  <a-input v-model:value="editForm.receiver" placeholder="请选择兜底接收者" style="width: calc(100% - 100px)" />
                  <a-button type="primary" @click="showUserModal('edit')">选择用户</a-button>
                </a-input-group>
              </a-form-item>
            </a-col>
          </a-row>
        </div>
      </a-form>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal :open="detailDialogVisible" title="实例池详情" :width="previewDialogWidth" :footer="null"
      @cancel="closeDetailDialog" class="detail-dialog">
      <div v-if="detailDialog.form" class="pool-details">
        <div class="detail-header">
          <h2>{{ detailDialog.form.name }}</h2>
          <div class="detail-badges">
            <a-tag color="success">AlertManager实例池</a-tag>
          </div>
        </div>

        <a-descriptions bordered :column="1" :labelStyle="{ width: '150px' }">
          <a-descriptions-item label="ID">{{ detailDialog.form.id }}</a-descriptions-item>
          <a-descriptions-item label="恢复时间">{{ detailDialog.form.resolve_timeout || '未配置' }}</a-descriptions-item>
          <a-descriptions-item label="分组等待时间">{{ detailDialog.form.group_wait || '未配置' }}</a-descriptions-item>
          <a-descriptions-item label="分组等待间隔">{{ detailDialog.form.group_interval || '未配置' }}</a-descriptions-item>
          <a-descriptions-item label="重复发送时间">{{ detailDialog.form.repeat_interval || '未配置' }}</a-descriptions-item>
          <a-descriptions-item label="兜底接收者">{{ detailDialog.form.receiver || '未配置' }}</a-descriptions-item>
          <a-descriptions-item label="创建人">{{ detailDialog.form.create_user_name || '未知' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatFullDateTime(detailDialog.form.created_at) }}</a-descriptions-item>
        </a-descriptions>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button type="primary" @click="showEditModal(detailDialog.form)">编辑</a-button>
        </div>
      </div>
      
      <!-- 加载状态 -->
      <div v-else class="loading-container">
        <a-spin size="large" />
        <p style="margin-top: 16px; text-align: center;">正在加载详情...</p>
      </div>
    </a-modal>

    <!-- 用户选择模态框 -->
    <a-modal 
      :open="isUserModalVisible" 
      title="选择兜底接收者" 
      @cancel="closeUserModal"
      :width="600"
      :footer="null"
    >
      <div class="user-selection-content">
        <a-input-search
          v-model:value="userSearchText"
          placeholder="搜索用户..."
          @search="handleUserSearch"
          style="margin-bottom: 16px;"
          allow-clear
        />
        <a-table
          :columns="userColumns"
          :data-source="userList"
          :loading="userLoading"
          :pagination="userPagination"
          @change="handleUserTableChange"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-button type="primary" size="small" @click="handleSelectUser(record)">选择</a-button>
            </template>
          </template>
        </a-table>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import {
  PlusOutlined,
  DownOutlined,
  MinusCircleOutlined
} from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
import {
  getMonitorAlertManagerPoolListApi,
  createMonitorAlertManagerPoolApi,
  updateMonitorAlertManagerPoolApi,
  deleteMonitorAlertManagerPoolApi,
  getMonitorAlertManagerPoolApi,
  type MonitorAlertManagerPool,
  type GetAlertManagerPoolListParams,
  type CreateMonitorAlertManagerPoolReq,
  type UpdateMonitorAlertManagerPoolReq,
} from '#/api/core/prometheus/prometheus_alert_pool';

import { getUserList, type GetUserListReq } from '#/api/core/system/user';

// 动态表单项接口
interface DynamicItem {
  value: string;
  key: number;
}

interface LabelItem {
  labelKey: string;
  labelValue: string;
  key: number;
}

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
  { title: '实例池名称', dataIndex: 'name', key: 'name', width: 200, fixed: 'left' },
  { title: 'AlertManager实例', dataIndex: 'alert_manager_instances', key: 'alert_manager_instances', width: 220 },
  { title: '分组标签', dataIndex: 'group_by', key: 'group_by', width: 180 },
  { title: '时间配置', dataIndex: 'timing_config', key: 'timing_config', width: 160 },
  { title: '接收器', dataIndex: 'receiver', key: 'receiver', width: 120 },
  { title: '创建人', dataIndex: 'create_user_name', key: 'creator', width: 120 },
  { title: '创建时间', dataIndex: 'created_at', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 200, align: 'center' as const, fixed: 'right' }
];

// 状态数据
const loading = ref(false);
const searchText = ref('');
const data = ref<MonitorAlertManagerPool[]>([]);

// 防抖处理
let searchTimeout: any = null;

// 分页配置
const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  size: 'default' as const
});

// 统计数据
const stats = reactive({
  total: 0,
  alertInstances: 0,
  active: 0,
  groupLabels: 0
});

// 对话框状态
const isAddModalVisible = ref(false);
const isEditModalVisible = ref(false);
const detailDialogVisible = ref(false);

// 表单数据
const addForm = reactive({
  name: '',
  alert_manager_instances: [{ value: '', key: Date.now() }],
  resolve_timeout: '',
  group_wait: '',
  group_interval: '',
  repeat_interval: '',
  group_by: [{ labelKey: '', labelValue: '', key: Date.now() }],
  receiver: '',
});

const editForm = reactive({
  id: 0,
  name: '',
  alert_manager_instances: [{ value: '', key: Date.now() }],
  resolve_timeout: '',
  group_wait: '',
  group_interval: '',
  repeat_interval: '',
  group_by: [{ labelKey: '', labelValue: '', key: Date.now() }],
  receiver: '',
});

// 详情对话框数据
const detailDialog = reactive({
  form: null as MonitorAlertManagerPool | null
});

// 用户选择模态框状态
const isUserModalVisible = ref(false);
const userList = ref<any[]>([]);
const userLoading = ref(false);
const userPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: false,
});
const userSearchText = ref('');
const activeForm = ref<'add' | 'edit' | null>(null);

const userColumns = [
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '昵称', dataIndex: 'nickname', key: 'nickname' },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
  { title: '操作', key: 'action', width: 80, align: 'center' as const },
];

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入实例池名称', trigger: 'blur' },
    { min: 3, max: 50, message: '长度应为3到50个字符', trigger: 'blur' }
  ]
};


const getAvatarColor = (name: string): string => {
  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
};

const getInitials = (name: string): string => {
  if (!name) return '';
  return name.slice(0, 2).toUpperCase();
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('zh-CN');
};

const formatTime = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const formatFullDateTime = (dateString?: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('zh-CN');
};

// 更新统计数据
const updateStats = () => {
  stats.total = paginationConfig.total;
  stats.alertInstances = data.value.reduce((total, item) => {
    return total + (item.alert_manager_instances?.length || 0);
  }, 0);
  stats.active = data.value.filter(item => item.alert_manager_instances?.length > 0).length;
  stats.groupLabels = data.value.reduce((total, item) => {
    return total + (item.group_by?.length || 0);
  }, 0);
};

// 数据加载
const fetchAlertManagerPools = async (): Promise<void> => {
  loading.value = true;
  try {
    const params: GetAlertManagerPoolListParams = {
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      search: searchText.value || undefined,
    };

    const response = await getMonitorAlertManagerPoolListApi(params);
    if (response) {
      data.value = response.items || [];
      paginationConfig.total = response.total || 0;
      updateStats();
    }
  } catch (error: any) {
    console.error('加载实例池列表失败:', error);
    message.error(error.message || '加载实例池列表失败');
  } finally {
    loading.value = false;
  }
};

// 事件处理
const handleTableChange = (pagination: any): void => {
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  fetchAlertManagerPools();
};

const handleSearch = (): void => {
  paginationConfig.current = 1;
  fetchAlertManagerPools();
};

const handleSearchChange = (): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    handleSearch();
  }, 500);
};

const handleReset = (): void => {
  searchText.value = '';
  paginationConfig.current = 1;
  fetchAlertManagerPools();
  message.success('过滤条件已重置');
};

const showAddModal = (): void => {
  resetAddForm();
  isAddModalVisible.value = true;
};

const handleViewPool = async (record: MonitorAlertManagerPool): Promise<void> => {
  try {
    if (record.id == null) {
      message.error('记录ID缺失');
      return;
    }
    const response = await getMonitorAlertManagerPoolApi(record.id);
    detailDialog.form = response;
    detailDialogVisible.value = true;
  } catch (error: any) {
    console.error('获取实例池详情失败:', error);
    message.error(error.message || '获取实例池详情失败');
  }
};

const handleMenuClick = (command: string, record: MonitorAlertManagerPool): void => {
  switch (command) {
    case 'delete':
      confirmDelete(record);
      break;
  }
};

const confirmDelete = (record: MonitorAlertManagerPool): void => {
  Modal.confirm({
    title: '警告',
    content: `确定要删除实例池 "${record.name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        if (record.id == null) {
          message.error('记录ID缺失');
          return;
        }
        await deleteMonitorAlertManagerPoolApi(record.id);
        message.success(`实例池 "${record.name}" 已删除`);
        fetchAlertManagerPools();
      } catch (error: any) {
        console.error('删除实例池失败:', error);
        message.error(error.message || '删除实例池失败');
      }
    }
  });
};

// 用户选择相关
const fetchUsers = async () => {
  userLoading.value = true;
  try {
    const params: GetUserListReq = {
      page: userPagination.current,
      size: userPagination.pageSize,
      search: userSearchText.value,
    };
    const response = await getUserList(params);
    if (response) {
      userList.value = response.items || [];
      userPagination.total = response.total || 0;
    }
  } catch (error: any) {
    message.error(error.message || '加载用户列表失败');
  } finally {
    userLoading.value = false;
  }
};

const handleUserTableChange = (pagination: any) => {
  userPagination.current = pagination.current;
  fetchUsers();
};

const handleUserSearch = () => {
  userPagination.current = 1;
  fetchUsers();
};

const showUserModal = (formType: 'add' | 'edit') => {
  activeForm.value = formType;
  userPagination.current = 1;
  userSearchText.value = '';
  fetchUsers();
  isUserModalVisible.value = true;
};

const closeUserModal = () => {
  isUserModalVisible.value = false;
};

const handleSelectUser = (user: any) => {
  if (activeForm.value === 'add') {
    addForm.receiver = user.username;
  } else if (activeForm.value === 'edit') {
    editForm.receiver = user.username;
  }
  closeUserModal();
};

// 表单相关
const addFormRef = ref();
const editFormRef = ref();

const resetAddForm = (): void => {
  Object.assign(addForm, {
    name: '',
    alert_manager_instances: [{ value: '', key: Date.now() }],
    resolve_timeout: '',
    group_wait: '',
    group_interval: '',
    repeat_interval: '',
    group_by: [{ labelKey: '', labelValue: '', key: Date.now() }],
    receiver: '',
  });
};

const closeAddModal = (): void => {
  isAddModalVisible.value = false;
};

const closeEditModal = (): void => {
  isEditModalVisible.value = false;
};

const closeDetailDialog = (): void => {
  detailDialogVisible.value = false;
};

// 动态表单项操作
const addAlertManagerInstance = (): void => {
  addForm.alert_manager_instances.push({
    value: '',
    key: Date.now()
  });
};

const removeAlertManagerInstance = (instance: DynamicItem): void => {
  const index = addForm.alert_manager_instances.indexOf(instance);
  if (index !== -1) {
    addForm.alert_manager_instances.splice(index, 1);
  }
};

const addLabel = (): void => {
  addForm.group_by.push({
    labelKey: '',
    labelValue: '',
    key: Date.now()
  });
};

const removeLabel = (label: LabelItem): void => {
  const index = addForm.group_by.indexOf(label);
  if (index !== -1) {
    addForm.group_by.splice(index, 1);
  }
};

// 编辑模态框动态表单项操作
const addEditAlertManagerInstance = (): void => {
  editForm.alert_manager_instances.push({
    value: '',
    key: Date.now()
  });
};

const removeEditAlertManagerInstance = (instance: DynamicItem): void => {
  const index = editForm.alert_manager_instances.indexOf(instance);
  if (index !== -1) {
    editForm.alert_manager_instances.splice(index, 1);
  }
};

const addEditLabel = (): void => {
  editForm.group_by.push({
    labelKey: '',
    labelValue: '',
    key: Date.now()
  });
};

const removeEditLabel = (label: LabelItem): void => {
  const index = editForm.group_by.indexOf(label);
  if (index !== -1) {
    editForm.group_by.splice(index, 1);
  }
};

const handleAdd = async (): Promise<void> => {
  try {
    await addFormRef.value?.validate();
    const formData: CreateMonitorAlertManagerPoolReq = {
      name: addForm.name,
      alert_manager_instances: addForm.alert_manager_instances.map(item => item.value).filter(v => v.trim() !== ''),
      resolve_timeout: addForm.resolve_timeout,
      group_wait: addForm.group_wait,
      group_interval: addForm.group_interval,
      repeat_interval: addForm.repeat_interval,
      group_by: addForm.group_by
        .filter(item => item.labelKey && item.labelValue)
        .map(item => `${item.labelKey},${item.labelValue}`),
      receiver: addForm.receiver,
    };
    await createMonitorAlertManagerPoolApi(formData);
    message.success('新增实例池成功');
    await fetchAlertManagerPools();
    closeAddModal();
  } catch (error: any) {
    message.error(error.message || '新增实例池失败');
  }
};

const showEditModal = (record: MonitorAlertManagerPool): void => {
  if (record.id == null) {
    message.error('记录ID缺失');
    return;
  }
  editForm.id = record.id;
  editForm.name = record.name ?? '';
  editForm.alert_manager_instances = (record.alert_manager_instances ?? []).map((value) => ({
    value,
    key: Date.now() + Math.random(),
  }));
  editForm.resolve_timeout = record.resolve_timeout ?? '';
  editForm.group_wait = record.group_wait ?? '';
  editForm.group_interval = record.group_interval ?? '';
  editForm.repeat_interval = record.repeat_interval ?? '';
  const groupBy = record.group_by ?? [];
  if (groupBy.length > 0) {
    editForm.group_by = groupBy.map((value: string) => {
      const [labelKey, labelValue] = value.split(',');
      return {
        labelKey: labelKey ?? '',
        labelValue: labelValue ?? '',
        key: Date.now() + Math.random(),
      };
    });
  } else {
    editForm.group_by = [{ labelKey: '', labelValue: '', key: Date.now() }];
  }
  editForm.receiver = record.receiver ?? '';
  isEditModalVisible.value = true;
  detailDialogVisible.value = false;
};

const handleEdit = async (): Promise<void> => {
  try {
    await editFormRef.value?.validate();
  const formData: UpdateMonitorAlertManagerPoolReq = {
      id: editForm.id,
      name: editForm.name,
      alert_manager_instances: editForm.alert_manager_instances.map(item => item.value).filter(v => v.trim() !== ''),
      resolve_timeout: editForm.resolve_timeout,
      group_wait: editForm.group_wait,
      group_interval: editForm.group_interval,
      repeat_interval: editForm.repeat_interval,
      group_by: editForm.group_by
        .filter(item => item.labelKey && item.labelValue)
        .map(item => `${item.labelKey},${item.labelValue}`),
      receiver: editForm.receiver,
    };
    await updateMonitorAlertManagerPoolApi(formData);
    message.success('更新实例池成功');
    await fetchAlertManagerPools();
    closeEditModal();
  } catch (error: any) {
    message.error(error.message || '更新实例池失败');
  }
};

// 生命周期钩子
onMounted(() => {
  fetchAlertManagerPools();
});
</script>

<style scoped>
.alert-pool-container {
  padding: 12px;
  min-height: 100vh;
}

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
  background: linear-gradient(135deg, #1890ff 0%);
  border: none;
  flex-shrink: 0;
}

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

.stats-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
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

.status-partial {
  background-color: #faad14;
}

.status-none {
  background-color: #d9d9d9;
}

.status-active {
  background-color: #52c41a;
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
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.prometheus-tag {
  background-color: #e6f7ff;
  color: #0958d9;
  border-left: 3px solid #1890ff;
}

.alert-tag {
  background-color: #fff7e6;
  color: #d46b08;
  border-left: 3px solid #fa8c16;
}

.label-tag {
  background-color: #f6ffed;
  color: #389e0d;
  border-left: 3px solid #52c41a;
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
  color: #8c8c8c;
}

.label-value {
  color: #555;
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
  color: #666;
}

.config-value {
  font-size: 12px;
  font-weight: 500;
  color: #333;
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

.full-width {
  width: 100%;
}

.tech-switch {
  background-color: rgba(0, 0, 0, 0.25);
}

.tech-switch.ant-switch-checked {
  background: linear-gradient(45deg, #1890ff, #36cfc9);
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
  background: #f5f5f5;
  border: 1px dashed #d9d9d9;
  color: #595959;
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
  color: #8c8c8c;
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
  color: #1f2937;
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
  .alert-pool-container {
    padding: 8px;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

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

  .detail-footer {
    justify-content: center;
  }

  .detail-footer .ant-btn {
    flex: 1;
    max-width: 120px;
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
