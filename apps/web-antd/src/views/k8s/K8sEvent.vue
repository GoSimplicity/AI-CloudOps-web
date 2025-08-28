<template>
  <div class="cluster-management-container event-management-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="page-title">
            <ActivityOutlined class="title-icon" />
      <h1>Kubernetes 事件管理</h1>
          </div>
          <p class="page-subtitle">监控和管理集群中的所有事件信息</p>
        </div>
        <div class="header-actions">
          <a-button type="primary" size="large" @click="getEventStatistics" :loading="statisticsLoading">
            <template #icon><BarChartOutlined /></template>
            查看统计
          </a-button>
          <a-button type="primary" size="large" @click="refreshData" :loading="loading">
            <template #icon><ReloadOutlined /></template>
            刷新数据
          </a-button>
        </div>
      </div>
    </div>

    <!-- 数据概览卡片 -->
    <div class="overview-cards" v-if="statistics">
      <div class="overview-card total-clusters">
        <div class="card-icon">
          <ActivityOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ statistics.total_count || 0 }}</div>
          <div class="card-label">事件总数</div>
        </div>
      </div>
      
      <div class="overview-card running-clusters">
        <div class="card-icon">
          <CheckCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ statistics.normal_count || 0 }}</div>
          <div class="card-label">正常事件</div>
        </div>
      </div>
      
      <div class="overview-card env-types">
        <div class="card-icon">
          <WarningOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ statistics.warning_count || 0 }}</div>
          <div class="card-label">警告事件</div>
        </div>
      </div>
      
      <div class="overview-card resource-usage">
        <div class="card-icon">
          <HistoryOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ statistics.recent_count || 0 }}</div>
          <div class="card-label">近期事件</div>
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
          <a-select-option value="">全部命名空间</a-select-option>
          <a-select-option v-for="ns in namespaces" :key="ns" :value="ns">
            <span class="namespace-option">
              <AppstoreOutlined />
              {{ ns }}
            </span>
          </a-select-option>
        </a-select>
        
        <a-input-search
          v-model:value="searchText"
          placeholder="搜索事件原因、消息或对象名称"
          class="search-input"
          @search="handleSearch"
          allow-clear
        />
      </div>
      
      <div class="toolbar-right">
        <a-select
          v-model:value="selectedEventType"
          placeholder="事件类型"
          class="env-filter"
          allow-clear
          @change="handleFilterChange"
        >
          <template #suffixIcon><TagOutlined /></template>
          <a-select-option value="Normal">
            <span class="status-option">
              <CheckCircleOutlined style="color: #52c41a" />
              正常
            </span>
          </a-select-option>
          <a-select-option value="Warning">
            <span class="status-option">
              <ExclamationCircleOutlined style="color: #faad14" />
              警告
            </span>
          </a-select-option>
        </a-select>
        
        <a-button @click="handleExportEvents" :loading="exportLoading">
          <template #icon><DownloadOutlined /></template>
          导出
        </a-button>
        
        <a-button type="primary" danger @click="handleCleanupEvents">
          <template #icon><ClearOutlined /></template>
          清理历史
        </a-button>
      </div>
    </div>
    
    <!-- 数据展示区域 -->
    <div class="data-display">
      <div class="display-header" v-if="filteredEvents.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ total }} 个事件</span>
          <div class="env-tags">
            <a-tag color="green" v-if="normalEventsCount > 0">正常 {{ normalEventsCount }}</a-tag>
            <a-tag color="orange" v-if="warningEventsCount > 0">警告 {{ warningEventsCount }}</a-tag>
            <a-tag color="blue" v-if="selectedNamespace">{{ selectedNamespace }}</a-tag>
          </div>
        </div>
      </div>

      <!-- 表格视图 -->
      <a-table
        :columns="columns"
        :data-source="filteredEvents"
        :loading="loading"
        row-key="uid"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: number[]) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['20', '50', '100', '200']
        }"
        @change="handleTableChange"
        class="cluster-table events-table"
      >
        <!-- 事件类型列 -->
        <template #type="{ text }">
          <a-tag :color="getEventTypeColor(text)" class="status-tag event-type-tag">
            <CheckCircleOutlined v-if="text === 'Normal'" />
            <ExclamationCircleOutlined v-else />
            {{ text }}
          </a-tag>
        </template>

        <!-- 原因列 -->
        <template #reason="{ text }">
          <span class="event-reason">{{ text }}</span>
        </template>

        <!-- 消息列 -->
        <template #message="{ text }">
          <a-tooltip :title="text">
            <span class="event-message">{{ truncateText(text, 50) }}</span>
          </a-tooltip>
        </template>

        <!-- 对象列 -->
        <template #object="{ record }">
          <div class="object-info">
            <a-tag class="env-tag object-tag">
              <component :is="getObjectIcon(record.object_kind)" />
              {{ record.object_kind }}
            </a-tag>
            <span class="object-name">{{ record.object_name }}</span>
          </div>
        </template>

        <!-- 命名空间列 -->
        <template #namespace="{ text }">
          <a-tag v-if="text" class="env-tag namespace-tag">
            <PartitionOutlined />
            {{ text }}
          </a-tag>
          <span v-else class="text-placeholder">-</span>
        </template>

        <!-- 次数列 -->
        <template #count="{ text }">
          <a-badge :count="text" :number-style="{ backgroundColor: getCountBadgeColor(text) }" />
        </template>

        <!-- 最后时间列 -->
        <template #lastTime="{ record }">
          <div class="timestamp">
            <HistoryOutlined />
            <a-tooltip :title="formatDateTime(record.last_timestamp)">
              <span>{{ formatTime(record.last_timestamp) }}</span>
            </a-tooltip>
          </div>
        </template>

        <!-- 操作列 -->
        <template #action="{ record }">
          <div class="action-column">
            <a-tooltip title="查看详情">
              <a-button type="primary" ghost shape="circle" size="small" @click="showEventDetails(record)">
                <template #icon><EyeOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="查看相关事件">
              <a-button type="primary" ghost shape="circle" size="small" @click="showRelatedEvents(record)">
                <template #icon><LinkOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </template>

        <!-- 空状态 -->
        <template #emptyText>
          <div class="empty-state">
            <ActivityOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
            <p>暂无事件数据</p>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 事件详情模态框 -->
    <a-modal
      v-model:open="eventDetailsVisible"
      title="事件详情"
      width="800px"
      :footer="null"
      class="cluster-modal event-detail-modal"
    >
      <div v-if="currentEvent" class="event-details">
        <a-alert class="modal-alert" :type="currentEvent.type === 'Normal' ? 'info' : 'warning'" show-icon>
          <template #message>
            <span>{{ currentEvent.reason }}</span>
          </template>
          <template #description>
            <div>类型: {{ currentEvent.type }} | 对象: {{ currentEvent.object_kind }}/{{ currentEvent.object_name }}</div>
          </template>
        </a-alert>

        <div class="details-grid">
          <div class="detail-card">
            <h4><InfoCircleOutlined /> 基本信息</h4>
            <div class="detail-item">
              <div class="detail-label">事件类型:</div>
              <div class="detail-value">
                <a-tag :color="getEventTypeColor(currentEvent.type)" class="status-tag">
                  {{ currentEvent.type }}
                </a-tag>
              </div>
            </div>
            <div class="detail-item">
              <div class="detail-label">事件原因:</div>
              <div class="detail-value">{{ currentEvent.reason }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">发生次数:</div>
              <div class="detail-value">
                <a-badge :count="currentEvent.count" :number-style="{ backgroundColor: getCountBadgeColor(currentEvent.count) }" />
              </div>
            </div>
          </div>

          <div class="detail-card">
            <h4><CodeOutlined /> 对象信息</h4>
            <div class="detail-item">
              <div class="detail-label">对象类型:</div>
              <div class="detail-value">{{ currentEvent.object_kind }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">对象名称:</div>
              <div class="detail-value">{{ currentEvent.object_name }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">命名空间:</div>
              <div class="detail-value">{{ currentEvent.object_namespace || '-' }}</div>
            </div>
          </div>
        </div>

        <div class="detail-card">
          <div class="detail-message">
            <h4><InfoCircleOutlined /> 事件消息</h4>
            <div class="message-content">{{ currentEvent.message }}</div>
          </div>
        </div>

        <div class="modal-footer">
          <a-space>
            <a-button @click="eventDetailsVisible = false">关闭</a-button>
            <a-button type="primary" ghost @click="showRelatedEvents(currentEvent)">
              <template #icon><LinkOutlined /></template>
              查看相关事件
            </a-button>
          </a-space>
        </div>
      </div>
    </a-modal>

    <!-- 清理历史事件模态框 -->
    <a-modal
      v-model:open="cleanupModalVisible"
      title="清理历史事件"
      @ok="confirmCleanup"
      @cancel="cleanupModalVisible = false"
      :confirmLoading="cleanupLoading"
      class="cluster-modal"
    >
      <a-alert class="modal-alert" type="warning" show-icon>
        <template #message>清理历史事件</template>
        <template #description>此操作将删除指定天数之前的历史事件，无法恢复</template>
      </a-alert>

      <a-form layout="vertical">
        <a-form-item label="保留天数" required>
          <a-input-number 
            v-model:value="cleanupDays" 
            :min="1" 
            :max="365" 
            style="width: 100%" 
            placeholder="请输入保留天数"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { 
  getEventsApi,
  getEventStatisticsApi,
  cleanupEventsApi,
  exportEventsApi,
  getResourceEventsApi,
  getAllClustersApi,
  getNamespacesByClusterIdApi
} from '#/api';
import type { 
  EventInfo, 
  EventListReq,
  EventStatistics 
} from '#/api';
import { 
  AppstoreOutlined as ActivityOutlined,
  BarChartOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  HistoryOutlined,
  ClusterOutlined,
  CloudServerOutlined,
  PartitionOutlined,
  AppstoreOutlined,
  TagOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
  ClearOutlined,
  EyeOutlined,
  LinkOutlined,
  CodeOutlined,
  InfoCircleOutlined,
  RocketOutlined,
  DatabaseOutlined,
  InboxOutlined as BoxOutlined,
  ForkOutlined as NetworkOutlined,
  SettingOutlined
} from '@ant-design/icons-vue';

// 状态变量
const loading = ref(false);
const statisticsLoading = ref(false);
const clustersLoading = ref(false);
const namespacesLoading = ref(false);
const exportLoading = ref(false);
const cleanupLoading = ref(false);
const events = ref<EventInfo[]>([]);
const clusters = ref<Array<{id: number, name: string}>>([]);
const namespaces = ref<string[]>([]);
const statistics = ref<EventStatistics | null>(null);

// 筛选和分页状态
const selectedCluster = ref<number>();
const selectedNamespace = ref<string>('');
const selectedEventType = ref<string>('');
const limitDays = ref<number>(7);
const searchText = ref('');
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);

// 模态框状态
const eventDetailsVisible = ref(false);
const cleanupModalVisible = ref(false);
const currentEvent = ref<EventInfo | null>(null);
const cleanupDays = ref(30);

// 表格列配置
const columns = [
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: '8%',
    slots: { customRender: 'type' },
    filters: [
      { text: '正常', value: 'Normal' },
      { text: '警告', value: 'Warning' },
    ],
    onFilter: (value: string, record: EventInfo) => record.type === value,
  },
  {
    title: '原因',
    dataIndex: 'reason',
    key: 'reason',
    width: '12%',
    slots: { customRender: 'reason' },
    sorter: (a: EventInfo, b: EventInfo) => a.reason.localeCompare(b.reason),
  },
  {
    title: '消息',
    dataIndex: 'message',
    key: 'message',
    width: '30%',
    slots: { customRender: 'message' },
  },
  {
    title: '对象',
    key: 'object',
    width: '15%',
    slots: { customRender: 'object' },
  },
  {
    title: '命名空间',
    dataIndex: 'object_namespace',
    key: 'namespace',
    width: '10%',
    slots: { customRender: 'namespace' },
  },
  {
    title: '次数',
    dataIndex: 'count',
    key: 'count',
    width: '8%',
    slots: { customRender: 'count' },
    sorter: (a: EventInfo, b: EventInfo) => a.count - b.count,
  },
  {
    title: '最后时间',
    dataIndex: 'last_timestamp',
    key: 'lastTime',
    width: '12%',
    slots: { customRender: 'lastTime' },
    sorter: (a: EventInfo, b: EventInfo) => new Date(a.last_timestamp).getTime() - new Date(b.last_timestamp).getTime(),
  },
  {
    title: '操作',
    key: 'action',
    width: '10%',
    fixed: 'right',
    slots: { customRender: 'action' },
  },
];

// 计算属性：过滤后的事件列表
const filteredEvents = computed(() => {
  let result = [...events.value];
  
  if (searchText.value) {
    const searchValue = searchText.value.toLowerCase().trim();
    result = result.filter(event => 
      event.reason.toLowerCase().includes(searchValue) ||
      event.message.toLowerCase().includes(searchValue) ||
      event.object_name.toLowerCase().includes(searchValue)
    );
  }
  
  return result;
});

// 计算属性：事件统计
const normalEventsCount = computed(() => events.value.filter(e => e.type === 'Normal').length);
const warningEventsCount = computed(() => events.value.filter(e => e.type === 'Warning').length);

// 工具函数
const getEventTypeColor = (type: string) => {
  return type === 'Normal' ? 'green' : 'orange';
};

const getObjectIcon = (kind: string) => {
  const iconMap: Record<string, any> = {
    'Pod': BoxOutlined,
    'Deployment': RocketOutlined,
    'Service': NetworkOutlined,
    'Node': DatabaseOutlined,
    'ConfigMap': SettingOutlined,
    'Secret': SettingOutlined,
    'default': CodeOutlined
  };
  return iconMap[kind] || iconMap.default;
};

const getCountBadgeColor = (count: number) => {
  if (count > 10) return '#f5222d';
  if (count > 5) return '#faad14';
  return '#52c41a';
};

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const formatTime = (timestamp: string) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
};

const formatDateTime = (timestamp: string) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

// API调用函数
const getClusters = async () => {
  clustersLoading.value = true;
  try {
    const res = await getAllClustersApi();
    clusters.value = res ?? [];
    if (clusters.value.length > 0 && !selectedCluster.value) {
      selectedCluster.value = clusters.value[0]?.id;
      if (selectedCluster.value) {
        await getNamespaces();
        await getEvents();
      }
    }
  } catch (error: any) {
    message.error(error.message || '获取集群列表失败');
  } finally {
    clustersLoading.value = false;
  }
};

const getNamespaces = async () => {
  if (!selectedCluster.value) return;

  namespacesLoading.value = true;
  try {
    const res = await getNamespacesByClusterIdApi(selectedCluster.value);
    namespaces.value = res.map((ns: { name: string }) => ns.name);
  } catch (error: any) {
    message.error(error.message || '获取命名空间列表失败');
    namespaces.value = [];
  } finally {
    namespacesLoading.value = false;
  }
};

const getEvents = async () => {
  if (!selectedCluster.value) {
    message.warning('请先选择集群');
    return;
  }

  loading.value = true;
  try {
    const params: EventListReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value || undefined,
      type: selectedEventType.value as any || undefined,
      limit_days: limitDays.value,
      page: currentPage.value,
      page_size: pageSize.value
    };
    
    const res = await getEventsApi(params);
    events.value = Array.isArray(res) ? res : (res as any)?.data || [];
    total.value = (res as any)?.total || events.value.length;
    
    message.success('事件数据加载成功');
  } catch (error: any) {
    message.error(error.message || '获取事件列表失败');
    events.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

const getEventStatistics = async () => {
  if (!selectedCluster.value) {
    message.warning('请先选择集群');
    return;
  }

  statisticsLoading.value = true;
  try {
    const res = await getEventStatisticsApi(
      selectedCluster.value,
      selectedNamespace.value || undefined,
      limitDays.value
    );
    statistics.value = res;
    message.success('事件统计加载成功');
  } catch (error: any) {
    message.error(error.message || '获取事件统计失败');
  } finally {
    statisticsLoading.value = false;
  }
};

// 事件处理函数
const refreshData = () => {
  getEvents();
};

const handleClusterChange = () => {
  selectedNamespace.value = '';
  events.value = [];
  currentPage.value = 1;
  total.value = 0;
  statistics.value = null;
  getNamespaces();
  getEvents();
};

const handleNamespaceChange = () => {
  currentPage.value = 1;
  getEvents();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  getEvents();
};

const handleSearch = () => {
  // 搜索逻辑已在计算属性中实现
};

const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  getEvents();
};

const showEventDetails = (event: EventInfo) => {
  currentEvent.value = event;
  eventDetailsVisible.value = true;
};

const showRelatedEvents = async (event: EventInfo) => {
  if (!selectedCluster.value || !event.object_namespace) return;
  
  try {
    loading.value = true;
    const relatedEvents = await getResourceEventsApi(
      selectedCluster.value,
      event.object_namespace,
      event.object_kind,
      event.object_name
    );
    events.value = relatedEvents || [];
    total.value = events.value.length;
    eventDetailsVisible.value = false;
    message.success(`已加载 ${event.object_name} 相关事件`);
  } catch (error: any) {
    message.error(error.message || '获取相关事件失败');
  } finally {
    loading.value = false;
  }
};

const handleExportEvents = async () => {
  if (!selectedCluster.value) return;

  exportLoading.value = true;
  try {
    const params: EventListReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value || undefined,
      type: selectedEventType.value as any || undefined,
      limit_days: limitDays.value
    };
    
    await exportEventsApi(params);
    message.success('事件导出成功');
  } catch (error: any) {
    message.error(error.message || '导出事件失败');
  } finally {
    exportLoading.value = false;
  }
};

const handleCleanupEvents = () => {
  cleanupModalVisible.value = true;
};

const confirmCleanup = async () => {
  if (!selectedCluster.value) return;

  cleanupLoading.value = true;
  try {
    await cleanupEventsApi(
      selectedCluster.value,
      selectedNamespace.value || undefined,
      cleanupDays.value
    );
    message.success('历史事件清理成功');
    cleanupModalVisible.value = false;
    getEvents();
  } catch (error: any) {
    message.error(error.message || '清理历史事件失败');
  } finally {
    cleanupLoading.value = false;
  }
};

// 页面初始化
onMounted(() => {
  getClusters();
});
</script>

<style>
/* 继承现有的样式系统 */
.cluster-management-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* ==================== 页面头部 ==================== */
.page-header {
  background: #ffffff;
  border-radius: 8px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
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
  color: #1677ff;
  margin-right: 16px;
}

.page-title h1 {
  font-size: 24px;
  font-weight: 600;
  color: #000000d9;
  margin: 0;
  line-height: 1.2;
}

.page-subtitle {
  font-size: 14px;
  color: #00000073;
  margin: 0;
  line-height: 1.5714;
}

.header-actions {
  flex-shrink: 0;
  display: flex;
  gap: 12px;
}

/* ==================== 概览卡片 ==================== */
.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.overview-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
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
  flex-shrink: 0;
}

.total-clusters .card-icon {
  background: rgba(22, 119, 255, 0.1);
  color: #1677ff;
}

.running-clusters .card-icon {
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
}

.env-types .card-icon {
  background: rgba(250, 173, 20, 0.1);
  color: #faad14;
}

.resource-usage .card-icon {
  background: rgba(114, 46, 209, 0.1);
  color: #722ed1;
}

.card-info {
  flex: 1;
}

.card-number {
  font-size: 20px;
  font-weight: 600;
  color: #000000d9;
  line-height: 1.2;
  margin-bottom: 4px;
}

.card-label {
  font-size: 14px;
  color: #00000073;
  line-height: 1.5714;
}

/* ==================== 工具栏 ==================== */
.toolbar {
  background: #ffffff;
  border-radius: 8px;
  padding: 20px 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  border: 1px solid #f0f0f0;
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
  flex-shrink: 0;
}

.search-input {
  width: 320px;
}

.env-filter {
  width: 160px;
}

.cluster-option, .namespace-option, .status-option {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ==================== 数据展示区域 ==================== */
.data-display {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f0f0;
  overflow: hidden;
}

.display-header {
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
  background: #ffffff;
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
  flex-wrap: wrap;
}

/* ==================== 表格样式 ==================== */
.cluster-table {
  border: none;
}

.cluster-table :deep(.ant-table-thead > tr > th) {
  background: #fafafa;
  font-weight: 600;
  padding: 16px 16px;
  border-bottom: 1px solid #f0f0f0;
  color: #000000d9;
  font-size: 14px;
}

.cluster-table :deep(.ant-table-tbody > tr:hover) {
  background-color: #fafafa;
}

.cluster-table :deep(.ant-table-tbody > tr > td) {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  vertical-align: middle;
  font-size: 14px;
}

/* ==================== 事件特定样式 ==================== */
.event-type-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 12px;
}

.event-reason {
  font-weight: 600;
  color: #000000d9;
}

.event-message {
  color: #00000073;
  line-height: 1.5;
}

.object-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.object-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 6px;
  background: #f0f0f0;
  color: #595959;
  border-radius: 4px;
}

.object-name {
  font-weight: 500;
  color: #000000d9;
  font-size: 13px;
}

.namespace-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.timestamp {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #00000073;
  font-size: 14px;
}

.text-placeholder {
  color: #00000040;
  font-style: italic;
}

.action-column {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.action-column :deep(.ant-btn) {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
}

.action-column :deep(.ant-btn:hover) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

/* ==================== 模态框样式 ==================== */
.cluster-modal :deep(.ant-modal-content) {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 9px 28px rgba(0, 0, 0, 0.12);
}

.cluster-modal :deep(.ant-modal-header) {
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
  padding: 20px 24px;
}

.cluster-modal :deep(.ant-modal-title) {
  font-size: 16px;
  font-weight: 600;
  color: #000000d9;
}

.modal-alert {
  margin-bottom: 20px;
  border-radius: 6px;
}

.event-details {
  padding: 8px 0;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.detail-card {
  background-color: #fafafa;
  border-radius: 8px;
  padding: 16px;
}

.detail-card h4 {
  margin: 0 0 16px 0;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #000000d9;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  align-items: center;
}

.detail-label {
  color: #00000073;
  font-weight: 500;
  min-width: 100px;
}

.detail-value {
  color: #000000d9;
  font-weight: 400;
  flex: 1;
  text-align: right;
}

.detail-message {
  width: 100%;
}

.message-content {
  background: #f8f8f8;
  border-radius: 6px;
  padding: 12px 16px;
  margin-top: 8px;
  line-height: 1.6;
  color: #000000d9;
  font-size: 14px;
  border-left: 4px solid #1677ff;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* ==================== 空状态 ==================== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 0;
  color: #00000073;
}

.empty-state p {
  margin: 16px 0 24px;
  font-size: 14px;
}

/* ==================== 响应式设计 ==================== */
@media (max-width: 1400px) {
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .details-grid {
    grid-template-columns: 1fr;
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
</style>
