<template>
  <div class="cluster-management-container deployment-management-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="page-title">
            <RocketOutlined class="title-icon" />
            <h1>Kubernetes Deployment 管理</h1>
          </div>
          <p class="page-subtitle">管理和监控集群中的所有Deployment资源</p>
        </div>
        <div class="header-actions">
          <a-button type="primary" size="large" @click="isCreateModalVisible = true">
            <template #icon><PlusOutlined /></template>
            创建部署
          </a-button>
          <a-button type="primary" size="large" @click="refreshData" :loading="loading">
            <template #icon><ReloadOutlined /></template>
            刷新数据
          </a-button>
        </div>
      </div>
    </div>

    <!-- 数据概览卡片 -->
    <div class="overview-cards">
      <div class="overview-card total-clusters">
        <div class="card-icon">
          <RocketOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ deployments.length }}</div>
          <div class="card-label">Deployment 总数</div>
        </div>
      </div>
      
      <div class="overview-card running-clusters">
        <div class="card-icon">
          <CheckCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ healthyDeployments }}</div>
          <div class="card-label">健康部署</div>
        </div>
      </div>
      
      <div class="overview-card env-types">
        <div class="card-icon">
          <WarningOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ problemDeployments }}</div>
          <div class="card-label">问题部署</div>
        </div>
      </div>
      
      <div class="overview-card resource-usage">
        <div class="card-icon">
          <PartitionOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ selectedNamespace }}</div>
          <div class="card-label">命名空间</div>
        </div>
      </div>
    </div>

    <!-- 操作工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <a-select
          v-model:value="selectedCluster"
          placeholder="选择集群"
          class="env-filter cluster-selector"
          :loading="clustersLoading"
          @change="handleClusterChange"
        >
          <template #suffixIcon><ClusterOutlined /></template>
          <a-select-option v-for="cluster in clusters" :key="cluster.id" :value="cluster.id">
            <span class="cluster-option">
              <CloudServerOutlined />
              {{ cluster.name }}
            </span>
          </a-select-option>
        </a-select>
        
        <a-select
          v-model:value="selectedNamespace"
          placeholder="选择命名空间"
          class="env-filter namespace-selector"
          :loading="namespacesLoading"
          @change="handleNamespaceChange"
        >
          <template #suffixIcon><PartitionOutlined /></template>
          <a-select-option v-for="ns in namespaces" :key="ns" :value="ns">
            <span class="namespace-option">
              <AppstoreOutlined />
              {{ ns }}
            </span>
          </a-select-option>
        </a-select>
        
        <a-input-search
          v-model:value="searchText"
          placeholder="搜索 Deployment 名称"
          class="search-input"
          @search="onSearch"
          allow-clear
        />
      </div>
      
      <div class="toolbar-right">
        <div class="view-toggle">
          <a-radio-group v-model:value="viewMode" button-style="solid" size="small">
            <a-radio-button value="table">
              <TableOutlined />
            </a-radio-button>
            <a-radio-button value="card">
              <AppstoreOutlined />
            </a-radio-button>
          </a-radio-group>
        </div>
        
        <a-button @click="refreshData" :loading="loading">
          <template #icon><ReloadOutlined /></template>
        </a-button>
        
        <a-button 
          type="primary" 
          danger 
          @click="handleBatchDelete" 
          :disabled="!selectedRows.length"
          v-if="selectedRows.length > 0"
        >
          <template #icon><DeleteOutlined /></template>
          删除 ({{ selectedRows.length }})
        </a-button>
      </div>
    </div>

    <!-- 数据展示区域 -->
    <div class="data-display">
      <div class="display-header" v-if="filteredDeployments.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ filteredDeployments.length }} 个Deployment</span>
          <div class="env-tags">
            <a-tag color="green">健康 {{ healthyDeployments }}</a-tag>
            <a-tag color="orange" v-if="problemDeployments > 0">问题 {{ problemDeployments }}</a-tag>
            <a-tag color="blue">{{ selectedNamespace }}</a-tag>
          </div>
        </div>
      </div>

      <!-- 表格视图 -->
      <a-table
        v-if="viewMode === 'table'"
        :columns="columns"
        :data-source="filteredDeployments"
        :row-selection="rowSelection"
        :loading="loading"
        row-key="uid"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: totalItems,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: number[]) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['12', '24', '48', '96']
        }"
        @change="handleTableChange"
        class="cluster-table deployments-table"
      >
        <!-- Deployment名称列 -->
        <template #name="{ text, record }">
          <div class="cluster-name deployment-name">
            <RocketOutlined />
            <span>{{ text }}</span>
          </div>
        </template>

        <!-- 副本列 -->
        <template #replicas="{ record }">
          <div class="replicas-info">
            <a-tag color="blue">{{ record.available_replicas || 0 }}/{{ record.replicas || 0 }}</a-tag>
          </div>
        </template>

        <!-- 命名空间列 -->
        <template #namespace="{ text }">
          <a-tag class="env-tag namespace-tag">
            <AppstoreOutlined /> {{ text }}
          </a-tag>
        </template>
        
        <!-- 状态列 -->
        <template #status="{ record }">
          <div class="status-wrapper">
            <a-tag :color="getStatusColor(record)" class="status-tag">
              {{ record.available_replicas || 0 }}/{{ record.replicas || 0 }} 副本
            </a-tag>
            <a-progress 
              :percent="getStatusPercent(record)" 
              :status="getProgressStatus(record)"
              size="small"
              :stroke-color="getStatusColor(record)"
              :show-info="false"
              class="status-progress"
            />
          </div>
        </template>

        <!-- 镜像列 -->
        <template #image="{ record }">
          <div class="timestamp image-tag">
            <ContainerOutlined />
            <span class="image-text">{{ record.images?.[0] || '-' }}</span>
          </div>
        </template>

        <!-- 创建时间列 -->
        <template #creationTimestamp="{ record }">
          <div class="timestamp">
            <ClockCircleOutlined />
            <a-tooltip :title="formatDateTime(record.creation_timestamp)">
              <span>{{ formatDate(record.creation_timestamp) }}</span>
            </a-tooltip>
          </div>
        </template>

        <!-- 操作列 -->
        <template #action="{ record }">
          <div class="action-column">
            <a-tooltip title="查看 YAML">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewDeploymentYaml(record)">
                <template #icon><CodeOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="扩缩容">
              <a-button type="primary" ghost shape="circle" size="small" @click="handleScale(record)">
                <template #icon><ScaleOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="历史版本">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewHistory(record)">
                <template #icon><HistoryOutlined /></template>
              </a-button>
            </a-tooltip>
            
            <a-tooltip title="重启 Deployment">
              <a-popconfirm
                title="确定要重启该 Deployment 吗?"
                @confirm="handleRestart(record)"
                ok-text="确定"
                cancel-text="取消"
              >
                <a-button type="primary" ghost shape="circle" size="small">
                  <template #icon><SyncOutlined /></template>
                </a-button>
              </a-popconfirm>
            </a-tooltip>

            <a-tooltip title="暂停/恢复">
              <a-button type="primary" ghost shape="circle" size="small" @click="handlePauseResume(record)" :loading="isPauseResumeLoading">
                <template #icon><PlayCircleOutlined v-if="record.status === 'Paused'" /><PauseCircleOutlined v-else /></template>
              </a-button>
            </a-tooltip>
            
            <a-tooltip title="删除 Deployment">
              <a-popconfirm
                title="确定要删除该 Deployment 吗?"
                description="此操作不可撤销"
                @confirm="handleDelete(record)"
                ok-text="确定"
                cancel-text="取消"
              >
                <a-button type="primary" danger ghost shape="circle" size="small">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-popconfirm>
            </a-tooltip>
          </div>
        </template>

        <!-- 空状态 -->
        <template #emptyText>
          <div class="empty-state">
            <RocketOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
            <p>暂无Deployment数据</p>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </div>
        </template>
      </a-table>

      <!-- 卡片视图 -->
      <div v-else class="card-view">
        <a-spin :spinning="loading">
          <a-empty v-if="filteredDeployments.length === 0" description="暂无Deployment数据">
            <template #image>
              <RocketOutlined style="font-size: 64px; color: #d9d9d9;" />
            </template>
            <template #description>
              <span style="color: #999;">暂无Deployment数据</span>
            </template>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </a-empty>
          <div v-else class="cluster-cards deployment-cards">
            <a-checkbox-group v-model:value="selectedCardIds" class="card-checkbox-group">
              <div v-for="deployment in filteredDeployments" :key="deployment.uid" class="cluster-card deployment-card">
                <div class="card-header">
                  <a-checkbox :value="deployment.uid" class="card-checkbox" />
                  <div class="service-title deployment-title">
                    <RocketOutlined class="service-icon deployment-icon" />
                    <h3>{{ deployment.name }}</h3>
                  </div>
                  <a-tag :color="getStatusColor(deployment)" class="card-type-tag env-tag card-status-tag">
                    {{ deployment.available_replicas || 0 }}/{{ deployment.replicas || 0 }}
                  </a-tag>
                </div>
                
                <div class="card-content">
                  <div class="card-detail">
                    <span class="detail-label">命名空间:</span>
                    <span class="detail-value">
                      <AppstoreOutlined />
                      {{ deployment.namespace }}
                    </span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">镜像:</span>
                    <span class="detail-value">
                      <ContainerOutlined />
                      {{ deployment.images?.[0] || '-' }}
                    </span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">创建时间:</span>
                    <span class="detail-value">
                      <ClockCircleOutlined />
                      {{ formatDate(deployment.creation_timestamp) }}
                    </span>
                  </div>
                  <div class="card-status card-detail">
                    <span class="detail-label">状态:</span>
                    <div class="detail-value">
                      <a-progress 
                        :percent="getStatusPercent(deployment)" 
                        :status="getProgressStatus(deployment)"
                        size="small"
                        :stroke-color="getStatusColor(deployment)"
                        class="card-progress"
                      />
                    </div>
                  </div>
                </div>
                
                <div class="card-footer card-action-footer">
                  <a-button type="primary" ghost size="small" @click="viewDeploymentYaml(deployment)">
                    <template #icon><CodeOutlined /></template>
                    YAML
                  </a-button>
                  <a-button type="primary" ghost size="small" @click="handleScale(deployment)">
                    <template #icon><ScaleOutlined /></template>
                    扩缩容
                  </a-button>
                  <a-button type="primary" ghost size="small" @click="handleRestart(deployment)">
                    <template #icon><SyncOutlined /></template>
                    重启
                  </a-button>
                  <a-popconfirm
                    title="确定要删除该 Deployment 吗?"
                    @confirm="handleDelete(deployment)"
                    ok-text="确定"
                    cancel-text="取消"
                  >
                    <a-button type="primary" danger ghost size="small">
                      <template #icon><DeleteOutlined /></template>
                      删除
                    </a-button>
                  </a-popconfirm>
                </div>
              </div>
            </a-checkbox-group>
          </div>
        </a-spin>
      </div>
    </div>

    <!-- 查看 Deployment YAML 模态框 -->
    <a-modal
      v-model:open="viewYamlModalVisible"
      title="Deployment YAML 配置"
      width="900px"
      class="cluster-modal yaml-modal"
      :footer="null"
    >
      <a-alert v-if="currentDeployment" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentDeployment.name }} ({{ currentDeployment.namespace }})</span>
        </template>
        <template #description>
          <div>状态: {{ currentDeployment.available_replicas || 0 }}/{{ currentDeployment.replicas || 0 }} | 创建于: {{ formatDate(currentDeployment.creation_timestamp) }}</div>
        </template>
      </a-alert>
      
      <div class="yaml-actions">
        <a-button type="primary" size="small" @click="copyYaml">
          <template #icon><CopyOutlined /></template>
          复制
        </a-button>
      </div>
      <pre class="yaml-editor">{{ deploymentYaml }}</pre>
    </a-modal>

    <!-- 扩缩容模态框 -->
    <a-modal
      v-model:open="isScaleModalVisible"
      title="扩缩容 Deployment"
      @ok="confirmScale"
      @cancel="isScaleModalVisible = false"
      :confirmLoading="loading"
      class="cluster-modal"
    >
      <a-alert v-if="selectedDeploymentForScale" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ selectedDeploymentForScale.name }} ({{ selectedDeploymentForScale.namespace }})</span>
        </template>
        <template #description>
          <div>当前副本数: {{ selectedDeploymentForScale.replicas }}</div>
        </template>
      </a-alert>

      <a-form layout="vertical">
        <a-form-item label="目标副本数" required>
          <a-input-number 
            v-model:value="scaleForm.replicas" 
            :min="0" 
            :max="100" 
            style="width: 100%" 
            placeholder="请输入目标副本数"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 历史版本模态框 -->
    <a-modal
      v-model:open="isHistoryModalVisible"
      title="历史版本"
      width="800px"
      :footer="null"
      class="cluster-modal"
    >
      <a-alert v-if="currentDeployment" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentDeployment.name }} ({{ currentDeployment.namespace }})</span>
        </template>
        <template #description>
          <div>查看历史版本记录</div>
        </template>
      </a-alert>

      <a-table 
        :data-source="deploymentHistory" 
        :columns="[
          { title: '版本', dataIndex: 'revision', key: 'revision', width: '15%' },
          { title: '变更原因', dataIndex: 'change_cause', key: 'change_cause', ellipsis: true },
          { title: '创建时间', dataIndex: 'creation_timestamp', key: 'creation_timestamp', width: '25%' },
          { title: '操作', key: 'action', width: '15%' }
        ]"
        :loading="loading"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'creation_timestamp'">
            {{ formatDateTime(record.creation_timestamp) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button 
              type="primary" 
              size="small" 
              @click="rollbackToVersion(record.revision)"
              :loading="loading"
            >
              回滚
            </a-button>
          </template>
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useRoute } from 'vue-router';
import {
  getDeployListApi,
  getDeploymentListWithFilterApi,
  getDeployYamlApi,
  deleteDeployApi,
  restartDeployApi,
  createDeploymentApi,
  updateDeploymentApi,
  scaleDeploymentApi,
  rollbackDeploymentApi,
  getDeploymentHistoryApi,
  getDeploymentEventsApi,
  pauseDeploymentApi,
  resumeDeploymentApi,
  batchDeleteDeploymentApi,
  batchRestartDeploymentApi,
  getAllClustersApi,
  getNamespacesByClusterIdApi,
} from '#/api';
import type { 
  DeploymentInfo, 
  DeploymentListReq,
  DeploymentCreateReq,
  DeploymentUpdateReq,
  DeploymentScaleReq,
  DeploymentHistory 
} from '#/api';
import { 
  CloudServerOutlined, 
  TableOutlined, 
  AppstoreOutlined, 
  ReloadOutlined,
  DeleteOutlined,
  CodeOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CopyOutlined,
  ClusterOutlined,
  PartitionOutlined,
  SyncOutlined,
  ContainerOutlined,
  PlusOutlined,
  ExpandOutlined as ScaleOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined
} from '@ant-design/icons-vue';

// 使用API中定义的类型
type Deployment = DeploymentInfo;

// 状态变量
const route = useRoute();
const loading = ref(false);
const clustersLoading = ref(false);
const namespacesLoading = ref(false);
const deployments = ref<DeploymentInfo[]>([]);
const currentPage = ref(1);
const pageSize = ref(12);
const totalItems = ref(0);
const isCreateModalVisible = ref(false);
const isScaleModalVisible = ref(false);
const isHistoryModalVisible = ref(false);
const isPauseResumeLoading = ref(false);
const scaleForm = ref({
  replicas: 1
});
const createForm = ref<Partial<DeploymentCreateReq>>({
  name: '',
  namespace: '',
  replicas: 1,
  image: '',
  labels: {},
  annotations: {}
});
const deploymentHistory = ref<DeploymentHistory[]>([]);
const selectedDeploymentForScale = ref<DeploymentInfo | null>(null);
const searchText = ref('');
const selectedRows = ref<DeploymentInfo[]>([]);
const namespaces = ref<string[]>(['default']);
const selectedNamespace = ref<string>('default');
const viewYamlModalVisible = ref(false);
const deploymentYaml = ref('');
const clusters = ref<Array<{id: number, name: string}>>([]);
const selectedCluster = ref<number>();
const viewMode = ref<'table' | 'card'>('table');
const currentDeployment = ref<DeploymentInfo | null>(null);
const selectedCardIds = ref<string[]>([]);

// 根据卡片选择更新 selectedRows
watch(selectedCardIds, (newValue) => {
  selectedRows.value = deployments.value.filter(deployment => 
    newValue.includes(deployment.uid)
  );
});

// 表格列配置
const columns = [
  {
    title: 'Deployment 名称',
    dataIndex: 'name',
    key: 'name',
    slots: { customRender: 'name' },
    width: '18%',
    sorter: (a: DeploymentInfo, b: DeploymentInfo) => a.name.localeCompare(b.name),
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    width: '12%',
    slots: { customRender: 'namespace' },
    sorter: (a: DeploymentInfo, b: DeploymentInfo) => a.namespace.localeCompare(b.namespace),
  },
  {
    title: '状态',
    key: 'status',
    width: '15%',
    slots: { customRender: 'status' },
  },
  {
    title: '副本',
    key: 'replicas',
    width: '10%',
    slots: { customRender: 'replicas' },
  },
  {
    title: '镜像',
    dataIndex: 'images',
    key: 'image',
    width: '22%',
    slots: { customRender: 'image' },
  },
  {
    title: '创建时间',
    dataIndex: 'creation_timestamp',
    key: 'creationTimestamp',
    width: '13%',
    sorter: (a: DeploymentInfo, b: DeploymentInfo) => new Date(a.creation_timestamp).getTime() - new Date(b.creation_timestamp).getTime(),
    slots: { customRender: 'creationTimestamp' },
  },
  {
    title: '操作',
    key: 'action',
    width: '20%',
    fixed: 'right',
    slots: { customRender: 'action' },
  },
];

// 计算属性：过滤后的Deployment列表
const filteredDeployments = computed(() => {
  const searchValue = searchText.value.toLowerCase().trim();
  if (!searchValue) return deployments.value;
  return deployments.value.filter(deploy => 
    deploy.name.toLowerCase().includes(searchValue) || 
    deploy.images.some(img => img.toLowerCase().includes(searchValue))
  );
});

// 计算属性：健康和问题部署统计
const healthyDeployments = computed(() => 
  deployments.value.filter(deploy => {
    const available = deploy.available_replicas || 0;
    const total = deploy.replicas || 0;
    return total > 0 && available === total;
  }).length
);

const problemDeployments = computed(() => 
  deployments.value.filter(deploy => {
    const available = deploy.available_replicas || 0;
    const total = deploy.replicas || 0;
    return total > 0 && available < total;
  }).length
);

// 获取状态颜色
const getStatusColor = (deployment: DeploymentInfo) => {
  if (!deployment.replicas) return 'default';
  const available = deployment.available_replicas || 0;
  const total = deployment.replicas || 0;
  
  if (available === 0) return 'error';
  if (available < total) return 'warning';
  return 'success';
};

// 获取进度条百分比
const getStatusPercent = (deployment: DeploymentInfo) => {
  if (!deployment.replicas) return 0;
  const available = deployment.available_replicas || 0;
  const total = deployment.replicas || 0;
  
  return Math.round((available / total) * 100);
};

// 获取进度条状态
const getProgressStatus = (deployment: DeploymentInfo) => {
  if (!deployment.replicas) return 'normal';
  const available = deployment.available_replicas || 0;
  const total = deployment.replicas || 0;
  
  if (available === 0) return 'exception';
  if (available < total) return 'active';
  return 'success';
};

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 日期时间格式化
const formatDateTime = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

// 表格选择配置
const rowSelection = {
  onChange: (selectedRowKeys: string[], selectedRowsData: DeploymentInfo[]) => {
    selectedRows.value = selectedRowsData;
    selectedCardIds.value = selectedRowsData.map(row => row.uid);
  },
  getCheckboxProps: (record: DeploymentInfo) => ({
    disabled: false, // 可以根据条件禁用某些行的选择
  }),
};

// 复制YAML
const copyYaml = async () => {
  try {
    await navigator.clipboard.writeText(deploymentYaml.value);
    message.success('YAML 已复制到剪贴板');
  } catch (err) {
    message.error('复制失败，请手动选择并复制');
  }
};

// 获取集群列表
const getClusters = async () => {
  clustersLoading.value = true;
  try {
    const res = await getAllClustersApi();
    clusters.value = res ?? [];
    if (clusters.value.length > 0 && !selectedCluster.value) {
      selectedCluster.value = clusters.value[0]?.id;
      if (selectedCluster.value) {
        await getNamespaces();
        await getDeployments(1, pageSize.value);
      }
    }
  } catch (error: any) {
    message.error(error.message || '获取集群列表失败');
  } finally {
    clustersLoading.value = false;
  }
};

// 获取命名空间列表
const getNamespaces = async () => {
  if (!selectedCluster.value) {
    message.warning('请先选择集群');
    return;
  }

  namespacesLoading.value = true;
  try {
    const res = await getNamespacesByClusterIdApi(selectedCluster.value);
    namespaces.value = res.map((ns: { name: string }) => ns.name);
    if (namespaces.value.length > 0) {
      selectedNamespace.value = namespaces.value[0] || 'default';
    }
  } catch (error: any) {
    message.error(error.message || '获取命名空间列表失败');
    namespaces.value = ['default'];
    selectedNamespace.value = 'default';
  } finally {
    namespacesLoading.value = false;
  }
};

// 获取Deployment列表（支持分页）
const getDeployments = async (page = 1, size = pageSize.value) => {
  if (!selectedCluster.value || !selectedNamespace.value) {
    message.warning('请先选择集群和命名空间');
    return;
  }
  
  loading.value = true;
  try {
    const params: DeploymentListReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      page,
      page_size: size
    };
    const res = await getDeploymentListWithFilterApi(params);
    deployments.value = (res as any)?.data || res || [];
    
    // 如果API返回分页信息，更新总数
    if ((res as any)?.total !== undefined) {
      totalItems.value = (res as any).total;
    } else {
      totalItems.value = deployments.value.length;
    }
    
    currentPage.value = page;
    selectedRows.value = [];
    selectedCardIds.value = [];
  } catch (error: any) {
    message.error(error.message || '获取Deployment列表失败');
    deployments.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

// 刷新数据
const refreshData = () => {
  getDeployments(currentPage.value, pageSize.value);
};

// 扩缩容Deployment
const handleScale = (deployment: DeploymentInfo) => {
  selectedDeploymentForScale.value = deployment;
  scaleForm.value.replicas = deployment.replicas;
  isScaleModalVisible.value = true;
};

const confirmScale = async () => {
  if (!selectedDeploymentForScale.value || !selectedCluster.value) return;
  
  try {
    loading.value = true;
    await scaleDeploymentApi({
      cluster_id: selectedCluster.value,
      namespace: selectedDeploymentForScale.value.namespace,
      name: selectedDeploymentForScale.value.name,
      replicas: scaleForm.value.replicas
    });
    
    message.success('扩缩容操作成功');
    isScaleModalVisible.value = false;
    getDeployments(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '扩缩容操作失败');
  } finally {
    loading.value = false;
  }
};

// 暂停/恢复Deployment
const handlePauseResume = async (deployment: DeploymentInfo) => {
  if (!selectedCluster.value) return;
  
  isPauseResumeLoading.value = true;
  try {
    // 这里可能需要根据部署状态判断是暂停还是恢复
    const isPaused = deployment.status === 'Paused';
    
    if (isPaused) {
      await resumeDeploymentApi(selectedCluster.value, deployment.namespace, deployment.name);
      message.success('部署已恢复');
    } else {
      await pauseDeploymentApi(selectedCluster.value, deployment.namespace, deployment.name);
      message.success('部署已暂停');
    }
    
    getDeployments(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '操作失败');
  } finally {
    isPauseResumeLoading.value = false;
  }
};

// 查看历史版本
const viewHistory = async (deployment: DeploymentInfo) => {
  if (!selectedCluster.value) return;
  
  try {
    loading.value = true;
    currentDeployment.value = deployment;
    const history = await getDeploymentHistoryApi(
      selectedCluster.value,
      deployment.namespace,
      deployment.name
    );
    deploymentHistory.value = history || [];
    isHistoryModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取历史版本失败');
  } finally {
    loading.value = false;
  }
};

// 回滚到指定版本
const rollbackToVersion = async (revision: number) => {
  if (!currentDeployment.value || !selectedCluster.value) return;
  
  try {
    loading.value = true;
    await rollbackDeploymentApi({
      cluster_id: selectedCluster.value,
      namespace: currentDeployment.value.namespace,
      name: currentDeployment.value.name,
      revision
    });
    
    message.success('回滚操作成功');
    isHistoryModalVisible.value = false;
    getDeployments(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '回滚操作失败');
  } finally {
    loading.value = false;
  }
};

// 分页处理
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  getDeployments(pagination.current, pagination.pageSize);
};

// 搜索
const onSearch = () => {
  // 搜索逻辑已经在计算属性中实现，这里可以添加其他触发行为
};

// 查看Deployment YAML
const viewDeploymentYaml = async (deployment: DeploymentInfo) => {
  if (!selectedCluster.value) return;
  try {
    currentDeployment.value = deployment;
    const res = await getDeployYamlApi(selectedCluster.value, deployment.name, deployment.namespace);
    deploymentYaml.value = typeof res === 'string' ? res : JSON.stringify(res, null, 2);
    viewYamlModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取Deployment YAML失败');
  }
};

// 删除Deployment
const handleDelete = async (deployment: DeploymentInfo) => {
  if (!selectedCluster.value) return;
  
  try {
    await deleteDeployApi(selectedCluster.value, deployment.namespace, deployment.name);
    message.success('Deployment删除成功');
    getDeployments(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '删除Deployment失败');
  }
};

// 重启Deployment
const handleRestart = async (deployment: DeploymentInfo) => {
  if (!selectedCluster.value) return;
  
  try {
    await restartDeployApi(selectedCluster.value, deployment.namespace, deployment.name);
    message.success('Deployment重启成功');
    getDeployments(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '重启Deployment失败');
  }
};

// 批量删除Deployment
const handleBatchDelete = async () => {
  if (!selectedRows.value.length || !selectedCluster.value) return;
  
  try {
    loading.value = true;
    // 使用批量删除API
    await batchDeleteDeploymentApi({
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      names: selectedRows.value.map(d => d.name)
    });
    
    message.success(`成功删除 ${selectedRows.value.length} 个部署`);
    selectedRows.value = [];
    selectedCardIds.value = [];
    getDeployments(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '批量删除失败');
  } finally {
    loading.value = false;
  }
};

// 切换命名空间
const handleNamespaceChange = () => {
  currentPage.value = 1;
  getDeployments(1, pageSize.value);
};

// 切换集群
const handleClusterChange = () => {
  selectedNamespace.value = 'default';
  deployments.value = [];
  currentPage.value = 1;
  totalItems.value = 0;
  getNamespaces();
  getDeployments(1, pageSize.value);
};

// 页面加载时获取数据
onMounted(() => {
  getClusters();
});
</script>

<style>
/* 现代化大气设计系统 */
:root {
  --primary-color: #1677ff;
  --primary-hover: #4096ff;
  --primary-active: #0958d9;
  --success-color: #52c41a;
  --warning-color: #faad14;
  --error-color: #ff4d4f;
  --text-primary: #000000d9;
  --text-secondary: #00000073;
  --text-tertiary: #00000040;
  --text-quaternary: #00000026;
  --border-color: #d9d9d9;
  --border-color-split: #f0f0f0;
  --background-color: #f5f5f5;
  --component-background: #ffffff;
  --layout-header-background: #001529;
  --shadow-1: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-2: 0 6px 16px rgba(0, 0, 0, 0.08);
  --shadow-3: 0 9px 28px rgba(0, 0, 0, 0.12);
  --border-radius-base: 8px;
  --border-radius-sm: 6px;
  --border-radius-lg: 12px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;
  --font-size-xxl: 24px;
  --line-height-base: 1.5714;
  --transition-duration: 0.3s;
  --transition-function: cubic-bezier(0.645, 0.045, 0.355, 1);
}

/* ==================== 布局容器 ==================== */
.cluster-management-container {
  min-height: 100vh;
  background: var(--background-color);
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* ==================== 页面头部 ==================== */
.page-header {
  background: var(--component-background);
  border-radius: var(--border-radius-base);
  margin-bottom: 24px;
  box-shadow: var(--shadow-1);
  overflow: hidden;
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
  color: var(--primary-color);
  margin-right: 16px;
}

.page-title h1 {
  font-size: var(--font-size-xxl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.page-subtitle {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin: 0;
  line-height: var(--line-height-base);
}

.header-actions {
  flex-shrink: 0;
}

/* ==================== 概览卡片 ==================== */
.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.overview-card {
  background: var(--component-background);
  border-radius: var(--border-radius-base);
  padding: 24px;
  box-shadow: var(--shadow-1);
  display: flex;
  align-items: center;
  transition: all var(--transition-duration) var(--transition-function);
  border: 1px solid var(--border-color-split);
}

.overview-card:hover {
  box-shadow: var(--shadow-2);
  transform: translateY(-2px);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--border-radius-base);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 16px;
  flex-shrink: 0;
}

.total-clusters .card-icon {
  background: rgba(22, 119, 255, 0.1);
  color: var(--primary-color);
}

.running-clusters .card-icon {
  background: rgba(82, 196, 26, 0.1);
  color: var(--success-color);
}

.env-types .card-icon {
  background: rgba(250, 173, 20, 0.1);
  color: var(--warning-color);
}

.resource-usage .card-icon {
  background: rgba(114, 46, 209, 0.1);
  color: #722ed1;
}

.card-info {
  flex: 1;
}

.card-number {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
  margin-bottom: 4px;
}

.card-label {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  line-height: var(--line-height-base);
}

/* ==================== 工具栏 ==================== */
.toolbar {
  background: var(--component-background);
  border-radius: var(--border-radius-base);
  padding: 20px 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  border: 1px solid var(--border-color-split);
}

.toolbar-left {
  display: flex;
  gap: 16px;
  align-items: center;
  flex: 1;
}

.search-input {
  width: 320px;
}

.search-input :deep(.ant-input) {
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-base);
  height: 40px;
}

.env-filter {
  width: 160px;
}

.env-filter :deep(.ant-select-selector) {
  border-radius: var(--border-radius-sm);
  height: 40px;
}

.toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-shrink: 0;
}

.view-toggle :deep(.ant-radio-group) {
  border-radius: var(--border-radius-sm);
}

.view-toggle :deep(.ant-radio-button-wrapper) {
  height: 32px;
  line-height: 30px;
  padding: 0 12px;
  border-radius: var(--border-radius-sm);
}

.view-toggle :deep(.ant-radio-button-wrapper:first-child) {
  border-radius: var(--border-radius-sm) 0 0 var(--border-radius-sm);
}

.view-toggle :deep(.ant-radio-button-wrapper:last-child) {
  border-radius: 0 var(--border-radius-sm) var(--border-radius-sm) 0;
}

.cluster-option, .namespace-option {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ==================== 数据展示区域 ==================== */
.data-display {
  background: var(--component-background);
  border-radius: var(--border-radius-base);
  box-shadow: var(--shadow-1);
  border: 1px solid var(--border-color-split);
  overflow: hidden;
}

.display-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color-split);
  background: var(--component-background);
}

.result-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-count {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  font-weight: 500;
}

.env-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.env-tags :deep(.ant-tag) {
  border-radius: var(--border-radius-sm);
  font-size: 12px;
  font-weight: 500;
  margin: 0;
}

/* ==================== 表格样式 ==================== */
.cluster-table {
  border: none;
}

.cluster-table :deep(.ant-table-container) {
  border-radius: 0;
}

.cluster-table :deep(.ant-table-thead > tr > th) {
  background: #fafafa;
  font-weight: 600;
  padding: 16px 16px;
  border-bottom: 1px solid var(--border-color-split);
  color: var(--text-primary);
  font-size: var(--font-size-base);
}

.cluster-table :deep(.ant-table-tbody > tr) {
  transition: background-color var(--transition-duration) var(--transition-function);
}

.cluster-table :deep(.ant-table-tbody > tr:hover) {
  background-color: #fafafa;
}

.cluster-table :deep(.ant-table-tbody > tr > td) {
  padding: 16px;
  border-bottom: 1px solid var(--border-color-split);
  vertical-align: middle;
  font-size: var(--font-size-base);
}

.cluster-name {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.deployment-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.namespace-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
  font-size: 13px;
  padding: 2px 8px;
  border-radius: 4px;
}

.env-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: var(--border-radius-base);
  font-size: 12px;
  border: none;
}

.status-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.status-tag {
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  text-align: center;
}

.status-progress {
  width: 100%;
  margin-top: 4px;
}

.image-tag {
  display: flex;
  align-items: center;
  gap: 10px;
}

.image-text {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #595959;
  word-break: break-all;
}

.timestamp {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: var(--font-size-base);
}

.action-column {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.action-column :deep(.ant-btn) {
  width: 32px;
  height: 32px;
  border-radius: var(--border-radius-sm);
  transition: all var(--transition-duration) var(--transition-function);
}

.action-column :deep(.ant-btn:hover) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-2);
}

/* ==================== 卡片视图 ==================== */
.card-view {
  padding: 24px;
}

.cluster-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 24px;
}

.card-checkbox-group {
  display: contents;
}

.cluster-card {
  background: var(--component-background);
  border-radius: var(--border-radius-base);
  box-shadow: var(--shadow-1);
  transition: all var(--transition-duration) var(--transition-function);
  overflow: hidden;
  border: 1px solid var(--border-color-split);
  position: relative;
}

.cluster-card:hover {
  box-shadow: var(--shadow-2);
  transform: translateY(-4px);
}

.card-header {
  padding: 24px 24px 16px;
  background: var(--component-background);
  position: relative;
}

.service-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 60px;
}

.service-title h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.service-icon {
  font-size: 20px;
  color: var(--primary-color);
}

.deployment-icon {
  color: var(--primary-color);
  font-size: 20px;
}

.card-type-tag {
  position: absolute;
  top: 20px;
  right: 48px;
  padding: 4px 8px;
  border-radius: var(--border-radius-sm);
  font-weight: 500;
  font-size: 12px;
}

.card-checkbox {
  position: absolute;
  top: 20px;
  right: 16px;
}

.card-content {
  padding: 0 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-detail {
  display: flex;
  align-items: center;
  line-height: var(--line-height-base);
}

.detail-label {
  color: var(--text-secondary);
  min-width: 100px;
  font-size: var(--font-size-base);
  font-weight: 500;
}

.detail-value {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-base);
  color: var(--text-primary);
  flex: 1;
  font-weight: 500;
}

.card-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-progress {
  width: 100%;
  margin-top: 8px;
}

.card-action-footer {
  padding: 16px 24px 20px;
  background: #fafafa;
  border-top: 1px solid var(--border-color-split);
  display: flex;
  gap: 12px;
}

.card-action-footer .ant-btn {
  flex: 1;
  height: 36px;
  border-radius: var(--border-radius-sm);
  font-weight: 500;
  transition: all var(--transition-duration) var(--transition-function);
  font-size: var(--font-size-base);
}

.card-action-footer .ant-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-2);
}

/* ==================== 模态框样式 ==================== */
.cluster-modal :deep(.ant-modal-content) {
  border-radius: var(--border-radius-base);
  overflow: hidden;
  box-shadow: var(--shadow-3);
}

.cluster-modal :deep(.ant-modal-header) {
  background: var(--component-background);
  border-bottom: 1px solid var(--border-color-split);
  padding: 20px 24px;
}

.cluster-modal :deep(.ant-modal-title) {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.modal-alert {
  margin-bottom: 20px;
  border-radius: var(--border-radius-sm);
}

/* YAML模态框样式 */
.yaml-modal {
  font-family: "Consolas", "Monaco", monospace;
}

.yaml-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}

.yaml-editor {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  padding: 16px;
  background-color: #fafafa;
  border-radius: 4px;
  border: 1px solid #f0f0f0;
  overflow: auto;
  max-height: 500px;
  margin: 0;
}

/* ==================== 空状态 ==================== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 0;
  color: var(--text-secondary);
}

.empty-state p {
  margin: 16px 0 24px;
  font-size: var(--font-size-base);
}

/* ==================== 响应式设计 ==================== */
@media (max-width: 1400px) {
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .cluster-cards {
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  }
}

@media (max-width: 1024px) {
  .cluster-management-container {
    padding: 16px;
  }
  
  .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
    padding: 24px 32px;
  }
  
  .toolbar {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .toolbar-left {
    flex-direction: column;
    gap: 12px;
  }
  
  .search-input {
    width: 100%;
  }
  
  .env-filter {
    width: 100%;
  }
  
  .toolbar-right {
    justify-content: space-between;
  }
}

@media (max-width: 768px) {
  .cluster-management-container {
    padding: 12px;
  }
  
  .header-content {
    padding: 20px 24px;
  }
  
  .page-title h1 {
    font-size: var(--font-size-xl);
  }
  
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .overview-card {
    padding: 16px;
  }
  
  .card-icon {
    width: 40px;
    height: 40px;
    font-size: 18px;
    margin-right: 12px;
  }
  
  .card-number {
    font-size: var(--font-size-lg);
  }
  
  .cluster-cards {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .cluster-card {
    margin-bottom: 0;
  }
  
  .card-action-footer {
    flex-direction: column;
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .overview-cards {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .overview-card {
    padding: 12px;
  }
  
  .card-icon {
    width: 36px;
    height: 36px;
    font-size: 16px;
    margin-right: 8px;
  }
  
  .toolbar-right {
    flex-direction: column;
    gap: 8px;
  }
  
  .cluster-table :deep(.ant-table-tbody > tr > td) {
    padding: 12px 8px;
    font-size: 13px;
  }
  
  .action-column {
    flex-direction: column;
    gap: 4px;
  }
  
  .action-column :deep(.ant-btn) {
    width: 28px;
    height: 28px;
  }
}
</style>
