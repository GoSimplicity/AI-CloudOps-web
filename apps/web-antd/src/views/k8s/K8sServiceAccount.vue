<template>
  <div class="k8s-serviceaccount-container">
    <!-- 概览卡片 -->
    <div class="overview-cards">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="总数"
              :value="statistics.total_count"
              :value-style="{ color: '#1890ff' }"
            >
              <template #prefix>
                <UserOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="活跃状态"
              :value="statistics.active_count"
              :value-style="{ color: '#52c41a' }"
            >
              <template #prefix>
                <CheckCircleOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="包含密钥"
              :value="statistics.with_secrets_count"
              :value-style="{ color: '#faad14' }"
            >
              <template #prefix>
                <KeyOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="自动挂载Token"
              :value="statistics.auto_mount_enabled_count"
              :value-style="{ color: '#722ed1' }"
            >
              <template #prefix>
                <ApiOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>
    </div>
    
    <!-- 工具栏 -->
    <div class="toolbar">
      <a-row justify="space-between" align="middle">
        <a-col>
          <a-space>
            <a-select
              v-model:value="selectedClusterId"
              placeholder="选择集群"
              style="width: 200px"
              @change="onClusterChange"
            >
              <a-select-option
                v-for="cluster in clusters"
                :key="cluster.id"
                :value="cluster.id"
              >
                {{ cluster.name }}
              </a-select-option>
            </a-select>

            <a-select
              v-model:value="selectedNamespace"
              placeholder="选择命名空间"
              style="width: 200px"
              :disabled="!selectedClusterId"
              allow-clear
              @change="loadServiceAccounts"
            >
              <a-select-option value="">全部命名空间</a-select-option>
              <a-select-option
                v-for="ns in namespaces"
                :key="ns"
                :value="ns"
              >
                {{ ns }}
              </a-select-option>
            </a-select>

            <a-input-search
              v-model:value="searchKeyword"
              placeholder="搜索服务账户名称"
              style="width: 300px"
              @search="loadServiceAccounts"
              @pressEnter="loadServiceAccounts"
            />
          </a-space>
        </a-col>
        <a-col>
          <a-space>
            <a-button type="primary" @click="showCreateModal">
              <template #icon><PlusOutlined /></template>
              创建服务账户
            </a-button>
            <a-button 
              type="primary" 
              danger 
              :disabled="!hasSelected"
              @click="handleBatchDelete"
            >
              <template #icon><DeleteOutlined /></template>
              批量删除
            </a-button>
            <a-button @click="loadServiceAccounts">
              <template #icon><ReloadOutlined /></template>
              刷新
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </div>

    <!-- 数据表格 -->
    <a-table
      :columns="columns"
      :data-source="serviceAccountData"
      :loading="loading"
      :pagination="pagination"
      :row-selection="rowSelection"
      row-key="name"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.key === 'name'">
          <a @click="showDetails(record)">{{ text }}</a>
        </template>
        
        <template v-else-if="column.key === 'namespace'">
          <a-tag color="blue">{{ text }}</a-tag>
        </template>

        <template v-else-if="column.key === 'automount_token'">
          <a-tag :color="record.automount_service_account_token ? 'green' : 'red'">
            {{ record.automount_service_account_token ? '启用' : '禁用' }}
          </a-tag>
        </template>

        <template v-else-if="column.key === 'secrets_count'">
          <a-badge 
            :count="record.secrets_count" 
            :number-style="{ backgroundColor: '#52c41a' }"
          />
        </template>

        <template v-else-if="column.key === 'image_pull_secrets_count'">
          <a-badge 
            :count="record.image_pull_secrets_count"
            :number-style="{ backgroundColor: '#faad14' }"
          />
        </template>

        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="showDetails(record)">
              详情
            </a-button>
            <a-button type="link" size="small" @click="getToken(record)">
              获取Token
            </a-button>
            <a-button type="link" size="small" @click="showEditModal(record)">
              编辑
            </a-button>
            <a-button type="link" size="small" @click="showYamlModal(record)">
              YAML
            </a-button>
            <a-popconfirm
              title="确定要删除这个服务账户吗？"
              @confirm="handleDelete(record)"
            >
              <a-button type="link" size="small" danger>
                删除
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 创建/编辑ServiceAccount模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      :title="editingServiceAccount ? '编辑服务账户' : '创建服务账户'"
      width="800px"
      @ok="handleCreateOrUpdate"
      @cancel="handleCreateCancel"
    >
      <a-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        layout="vertical"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="服务账户名称" name="name">
              <a-input 
                v-model:value="createForm.name" 
                placeholder="请输入服务账户名称"
                :disabled="!!editingServiceAccount"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间" name="namespace">
              <a-select
                v-model:value="createForm.namespace"
                placeholder="选择命名空间"
                :disabled="!!editingServiceAccount"
              >
                <a-select-option
                  v-for="ns in namespaces"
                  :key="ns"
                  :value="ns"
                >
                  {{ ns }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="自动挂载服务账户Token">
          <a-switch 
            v-model:checked="createForm.automount_service_account_token"
            checked-children="启用"
            un-checked-children="禁用"
          />
          <div class="form-help">
            控制是否自动将服务账户的API Token挂载到Pod中
          </div>
        </a-form-item>

        <a-form-item label="镜像拉取密钥">
          <a-select
            v-model:value="createForm.image_pull_secrets"
            mode="multiple"
            placeholder="选择镜像拉取密钥（可选）"
            :options="secretOptions"
          />
          <div class="form-help">
            用于从私有镜像仓库拉取镜像的密钥
          </div>
        </a-form-item>

        <a-divider orientation="left">标签</a-divider>
        <div class="labels-section">
          <a-row :gutter="8">
            <a-col :span="10">
              <a-input 
                v-model:value="newLabelKey" 
                placeholder="标签键"
                @pressEnter="addLabel"
              />
            </a-col>
            <a-col :span="10">
              <a-input 
                v-model:value="newLabelValue" 
                placeholder="标签值"
                @pressEnter="addLabel"
              />
            </a-col>
            <a-col :span="4">
              <a-button type="primary" @click="addLabel">添加</a-button>
            </a-col>
          </a-row>
          <div v-if="Object.keys(createForm.labels || {}).length" class="labels-list">
            <a-tag
              v-for="(value, key) in createForm.labels"
              :key="key"
              closable
              @close="() => removeLabel(String(key))"
            >
              {{ key }}={{ value }}
            </a-tag>
          </div>
        </div>

        <a-divider orientation="left">注解</a-divider>
        <div class="annotations-section">
          <a-row :gutter="8">
            <a-col :span="10">
              <a-input 
                v-model:value="newAnnotationKey" 
                placeholder="注解键"
                @pressEnter="addAnnotation"
              />
            </a-col>
            <a-col :span="10">
              <a-input 
                v-model:value="newAnnotationValue" 
                placeholder="注解值"
                @pressEnter="addAnnotation"
              />
            </a-col>
            <a-col :span="4">
              <a-button type="primary" @click="addAnnotation">添加</a-button>
            </a-col>
          </a-row>
          <div v-if="Object.keys(createForm.annotations || {}).length" class="annotations-list">
            <a-tag
              v-for="(value, key) in createForm.annotations"
              :key="key"
              closable
              @close="() => removeAnnotation(String(key))"
            >
              {{ key }}={{ value }}
            </a-tag>
          </div>
        </div>
      </a-form>
    </a-modal>

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailsModalVisible"
      title="服务账户详情"
      width="1000px"
      :footer="null"
    >
      <div v-if="selectedServiceAccount">
        <a-descriptions bordered :column="2">
          <a-descriptions-item label="名称">
            {{ selectedServiceAccount.name }}
          </a-descriptions-item>
          <a-descriptions-item label="命名空间">
            <a-tag color="blue">{{ selectedServiceAccount.namespace }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="UID">
            {{ selectedServiceAccount.uid }}
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ selectedServiceAccount.creation_timestamp }}
          </a-descriptions-item>
          <a-descriptions-item label="年龄">
            {{ selectedServiceAccount.age }}
          </a-descriptions-item>
          <a-descriptions-item label="自动挂载Token">
            <a-tag :color="selectedServiceAccount.automount_service_account_token ? 'green' : 'red'">
              {{ selectedServiceAccount.automount_service_account_token ? '启用' : '禁用' }}
            </a-tag>
          </a-descriptions-item>
        </a-descriptions>

        <a-divider orientation="left">密钥列表</a-divider>
        <a-table
          :columns="secretColumns"
          :data-source="serviceAccountDetails?.secrets || []"
          :pagination="false"
          size="small"
        />

        <a-divider orientation="left">镜像拉取密钥</a-divider>
        <a-table
          :columns="secretColumns"
          :data-source="serviceAccountDetails?.image_pull_secrets || []"
          :pagination="false"
          size="small"
        />

        <a-divider orientation="left">标签</a-divider>
        <div class="labels-display">
          <a-tag
            v-for="(value, key) in selectedServiceAccount.labels"
            :key="key"
            color="blue"
          >
            {{ key }}={{ value }}
          </a-tag>
          <span v-if="!Object.keys(selectedServiceAccount.labels || {}).length" class="text-gray">
            无标签
          </span>
        </div>

        <a-divider orientation="left">注解</a-divider>
        <div class="annotations-display">
          <a-tag
            v-for="(value, key) in selectedServiceAccount.annotations"
            :key="key"
            color="orange"
          >
            {{ key }}={{ value }}
          </a-tag>
          <span v-if="!Object.keys(selectedServiceAccount.annotations || {}).length" class="text-gray">
            无注解
          </span>
        </div>
      </div>
    </a-modal>

    <!-- Token模态框 -->
    <a-modal
      v-model:open="isTokenModalVisible"
      title="服务账户Token"
      width="800px"
      :footer="null"
    >
      <div v-if="currentToken">
        <a-form layout="vertical">
          <a-form-item label="过期时间（秒）">
            <a-input-number 
              v-model:value="tokenExpiration"
              :min="3600"
              :max="86400"
              style="width: 200px"
            />
            <a-button type="primary" @click="refreshToken" style="margin-left: 8px">
              重新生成
            </a-button>
          </a-form-item>
          
          <a-form-item label="Token">
            <a-textarea
              :value="currentToken.token"
              :rows="6"
              readonly
            />
            <div style="margin-top: 8px">
              <a-button @click="copyToken">复制Token</a-button>
              <span v-if="currentToken.expiration_timestamp" style="margin-left: 16px; color: #999">
                过期时间: {{ currentToken.expiration_timestamp }}
              </span>
            </div>
          </a-form-item>
        </a-form>
      </div>
    </a-modal>

    <!-- YAML编辑模态框 -->
    <a-modal
      v-model:open="isYamlModalVisible"
      title="YAML配置"
      width="1000px"
      @ok="handleYamlUpdate"
      @cancel="isYamlModalVisible = false"
    >
      <a-textarea
        v-model:value="yamlContent"
        placeholder="YAML内容"
        :rows="20"
        style="font-family: monospace"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import type { TableColumnsType, TableProps } from 'ant-design-vue';
import {
  UserOutlined,
  CheckCircleOutlined,
  KeyOutlined,
  ApiOutlined,
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue';

import {
  getAllClustersApi,
  getNamespacesByClusterIdApi,
  getServiceAccountListApi,
  getServiceAccountDetailsApi,
  getServiceAccountStatisticsApi,
  createServiceAccountApi,
  updateServiceAccountApi,
  deleteServiceAccountApi,
  batchDeleteServiceAccountApi,
  getServiceAccountTokenApi,
  getServiceAccountYamlApi,
  updateServiceAccountYamlApi,
  getSecretListApi,
  type ServiceAccountInfo,
  type ServiceAccountDetails,
  type ServiceAccountCreateReq,
  type ServiceAccountUpdateReq,
  type ServiceAccountStatistics,
  type ServiceAccountTokenResp,
  type SecretInfo,
} from '#/api/core';

// 集群信息类型定义（临时）
interface ClusterInfo {
  id: number;
  name: string;
  description?: string;
}

// 响应式数据
const loading = ref(false);
const clusters = ref<ClusterInfo[]>([]);
const namespaces = ref<string[]>([]);
const serviceAccountData = ref<ServiceAccountInfo[]>([]);
const selectedClusterId = ref<number>();
const selectedNamespace = ref<string>('');
const searchKeyword = ref('');
const selectedRowKeys = ref<string[]>([]);

// 统计数据
const statistics = ref<ServiceAccountStatistics>({
  total_count: 0,
  active_count: 0,
  with_secrets_count: 0,
  with_image_pull_secrets_count: 0,
  auto_mount_enabled_count: 0,
});

// 分页配置
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
});

// 模态框状态
const isCreateModalVisible = ref(false);
const isDetailsModalVisible = ref(false);
const isTokenModalVisible = ref(false);
const isYamlModalVisible = ref(false);

// 编辑状态
const editingServiceAccount = ref<ServiceAccountInfo | null>(null);
const selectedServiceAccount = ref<ServiceAccountInfo | null>(null);
const serviceAccountDetails = ref<ServiceAccountDetails | null>(null);

// Token相关
const currentToken = ref<ServiceAccountTokenResp | null>(null);
const tokenExpiration = ref(3600);

// YAML编辑
const yamlContent = ref('');

// 密钥选项
const secretOptions = ref<{ label: string; value: string }[]>([]);

// 创建表单
const createFormRef = ref();
const createForm = reactive<ServiceAccountCreateReq>({
  cluster_id: 0,
  namespace: '',
  name: '',
  labels: {},
  annotations: {},
  automount_service_account_token: true,
  image_pull_secrets: [],
});

// 标签和注解
const newLabelKey = ref('');
const newLabelValue = ref('');
const newAnnotationKey = ref('');
const newAnnotationValue = ref('');

// 表单验证规则
const createRules = {
  name: [
    { required: true, message: '请输入服务账户名称', trigger: 'blur' },
    { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: '名称只能包含小写字母、数字和连字符', trigger: 'blur' },
  ],
  namespace: [
    { required: true, message: '请选择命名空间', trigger: 'change' },
  ],
};

// 计算属性
const hasSelected = computed(() => selectedRowKeys.value.length > 0);

// 表格列定义
const columns: TableColumnsType = [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    sorter: true,
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    sorter: true,
  },
  {
    title: '自动挂载Token',
    dataIndex: 'automount_service_account_token',
    key: 'automount_token',
  },
  {
    title: '密钥数量',
    dataIndex: 'secrets_count',
    key: 'secrets_count',
    sorter: true,
  },
  {
    title: '镜像拉取密钥',
    dataIndex: 'image_pull_secrets_count',
    key: 'image_pull_secrets_count',
    sorter: true,
  },
  {
    title: '创建时间',
    dataIndex: 'creation_timestamp',
    key: 'creation_timestamp',
    sorter: true,
  },
  {
    title: '年龄',
    dataIndex: 'age',
    key: 'age',
    sorter: true,
  },
  {
    title: '操作',
    key: 'action',
    width: 300,
  },
];

// 密钥表格列
const secretColumns: TableColumnsType = [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
  },
];

// 行选择配置
const rowSelection = {
  selectedRowKeys: selectedRowKeys,
  onChange: (keys: string[]) => {
    selectedRowKeys.value = keys;
  },
};

// 方法定义
const loadClusters = async () => {
  try {
    const response = await getAllClustersApi();
    clusters.value = response || [];
    if (clusters.value.length > 0 && !selectedClusterId.value) {
      selectedClusterId.value = clusters.value[0]?.id;
      if (selectedClusterId.value) {
        await onClusterChange(selectedClusterId.value);
      }
    }
  } catch (error) {
    console.error('加载集群列表失败:', error);
    message.error('加载集群列表失败');
  }
};

const onClusterChange = async (clusterId: number) => {
  selectedClusterId.value = clusterId;
  selectedNamespace.value = '';
  await loadNamespaces();
  await loadServiceAccounts();
  await loadStatistics();
};

const loadNamespaces = async () => {
  if (!selectedClusterId.value) return;
  
  try {
    const response = await getNamespacesByClusterIdApi(selectedClusterId.value);
    namespaces.value = response || [];
  } catch (error) {
    console.error('加载命名空间列表失败:', error);
    message.error('加载命名空间列表失败');
  }
};

const loadServiceAccounts = async () => {
  if (!selectedClusterId.value) return;

  loading.value = true;
  try {
    const params = {
      cluster_id: selectedClusterId.value,
      namespace: selectedNamespace.value || undefined,
      page: pagination.current,
      page_size: pagination.pageSize,
    };

    const response = await getServiceAccountListApi(params);
    serviceAccountData.value = response || [];
    pagination.total = response.length || 0;

    // 过滤搜索
    if (searchKeyword.value) {
      serviceAccountData.value = serviceAccountData.value.filter(item =>
        item.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
      );
    }
  } catch (error) {
    console.error('加载服务账户列表失败:', error);
    message.error('加载服务账户列表失败');
  } finally {
    loading.value = false;
  }
};

const loadStatistics = async () => {
  if (!selectedClusterId.value) return;

  try {
    const response = await getServiceAccountStatisticsApi(
      selectedClusterId.value,
      selectedNamespace.value || undefined
    );
    statistics.value = response || statistics.value;
  } catch (error) {
    console.error('加载统计信息失败:', error);
  }
};

const loadSecrets = async () => {
  if (!selectedClusterId.value || !selectedNamespace.value) return;

  try {
    const response = await getSecretListApi({
      cluster_id: selectedClusterId.value,
      namespace: selectedNamespace.value,
    });
    secretOptions.value = (response || []).map((secret: SecretInfo) => ({
      label: secret.name,
      value: secret.name,
    }));
  } catch (error) {
    console.error('加载密钥列表失败:', error);
  }
};

const showCreateModal = () => {
  editingServiceAccount.value = null;
  resetCreateForm();
  isCreateModalVisible.value = true;
  loadSecrets();
};

const showEditModal = (record: ServiceAccountInfo) => {
  editingServiceAccount.value = record;
  resetCreateForm();
  
  // 填充编辑数据
  createForm.name = record.name;
  createForm.namespace = record.namespace;
  createForm.cluster_id = record.cluster_id;
  createForm.labels = { ...(record.labels || {}) };
  createForm.annotations = { ...(record.annotations || {}) };
  createForm.automount_service_account_token = record.automount_service_account_token ?? true;
  
  isCreateModalVisible.value = true;
  loadSecrets();
};

const resetCreateForm = () => {
  createForm.cluster_id = selectedClusterId.value || 0;
  createForm.namespace = selectedNamespace.value || '';
  createForm.name = '';
  createForm.labels = {};
  createForm.annotations = {};
  createForm.automount_service_account_token = true;
  createForm.image_pull_secrets = [];
  
  newLabelKey.value = '';
  newLabelValue.value = '';
  newAnnotationKey.value = '';
  newAnnotationValue.value = '';
};

const addLabel = () => {
  if (newLabelKey.value && newLabelValue.value) {
    if (!createForm.labels) createForm.labels = {};
    createForm.labels[newLabelKey.value] = newLabelValue.value;
    newLabelKey.value = '';
    newLabelValue.value = '';
  }
};

const removeLabel = (key: string) => {
  if (createForm.labels) {
    delete createForm.labels[key];
  }
};

const addAnnotation = () => {
  if (newAnnotationKey.value && newAnnotationValue.value) {
    if (!createForm.annotations) createForm.annotations = {};
    createForm.annotations[newAnnotationKey.value] = newAnnotationValue.value;
    newAnnotationKey.value = '';
    newAnnotationValue.value = '';
  }
};

const removeAnnotation = (key: string) => {
  if (createForm.annotations) {
    delete createForm.annotations[key];
  }
};

const handleCreateOrUpdate = async () => {
  try {
    await createFormRef.value?.validate();
    
    if (editingServiceAccount.value) {
      // 编辑
      const updateData: ServiceAccountUpdateReq = {
        cluster_id: createForm.cluster_id,
        namespace: createForm.namespace,
        name: createForm.name,
        labels: createForm.labels,
        annotations: createForm.annotations,
        automount_service_account_token: createForm.automount_service_account_token,
        image_pull_secrets: createForm.image_pull_secrets,
      };
      
      await updateServiceAccountApi(updateData);
      message.success('服务账户更新成功');
    } else {
      // 创建
      await createServiceAccountApi(createForm);
      message.success('服务账户创建成功');
    }
    
    isCreateModalVisible.value = false;
    await loadServiceAccounts();
    await loadStatistics();
  } catch (error) {
    console.error('操作失败:', error);
    message.error(editingServiceAccount.value ? '更新失败' : '创建失败');
  }
};

const handleCreateCancel = () => {
  isCreateModalVisible.value = false;
  resetCreateForm();
};

const handleDelete = async (record: ServiceAccountInfo) => {
  try {
    await deleteServiceAccountApi({
      cluster_id: record.cluster_id,
      namespace: record.namespace,
      name: record.name,
    });
    message.success('服务账户删除成功');
    await loadServiceAccounts();
    await loadStatistics();
  } catch (error) {
    console.error('删除失败:', error);
    message.error('删除失败');
  }
};

const handleBatchDelete = async () => {
  if (!selectedClusterId.value || selectedRowKeys.value.length === 0) return;

  try {
    // 需要按命名空间分组批量删除ServiceAccount
    const groupedByNamespace = selectedRowKeys.value.reduce((acc, name) => {
      const item = serviceAccountData.value.find(sa => sa.name === name);
      if (item && item.namespace) {
        if (!acc[item.namespace]) acc[item.namespace] = [];
        acc[item.namespace]?.push(name);
      }
      return acc;
    }, {} as Record<string, string[]>);
    
    for (const [namespace, names] of Object.entries(groupedByNamespace)) {
      await batchDeleteServiceAccountApi({
        cluster_id: selectedClusterId.value,
        namespace,
        names,
      });
    }

    message.success(`成功删除 ${selectedRowKeys.value.length} 个服务账户`);
    selectedRowKeys.value = [];
    await loadServiceAccounts();
    await loadStatistics();
  } catch (error) {
    console.error('批量删除失败:', error);
    message.error('批量删除失败');
  }
};

const showDetails = async (record: ServiceAccountInfo) => {
  selectedServiceAccount.value = record;
  
  try {
    const response = await getServiceAccountDetailsApi(
      record.cluster_id,
      record.namespace,
      record.name
    );
    serviceAccountDetails.value = response;
    isDetailsModalVisible.value = true;
  } catch (error) {
    console.error('获取详情失败:', error);
    message.error('获取详情失败');
  }
};

const getToken = async (record: ServiceAccountInfo) => {
  try {
    const response = await getServiceAccountTokenApi({
      cluster_id: record.cluster_id,
      namespace: record.namespace,
      name: record.name,
      expiration_seconds: tokenExpiration.value,
    });
    currentToken.value = response;
    selectedServiceAccount.value = record;
    isTokenModalVisible.value = true;
  } catch (error) {
    console.error('获取Token失败:', error);
    message.error('获取Token失败');
  }
};

const refreshToken = async () => {
  if (!selectedServiceAccount.value) return;
  await getToken(selectedServiceAccount.value);
};

const copyToken = async () => {
  if (!currentToken.value?.token) return;
  
  try {
    await navigator.clipboard.writeText(currentToken.value.token);
    message.success('Token已复制到剪贴板');
  } catch (error) {
    console.error('复制失败:', error);
    message.error('复制失败');
  }
};

const showYamlModal = async (record: ServiceAccountInfo) => {
  try {
    const response = await getServiceAccountYamlApi(
      record.cluster_id,
      record.namespace,
      record.name
    );
    yamlContent.value = response.yaml;
    selectedServiceAccount.value = record;
    isYamlModalVisible.value = true;
  } catch (error) {
    console.error('获取YAML失败:', error);
    message.error('获取YAML失败');
  }
};

const handleYamlUpdate = async () => {
  if (!selectedServiceAccount.value) return;

  try {
    await updateServiceAccountYamlApi(
      selectedServiceAccount.value.cluster_id,
      selectedServiceAccount.value.namespace,
      selectedServiceAccount.value.name,
      yamlContent.value
    );
    message.success('YAML更新成功');
    isYamlModalVisible.value = false;
    await loadServiceAccounts();
  } catch (error) {
    console.error('YAML更新失败:', error);
    message.error('YAML更新失败');
  }
};

const handleTableChange: TableProps['onChange'] = (pag) => {
  if (pag) {
    pagination.current = pag.current || 1;
    pagination.pageSize = pag.pageSize || 10;
  }
  loadServiceAccounts();
};

// 生命周期
onMounted(() => {
  loadClusters();
});
</script>

<style scoped>
.k8s-serviceaccount-container {
  padding: 24px;
}

.overview-cards {
  margin-bottom: 24px;
}

.toolbar {
  margin-bottom: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.labels-section, .annotations-section {
  margin-top: 16px;
}

.labels-list, .annotations-list {
  margin-top: 8px;
}

.labels-list .ant-tag, .annotations-list .ant-tag {
  margin-bottom: 8px;
}

.labels-display, .annotations-display {
  min-height: 32px;
  padding: 8px 0;
}

.labels-display .ant-tag, .annotations-display .ant-tag {
  margin-bottom: 8px;
}

.text-gray {
  color: #999;
}

.form-help {
  margin-top: 4px;
  font-size: 12px;
  color: #999;
}

:deep(.ant-table-tbody > tr > td) {
  padding: 12px 16px;
}

:deep(.ant-descriptions-item-label) {
  font-weight: 600;
}
</style>
