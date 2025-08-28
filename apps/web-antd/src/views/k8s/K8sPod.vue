<template>
  <div class="cluster-management-container pod-management-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="page-title">
            <CloudServerOutlined class="title-icon" />
            <h1>Kubernetes Pod 管理</h1>
          </div>
          <p class="page-subtitle">管理和监控集群中的所有Pod实例</p>
        </div>
        <div class="header-actions">
          <a-button type="primary" size="large" @click="getPods" :loading="loading">
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
          <DashboardOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ pods.length }}</div>
          <div class="card-label">Pod 总数</div>
        </div>
      </div>
      
      <div class="overview-card running-clusters">
        <div class="card-icon">
          <CheckCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ runningPodsCount }}</div>
          <div class="card-label">运行中</div>
        </div>
      </div>
      
      <div class="overview-card env-types">
        <div class="card-icon">
          <WarningOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ problemPodsCount }}</div>
          <div class="card-label">问题Pod</div>
        </div>
      </div>
      
      <div class="overview-card resource-usage">
        <div class="card-icon">
          <ClusterOutlined />
        </div>
        <div class="card-info">
          <div class="card-number cluster-name">{{ selectedClusterName || '未选择' }}</div>
          <div class="card-label">当前集群</div>
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
          placeholder="搜索 Pod 名称"
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
        
        <a-button @click="getPods" :loading="loading">
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
      <div class="display-header" v-if="filteredPods.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ filteredPods.length }} 个Pod</span>
          <div class="env-tags">
            <a-tag color="green">运行中 {{ runningPodsCount }}</a-tag>
            <a-tag color="orange" v-if="problemPodsCount > 0">问题 {{ problemPodsCount }}</a-tag>
            <a-tag color="blue">{{ selectedNamespace }}</a-tag>
          </div>
        </div>
      </div>

      <!-- 表格视图 -->
      <a-table
        v-if="viewMode === 'table'"
        :columns="columns"
        :data-source="filteredPods"
        :row-selection="rowSelection"
        :loading="loading"
        row-key="name"
        :pagination="{ 
          pageSize: 12, 
          showSizeChanger: true, 
          showQuickJumper: true,
          showTotal: (total: number) => `共 ${total} 条数据`,
          pageSizeOptions: ['12', '24', '48', '96']
        }"
        class="cluster-table pod-table"
      >
        <!-- Pod名称列 -->
        <template #name="{ text }">
          <div class="cluster-name pod-name">
            <CodepenOutlined />
            <span>{{ text }}</span>
          </div>
        </template>

        <!-- 命名空间列 -->
        <template #namespace="{ text }">
          <a-tag class="env-tag namespace-tag">
            <AppstoreOutlined /> {{ text }}
          </a-tag>
        </template>

        <!-- 状态列 -->
        <template #status="{ text }">
          <a-tag :color="getPodStatusColor(text)" class="status-tag">
            <span class="status-dot"></span>
            {{ text }}
          </a-tag>
        </template>

        <!-- IP地址列 -->
        <template #ip="{ text }">
          <div class="timestamp ip-address">
            <GlobalOutlined />
            <span>{{ text }}</span>
          </div>
        </template>

        <!-- 创建时间列 -->
        <template #age="{ text }">
          <div class="timestamp">
            <ClockCircleOutlined />
            <span>{{ text }}</span>
          </div>
        </template>

        <!-- 操作列 -->
        <template #action="{ record }">
          <div class="action-column">
            <a-tooltip title="查看 YAML">
              <a-button type="primary" ghost shape="circle" @click="viewPodYaml(record)">
                <template #icon><CodeOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="查看日志">
              <a-button type="primary" ghost shape="circle" @click="viewPodLogs(record)">
                <template #icon><FileTextOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="删除 Pod">
              <a-popconfirm
                title="确定要删除该 Pod 吗?"
                description="此操作不可撤销"
                @confirm="handleDelete(record)"
                ok-text="确定"
                cancel-text="取消"
              >
                <a-button type="primary" danger ghost shape="circle">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-popconfirm>
            </a-tooltip>
          </div>
        </template>

        <!-- 空状态 -->
        <template #emptyText>
          <div class="empty-state">
            <CloudServerOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
            <p>暂无Pod数据</p>
            <a-button type="primary" @click="getPods">刷新数据</a-button>
          </div>
        </template>
      </a-table>

      <!-- 卡片视图 -->
      <div v-else class="card-view">
        <a-spin :spinning="loading">
          <a-empty v-if="filteredPods.length === 0" description="暂无Pod数据">
            <template #image>
              <CloudServerOutlined style="font-size: 64px; color: #d9d9d9;" />
            </template>
            <template #description>
              <span style="color: #999;">暂无Pod数据</span>
            </template>
            <a-button type="primary" @click="getPods">刷新数据</a-button>
          </a-empty>
          <div v-else class="cluster-cards pod-cards">
            <a-checkbox-group v-model:value="selectedCardIds" class="card-checkbox-group">
              <div v-for="pod in filteredPods" :key="pod.name" class="cluster-card pod-card">
                <div class="card-header">
                  <a-checkbox :value="pod.name" class="card-checkbox" />
                  <div class="service-title pod-title">
                    <CodepenOutlined class="service-icon" />
                    <h3>{{ pod.name }}</h3>
                  </div>
                  <a-tag :color="getPodStatusColor(pod.status)" class="card-type-tag env-tag status-tag">
                    <span class="status-dot"></span>
                    {{ pod.status }}
                  </a-tag>
                </div>

                <div class="card-content">
                  <div class="card-detail namespace-detail">
                    <span class="detail-label">命名空间:</span>
                    <span class="detail-value">
                      <AppstoreOutlined />
                      {{ pod.namespace }}
                    </span>
                  </div>
                  <div class="card-detail ip-detail">
                    <span class="detail-label">IP地址:</span>
                    <span class="detail-value">
                      <GlobalOutlined />
                      {{ pod.ip }}
                    </span>
                  </div>
                  <div class="card-detail age-detail">
                    <span class="detail-label">创建时间:</span>
                    <span class="detail-value">
                      <ClockCircleOutlined />
                      {{ pod.age }}
                    </span>
                  </div>
                  <div class="card-detail containers-detail">
                    <span class="detail-label">容器数量:</span>
                    <span class="detail-value">{{ pod.containers?.length || 0 }}</span>
                  </div>
                </div>

                <div class="card-footer card-action-footer">
                  <a-button type="primary" ghost size="small" @click="viewPodYaml(pod)">
                    <template #icon><CodeOutlined /></template>
                    YAML
                  </a-button>
                  <a-button type="primary" ghost size="small" @click="viewPodLogs(pod)">
                    <template #icon><FileTextOutlined /></template>
                    日志
                  </a-button>
                  <a-popconfirm title="确定要删除该 Pod 吗?" @confirm="handleDelete(pod)" ok-text="确定" cancel-text="取消">
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

    <!-- Pod YAML 模态框 -->
    <a-modal 
      v-model:open="yamlModalVisible" 
      title="Pod YAML 配置" 
      width="900px" 
      class="cluster-modal yaml-modal" 
      :footer="null"
    >
      <a-alert v-if="selectedPod" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ selectedPod.name }} ({{ selectedPod.namespace }})</span>
        </template>
        <template #description>
          <div>状态: {{ selectedPod.status }} | IP: {{ selectedPod.ip }}</div>
        </template>
      </a-alert>
      
      <div class="yaml-actions">
        <a-button type="primary" size="small" @click="copyYaml">
          <template #icon><CopyOutlined /></template>
          复制
        </a-button>
      </div>
      <pre class="yaml-editor">{{ podYaml }}</pre>
    </a-modal>

    <!-- Pod 日志查看模态框 -->
    <a-modal 
      v-model:open="logModalVisible" 
      title="Pod 日志查看" 
      width="900px" 
      :footer="null" 
      class="cluster-modal logs-modal"
    >
      <a-alert v-if="selectedPod" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ selectedPod.name }} ({{ selectedPod.namespace }})</span>
        </template>
        <template #description>
          <div>状态: {{ selectedPod.status }}</div>
        </template>
      </a-alert>

      <div class="logs-toolbar">
        <a-select 
          v-model:value="selectedContainer" 
          class="form-select container-select" 
          placeholder="选择容器"
          @change="handleContainerChange"
        >
          <template #suffixIcon><ContainerOutlined /></template>
          <a-select-option v-for="container in containers" :key="container" :value="container">
            <span class="container-option">
              <ContainerOutlined />
              {{ container }}
            </span>
          </a-select-option>
        </a-select>

        <a-button type="primary" @click="fetchPodLogs" :disabled="!selectedContainer" class="logs-refresh-btn">
          <template #icon><SyncOutlined /></template>
          刷新日志
        </a-button>

        <a-button type="primary" @click="copyLogs" :disabled="!podLogs">
          <template #icon><CopyOutlined /></template>
          复制
        </a-button>
      </div>

      <a-spin :spinning="logsLoading">
        <div class="logs-container">
          <template v-if="podLogs">
            <div class="logs-lines">
              <div v-for="(line, index) in podLogs.split('\n')" :key="index" class="log-line">
                <span class="line-number">{{ index + 1 }}</span>
                <span class="line-content">{{ line }}</span>
              </div>
            </div>
          </template>
          <a-empty v-else description="选择容器并获取日志" />
        </div>
      </a-spin>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { message } from 'ant-design-vue';
import {
  getPodsByNamespaceApi,
  getContainersByPodNameApi,
  getContainerLogsApi,
  getPodYamlApi,
  deletePodApi,
  getNamespacesByClusterIdApi,
  getAllClustersApi
} from '#/api';
import type { PodInfo } from '#/api';
import {
  SyncOutlined,
  DeleteOutlined,
  CloudServerOutlined,
  TableOutlined,
  AppstoreOutlined,
  ReloadOutlined,
  CodepenOutlined,
  CodeOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  ClusterOutlined,
  PartitionOutlined,
  DashboardOutlined,
  FileTextOutlined,
  ContainerOutlined,
  GlobalOutlined
} from '@ant-design/icons-vue';

// 使用API中的PodInfo类型
interface PodWithIP extends PodInfo {
  ip?: string;
}

type Pod = PodWithIP;

// 状态变量
const loading = ref(false);
const logsLoading = ref(false);
const clustersLoading = ref(false);
const namespacesLoading = ref(false);
const pods = ref<Pod[]>([]);
const searchText = ref('');
const selectedRows = ref<Pod[]>([]);
const namespaces = ref<string[]>(['default']);
const selectedNamespace = ref('default');
const yamlModalVisible = ref(false);
const logModalVisible = ref(false);
const podYaml = ref('');
const podLogs = ref('');
const selectedPod = ref<Pod | null>(null);
const selectedContainer = ref('');
const containers = ref<string[]>([]);
const clusters = ref<Array<{ id: number, name: string }>>([]);
const selectedCluster = ref<number>();
const viewMode = ref<'table' | 'card'>('table');
const selectedCardIds = ref<string[]>([]);

// 表格列配置
const columns = [
  {
    title: 'Pod 名称',
    dataIndex: 'name',
    key: 'name',
    width: '25%',
    sorter: (a: Pod, b: Pod) => a.name.localeCompare(b.name),
    slots: { customRender: 'name' },
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    width: '15%',
    slots: { customRender: 'namespace' },
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: '12%',
    slots: { customRender: 'status' },
    filters: [
      { text: 'Running', value: 'Running' },
      { text: 'Pending', value: 'Pending' },
      { text: 'Failed', value: 'Failed' },
      { text: 'Succeeded', value: 'Succeeded' },
      { text: 'Unknown', value: 'Unknown' },
    ],
    onFilter: (value: string, record: Pod) => record.status === value,
  },
  {
    title: 'IP地址',
    dataIndex: 'ip',
    key: 'ip',
    width: '15%',
    slots: { customRender: 'ip' },
  },
  {
    title: '创建时间',
    dataIndex: 'age',
    key: 'age',
    width: '15%',
    sorter: (a: Pod, b: Pod) => a.age.localeCompare(b.age),
    slots: { customRender: 'age' },
  },
  {
    title: '操作',
    key: 'action',
    width: '18%',
    fixed: 'right',
    slots: { customRender: 'action' },
  },
];

// 计算属性
const filteredPods = computed(() => {
  const searchValue = searchText.value.toLowerCase().trim();
  return pods.value.filter((pod: Pod) => pod.name.toLowerCase().includes(searchValue));
});

const selectedClusterName = computed(() => {
  const cluster = clusters.value.find(c => c.id === selectedCluster.value);
  return cluster ? cluster.name : '';
});

const runningPodsCount = computed(() =>
  pods.value.filter((pod: Pod) => pod.status === 'Running').length
);

// 运行中的Pod百分比
// const runningPodsPercentage = computed(() =>
//   pods.value.length > 0 ? Math.round((runningPodsCount.value / pods.value.length) * 100) : 0
// );

const problemPodsCount = computed(() =>
  pods.value.filter((pod: Pod) => ['Failed', 'Unknown', 'Pending'].includes(pod.status)).length
);

// 问题Pod的百分比
// const problemPodsPercentage = computed(() =>
//   pods.value.length > 0 ? Math.round((problemPodsCount.value / pods.value.length) * 100) : 0
// );

// 根据卡片选择更新 selectedRows
watch(selectedCardIds, (newValue) => {
  selectedRows.value = pods.value.filter((pod: Pod) =>
    newValue.includes(pod.name)
  );
});

// 表格选择配置
const rowSelection = {
  onChange: (_: string[], selectedRowsData: Pod[]) => {
    selectedRows.value = selectedRowsData;
    selectedCardIds.value = selectedRowsData.map(row => row.name);
  },
  getCheckboxProps: (_: Pod) => ({
    disabled: false, // 可以根据条件禁用某些行的选择
  }),
};

// 获取Pod状态对应的颜色
const getPodStatusColor = (status: string) => {
  const statusColors: Record<string, string> = {
    Running: 'green',
    Pending: 'orange',
    Failed: 'red',
    Succeeded: 'blue',
    Unknown: 'gray',
  };
  return statusColors[status] || 'default';
};

// 获取Pod列表
const getPods = async () => {
  if (!selectedCluster.value) {
    message.warning('请先选择集群');
    return;
  }
  loading.value = true;
  try {
    const res = await getPodsByNamespaceApi(selectedCluster.value, selectedNamespace.value);
    pods.value = res || [];
    selectedRows.value = [];
    selectedCardIds.value = [];
  } catch (error: any) {
    message.error(error.message || '获取Pod列表失败');
  } finally {
    loading.value = false;
  }
};

const getNamespaces = async () => {
  if (!selectedCluster.value) {
    message.warning('请先选择集群');
    return;
  }

  namespacesLoading.value = true;
  try {
    const res = await getNamespacesByClusterIdApi(selectedCluster.value);
    if (!res) {
      throw new Error('获取命名空间数据为空');
    }

    // 只获取name字段组成新数组
    namespaces.value = res.map((ns: { name: string }) => ns.name);

    // 如果没有选中的命名空间,默认选择第一个
    if (namespaces.value.length > 0) {
      selectedNamespace.value = selectedNamespace.value ?? namespaces.value[0];
    }
  } catch (error: any) {
    message.error(error.message || '获取命名空间列表失败');
    namespaces.value = ['default'];
    selectedNamespace.value = 'default';
  } finally {
    namespacesLoading.value = false;
  }
};

const getClusters = async () => {
  clustersLoading.value = true;
  try {
    const res = await getAllClustersApi();
    clusters.value = res || [];

    // 如果有集群数据，默认选择第一个
    if (clusters.value.length > 0 && clusters.value[0]?.id) {
      selectedCluster.value = clusters.value[0].id;
      await getNamespaces();
      await getPods();
    }
  } catch (error: any) {
    message.error(error.message || '获取集群列表失败');
    clusters.value = [];
  } finally {
    clustersLoading.value = false;
  }
};

// 复制YAML
const copyYaml = async () => {
  try {
    await navigator.clipboard.writeText(podYaml.value);
    message.success('YAML 已复制到剪贴板');
  } catch (err) {
    message.error('复制失败，请手动选择并复制');
  }
};

// 复制日志
const copyLogs = async () => {
  try {
    await navigator.clipboard.writeText(podLogs.value);
    message.success('日志已复制到剪贴板');
  } catch (err) {
    message.error('复制失败，请手动选择并复制');
  }
};

// 搜索
const onSearch = () => {
  // 搜索逻辑已经在计算属性中实现，这里可以添加其他触发行为
};

// 查看Pod YAML
const viewPodYaml = async (pod: Pod) => {
  if (!selectedCluster.value) return;
  selectedPod.value = pod;
  yamlModalVisible.value = true;
  podYaml.value = '加载中...';

  try {
    const res = await getPodYamlApi(selectedCluster.value, pod.name, pod.namespace);
    podYaml.value = res;
  } catch (error: any) {
    message.error(error.message || '获取Pod YAML失败');
    podYaml.value = '加载失败';
  }
};

// 查看Pod日志
const viewPodLogs = async (pod: Pod) => {
  if (!selectedCluster.value) return;
  selectedPod.value = pod;
  logModalVisible.value = true;
  podLogs.value = '';
  selectedContainer.value = '';
  logsLoading.value = true;

  try {
    // 获取容器列表
    const res = await getContainersByPodNameApi(selectedCluster.value, pod.name, pod.namespace);
    if (res) {
      containers.value = res.map((container: { name: string }) => container.name);

      // 如果有容器，选择第一个并获取日志
      if (containers.value.length > 0) {
        selectedContainer.value = containers.value[0] ?? '';
        await fetchPodLogs();
      }
    }
  } catch (error: any) {
    message.error(error.message || '获取容器列表失败');
  } finally {
    logsLoading.value = false;
  }
};

// 获取Pod日志
const fetchPodLogs = async () => {
  if (!selectedPod.value || !selectedContainer.value || !selectedCluster.value) return;

  logsLoading.value = true;
  try {
    const logs = await getContainerLogsApi(
      selectedCluster.value,
      selectedPod.value.name,
      selectedContainer.value,
      selectedPod.value.namespace
    );
    podLogs.value = logs || '暂无日志';
  } catch (error: any) {
    message.error(error.message || '获取容器日志失败');
    podLogs.value = '';
  } finally {
    logsLoading.value = false;
  }
};

// 切换容器时重新获取日志
const handleContainerChange = () => {
  podLogs.value = '';
  fetchPodLogs();
};

// 切换命名空间
const handleNamespaceChange = () => {
  getPods();
};

// 切换集群
const handleClusterChange = () => {
  getNamespaces();
  getPods();
};

// 删除Pod
const handleDelete = async (pod: Pod) => {
  if (!selectedCluster.value) return;
  try {
    await deletePodApi(selectedCluster.value, pod.name, pod.namespace);
    message.success(`Pod ${pod.name} 删除成功`);
    await getPods(); // 删除成功后立即刷新数据
  } catch (error: any) {
    message.error(error.message || '删除Pod失败');
  }
};

// 批量删除Pod
const handleBatchDelete = async () => {
  if (!selectedRows.value.length || !selectedCluster.value) return;

  try {
    loading.value = true;
    const promises = selectedRows.value.map((pod: Pod) =>
      deletePodApi(selectedCluster.value!, pod.name, pod.namespace)
    );

    await Promise.all(promises);
    message.success(`成功删除 ${selectedRows.value.length} 个Pod`);
    selectedRows.value = [];
    selectedCardIds.value = [];
    await getPods(); // 删除成功后立即刷新数据
  } catch (error: any) {
    message.error(error.message || '批量删除失败');
  } finally {
    loading.value = false;
  }
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

.cluster-name {
  font-size: 18px !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
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

.cluster-option,
.namespace-option,
.container-option {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cluster-option :deep(svg),
.namespace-option :deep(svg),
.container-option :deep(svg) {
  margin-right: 4px;
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

.pod-name {
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

.env-tag, .status-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: var(--border-radius-base);
  font-size: 12px;
  border: none;
}

.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
}

.timestamp {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: var(--font-size-base);
}

.ip-address {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Courier New', monospace;
  color: #595959;
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

.form-select {
  border-radius: var(--border-radius-sm);
  transition: all var(--transition-duration) var(--transition-function);
  font-size: var(--font-size-base);
}

.form-select:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
}

/* YAML模态框 */
.yaml-modal {
  font-family: "Consolas", "Monaco", monospace;
}

.yaml-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}

.yaml-editor {
  background-color: #f5f5f5;
  padding: 16px;
  border-radius: 4px;
  height: 400px;
  overflow: auto;
  font-size: 13px;
  white-space: pre-wrap;
  font-family: "Consolas", "Monaco", monospace;
}

/* 日志模态框 */
.logs-modal .logs-toolbar {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.logs-modal .container-select {
  flex: 1;
}

.logs-container {
  background-color: #1e1e1e;
  color: #f1f1f1;
  border-radius: 4px;
  height: 400px;
  overflow: auto;
  font-family: "Consolas", "Monaco", monospace;
  font-size: 13px;
}

.logs-lines {
  padding: 8px 0;
}

.log-line {
  display: flex;
  padding: 2px 8px;
}

.log-line:hover {
  background-color: #333;
}

.line-number {
  color: #888;
  min-width: 50px;
  text-align: right;
  padding-right: 16px;
  user-select: none;
}

.line-content {
  white-space: pre-wrap;
  word-break: break-all;
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
