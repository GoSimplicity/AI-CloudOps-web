<template>
  <div class="k8s-endpoint">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2>Endpoint 管理</h2>
      <p>查看和管理 Kubernetes 集群中的服务端点信息</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="总端点数"
              :value="stats.total"
              :loading="loading"
              value-style="color: #1890ff"
            />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="就绪端点"
              :value="stats.ready"
              :loading="loading"
              value-style="color: #52c41a"
            />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="未就绪端点"
              :value="stats.notReady"
              :loading="loading"
              value-style="color: #ff4d4f"
            />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="关联服务数"
              :value="stats.services"
              :loading="loading"
              value-style="color: #722ed1"
            />
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- 工具栏 -->
    <a-card class="toolbar-card">
      <a-row :gutter="16" align="middle">
        <!-- 集群选择 -->
        <a-col :span="4">
          <a-select
            v-model:value="selectedCluster"
            placeholder="选择集群"
            :loading="clustersLoading"
            @change="onClusterChange"
            style="width: 100%"
          >
            <a-select-option
              v-for="cluster in clusters"
              :key="cluster.id"
              :value="cluster.id"
            >
              {{ cluster.name }}
            </a-select-option>
          </a-select>
        </a-col>

        <!-- 命名空间选择 -->
        <a-col :span="4">
          <a-select
            v-model:value="selectedNamespace"
            placeholder="选择命名空间"
            :loading="namespacesLoading"
            @change="loadEndpoints"
            style="width: 100%"
            :disabled="!selectedCluster"
          >
            <a-select-option value="">全部命名空间</a-select-option>
            <a-select-option
              v-for="ns in namespaces"
              :key="ns.name"
              :value="ns.name"
            >
              {{ ns.name }}
            </a-select-option>
          </a-select>
        </a-col>

        <!-- 状态筛选 -->
        <a-col :span="3">
          <a-select
            v-model:value="statusFilter"
            placeholder="状态筛选"
            @change="loadEndpoints"
            style="width: 100%"
          >
            <a-select-option value="">全部状态</a-select-option>
            <a-select-option value="ready">就绪</a-select-option>
            <a-select-option value="not-ready">未就绪</a-select-option>
          </a-select>
        </a-col>

        <!-- 搜索 -->
        <a-col :span="5">
          <a-input-search
            v-model:value="searchText"
            placeholder="搜索服务或IP地址"
            @search="loadEndpoints"
            @change="loadEndpoints"
            allow-clear
          />
        </a-col>

        <!-- 操作按钮 -->
        <a-col :span="8" style="text-align: right">
          <a-space>
            <a-button @click="loadEndpoints" :loading="loading">
              <template #icon><ReloadOutlined /></template>
              刷新
            </a-button>
            <a-button type="primary" @click="showConnectivityTest = true" :disabled="!selectedEndpoints.length">
              <template #icon><ApiOutlined /></template>
              连通性测试
            </a-button>
            <a-dropdown>
              <a-button>
                <template #icon><MoreOutlined /></template>
                更多操作
                <DownOutlined />
              </a-button>
              <template #overlay>
                <a-menu @click="handleMoreAction">
                  <a-menu-item key="export">
                    <ExportOutlined />
                    导出列表
                  </a-menu-item>
                  <a-menu-item key="monitor">
                    <LineChartOutlined />
                    监控面板
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 端点列表 -->
    <a-card class="table-card">
      <a-table
        :columns="columns"
        :data-source="filteredEndpoints"
        :loading="loading"
        :pagination="pagination"
        :row-selection="rowSelection"
        :scroll="{ x: 1200 }"
        row-key="id"
        size="middle"
        @change="handleTableChange"
      >
        <!-- 服务名称 -->
        <template #serviceName="{ record }">
          <div class="service-name">
            <a-tag color="blue">{{ record.service_name }}</a-tag>
            <div class="namespace-info">{{ record.namespace }}</div>
          </div>
        </template>

        <!-- 端点地址 -->
        <template #endpoint="{ record }">
          <div class="endpoint-info">
            <div class="endpoint-ip">
              <CodeOutlined />
              {{ record.ip }}:{{ record.port }}
            </div>
            <div class="endpoint-protocol">
              <a-tag size="small" :color="getProtocolColor(record.protocol)">
                {{ record.protocol }}
              </a-tag>
            </div>
          </div>
        </template>

        <!-- 就绪状态 -->
        <template #ready="{ record }">
          <a-tag :color="record.ready ? 'success' : 'error'">
            <CheckCircleOutlined v-if="record.ready" />
            <CloseCircleOutlined v-else />
            {{ record.ready ? '就绪' : '未就绪' }}
          </a-tag>
        </template>

        <!-- 节点信息 -->
        <template #nodeInfo="{ record }">
          <div v-if="record.node_name" class="node-info">
            <div class="node-name">
              <DesktopOutlined />
              {{ record.node_name }}
            </div>
          </div>
          <span v-else class="text-muted">-</span>
        </template>

        <!-- 服务类型 -->
        <template #serviceType="{ record }">
          <a-tag :color="getServiceTypeColor(record.service_type)">
            {{ record.service_type }}
          </a-tag>
        </template>

        <!-- 创建时间 -->
        <template #createdTime="{ record }">
          <div class="time-info">
            <div>{{ record.creation_timestamp }}</div>
            <div class="age-info">{{ record.age }}</div>
          </div>
        </template>

        <!-- 操作列 -->
        <template #action="{ record }">
          <a-space>
            <a-button type="link" size="small" @click="viewEndpointDetail">
              <EyeOutlined />
              详情
            </a-button>
            <a-button type="link" size="small" @click="testEndpointConnectivity(record)">
              <ApiOutlined />
              测试
            </a-button>
            <a-dropdown>
              <a-button type="link" size="small">
                <MoreOutlined />
              </a-button>
              <template #overlay>
                <a-menu @click="(e: any) => handleEndpointAction(e.key, record)">
                  <a-menu-item key="events">
                    <HistoryOutlined />
                    查看事件
                  </a-menu-item>
                  <a-menu-item key="monitor">
                    <LineChartOutlined />
                    监控数据
                  </a-menu-item>
                  <a-menu-item key="copy">
                    <CopyOutlined />
                    复制地址
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </a-space>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { message } from 'ant-design-vue';
import {
  ReloadOutlined,
  ApiOutlined,
  MoreOutlined,
  DownOutlined,
  ExportOutlined,
  LineChartOutlined,
  EyeOutlined,
  HistoryOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  DesktopOutlined,
} from '@ant-design/icons-vue';

// API imports
import { getAllClustersApi } from '#/api/core/k8s_cluster';
import { getNamespacesByClusterIdApi } from '#/api/core/k8s_namespace';
import { getServiceListApi, testServiceConnectivityApi } from '#/api/core/k8s_service';
import type { ServiceEndpoint } from '#/api/core/k8s_service';

// 数据定义

interface EndpointInfo extends ServiceEndpoint {
  id: string;
  service_name: string;
  namespace: string;
  service_type: string;
  service_selector?: Record<string, string>;
  service_labels?: Record<string, string>;
  creation_timestamp: string;
  age: string;
}



const loading = ref(false);
const clustersLoading = ref(false);
const namespacesLoading = ref(false);

const selectedCluster = ref<number>();
const selectedNamespace = ref<string>('');
const statusFilter = ref<string>('');
const searchText = ref<string>('');

const clusters = ref<any[]>([]);
const namespaces = ref<any[]>([]);
const endpoints = ref<EndpointInfo[]>([]);
const selectedEndpoints = ref<string[]>([]);

const showConnectivityTest = ref(false);

// 计算属性

const stats = computed(() => {
  const total = endpoints.value.length;
  const ready = endpoints.value.filter(ep => ep.ready).length;
  const notReady = total - ready;
  const services = new Set(endpoints.value.map(ep => `${ep.namespace}/${ep.service_name}`)).size;
  
  return { total, ready, notReady, services };
});

const filteredEndpoints = computed(() => {
  let filtered = [...endpoints.value];
  
  // 状态筛选
  if (statusFilter.value) {
    if (statusFilter.value === 'ready') {
      filtered = filtered.filter(ep => ep.ready);
    } else if (statusFilter.value === 'not-ready') {
      filtered = filtered.filter(ep => !ep.ready);
    }
  }
  
  // 搜索筛选
  if (searchText.value) {
    const search = searchText.value.toLowerCase();
    filtered = filtered.filter(ep => 
      ep.service_name.toLowerCase().includes(search) ||
      ep.ip.toLowerCase().includes(search) ||
      ep.namespace.toLowerCase().includes(search)
    );
  }
  
  return filtered;
});

// 表格配置

const columns = [
  {
    title: '服务名称',
    dataIndex: 'service_name',
    key: 'service_name',
    slots: { customRender: 'serviceName' },
    width: 200,
    ellipsis: true,
  },
  {
    title: '端点地址',
    dataIndex: 'endpoint',
    key: 'endpoint',
    slots: { customRender: 'endpoint' },
    width: 180,
  },
  {
    title: '就绪状态',
    dataIndex: 'ready',
    key: 'ready',
    slots: { customRender: 'ready' },
    width: 100,
    filters: [
      { text: '就绪', value: true },
      { text: '未就绪', value: false },
    ],
  },
  {
    title: '节点信息',
    dataIndex: 'node_name',
    key: 'node_name',
    slots: { customRender: 'nodeInfo' },
    width: 150,
    ellipsis: true,
  },
  {
    title: '服务类型',
    dataIndex: 'service_type',
    key: 'service_type',
    slots: { customRender: 'serviceType' },
    width: 100,
  },
  {
    title: '创建时间',
    dataIndex: 'creation_timestamp',
    key: 'creation_timestamp',
    slots: { customRender: 'createdTime' },
    width: 180,
    sorter: (a: EndpointInfo, b: EndpointInfo) => 
      new Date(a.creation_timestamp).getTime() - new Date(b.creation_timestamp).getTime(),
  },
  {
    title: '操作',
    key: 'action',
    slots: { customRender: 'action' },
    width: 150,
    fixed: 'right',
  },
];

const pagination = reactive({
  current: 1,
  pageSize: 20,
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 个端点`,
});

const rowSelection = {
  selectedRowKeys: selectedEndpoints,
  onChange: (keys: string[]) => {
    selectedEndpoints.value = keys;
  },
  onSelectAll: (selected: boolean, selectedRows: EndpointInfo[], changeRows: EndpointInfo[]) => {
    console.log('全选状态:', selected, selectedRows, changeRows);
  },
};

// 方法定义

/**
 * 获取集群列表
 */
const getClusters = async () => {
  try {
    clustersLoading.value = true;
    const response = await getAllClustersApi();
    clusters.value = response || [];
    
    // 选择第一个集群
    if (clusters.value.length > 0 && clusters.value[0]) {
      selectedCluster.value = clusters.value[0].id;
      await getNamespaces();
    }
  } catch (error) {
    console.error('获取集群列表失败:', error);
    message.error('获取集群列表失败');
  } finally {
    clustersLoading.value = false;
  }
};

/**
 * 获取命名空间列表
 */
const getNamespaces = async () => {
  if (!selectedCluster.value) return;
  
  try {
    namespacesLoading.value = true;
    const response = await getNamespacesByClusterIdApi(selectedCluster.value);
    namespaces.value = response || [];
  } catch (error) {
    console.error('获取命名空间列表失败:', error);
    message.error('获取命名空间列表失败');
  } finally {
    namespacesLoading.value = false;
  }
};

/**
 * 加载端点列表
 */
const loadEndpoints = async () => {
  if (!selectedCluster.value) return;
  
  try {
    loading.value = true;
    const allEndpoints: EndpointInfo[] = [];
    
    // 获取所有服务及其端点
    const services = await getServiceListApi(selectedCluster.value, selectedNamespace.value || '');
    
    for (const service of services) {
      // 为每个端点创建记录
      service.endpoints.forEach((endpoint, index) => {
        allEndpoints.push({
          ...endpoint,
          id: `${service.cluster_id}-${service.namespace}-${service.name}-${endpoint.ip}-${endpoint.port}-${index}`,
          service_name: service.name,
          namespace: service.namespace,
          service_type: service.type,
          service_selector: service.selector,
          service_labels: service.labels,
          creation_timestamp: service.creation_timestamp,
          age: service.age,
        });
      });
    }
    
    endpoints.value = allEndpoints;
  } catch (error) {
    console.error('获取端点列表失败:', error);
    message.error('获取端点列表失败');
  } finally {
    loading.value = false;
  }
};

/**
 * 集群变更处理
 */
const onClusterChange = async () => {
  selectedNamespace.value = '';
  await Promise.all([getNamespaces(), loadEndpoints()]);
};

/**
 * 表格变更处理
 */
const handleTableChange = (pag: any) => {
  pagination.current = pag.current;
  pagination.pageSize = pag.pageSize;
};

/**
 * 获取协议颜色
 */
const getProtocolColor = (protocol: string) => {
  const colorMap: Record<string, string> = {
    'TCP': 'blue',
    'UDP': 'green',
    'HTTP': 'orange',
    'HTTPS': 'red',
  };
  return colorMap[protocol] || 'default';
};

/**
 * 获取服务类型颜色
 */
const getServiceTypeColor = (type: string) => {
  const colorMap: Record<string, string> = {
    'ClusterIP': 'blue',
    'NodePort': 'green',
    'LoadBalancer': 'orange',
    'ExternalName': 'purple',
  };
  return colorMap[type] || 'default';
};

/**
 * 查看端点详情
 */
const viewEndpointDetail = () => {
  message.info('端点详情功能开发中');
};

/**
 * 测试端点连通性
 */
const testEndpointConnectivity = async (endpoint: EndpointInfo) => {
  try {
    const result = await testServiceConnectivityApi(
      selectedCluster.value!,
      endpoint.namespace,
      endpoint.service_name
    );
    
    if (result.success) {
      message.success(`连通性测试成功: ${result.message || '连接正常'}`);
    } else {
      message.error(`连通性测试失败: ${result.message || '连接异常'}`);
    }
  } catch (error) {
    console.error('连通性测试失败:', error);
    message.error('连通性测试失败');
  }
};

/**
 * 处理端点操作
 */
const handleEndpointAction = async (action: string, endpoint: EndpointInfo) => {
  switch (action) {
    case 'events':
      message.info('查看事件功能开发中');
      break;
    case 'monitor':
      message.info('监控数据功能开发中');
      break;
    case 'copy':
      try {
        await navigator.clipboard.writeText(`${endpoint.ip}:${endpoint.port}`);
        message.success('端点地址已复制到剪贴板');
      } catch (error) {
        message.error('复制失败');
      }
      break;
  }
};

/**
 * 处理更多操作
 */
const handleMoreAction = ({ key }: { key: string }) => {
  switch (key) {
    case 'export':
      message.info('导出功能开发中');
      break;
    case 'monitor':
      message.info('监控面板功能开发中');
      break;
  }
};

// 生命周期

onMounted(() => {
  getClusters();
});

// 监听集群变化
watch(selectedCluster, () => {
  if (selectedCluster.value) {
    loadEndpoints();
  }
});
</script>

<style scoped lang="less">
.k8s-endpoint {
  padding: 24px;
  background-color: #f5f5f5;
  min-height: 100vh;

  .page-header {
    margin-bottom: 24px;
    
    h2 {
      margin: 0 0 8px 0;
      color: #262626;
      font-size: 24px;
      font-weight: 600;
    }
    
    p {
      margin: 0;
      color: #8c8c8c;
      font-size: 14px;
    }
  }

  .stats-cards {
    margin-bottom: 24px;
    
    .ant-card {
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }
  }

  .toolbar-card,
  .table-card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    margin-bottom: 24px;
  }

  .table-card {
    margin-bottom: 0;
  }

  // 表格样式
  .service-name {
    .namespace-info {
      font-size: 12px;
      color: #8c8c8c;
      margin-top: 4px;
    }
  }

  .endpoint-info {
    .endpoint-ip {
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 13px;
    }

    .endpoint-protocol {
      margin-top: 4px;
    }
  }

  .node-info {
    .node-name {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
    }
  }

  .time-info {
    .age-info {
      font-size: 12px;
      color: #8c8c8c;
      margin-top: 4px;
    }
  }

  .text-muted {
    color: #8c8c8c;
  }

  // 响应式设计
  @media (max-width: 768px) {
    padding: 16px;

    .toolbar-card .ant-row > .ant-col {
      margin-bottom: 8px;
    }
  }
}

// 暗色主题支持
[data-theme='dark'] .k8s-endpoint {
  background-color: #141414;

  .page-header {
    h2 {
      color: #f0f0f0;
    }
    
    p {
      color: #a6a6a6;
    }
  }

  .text-muted {
    color: #a6a6a6;
  }
}
</style>
