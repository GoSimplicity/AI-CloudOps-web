<template>
  <div class="cluster-management-container namespace-management-container">
    <!-- 页面头部 -->
    <K8sPageHeader
      title="命名空间管理"
      subtitle="管理和监控集群中的所有命名空间资源"
      :title-icon="AppstoreOutlined"
      @refresh="refreshData"
      :loading="loading"
    >
      <template #actions>
        <a-button type="primary" @click="isCreateModalVisible = true">
          <template #icon><PlusOutlined /></template>
          创建命名空间
        </a-button>
        <a-button @click="refreshData" :loading="loading">
          <template #icon><ReloadOutlined /></template>
          刷新数据
        </a-button>
      </template>
    </K8sPageHeader>

    <!-- 概览卡片 -->
    <K8sOverviewCards :cards="overviewCards" />

    <!-- 操作工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <K8sClusterSelector
          v-model:value="selectedCluster"
          :clusters="runningClusters"
          :loading="clustersLoading"
          @change="handleClusterChange"
          placeholder="选择集群"
        />

        <a-select v-model:value="statusFilter" placeholder="状态筛选" class="env-filter" allow-clear
          @change="handleFilterChange">
          <template #suffixIcon>
            <FilterOutlined />
          </template>
          <a-select-option value="Active">Active</a-select-option>
          <a-select-option value="Terminating">Terminating</a-select-option>
        </a-select>

        <a-input-search v-model:value="searchText" placeholder="搜索命名空间名称" class="search-input" @search="onSearch"
          allow-clear />
      </div>

      <div class="toolbar-right">
        <div class="page-size-selector">
          <span class="selector-label">每页显示:</span>
          <a-select v-model:value="pageSize" size="small" style="width: 80px" @change="handlePageSizeChange">
            <a-select-option :value="10">10</a-select-option>
            <a-select-option :value="20">20</a-select-option>
            <a-select-option :value="30">30</a-select-option>
            <a-select-option :value="50">50</a-select-option>
          </a-select>
        </div>

        <a-button @click="refreshData" :loading="loading">
          <template #icon>
            <ReloadOutlined />
          </template>
        </a-button>



        <a-button type="primary" danger @click="handleBatchDelete" :disabled="!selectedRows.length"
          v-if="selectedRows.length > 0">
          <template #icon>
            <DeleteOutlined />
          </template>
          删除 ({{ selectedRows.length }})
        </a-button>
      </div>
    </div>

    <!-- 数据展示区域 -->
    <div class="data-display">
      <div class="display-header" v-if="filteredNamespaces.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ totalItems }} 个命名空间，当前显示 {{ filteredNamespaces.length }} 个</span>
          <div class="env-tags">
            <a-tag color="green">活跃 {{ activeNamespaces }}</a-tag>
            <a-tag color="blue">当前页 {{ namespaces.length }}</a-tag>
          </div>
        </div>
      </div>

      <!-- 表格视图 -->
      <a-table :columns="columns" :data-source="filteredNamespaces"
        :row-selection="rowSelection" :loading="loading" row-key="uid"         :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: totalItems,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: number[]) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['10', '20', '30', '50']
        }" @change="handleTableChange" class="cluster-table namespaces-table">
        <!-- 命名空间名称列 -->
        <template #name="{ text }">
          <div class="cluster-name namespace-name">
            <AppstoreOutlined />
            <span>{{ text }}</span>
            <a-tag v-if="text === 'kube-system'" color="red" size="small">系统</a-tag>
            <a-tag v-if="text === 'default'" color="blue" size="small">默认</a-tag>
          </div>
        </template>

        <!-- 状态列 -->
        <template #status="{ text }">
          <a-badge :status="text === 'Active' ? 'success' : 'processing'" :text="text" class="status-badge" />
        </template>

        <!-- 标签列 -->
        <template #labels="{ record }">
          <div class="labels-container">
            <a-tag v-for="label in record.labels?.slice(0, 2)" :key="label" color="geekblue" size="small"
              class="label-tag">
              {{ label }}
            </a-tag>
            <a-tag v-if="record.labels && record.labels.length > 2" color="default" size="small"
              @click="viewLabels(record)" class="more-tag">
              +{{ record.labels.length - 2 }}
            </a-tag>
          </div>
        </template>

                <!-- 阶段列 -->
        <template #phase="{ record }">
          <div class="timestamp">
            <ClockCircleOutlined />
            <span>{{ record.phase || '-' }}</span>
          </div>
        </template>

        <!-- 操作列 -->
        <template #action="{ record }">
          <div class="action-column">
            <a-tooltip title="查看详情">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewDetails(record)">
                <template #icon>
                  <EyeOutlined />
                </template>
              </a-button>
            </a-tooltip>



            <a-tooltip title="编辑">
              <a-button type="primary" ghost shape="circle" size="small" @click="handleEdit(record)">
                <template #icon>
                  <EditOutlined />
                </template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="删除">
              <a-popconfirm title="确定要删除该命名空间吗?" description="删除命名空间将删除其中的所有资源，此操作不可撤销！" @confirm="handleDelete(record)"
                ok-text="确定" cancel-text="取消" :disabled="isSystemNamespace(record.name)">
                <a-button type="primary" danger ghost shape="circle" size="small"
                  :disabled="isSystemNamespace(record.name)">
                  <template #icon>
                    <DeleteOutlined />
                  </template>
                </a-button>
              </a-popconfirm>
            </a-tooltip>
          </div>
        </template>

        <!-- 空状态 -->
        <template #emptyText>
          <div class="empty-state">
            <AppstoreOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
            <p>暂无命名空间数据</p>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建命名空间模态框 -->
    <a-modal v-model:open="isCreateModalVisible" title="创建命名空间" @ok="handleCreateConfirm" @cancel="handleCreateCancel"
      :confirmLoading="loading" class="cluster-modal namespace-modal" width="700px">
      <a-alert class="modal-alert" type="info" show-icon>
        <template #message>创建新的命名空间</template>
        <template #description>命名空间用于逻辑隔离Kubernetes资源</template>
      </a-alert>

      <a-form 
        ref="createFormRef"
        :model="createForm" 
        layout="vertical" 
        class="cluster-form namespace-form"
        :rules="createFormRules"
      >
        <a-form-item label="命名空间名称" name="namespace">
          <a-input v-model:value="createForm.namespace" placeholder="请输入命名空间名称" class="form-input">
            <template #prefix>
              <AppstoreOutlined />
            </template>
          </a-input>
        </a-form-item>

        <a-form-item label="标签 (可选)">
          <div class="key-value-inputs">
            <div v-for="(entry, index) in createForm.labelEntries" :key="index" class="key-value-row">
              <a-input v-model:value="entry.key" placeholder="键" style="width: 40%" class="form-input" />
              <a-input v-model:value="entry.value" placeholder="值" style="width: 40%" class="form-input" />
              <a-button v-if="createForm.labelEntries.length > 1" type="text" danger @click="removeLabelEntry(index)"
                style="width: 15%">
                删除
              </a-button>
              <a-button v-else type="text" @click="addLabelEntry" style="width: 15%">
                添加
              </a-button>
            </div>
            <a-button v-if="createForm.labelEntries.length > 1" type="dashed" @click="addLabelEntry"
              style="width: 100%; margin-top: 8px">
              <template #icon>
                <PlusOutlined />
              </template>
              添加标签
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="注解 (可选)">
          <div class="key-value-inputs">
            <div v-for="(entry, index) in createForm.annotationEntries" :key="index" class="key-value-row">
              <a-input v-model:value="entry.key" placeholder="键" style="width: 40%" class="form-input" />
              <a-input v-model:value="entry.value" placeholder="值" style="width: 40%" class="form-input" />
              <a-button v-if="createForm.annotationEntries.length > 1" type="text" danger
                @click="removeAnnotationEntry(index)" style="width: 15%">
                删除
              </a-button>
              <a-button v-else type="text" @click="addAnnotationEntry" style="width: 15%">
                添加
              </a-button>
            </div>
            <a-button v-if="createForm.annotationEntries.length > 1" type="dashed" @click="addAnnotationEntry"
              style="width: 100%; margin-top: 8px">
              <template #icon>
                <PlusOutlined />
              </template>
              添加注解
            </a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑命名空间模态框 -->
    <a-modal v-model:open="editModalVisible" title="编辑命名空间" @ok="handleEditConfirm" @cancel="handleEditCancel"
      :confirmLoading="loading" class="cluster-modal namespace-modal" width="700px">
      <a-alert v-if="currentNamespace" class="modal-alert" type="info" show-icon>
        <template #message>编辑命名空间: {{ currentNamespace.name }}</template>
        <template #description>修改命名空间的标签和注解</template>
      </a-alert>

      <a-form 
        ref="editFormRef"
        :model="editForm" 
        layout="vertical" 
        class="cluster-form namespace-form"
      >
        <a-form-item label="命名空间名称">
          <a-input :value="currentNamespace?.name" disabled class="form-input disabled">
            <template #prefix>
              <AppstoreOutlined />
            </template>
          </a-input>
        </a-form-item>

        <a-form-item label="标签">
          <div class="key-value-inputs">
            <div v-for="(entry, index) in editForm.labelEntries" :key="index" class="key-value-row">
              <a-input v-model:value="entry.key" placeholder="键" style="width: 40%" class="form-input" />
              <a-input v-model:value="entry.value" placeholder="值" style="width: 40%" class="form-input" />
              <a-button type="text" danger @click="removeEditLabelEntry(index)" style="width: 15%">
                删除
              </a-button>
            </div>
            <a-button type="dashed" @click="addEditLabelEntry" style="width: 100%; margin-top: 8px">
              <template #icon>
                <PlusOutlined />
              </template>
              添加标签
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="注解">
          <div class="key-value-inputs">
            <div v-for="(entry, index) in editForm.annotationEntries" :key="index" class="key-value-row">
              <a-input v-model:value="entry.key" placeholder="键" style="width: 40%" class="form-input" />
              <a-input v-model:value="entry.value" placeholder="值" style="width: 40%" class="form-input" />
              <a-button type="text" danger @click="removeEditAnnotationEntry(index)" style="width: 15%">
                删除
              </a-button>
            </div>
            <a-button type="dashed" @click="addEditAnnotationEntry" style="width: 100%; margin-top: 8px">
              <template #icon>
                <PlusOutlined />
              </template>
              添加注解
            </a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 命名空间详情模态框 -->
    <a-modal v-model:open="detailsModalVisible" title="命名空间详情" width="900px" :footer="null"
      class="cluster-modal namespace-detail-modal">
      <a-spin :spinning="detailsLoading">
        <div v-if="currentNamespace" class="namespace-details">
          <a-alert class="modal-alert" type="info" show-icon>
            <template #message>{{ currentNamespace.name }}</template>
            <template #description>
              状态: {{ currentNamespace.status || '-' }} | 阶段: {{ currentNamespace.phase || '-' }}
            </template>
          </a-alert>

          <a-tabs default-active-key="1">
            <a-tab-pane key="1" tab="基本信息">
              <div class="details-grid">
                <div class="detail-card">
                  <h4>
                    <AppstoreOutlined /> 基本信息
                  </h4>
                  <div class="detail-item">
                    <div class="detail-label">名称:</div>
                    <div class="detail-value">{{ currentNamespace.name }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">状态:</div>
                    <div class="detail-value">
                      <a-badge :status="currentNamespace.status === 'Active' ? 'success' : 'processing'"
                        :text="currentNamespace.status" />
                    </div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">阶段:</div>
                    <div class="detail-value">{{ currentNamespace.phase || '-' }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">UID:</div>
                    <div class="detail-value">{{ currentNamespace.uid }}</div>
                  </div>
                </div>
              </div>
            </a-tab-pane>

            <a-tab-pane key="2" tab="标签和注解">
              <div class="details-grid">
                <div class="detail-card">
                  <div class="card-header">
                    <h4>
                      <TagOutlined /> 标签
                    </h4>
                    <a-button type="primary" size="small" @click="handleEdit(currentNamespace)">
                      <template #icon>
                        <EditOutlined />
                      </template>
                      编辑
                    </a-button>
                  </div>
                  <div class="labels-list">
                    <a-empty v-if="!currentNamespace.labels?.length" description="暂无标签" />
                    <a-tag v-for="label in currentNamespace.labels" :key="label" color="blue" class="label-tag">
                      {{ label }}
                    </a-tag>
                  </div>
                </div>

                <div class="detail-card">
                  <h4>
                    <InfoCircleOutlined /> 注解
                  </h4>
                  <div class="annotations-list">
                    <a-empty v-if="!currentNamespace.annotations?.length" description="暂无注解" />
                    <div v-for="annotation in currentNamespace.annotations" :key="annotation" class="annotation-item">
                      <div class="annotation-key">{{ annotation.split('=')[0] }}</div>
                      <div class="annotation-value">{{ annotation.split('=')[1] || '-' }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </a-tab-pane>


          </a-tabs>

          <div class="modal-footer">
            <a-space>
              <a-button @click="detailsModalVisible = false">关闭</a-button>
              <a-button type="primary" ghost @click="handleEdit(currentNamespace)">
                <template #icon>
                  <EditOutlined />
                </template>
                编辑
              </a-button>

            </a-space>
          </div>
        </div>
      </a-spin>
    </a-modal>


  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch, h } from 'vue';
import { message, Modal } from 'ant-design-vue';
import {
  K8sPageHeader,
  K8sOverviewCards,
  K8sClusterSelector,
  // K8sStatusTag
} from './components';
import {
  getNamespacesListApi,
  createNamespaceApi,
  deleteNamespaceApi,
  getNamespaceDetailsApi,
  updateNamespaceApi
} from '#/api/core/k8s/k8s_namespace';
import {
  getClustersListApi,
  ClusterStatus,
  type K8sCluster,
  type KeyValueList,
  type KeyValue
} from '#/api/core/k8s/k8s_cluster';

// 本地类型定义（用于页面显示）
interface NamespaceDetails {
  name: string;
  uid?: string;
  status?: string;
  phase?: string;
  labels?: string[];
  annotations?: string[];
  cluster_id: number;
}


import {
  // CloudServerOutlined,
  AppstoreOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ClusterOutlined,
  FilterOutlined,
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TagOutlined,
  InfoCircleOutlined,
  DeploymentUnitOutlined
} from '@ant-design/icons-vue';

// 添加概览卡片的计算属性
const overviewCards = computed(() => [
  {
    label: '命名空间总数',
    value: totalItems.value,
    icon: AppstoreOutlined,
    type: 'total'
  },
  {
    label: '活跃状态',
    value: activeNamespaces.value,
    icon: CheckCircleOutlined,
    type: 'running'
  },
  {
    label: '当前页数量',
    value: namespaces.value.length,
    icon: DeploymentUnitOutlined,
    type: 'warning'
  },
  {
    label: '当前集群',
    value: clusters.value.find(c => c.id === selectedCluster.value)?.name || '-',
    icon: ClusterOutlined,
    type: 'total'
  }
]);

// 基本状态变量
const loading = ref(false);
const clustersLoading = ref(false);
const detailsLoading = ref(false);
const namespaces = ref<NamespaceDetails[]>([]);
const searchText = ref('');
const statusFilter = ref<string>();
const selectedRows = ref<NamespaceDetails[]>([]);
const detailsModalVisible = ref(false);
const isCreateModalVisible = ref(false);
const editModalVisible = ref(false);
const clusters = ref<K8sCluster[]>([]);
const selectedCluster = ref<number>();
const currentNamespace = ref<NamespaceDetails | null>(null);
const currentPage = ref(1);
const pageSize = ref(10);
const totalItems = ref(0);

// 表单引用
const createFormRef = ref();
const editFormRef = ref();

// 表单状态
const createForm = ref<{
  namespace: string;
  labelEntries: Array<{ key: string; value: string }>;
  annotationEntries: Array<{ key: string; value: string }>;
}>({
  namespace: '',
  labelEntries: [{ key: '', value: '' }],
  annotationEntries: [{ key: '', value: '' }]
});

const editForm = ref<{
  namespace: string;
  labelEntries: Array<{ key: string; value: string }>;
  annotationEntries: Array<{ key: string; value: string }>;
}>({
  namespace: '',
  labelEntries: [{ key: '', value: '' }],
  annotationEntries: [{ key: '', value: '' }]
});



// 表单验证规则
const createFormRules = {
  namespace: [
    { required: true, message: '请输入命名空间名称', trigger: 'blur' },
    { 
      pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, 
      message: '名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', 
      trigger: 'blur' 
    },
    {
      min: 1,
      max: 63,
      message: '命名空间名称长度应在 1-63 个字符之间',
      trigger: 'blur'
    },
    {
      validator: async (_rule: any, value: string) => {
        if (!value) return Promise.resolve();
        // 检查是否与系统命名空间冲突
        const systemNs = ['kube-system', 'kube-public', 'kube-node-lease', 'kubernetes-dashboard'];
        if (systemNs.includes(value)) {
          return Promise.reject('不能使用系统保留的命名空间名称');
        }
        // 检查是否已存在（简单检查当前列表）
        const exists = namespaces.value.some(ns => ns.name === value);
        if (exists) {
          return Promise.reject('命名空间名称已存在');
        }
        return Promise.resolve();
      },
      trigger: 'blur'
    }
  ]
};



// 监听搜索和筛选变化，重置分页并重新获取数据
watch([searchText, statusFilter], () => {
  currentPage.value = 1;
  // 使用防抖，避免频繁请求
  clearTimeout((window as any).searchTimeout);
  (window as any).searchTimeout = setTimeout(() => {
    getNamespaces();
  }, 300);
});

// 表格列配置
const columns = [
  {
    title: '命名空间名称',
    dataIndex: 'name',
    key: 'name',
    slots: { customRender: 'name' },
    width: '20%',
    sorter: (a: NamespaceDetails, b: NamespaceDetails) => a.name.localeCompare(b.name),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: '12%',
    slots: { customRender: 'status' },
    sorter: (a: NamespaceDetails, b: NamespaceDetails) => (a.status || '').localeCompare(b.status || ''),
  },
  {
    title: '标签',
    dataIndex: 'labels',
    key: 'labels',
    width: '25%',
    slots: { customRender: 'labels' },
  },
  {
    title: '阶段',
    dataIndex: 'phase',
    key: 'phase',
    width: '15%',
    slots: { customRender: 'phase' },
    sorter: (a: NamespaceDetails, b: NamespaceDetails) => (a.phase || '').localeCompare(b.phase || ''),
  },
  {
    title: '操作',
    key: 'action',
    width: '18%',
    fixed: 'right',
    slots: { customRender: 'action' },
  },
];

// 计算属性 - 由于现在使用真实分页，这里只需要返回当前数据
const filteredNamespaces = computed(() => {
  return namespaces.value;
});

// 活跃命名空间数量 - 由于使用分页，这里显示当前页面的活跃数量
const activeNamespaces = computed(() =>
  namespaces.value.filter(ns => ns.status === 'Active').length
);



const runningClusters = computed(() =>
  clusters.value.filter(cluster => cluster.status === ClusterStatus.Running)
);

// 表格选择配置
const rowSelection = {
  onChange: (_: string[], selectedRowsData: NamespaceDetails[]) => {
    selectedRows.value = selectedRowsData;
  },
  getCheckboxProps: (record: NamespaceDetails) => ({
    disabled: isSystemNamespace(record.name),
  }),
};

// 判断是否是系统命名空间
const isSystemNamespace = (name: string) => {
  const systemNamespaces = ['kube-system', 'kube-public', 'kube-node-lease'];
  return systemNamespaces.includes(name);
};

// 验证集群状态
const validateClusterStatus = (): boolean => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return false;
  }

  const currentCluster = clusters.value.find(c => c.id === selectedCluster.value);
  if (!currentCluster) {
    message.error('未找到指定的集群');
    return false;
  }

  if (currentCluster.status !== ClusterStatus.Running) {
    message.error(`集群状态为 ${getClusterStatusText(currentCluster.status)}，无法执行操作`);
    return false;
  }

  return true;
};

// 获取集群状态文本
const getClusterStatusText = (status: ClusterStatus): string => {
  switch (status) {
    case ClusterStatus.Running:
      return '运行中';
    case ClusterStatus.Stopped:
      return '已停止';
    case ClusterStatus.Error:
      return '异常';
    default:
      return '未知状态';
  }
};

// 验证键值对格式
const validateKeyValuePairs = (pairs: KeyValueList, type: string): string | null => {
  // DNS 子域名格式正则
  const labelKeyRegex = /^([a-z0-9]([a-z0-9\-]*[a-z0-9])?\.)*[a-z0-9]([a-z0-9\-]*[a-z0-9])?$/;
  const labelValueRegex = /^[a-z0-9A-Z]([a-z0-9A-Z\-_\.]*[a-z0-9A-Z])?$/;
  
  for (const pair of pairs) {
    // 检查键格式
    if (!labelKeyRegex.test(pair.key)) {
      return `${type}键 "${pair.key}" 格式不正确，应符合DNS子域名规范`;
    }
    // 检查键长度
    if (pair.key.length > 253) {
      return `${type}键 "${pair.key}" 过长，最大长度为253字符`;
    }
    // 检查值长度
    if (pair.value.length > 63) {
      return `${type}值 "${pair.value}" 过长，最大长度为63字符`;
    }
    // 检查值格式（如果不为空）
    if (pair.value && !labelValueRegex.test(pair.value)) {
      return `${type}值 "${pair.value}" 格式不正确`;
    }
  }
  return null;
};




// 获取集群列表 - 分页获取所有可用集群
const getClusters = async () => {
  clustersLoading.value = true;
  try {
    let allClusters: K8sCluster[] = [];
    let currentPage = 1;
    const pageSize = 50; // 每页获取50个集群
    let hasMoreData = true;

    // 分页获取所有集群
    while (hasMoreData) {
      const res = await getClustersListApi({
        page: currentPage,
        size: pageSize,
      });
      
      // 处理响应数据
      let pageItems: K8sCluster[] = [];
      let totalCount = 0;
      
      if (res && res.items && Array.isArray(res.items)) {
        pageItems = res.items;
        totalCount = res.total || res.items.length;
      } else if (Array.isArray(res)) {
        pageItems = res;
        totalCount = res.length;
        hasMoreData = false; // 如果直接返回数组，说明没有分页
      } else if (res && res.data) {
        if (Array.isArray(res.data)) {
          pageItems = res.data;
          totalCount = res.total || res.data.length;
          hasMoreData = false;
        } else if (res.data.items && Array.isArray(res.data.items)) {
          pageItems = res.data.items;
          totalCount = res.data.total || res.data.items.length;
        }
      }
      
      allClusters.push(...pageItems);
      
      // 检查是否还有更多数据
      if (pageItems.length < pageSize || allClusters.length >= totalCount) {
        hasMoreData = false;
      } else {
        currentPage++;
      }
      
      // 防止无限循环，最多获取10页
      if (currentPage > 10) {
        console.warn('集群数据过多，已达到最大获取页数限制');
        break;
      }
    }
    
    clusters.value = allClusters;
    console.log(`成功获取 ${allClusters.length} 个集群`);
    
    // 过滤出运行中的集群
    const runningClusters = clusters.value.filter(cluster => cluster.status === ClusterStatus.Running);
    
    if (runningClusters.length === 0) {
      message.warning('当前没有运行中的集群，无法管理命名空间');
      return;
    }
    
    // 智能选择集群
    if (!selectedCluster.value || !runningClusters.find(c => c.id === selectedCluster.value)) {
      selectedCluster.value = runningClusters[0]?.id;
      if (selectedCluster.value) {
        await getNamespaces();
      }
    }
  } catch (error: any) {
    console.error('获取集群列表失败:', error);
    message.error(error.message || '获取集群列表失败');
    clusters.value = [];
  } finally {
    clustersLoading.value = false;
  }
};

// 获取命名空间列表
const getNamespaces = async () => {
  if (!validateClusterStatus()) {
    return;
  }

  loading.value = true;
  try {
    // 构建查询参数，确保所有分页参数都正确传递
    const params: any = {
      page: currentPage.value,
      size: pageSize.value,
      cluster_id: selectedCluster.value!,
    };

    // 只有当搜索文本不为空时才添加搜索参数
    if (searchText.value && searchText.value.trim()) {
      params.search = searchText.value.trim();
    }

    // 只有当状态筛选不为空时才添加状态参数
    if (statusFilter.value) {
      params.status = statusFilter.value;
    }

    console.log('获取命名空间列表参数:', params); // 调试日志

    const res = await getNamespacesListApi(selectedCluster.value!, params);

    // 处理返回的数据 - 支持多种响应格式
    const namespaceDetails: NamespaceDetails[] = [];
    let responseItems: any[] = [];
    let responseTotal = 0;

    console.log('命名空间API响应:', res); // 调试日志

    // 处理不同的响应格式
    if (res) {
      // 标准格式：{ items: [], total: number }
      if (res.items && Array.isArray(res.items)) {
        responseItems = res.items;
        responseTotal = res.total || res.items.length;
      }
      // 直接是数组格式
      else if (Array.isArray(res)) {
        responseItems = res;
        responseTotal = res.length;
      }
      // 包含 data 字段的格式
      else if (res.data) {
        if (Array.isArray(res.data)) {
          responseItems = res.data;
          responseTotal = res.total || res.data.length;
        } else if (res.data.items && Array.isArray(res.data.items)) {
          responseItems = res.data.items;
          responseTotal = res.data.total || res.data.items.length;
        }
      }
    }

    console.log(`处理命名空间数据: ${responseItems.length} 个命名空间，总数: ${responseTotal}`); // 调试日志

    // 转换数据格式
    for (const ns of responseItems) {
      namespaceDetails.push({
        name: ns.name,
        uid: ns.uid || `${ns.name}-${Date.now()}`,
        status: ns.status || 'Active',
        phase: ns.phase,
        labels: ns.labels?.map((label: any) => `${label.key}=${label.value}`).filter(Boolean) || [],
        annotations: ns.annotations?.map((annotation: any) => `${annotation.key}=${annotation.value}`).filter(Boolean) || [],
        cluster_id: ns.cluster_id
      });
    }

    namespaces.value = namespaceDetails;
    totalItems.value = responseTotal;
    selectedRows.value = [];
  } catch (error: any) {
    message.error(error.message || '获取命名空间列表失败');
    namespaces.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

// 刷新数据
const refreshData = () => {
  getNamespaces();
};

// 搜索处理 - 实时搜索，重置分页
const onSearch = () => {
  currentPage.value = 1;
  getNamespaces();
};

// 筛选处理 - 状态筛选变化时重新获取数据
const handleFilterChange = () => {
  currentPage.value = 1;
  getNamespaces();
};



const handleBatchDelete = () => {
  if (!selectedRows.value.length) {
    message.warning('请先选择要删除的命名空间');
    return;
  }
  
  if (!validateClusterStatus()) {
    return;
  }

  // 检查是否包含系统命名空间
  const systemNamespaces = selectedRows.value.filter(ns => isSystemNamespace(ns.name));
  if (systemNamespaces.length > 0) {
    message.error(`无法删除系统命名空间: ${systemNamespaces.map(ns => ns.name).join(', ')}`);
    return;
  }

  Modal.confirm({
    title: `确定要删除选中的 ${selectedRows.value.length} 个命名空间吗?`,
    content: h('div', [
      h('p', { style: 'margin-bottom: 8px; color: #ff4d4f; font-weight: 500;' }, '⚠️ 危险操作警告'),
      h('p', { style: 'margin-bottom: 8px;' }, '删除命名空间将同时删除其中的所有资源，包括：'),
      h('ul', { style: 'margin: 8px 0; padding-left: 20px; color: #666;' }, [
        h('li', 'Pods、Deployments、Services等工作负载'),
        h('li', 'ConfigMaps、Secrets等配置资源'),
        h('li', 'PersistentVolumeClaims等存储资源')
      ]),
      h('p', { style: 'margin-top: 12px; font-weight: 500; color: #ff4d4f;' }, '此操作不可撤销，请谨慎操作！')
    ]),
    okText: '我已了解风险，确认删除',
    cancelText: '取消操作',
    okType: 'danger',
    width: 500,
    async onOk() {
      try {
        loading.value = true;
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        // 逐个删除命名空间
        for (const ns of selectedRows.value) {
          try {
            await deleteNamespaceApi(selectedCluster.value!, ns.name);
            successCount++;
          } catch (error: any) {
            errorCount++;
            errors.push(`${ns.name}: ${error.message || '删除失败'}`);
          }
        }

        // 显示结果
        if (successCount > 0 && errorCount === 0) {
          message.success(`成功删除 ${successCount} 个命名空间`);
        } else if (successCount > 0 && errorCount > 0) {
          message.warning(`成功删除 ${successCount} 个，失败 ${errorCount} 个命名空间`);
          console.error('删除失败的命名空间:', errors);
        } else {
          message.error('批量删除失败');
          console.error('删除错误:', errors);
        }

        selectedRows.value = [];
        await getNamespaces();
      } catch (error: any) {
        message.error(error.message || '批量删除操作失败');
      } finally {
        loading.value = false;
      }
    }
  });
};

// 查看详情
const viewDetails = async (namespace: NamespaceDetails) => {
  if (!validateClusterStatus()) return;
  
  detailsLoading.value = true;
  try {
    const details = await getNamespaceDetailsApi(selectedCluster.value!, namespace.name);
    
    currentNamespace.value = {
      name: details.name,
      uid: details.uid,
      status: details.status,
      phase: details.phase,
      labels: details.labels?.map((label: KeyValue) => `${label.key}=${label.value}`).filter(Boolean) || [],
      annotations: details.annotations?.map((annotation: KeyValue) => `${annotation.key}=${annotation.value}`).filter(Boolean) || [],
      cluster_id: details.cluster_id
    };
    
    detailsModalVisible.value = true;
  } catch (error: any) {
    console.error('获取命名空间详情失败:', error);
    message.error(error.message || '获取命名空间详情失败');
    // 如果获取详情失败，使用列表中的基本信息
    currentNamespace.value = namespace;
    detailsModalVisible.value = true;
  } finally {
    detailsLoading.value = false;
  }
};

// 查看标签
const viewLabels = async (namespace: NamespaceDetails) => {
  if (!validateClusterStatus()) return;
  
  try {
    // 使用 getNamespaceDetailsApi 获取详细信息
    const details = await getNamespaceDetailsApi(selectedCluster.value!, namespace.name);
    
    // 更新当前命名空间信息为详细数据
    currentNamespace.value = {
      name: details.name,
      uid: details.uid,
      status: details.status,
      phase: details.phase,
      labels: details.labels?.map((label: KeyValue) => `${label.key}=${label.value}`).filter(Boolean) || [],
      annotations: details.annotations?.map((annotation: KeyValue) => `${annotation.key}=${annotation.value}`).filter(Boolean) || [],
      cluster_id: details.cluster_id
    };
    
    detailsModalVisible.value = true;
  } catch (error: any) {
    console.error('获取命名空间详情失败:', error);
    message.error(error.message || '获取命名空间详情失败');
    // 如果获取详情失败，使用列表中的基本信息
    currentNamespace.value = namespace;
    detailsModalVisible.value = true;
  }
};



// 编辑命名空间
const handleEdit = async (namespace: NamespaceDetails) => {
  if (!validateClusterStatus()) return;
  
  try {
    // 使用 getNamespaceDetailsApi 获取最新详细信息
    const details = await getNamespaceDetailsApi(selectedCluster.value!, namespace.name);
    
    // 更新当前命名空间信息
    currentNamespace.value = {
      name: details.name,
      uid: details.uid,
      status: details.status,
      phase: details.phase,
      labels: details.labels?.map((label: KeyValue) => `${label.key}=${label.value}`).filter(Boolean) || [],
      annotations: details.annotations?.map((annotation: KeyValue) => `${annotation.key}=${annotation.value}`).filter(Boolean) || [],
      cluster_id: details.cluster_id
    };
    
    // 设置编辑表单数据
    editForm.value = {
      namespace: details.name,
      labelEntries: details.labels?.length
        ? details.labels.map((label: KeyValue) => ({ key: label.key, value: label.value }))
        : [{ key: '', value: '' }],
      annotationEntries: details.annotations?.length
        ? details.annotations.map((annotation: KeyValue) => ({ key: annotation.key, value: annotation.value }))
        : [{ key: '', value: '' }]
    };
    
    editModalVisible.value = true;
  } catch (error: any) {
    console.error('获取命名空间详情失败:', error);
    message.error(error.message || '获取命名空间详情失败');
    
    // 如果获取详情失败，使用列表中的基本信息
    currentNamespace.value = namespace;
    editForm.value = {
      namespace: namespace.name,
      labelEntries: namespace.labels?.length
        ? namespace.labels.map(label => {
          const [key, value] = label.split('=');
          return { key: key || '', value: value || '' };
        })
        : [{ key: '', value: '' }],
      annotationEntries: namespace.annotations?.length
        ? namespace.annotations.map(annotation => {
          const [key, value] = annotation.split('=');
          return { key: key || '', value: value || '' };
        })
        : [{ key: '', value: '' }]
    };
    editModalVisible.value = true;
  }
};

// 删除命名空间
const handleDelete = async (namespace: NamespaceDetails) => {
  if (!validateClusterStatus()) return;

  try {
    await deleteNamespaceApi(selectedCluster.value!, namespace.name);
    message.success('命名空间删除成功');
    getNamespaces();
  } catch (error: any) {
    message.error(error.message || '删除命名空间失败');
  }
};

// 切换集群
const handleClusterChange = () => {
  namespaces.value = [];
  currentPage.value = 1;
  totalItems.value = 0;
  getNamespaces();
};

// 分页处理
const handleTableChange = (pagination: any) => {
  if (pagination) {
    currentPage.value = pagination.current || currentPage.value;
    pageSize.value = pagination.pageSize || pageSize.value;
  }
  // 重新获取数据
  getNamespaces();
};

// 页面大小变化处理
const handlePageSizeChange = () => {
  currentPage.value = 1; // 重置到第一页
  getNamespaces();
};

// 表单处理函数
const addLabelEntry = () => {
  createForm.value.labelEntries.push({ key: '', value: '' });
};

const removeLabelEntry = (index: number) => {
  createForm.value.labelEntries.splice(index, 1);
};

const addAnnotationEntry = () => {
  createForm.value.annotationEntries.push({ key: '', value: '' });
};

const removeAnnotationEntry = (index: number) => {
  createForm.value.annotationEntries.splice(index, 1);
};

const addEditLabelEntry = () => {
  editForm.value.labelEntries.push({ key: '', value: '' });
};

const removeEditLabelEntry = (index: number) => {
  editForm.value.labelEntries.splice(index, 1);
};

const addEditAnnotationEntry = () => {
  editForm.value.annotationEntries.push({ key: '', value: '' });
};

const removeEditAnnotationEntry = (index: number) => {
  editForm.value.annotationEntries.splice(index, 1);
};

// 创建命名空间处理
const handleCreateConfirm = async () => {
  if (!validateClusterStatus()) {
    return;
  }

  try {
    // 表单验证
    await createFormRef.value?.validateFields();
  } catch (error) {
    // 验证失败，不需要处理
    return;
  }

  loading.value = true;
  const hide = message.loading('正在创建命名空间...', 0);
  
  try {
    // 过滤空的标签和注解
    const labels: KeyValueList = createForm.value.labelEntries
      .filter(entry => entry.key?.trim() && entry.value?.trim())
      .map(entry => ({ key: entry.key.trim(), value: entry.value.trim() }));

    const annotations: KeyValueList = createForm.value.annotationEntries
      .filter(entry => entry.key?.trim() && entry.value?.trim())
      .map(entry => ({ key: entry.key.trim(), value: entry.value.trim() }));

    // 验证标签和注解的键值格式
    const labelValidation = validateKeyValuePairs(labels, '标签');
    if (labelValidation) {
      hide();
      message.error(labelValidation);
      return;
    }

    const annotationValidation = validateKeyValuePairs(annotations, '注解');
    if (annotationValidation) {
      hide();
      message.error(annotationValidation);
      return;
    }

    await createNamespaceApi(selectedCluster.value!, {
      cluster_id: selectedCluster.value!,
      name: createForm.value.namespace.trim(),
      labels,
      annotations
    });

    hide();
    message.success('命名空间创建成功');
    isCreateModalVisible.value = false;
    resetCreateForm();
    await getNamespaces();
  } catch (error: any) {
    hide();
    console.error('创建命名空间失败:', error);
    message.error(error.message || '创建命名空间失败');
  } finally {
    loading.value = false;
  }
};

const handleCreateCancel = () => {
  isCreateModalVisible.value = false;
  resetCreateForm();
};

const resetCreateForm = () => {
  createForm.value = {
    namespace: '',
    labelEntries: [{ key: '', value: '' }],
    annotationEntries: [{ key: '', value: '' }]
  };
  // 重置表单验证状态
  createFormRef.value?.resetFields();
};

// 编辑命名空间处理
const handleEditConfirm = async () => {
  if (!validateClusterStatus() || !currentNamespace.value) {
    if (!currentNamespace.value) {
      message.error('无效的操作');
    }
    return;
  }

  loading.value = true;
  const hide = message.loading('正在更新命名空间...', 0);
  
  try {
    // 过滤空的标签和注解
    const labels: KeyValueList = editForm.value.labelEntries
      .filter(entry => entry.key?.trim() && entry.value?.trim())
      .map(entry => ({ key: entry.key.trim(), value: entry.value.trim() }));

    const annotations: KeyValueList = editForm.value.annotationEntries
      .filter(entry => entry.key?.trim() && entry.value?.trim())
      .map(entry => ({ key: entry.key.trim(), value: entry.value.trim() }));

    // 验证标签和注解的键值格式
    const labelValidation = validateKeyValuePairs(labels, '标签');
    if (labelValidation) {
      hide();
      message.error(labelValidation);
      return;
    }

    const annotationValidation = validateKeyValuePairs(annotations, '注解');
    if (annotationValidation) {
      hide();
      message.error(annotationValidation);
      return;
    }

    await updateNamespaceApi(
      selectedCluster.value!,
      currentNamespace.value.name,
      {
        cluster_id: selectedCluster.value!,
        name: currentNamespace.value.name,
        labels,
        annotations
      }
    );

    hide();
    message.success('命名空间更新成功');
    editModalVisible.value = false;
    await getNamespaces();
  } catch (error: any) {
    hide();
    console.error('更新命名空间失败:', error);
    message.error(error.message || '更新命名空间失败');
  } finally {
    loading.value = false;
  }
};

const handleEditCancel = () => {
  editModalVisible.value = false;
};



// 页面加载时获取数据
onMounted(() => {
  getClusters();
});
</script>

<style scoped>
/* 保持原有样式系统 */
.cluster-management-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24px;
}

.page-header {
  background: #fff;
  border-radius: 8px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.header-content {
  padding: 32px 40px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.title-section {
  flex: 1;
}

.page-title {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.title-icon {
  font-size: 28px;
  color: #1677ff;
  margin-right: 16px;
}

.page-title h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: #00000073;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.overview-card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  transition: all 0.3s;
  border: 1px solid #f0f0f0;
}

.overview-card:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 16px;
}

.total-clusters .card-icon {
  background: rgba(22, 119, 255, 0.1);
  color: #1677ff;
}

.running-clusters .card-icon {
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
}

.error-clusters .card-icon,
.env-types .card-icon {
  background: rgba(114, 46, 209, 0.1);
  color: #722ed1;
}

.resource-usage .card-icon {
  background: rgba(22, 119, 255, 0.1);
  color: #1677ff;
}

.card-info {
  flex: 1;
}

.card-number {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 4px;
}

.card-label {
  font-size: 14px;
  color: #00000073;
}

.toolbar {
  background: #fff;
  border-radius: 8px;
  padding: 20px 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.toolbar-left {
  display: flex;
  gap: 16px;
  align-items: center;
  flex: 1;
}

.toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-input {
  width: 320px;
}

.env-filter,
.status-filter,
.cluster-selector {
  width: 160px;
}

.cluster-selector .cluster-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.data-display {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.display-header {
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.result-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-count {
  font-size: 14px;
  color: #00000073;
  font-weight: 500;
}

.env-tags {
  display: flex;
  gap: 8px;
}

.cluster-name,
.namespace-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.namespace-name .anticon {
  color: #1677ff;
}

.action-column {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-start;
}

.action-column .ant-btn {
  height: 32px;
  width: 32px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.action-column .ant-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: rgba(24, 144, 255, 0.3);
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
  z-index: 10;
}

.action-column .ant-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.action-column .ant-btn-primary.ant-btn-dangerous {
  border-color: rgba(255, 77, 79, 0.2);
}

.action-column .ant-btn-primary.ant-btn-dangerous:hover {
  border-color: rgba(255, 77, 79, 0.4);
  background: linear-gradient(145deg, #ffffff 0%, #fef2f2 100%);
}

.action-column .ant-btn .anticon {
  font-size: 14px;
  color: #64748b;
  transition: color 0.3s ease;
}

.action-column .ant-btn:hover .anticon {
  color: #1677ff;
}

.action-column .ant-btn-primary.ant-btn-dangerous:hover .anticon {
  color: #ff4d4f;
}

.timestamp {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #00000073;
}

.timestamp .anticon {
  color: #00000040;
}

.labels-container {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.namespace-tags {
  display: flex;
  gap: 4px;
}



.empty-state {
  text-align: center;
  padding: 60px 0;
  color: #00000073;
}

.empty-state p {
  margin: 16px 0;
  font-size: 16px;
}



/* 模态框样式 */
.cluster-modal :deep(.ant-modal-content) {
  border-radius: 8px;
}

.cluster-modal :deep(.ant-modal-header) {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  padding: 20px 24px;
}

.cluster-modal :deep(.ant-modal-title) {
  font-size: 16px;
  font-weight: 600;
}

.cluster-modal :deep(.ant-modal-body) {
  padding: 24px;
}

.cluster-modal :deep(.ant-modal-footer) {
  border-top: 1px solid #f0f0f0;
  padding: 16px 24px;
  background: #fafafa;
}

.modal-alert {
  margin-bottom: 20px;
  border-radius: 6px;
}

.cluster-form,
.namespace-form {
  padding: 8px 0;
}

.form-input {
  border-radius: 6px;
  transition: all 0.3s;
  font-size: 14px;
  height: 40px;
  border: 1px solid #d9d9d9;
}

.form-input.disabled {
  background-color: #f5f5f5;
  color: #00000040;
}

.form-input:focus,
.form-input:hover {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
}

/* 键值对输入 */
.key-value-inputs {
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 16px;
  background-color: #fafafa;
}

.key-value-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.key-value-row:last-child {
  margin-bottom: 0;
}

.label-tag {
  margin-right: 4px !important;
}

.more-tag {
  cursor: pointer;
  transition: all 0.3s;
}

.more-tag:hover {
  background-color: #1677ff !important;
  color: white !important;
}

/* 详情页面 */
.namespace-details,
.resources-content {
  padding: 8px 0;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.detail-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #f0f0f0;
}

.detail-card h4 {
  margin: 0 0 16px 0;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #000000d9;
  font-size: 16px;
}

.detail-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  align-items: flex-start;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.detail-label {
  color: #00000073;
  font-weight: 500;
  min-width: 100px;
  font-size: 14px;
}

.detail-value {
  color: #000000d9;
  font-weight: 400;
  flex: 1;
  text-align: right;
  word-break: break-all;
}

.labels-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.annotations-list {
  margin-top: 12px;
}

.annotation-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.annotation-item:last-child {
  border-bottom: none;
}

.annotation-key {
  font-weight: 600;
  color: #000000d9;
  flex: 1;
  font-size: 14px;
}

.annotation-value {
  color: #00000073;
  word-break: break-all;
  margin-left: 16px;
  flex: 2;
}



.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}



/* 页面大小选择器 */
.page-size-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 16px;
}

.selector-label {
  font-size: 14px;
  color: #00000073;
  white-space: nowrap;
}

.view-toggle {
  display: flex;
  align-items: center;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .cluster-management-container {
    padding: 16px;
  }
  
  .header-content {
    flex-direction: column;
    gap: 20px;
  }
  
  .header-actions {
    justify-content: flex-end;
  }
  
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .toolbar {
    flex-direction: column;
    gap: 16px;
  }
  
  .toolbar-left {
    width: 100%;
    flex-direction: column;
  }
  
  .toolbar-right {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  
  .search-input,
  .env-filter,
  .cluster-selector {
    width: 100%;
  }
  

}

@media (max-width: 768px) {
  .overview-cards {
    grid-template-columns: 1fr;
  }
  
  .toolbar-right {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  
  .page-size-selector {
    margin-right: 0;
    justify-content: center;
  }
  
  .key-value-row {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  
  .key-value-row .form-input {
    width: 100% !important;
  }
  
  .key-value-row .ant-btn {
    width: 100% !important;
  }
  
  .details-grid {
    grid-template-columns: 1fr;
  }
  
  .detail-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .detail-value {
    text-align: left;
  }
  


  
  .action-column {
    flex-direction: column;
    gap: 4px;
    align-items: stretch;
  }
  
  .action-column .ant-btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .cluster-management-container {
    padding: 12px;
  }
  
  .header-content {
    padding: 20px 16px;
  }
  
  .page-title h1 {
    font-size: 20px;
  }
  
  .card-number {
    font-size: 16px;
  }
  
  .toolbar {
    padding: 16px;
  }
  
  .card-view {
    padding: 16px;
  }
  
  .namespace-card {
    padding: 16px;
  }
}
</style>
