<template>
  <div class="cluster-management-container service-management-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="page-title">
            <ApiOutlined class="title-icon" />
            <h1>Kubernetes Service 管理</h1>
          </div>
          <p class="page-subtitle">管理和监控集群中的所有Service资源</p>
        </div>
        <div class="header-actions">
          <a-button type="primary" size="large" @click="isCreateModalVisible = true">
            <template #icon><PlusOutlined /></template>
            创建服务
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
          <ApiOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ services.length }}</div>
          <div class="card-label">Service 总数</div>
        </div>
      </div>
      
      <div class="overview-card running-clusters">
        <div class="card-icon">
          <CheckCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ activeServices }}</div>
          <div class="card-label">活跃服务</div>
        </div>
      </div>
      
      <div class="overview-card env-types">
        <div class="card-icon">
          <PartitionOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ Object.keys(serviceTypeDistribution).length }}</div>
          <div class="card-label">服务类型</div>
        </div>
      </div>
      
      <div class="overview-card resource-usage">
        <div class="card-icon">
          <GlobalOutlined />
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

        <a-select
          v-model:value="filterServiceType"
          placeholder="服务类型"
          class="env-filter type-selector"
          allow-clear
          @change="handleTypeFilterChange"
        >
          <template #suffixIcon><ApiOutlined /></template>
          <a-select-option value="ClusterIP">ClusterIP</a-select-option>
          <a-select-option value="NodePort">NodePort</a-select-option>
          <a-select-option value="LoadBalancer">LoadBalancer</a-select-option>
          <a-select-option value="ExternalName">ExternalName</a-select-option>
        </a-select>
        
        <a-input-search
          v-model:value="searchText"
          placeholder="搜索 Service 名称"
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
      <div class="display-header" v-if="filteredServices.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ filteredServices.length }} 个Service</span>
          <div class="env-tags">
            <a-tag v-for="(count, type) in serviceTypeDistribution" :key="type" :color="getServiceTypeColor(type)">
              {{ type }} {{ count }}
            </a-tag>
            <a-tag color="blue">{{ selectedNamespace }}</a-tag>
          </div>
        </div>
      </div>

      <!-- 表格视图 -->
      <a-table
        v-if="viewMode === 'table'"
        :columns="columns"
        :data-source="filteredServices"
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
        class="cluster-table services-table"
      >
        <!-- Service名称列 -->
        <template #name="{ text }">
          <div class="cluster-name service-name">
            <ApiOutlined />
            <span>{{ text }}</span>
          </div>
        </template>

        <!-- 命名空间列 -->
        <template #namespace="{ text }">
          <a-tag class="env-tag namespace-tag">
            <AppstoreOutlined /> {{ text }}
          </a-tag>
        </template>
        
        <!-- 类型列 -->
        <template #type="{ text }">
          <a-tag :color="getServiceTypeColor(text)" class="type-tag">
            {{ text }}
          </a-tag>
        </template>

        <!-- 集群IP列 -->
        <template #cluster_ip="{ text }">
          <div class="ip-address">
            <GlobalOutlined />
            <span>{{ text }}</span>
          </div>
        </template>

        <!-- 端口列 -->
        <template #ports="{ record }">
          <div class="ports-info">
            <a-tag v-for="port in record.ports.slice(0, 2)" :key="`${port.port}-${port.protocol}`" color="blue" class="port-tag">
              {{ port.port }}{{ port.target_port ? ':' + port.target_port : '' }}/{{ port.protocol }}
            </a-tag>
            <a-tag v-if="record.ports.length > 2" color="default">
              +{{ record.ports.length - 2 }}
            </a-tag>
          </div>
        </template>

        <!-- 端点列 -->
        <template #endpoints="{ record }">
          <div class="endpoints-info">
            <a-badge :count="record.endpoints?.length || 0" :number-style="{ backgroundColor: '#52c41a' }">
              <a-button type="link" size="small" @click="viewEndpoints(record)">
                端点
              </a-button>
            </a-badge>
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
              <a-button type="primary" ghost shape="circle" size="small" @click="viewServiceYaml(record)">
                <template #icon><CodeOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="端点详情">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewEndpoints(record)">
                <template #icon><LinkOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="端口转发">
              <a-button type="primary" ghost shape="circle" size="small" @click="showPortForward(record)">
                <template #icon><SwapOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="连通性测试">
              <a-button type="primary" ghost shape="circle" size="small" @click="testConnectivity(record)" :loading="testingConnectivity[record.uid]">
                <template #icon><ExperimentOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="编辑服务">
              <a-button type="primary" ghost shape="circle" size="small" @click="handleEdit(record)">
                <template #icon><EditOutlined /></template>
              </a-button>
            </a-tooltip>
            
            <a-tooltip title="删除服务">
              <a-popconfirm
                title="确定要删除该服务吗?"
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
            <ApiOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
            <p>暂无Service数据</p>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </div>
        </template>
      </a-table>

      <!-- 卡片视图 -->
      <div v-else class="card-view">
        <a-spin :spinning="loading">
          <a-empty v-if="filteredServices.length === 0" description="暂无Service数据">
            <template #image>
              <ApiOutlined style="font-size: 64px; color: #d9d9d9;" />
            </template>
            <template #description>
              <span style="color: #999;">暂无Service数据</span>
            </template>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </a-empty>
          <div v-else class="cluster-cards service-cards">
            <a-checkbox-group v-model:value="selectedCardIds" class="card-checkbox-group">
              <div v-for="service in filteredServices" :key="service.uid" class="cluster-card service-card">
                <div class="card-header">
                  <a-checkbox :value="service.uid" class="card-checkbox" />
                  <div class="service-title">
                    <ApiOutlined class="service-icon" />
                    <h3>{{ service.name }}</h3>
                  </div>
                  <a-tag :color="getServiceTypeColor(service.type)" class="card-type-tag type-tag">
                    {{ service.type }}
                  </a-tag>
                </div>
                
                <div class="card-content">
                  <div class="card-detail">
                    <span class="detail-label">命名空间:</span>
                    <span class="detail-value">
                      <AppstoreOutlined />
                      {{ service.namespace }}
                    </span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">集群IP:</span>
                    <span class="detail-value">
                      <GlobalOutlined />
                      {{ service.cluster_ip }}
                    </span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">端口:</span>
                    <span class="detail-value">
                      <a-tag v-for="port in service.ports.slice(0, 2)" :key="`${port.port}-${port.protocol}`" color="blue" size="small">
                        {{ port.port }}/{{ port.protocol }}
                      </a-tag>
                      <span v-if="service.ports.length > 2">+{{ service.ports.length - 2 }}</span>
                    </span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">端点:</span>
                    <span class="detail-value">{{ service.endpoints?.length || 0 }}</span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">创建时间:</span>
                    <span class="detail-value">
                      <ClockCircleOutlined />
                      {{ formatDate(service.creation_timestamp) }}
                    </span>
                  </div>
                </div>
                
                <div class="card-footer card-action-footer">
                  <a-button type="primary" ghost size="small" @click="viewServiceYaml(service)">
                    <template #icon><CodeOutlined /></template>
                    YAML
                  </a-button>
                  <a-button type="primary" ghost size="small" @click="viewEndpoints(service)">
                    <template #icon><LinkOutlined /></template>
                    端点
                  </a-button>
                  <a-button type="primary" ghost size="small" @click="handleEdit(service)">
                    <template #icon><EditOutlined /></template>
                    编辑
                  </a-button>
                  <a-popconfirm
                    title="确定要删除该服务吗?"
                    @confirm="handleDelete(service)"
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

    <!-- 查看 Service YAML 模态框 -->
    <a-modal
      v-model:open="viewYamlModalVisible"
      title="Service YAML 配置"
      width="900px"
      class="cluster-modal yaml-modal"
      :footer="null"
    >
      <a-alert v-if="currentService" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentService.name }} ({{ currentService.namespace }})</span>
        </template>
        <template #description>
          <div>类型: {{ currentService.type }} | 集群IP: {{ currentService.cluster_ip }}</div>
        </template>
      </a-alert>
      
      <div class="yaml-actions">
        <a-button type="primary" size="small" @click="copyYaml">
          <template #icon><CopyOutlined /></template>
          复制
        </a-button>
      </div>
      <pre class="yaml-editor">{{ serviceYaml }}</pre>
    </a-modal>

    <!-- 端点详情模态框 -->
    <a-modal
      v-model:open="endpointsModalVisible"
      title="Service 端点详情"
      width="800px"
      class="cluster-modal"
      :footer="null"
    >
      <a-alert v-if="currentService" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentService.name }} ({{ currentService.namespace }})</span>
        </template>
        <template #description>
          <div>端点总数: {{ serviceEndpoints.length }}</div>
        </template>
      </a-alert>

      <a-table 
        :data-source="serviceEndpoints" 
        :columns="[
          { title: 'IP地址', dataIndex: 'ip', key: 'ip' },
          { title: '端口', dataIndex: 'port', key: 'port', width: '100px' },
          { title: '协议', dataIndex: 'protocol', key: 'protocol', width: '100px' },
          { title: '状态', key: 'ready', width: '100px' },
          { title: '节点', dataIndex: 'node_name', key: 'node_name' }
        ]"
        :loading="endpointsLoading"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'ready'">
            <a-tag :color="record.ready ? 'green' : 'red'">
              {{ record.ready ? '就绪' : '未就绪' }}
            </a-tag>
          </template>
        </template>
      </a-table>
    </a-modal>

    <!-- 端口转发模态框 -->
    <a-modal
      v-model:open="portForwardModalVisible"
      title="Service 端口转发"
      @ok="confirmPortForward"
      @cancel="portForwardModalVisible = false"
      :confirmLoading="loading"
      class="cluster-modal"
    >
      <a-alert v-if="currentService" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentService.name }} ({{ currentService.namespace }})</span>
        </template>
        <template #description>
          <div>配置端口转发规则</div>
        </template>
      </a-alert>

      <a-form layout="vertical">
        <a-form-item label="端口映射" required>
          <div v-for="(mapping, index) in portMappings" :key="index" class="port-mapping-item">
            <a-input-number 
              v-model:value="mapping.local_port" 
              placeholder="本地端口" 
              :min="1" 
              :max="65535" 
              style="width: 120px"
            />
            <span style="margin: 0 8px;">→</span>
            <a-input-number 
              v-model:value="mapping.remote_port" 
              placeholder="远程端口" 
              :min="1" 
              :max="65535" 
              style="width: 120px"
            />
            <a-button type="link" danger @click="removePortMapping(index)" v-if="portMappings.length > 1">
              <template #icon><DeleteOutlined /></template>
            </a-button>
          </div>
          <a-button type="dashed" @click="addPortMapping" block>
            <template #icon><PlusOutlined /></template>
            添加端口映射
          </a-button>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { message } from 'ant-design-vue';
import {
  getServiceListWithFilterApi,
  getServiceYamlApi,
  deleteServiceApi,
  batchDeleteServiceApi,
  getServiceEndpointsApi,
  portForwardServiceApi,
  testServiceConnectivityApi,
  getAllClustersApi,
  getNamespacesByClusterIdApi,
} from '#/api';
import type { 
  ServiceInfo, 
  ServiceListReq,
  ServiceEndpoint,
  PortForwardPort 
} from '#/api';
import { 
  CloudServerOutlined, 
  TableOutlined, 
  AppstoreOutlined, 
  ReloadOutlined,
  DeleteOutlined,
  CodeOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  ClusterOutlined,
  PartitionOutlined,
  GlobalOutlined,
  PlusOutlined,
  EditOutlined,
  LinkOutlined,
  SwapOutlined,
  ExperimentOutlined
} from '@ant-design/icons-vue';

// 状态变量
const loading = ref(false);
const clustersLoading = ref(false);
const namespacesLoading = ref(false);
const endpointsLoading = ref(false);
const services = ref<ServiceInfo[]>([]);
const searchText = ref('');
const filterServiceType = ref<string | undefined>(undefined);
const selectedRows = ref<ServiceInfo[]>([]);
const namespaces = ref<string[]>(['default']);
const selectedNamespace = ref<string>('default');
const viewYamlModalVisible = ref(false);
const endpointsModalVisible = ref(false);
const portForwardModalVisible = ref(false);
const serviceYaml = ref('');
const clusters = ref<Array<{id: number, name: string}>>([]);
const selectedCluster = ref<number>();
const viewMode = ref<'table' | 'card'>('table');
const currentService = ref<ServiceInfo | null>(null);
const selectedCardIds = ref<string[]>([]);
const currentPage = ref(1);
const pageSize = ref(12);
const totalItems = ref(0);
const isCreateModalVisible = ref(false);
const serviceEndpoints = ref<ServiceEndpoint[]>([]);
const testingConnectivity = ref<Record<string, boolean>>({});
const portMappings = ref<PortForwardPort[]>([{ local_port: 8080, remote_port: 80 }]);

// 根据卡片选择更新 selectedRows
watch(selectedCardIds, (newValue) => {
  selectedRows.value = services.value.filter(service => 
    newValue.includes(service.uid)
  );
});

// 表格列配置
const columns = [
  {
    title: 'Service 名称',
    dataIndex: 'name',
    key: 'name',
    slots: { customRender: 'name' },
    width: '16%',
    sorter: (a: ServiceInfo, b: ServiceInfo) => a.name.localeCompare(b.name),
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    width: '12%',
    slots: { customRender: 'namespace' },
    sorter: (a: ServiceInfo, b: ServiceInfo) => a.namespace.localeCompare(b.namespace),
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: '10%',
    slots: { customRender: 'type' },
    filters: [
      { text: 'ClusterIP', value: 'ClusterIP' },
      { text: 'NodePort', value: 'NodePort' },
      { text: 'LoadBalancer', value: 'LoadBalancer' },
      { text: 'ExternalName', value: 'ExternalName' },
    ],
    onFilter: (value: string, record: ServiceInfo) => record.type === value,
  },
  {
    title: '集群IP',
    dataIndex: 'cluster_ip',
    key: 'cluster_ip',
    width: '12%',
    slots: { customRender: 'cluster_ip' },
  },
  {
    title: '端口',
    key: 'ports',
    width: '15%',
    slots: { customRender: 'ports' },
  },
  {
    title: '端点',
    key: 'endpoints',
    width: '8%',
    slots: { customRender: 'endpoints' },
  },
  {
    title: '创建时间',
    dataIndex: 'creation_timestamp',
    key: 'creationTimestamp',
    width: '12%',
    sorter: (a: ServiceInfo, b: ServiceInfo) => new Date(a.creation_timestamp).getTime() - new Date(b.creation_timestamp).getTime(),
    slots: { customRender: 'creationTimestamp' },
  },
  {
    title: '操作',
    key: 'action',
    width: '15%',
    fixed: 'right',
    slots: { customRender: 'action' },
  },
];

// 计算属性：过滤后的Service列表
const filteredServices = computed(() => {
  const searchValue = searchText.value.toLowerCase().trim();
  let filtered = services.value;
  
  // 按名称搜索
  if (searchValue) {
    filtered = filtered.filter(service => 
      service.name.toLowerCase().includes(searchValue)
    );
  }
  
  // 按类型过滤
  if (filterServiceType.value) {
    filtered = filtered.filter(service => service.type === filterServiceType.value);
  }
  
  return filtered;
});

// 计算属性：活跃服务数量
const activeServices = computed(() => 
  services.value.filter(service => service.endpoints && service.endpoints.length > 0).length
);

// 服务类型分布统计
const serviceTypeDistribution = computed(() => {
  const distribution: Record<string, number> = {};
  services.value.forEach(service => {
    const type = service.type || 'Unknown';
    if (!distribution[type]) {
      distribution[type] = 0;
    }
    distribution[type]++;
  });
  return distribution;
});

// 获取服务类型颜色
const getServiceTypeColor = (type: string) => {
  const typeColors: Record<string, string> = {
    ClusterIP: 'blue',
    NodePort: 'green',
    LoadBalancer: 'orange',
    ExternalName: 'purple',
  };
  return typeColors[type] || 'default';
};

// 表格选择配置
const rowSelection = {
  onChange: (_: string[], selectedRowsData: ServiceInfo[]) => {
    selectedRows.value = selectedRowsData;
    selectedCardIds.value = selectedRowsData.map(row => row.uid);
  },
  getCheckboxProps: (_: ServiceInfo) => ({
    disabled: false,
  }),
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

// 复制YAML
const copyYaml = async () => {
  try {
    await navigator.clipboard.writeText(serviceYaml.value);
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
        await getServices(1, pageSize.value);
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

// 获取Service列表（支持分页）
const getServices = async (page = 1, size = pageSize.value) => {
  if (!selectedCluster.value || !selectedNamespace.value) {
    message.warning('请先选择集群和命名空间');
    return;
  }
  
  loading.value = true;
  try {
    const params: ServiceListReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      page,
      page_size: size
    };
    
    if (filterServiceType.value) {
      params.type = filterServiceType.value;
    }
    
    const res = await getServiceListWithFilterApi(params);
    services.value = res || [];
    
    // 默认设置总数为当前数据长度（如果API未返回分页信息）
    totalItems.value = services.value.length;
    
    currentPage.value = page;
    selectedRows.value = [];
    selectedCardIds.value = [];
  } catch (error: any) {
    message.error(error.message || '获取Service列表失败');
    services.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

// 刷新数据
const refreshData = () => {
  getServices(currentPage.value, pageSize.value);
};

// 搜索
const onSearch = () => {
  // 搜索逻辑已经在计算属性中实现
};

// 类型筛选变化
const handleTypeFilterChange = () => {
  currentPage.value = 1;
  getServices(1, pageSize.value);
};

// 查看Service YAML
const viewServiceYaml = async (service: ServiceInfo) => {
  if (!selectedCluster.value) return;
  try {
    currentService.value = service;
    const res = await getServiceYamlApi(selectedCluster.value, service.name, service.namespace);
    serviceYaml.value = typeof res === 'string' ? res : JSON.stringify(res, null, 2);
    viewYamlModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取Service YAML失败');
  }
};

// 查看端点
const viewEndpoints = async (service: ServiceInfo) => {
  if (!selectedCluster.value) return;
  try {
    currentService.value = service;
    endpointsLoading.value = true;
    const endpoints = await getServiceEndpointsApi(selectedCluster.value, service.namespace, service.name);
    serviceEndpoints.value = endpoints || [];
    endpointsModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取端点信息失败');
  } finally {
    endpointsLoading.value = false;
  }
};

// 显示端口转发
const showPortForward = (service: ServiceInfo) => {
  currentService.value = service;
  // 初始化端口映射，使用服务的第一个端口
  if (service.ports && service.ports.length > 0) {
    const firstPort = service.ports[0];
    if (firstPort) {
      portMappings.value = [{
        local_port: firstPort.port,
        remote_port: firstPort.port
      }];
    }
  }
  portForwardModalVisible.value = true;
};

// 确认端口转发
const confirmPortForward = async () => {
  if (!currentService.value || !selectedCluster.value) return;
  
  try {
    loading.value = true;
    await portForwardServiceApi(
      selectedCluster.value,
      currentService.value.namespace,
      currentService.value.name,
      portMappings.value
    );
    
    message.success('端口转发已配置');
    portForwardModalVisible.value = false;
  } catch (error: any) {
    message.error(error.message || '端口转发配置失败');
  } finally {
    loading.value = false;
  }
};

// 添加端口映射
const addPortMapping = () => {
  portMappings.value.push({ local_port: 8080, remote_port: 80 });
};

// 移除端口映射
const removePortMapping = (index: number) => {
  portMappings.value.splice(index, 1);
};

// 连通性测试
const testConnectivity = async (service: ServiceInfo) => {
  if (!selectedCluster.value) return;
  
  testingConnectivity.value[service.uid] = true;
  try {
    await testServiceConnectivityApi(selectedCluster.value, service.namespace, service.name);
    message.success(`Service ${service.name} 连通性测试通过`);
  } catch (error: any) {
    message.error(error.message || '连通性测试失败');
  } finally {
    testingConnectivity.value[service.uid] = false;
  }
};

// 编辑服务
const handleEdit = (_: ServiceInfo) => {
  // 编辑功能
  message.info('编辑功能开发中...');
};

// 删除Service
const handleDelete = async (service: ServiceInfo) => {
  if (!selectedCluster.value) return;
  
  try {
    await deleteServiceApi(selectedCluster.value, service.namespace, service.name);
    message.success('Service删除成功');
    getServices(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '删除Service失败');
  }
};

// 批量删除Service
const handleBatchDelete = async () => {
  if (!selectedRows.value.length || !selectedCluster.value) return;
  
  try {
    loading.value = true;
    await batchDeleteServiceApi({
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      names: selectedRows.value.map(s => s.name)
    });
    
    message.success(`成功删除 ${selectedRows.value.length} 个服务`);
    selectedRows.value = [];
    selectedCardIds.value = [];
    getServices(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '批量删除失败');
  } finally {
    loading.value = false;
  }
};

// 切换命名空间
const handleNamespaceChange = () => {
  currentPage.value = 1;
  getServices(1, pageSize.value);
};

// 切换集群
const handleClusterChange = () => {
  selectedNamespace.value = 'default';
  services.value = [];
  currentPage.value = 1;
  totalItems.value = 0;
  getNamespaces();
  getServices(1, pageSize.value);
};

// 分页处理
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  getServices(pagination.current, pagination.pageSize);
};

// 页面加载时获取数据
onMounted(() => {
  getClusters();
});
</script>

<style>
/* 继承现有样式系统 */
/* 端口标签样式 */
.port-tag {
  margin-right: 4px;
  margin-bottom: 4px;
}

.ports-info {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.endpoints-info {
  display: flex;
  justify-content: center;
}

.type-tag {
  font-weight: 500;
}

.service-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.service-cards .service-card {
  border: 1px solid var(--border-color-split);
}

.port-mapping-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.port-mapping-item:last-child {
  margin-bottom: 0;
}

/* 操作按钮样式优化 */
.action-column {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.action-column :deep(.ant-btn) {
  min-width: 28px;
}
</style>
