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
          <a-button type="primary" size="large" @click="loadEventStatistics" :loading="statisticsLoading">
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
    <div class="overview-cards" v-if="summary">
      <div class="overview-card total-clusters">
        <div class="card-icon">
          <ActivityOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ summary.total_events || 0 }}</div>
          <div class="card-label">事件总数</div>
        </div>
      </div>
      
      <div class="overview-card running-clusters">
        <div class="card-icon">
          <CheckCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ summary.normal_events || 0 }}</div>
          <div class="card-label">正常事件</div>
        </div>
      </div>
      
      <div class="overview-card env-types">
        <div class="card-icon">
          <WarningOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ summary.warning_events || 0 }}</div>
          <div class="card-label">警告事件</div>
        </div>
      </div>
      
      <div class="overview-card resource-usage">
        <div class="card-icon">
          <HistoryOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ summary.unique_events || 0 }}</div>
          <div class="card-label">唯一事件</div>
        </div>
      </div>
    </div>

    <!-- 事件趋势图表 -->
    <div class="chart-container" v-if="eventTrends.length > 0">
      <div class="chart-header">
        <h3><BarChartOutlined /> 事件趋势分析</h3>
        <div class="chart-actions">
          <a-radio-group v-model:value="trendInterval" @change="handleTrendIntervalChange">
            <a-radio-button value="1h">1小时</a-radio-button>
            <a-radio-button value="6h">6小时</a-radio-button>
            <a-radio-button value="1d">1天</a-radio-button>
          </a-radio-group>
        </div>
      </div>
      <div class="chart-content">
        <div class="trend-chart" ref="trendChartRef"></div>
      </div>
    </div>

    <!-- 热门事件类型分布 -->
    <div class="stats-grid" v-if="summary && summary.top_reasons.length > 0">
      <div class="stats-card">
        <h4><TagOutlined /> 热门事件原因</h4>
        <div class="reason-list">
          <div 
            v-for="reason in summary.top_reasons.slice(0, 10)" 
            :key="reason.name"
            class="reason-item"
          >
            <span class="reason-name">{{ reason.name }}</span>
            <div class="reason-stats">
              <span class="reason-count">{{ reason.count }}</span>
              <div class="reason-bar">
                <div 
                  class="reason-bar-fill"
                  :style="{ width: `${reason.percentage}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="stats-card">
        <h4><AppstoreOutlined /> 热门对象类型</h4>
        <div class="object-list">
          <div 
            v-for="object in summary.top_objects.slice(0, 10)" 
            :key="object.name"
            class="object-item"
          >
            <span class="object-name">{{ object.name }}</span>
            <div class="object-stats">
              <span class="object-count">{{ object.count }}</span>
              <div class="object-bar">
                <div 
                  class="object-bar-fill"
                  :style="{ width: `${object.percentage}%` }"
                ></div>
              </div>
            </div>
          </div>
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
        <!-- 返回按钮 - 仅在查看相关事件时显示 -->
        <a-button 
          v-if="isViewingRelatedEvents" 
          @click="handleBackToAllEvents" 
          type="default"
          class="back-button"
        >
          <template #icon><ArrowLeftOutlined /></template>
          返回全部事件
        </a-button>
        
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
      <!-- 相关事件提示 -->
      <div class="related-events-banner" v-if="isViewingRelatedEvents && relatedEventSource">
        <a-alert 
          type="info" 
          show-icon 
          :closable="false"
          class="related-events-alert"
        >
          <template #message>
            <span>正在查看 <strong>{{ relatedEventSource.kind }}/{{ relatedEventSource.name }}</strong> 在命名空间 <strong>{{ relatedEventSource.namespace }}</strong> 中的相关事件</span>
          </template>
          <template #description>
            <span>共找到 {{ total }} 个相关事件</span>
          </template>
        </a-alert>
      </div>
      
      <div class="display-header" v-if="filteredEvents.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ total }} 个事件</span>
          <div class="env-tags">
            <a-tag color="green" v-if="normalEventsCount > 0">正常 {{ normalEventsCount }}</a-tag>
            <a-tag color="orange" v-if="warningEventsCount > 0">警告 {{ warningEventsCount }}</a-tag>
            <a-tag color="blue" v-if="selectedNamespace">{{ selectedNamespace }}</a-tag>
            <a-tag color="purple" v-if="isViewingRelatedEvents">相关事件</a-tag>
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
            <CheckCircleOutlined v-if="text === EventType.Normal" />
            <ExclamationCircleOutlined v-else />
            {{ getEventTypeText(text) }}
          </a-tag>
        </template>

        <!-- 原因列 -->
        <template #reason="{ text }">
          <span class="event-reason">{{ getEventReasonText(text) }}</span>
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
              <component :is="getObjectIcon(record.involved_object.kind)" />
              {{ record.involved_object.kind }}
            </a-tag>
            <span class="object-name">{{ record.involved_object.name }}</span>
          </div>
        </template>

        <!-- 命名空间列 -->
        <template #namespace="{ record }">
          <a-tag v-if="record.involved_object.namespace" class="env-tag namespace-tag">
            <PartitionOutlined />
            {{ record.involved_object.namespace }}
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
        <a-alert class="modal-alert" :type="currentEvent.type === EventType.Normal ? 'info' : 'warning'" show-icon>
          <template #message>
            <span>{{ getEventReasonText(currentEvent.reason) }}</span>
          </template>
          <template #description>
            <div>类型: {{ getEventTypeText(currentEvent.type) }} | 对象: {{ currentEvent.involved_object.kind }}/{{ currentEvent.involved_object.name }}</div>
          </template>
        </a-alert>

        <div class="details-grid">
          <div class="detail-card">
            <h4><InfoCircleOutlined /> 基本信息</h4>
            <div class="detail-item">
              <div class="detail-label">事件类型:</div>
              <div class="detail-value">
                <a-tag :color="getEventTypeColor(currentEvent.type)" class="status-tag">
                  {{ getEventTypeText(currentEvent.type) }}
                </a-tag>
              </div>
            </div>
            <div class="detail-item">
              <div class="detail-label">事件原因:</div>
              <div class="detail-value">{{ getEventReasonText(currentEvent.reason) }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">严重程度:</div>
              <div class="detail-value">{{ currentEvent.severity }}</div>
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
              <div class="detail-value">{{ currentEvent.involved_object.kind }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">对象名称:</div>
              <div class="detail-value">{{ currentEvent.involved_object.name }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">命名空间:</div>
              <div class="detail-value">{{ currentEvent.involved_object.namespace || '-' }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">对象 UID:</div>
              <div class="detail-value">{{ currentEvent.involved_object.uid || '-' }}</div>
            </div>
          </div>

          <div class="detail-card">
            <h4><SettingOutlined /> 事件源信息</h4>
            <div class="detail-item">
              <div class="detail-label">组件:</div>
              <div class="detail-value">{{ currentEvent.source.component }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">主机:</div>
              <div class="detail-value">{{ currentEvent.source.host }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">首次时间:</div>
              <div class="detail-value">{{ formatDateTime(currentEvent.first_timestamp) }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">最后时间:</div>
              <div class="detail-value">{{ formatDateTime(currentEvent.last_timestamp) }}</div>
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
  getEventList,
  getEventsByPod,
  getEventsByDeployment,
  getEventsByService,
  getEventStatistics,
  getEventSummary,
  getEventTrends,
  cleanupOldEvents,
  EventType,
  EventReason
} from '#/api/core/k8s_event';
import type { 
  K8sEvent,
  GetEventListReq,
  EventStatistics,
  EventSummary,
  GetEventStatisticsReq,
  GetEventSummaryReq,
  GetEventTrendsReq,
  CleanupOldEventsReq,
  EventTrend
} from '#/api/core/k8s_event';
import { getClustersListApi } from '#/api/core/k8s_cluster';
import { getNamespacesListApi } from '#/api/core/k8s_namespace';
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
  SettingOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons-vue';

// 状态变量
const loading = ref(false);
const statisticsLoading = ref(false);
const clustersLoading = ref(false);
const namespacesLoading = ref(false);
const exportLoading = ref(false);
const cleanupLoading = ref(false);
const events = ref<K8sEvent[]>([]);
const clusters = ref<Array<{id: number, name: string}>>([]);
const namespaces = ref<string[]>([]);
const statistics = ref<EventStatistics | null>(null);
const summary = ref<EventSummary | null>(null);
const eventTrends = ref<EventTrend[]>([]);

// 图表相关状态
const trendInterval = ref('1h');
const trendChartRef = ref<HTMLElement>();

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
const currentEvent = ref<K8sEvent | null>(null);
const cleanupDays = ref(30);

// 相关事件状态
const isViewingRelatedEvents = ref(false);
const originalEvents = ref<K8sEvent[]>([]);
const relatedEventSource = ref<{kind: string, name: string, namespace: string} | null>(null);

// 表格列配置
const columns = [
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: '8%',
    slots: { customRender: 'type' },
    filters: [
      { text: '正常', value: EventType.Normal },
      { text: '警告', value: EventType.Warning },
    ],
    onFilter: (value: number, record: K8sEvent) => record.type === value,
  },
  {
    title: '原因',
    dataIndex: 'reason',
    key: 'reason',
    width: '12%',
    slots: { customRender: 'reason' },
    sorter: (a: K8sEvent, b: K8sEvent) => String(a.reason).localeCompare(String(b.reason)),
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
    sorter: (a: K8sEvent, b: K8sEvent) => a.count - b.count,
  },
  {
    title: '最后时间',
    dataIndex: 'last_timestamp',
    key: 'lastTime',
    width: '12%',
    slots: { customRender: 'lastTime' },
    sorter: (a: K8sEvent, b: K8sEvent) => new Date(a.last_timestamp).getTime() - new Date(b.last_timestamp).getTime(),
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
      String(event.reason).toLowerCase().includes(searchValue) ||
      event.message.toLowerCase().includes(searchValue) ||
      event.involved_object.name.toLowerCase().includes(searchValue)
    );
  }
  
  return result;
});

// 计算属性：事件统计
const normalEventsCount = computed(() => events.value.filter(e => e.type === EventType.Normal).length);
const warningEventsCount = computed(() => events.value.filter(e => e.type === EventType.Warning).length);

// 工具函数
const getEventTypeColor = (type: EventType) => {
  return type === EventType.Normal ? 'green' : 'orange';
};

const getEventTypeText = (type: EventType) => {
  return type === EventType.Normal ? 'Normal' : 'Warning';
};

const getEventReasonText = (reason: EventReason) => {
  const reasonMap: Record<EventReason, string> = {
    [EventReason.BackOff]: 'BackOff',
    [EventReason.Pulled]: 'Pulled',
    [EventReason.Created]: 'Created',
    [EventReason.Deleted]: 'Deleted',
    [EventReason.Updated]: 'Updated',
    [EventReason.Restarted]: 'Restarted',
    [EventReason.Started]: 'Started',
    [EventReason.Stopped]: 'Stopped',
    [EventReason.Failed]: 'Failed',
    [EventReason.Succeeded]: 'Succeeded',
    [EventReason.Unknown]: 'Unknown',
    [EventReason.Warning]: 'Warning',
    [EventReason.Error]: 'Error',
    [EventReason.Fatal]: 'Fatal',
    [EventReason.Panic]: 'Panic',
    [EventReason.Timeout]: 'Timeout',
    [EventReason.Cancelled]: 'Cancelled',
    [EventReason.Interrupted]: 'Interrupted',
    [EventReason.Aborted]: 'Aborted',
    [EventReason.Ignored]: 'Ignored',
    [EventReason.Other]: 'Other',
  };
  return reasonMap[reason] || 'Unknown';
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
    const res = await getClustersListApi();
    // 处理API返回的数据结构
    if (Array.isArray(res)) {
      clusters.value = res.map((cluster: any) => ({
        id: cluster.id,
        name: cluster.name
      }));
    } else if (res && res.items) {
      clusters.value = res.items.map((cluster: any) => ({
        id: cluster.id,
        name: cluster.name
      }));
    } else {
      clusters.value = [];
    }
    
    if (clusters.value.length > 0 && !selectedCluster.value) {
      selectedCluster.value = clusters.value[0]?.id;
      if (selectedCluster.value) {
        await getNamespaces();
        await getEvents();
        await loadEventStatistics();
      }
    }
  } catch (error: any) {
    message.error(error.message || '获取集群列表失败');
    // 如果API调用失败，使用模拟数据作为后备
    clusters.value = [
      { id: 1, name: '开发集群' },
      { id: 2, name: '测试集群' },
      { id: 3, name: '生产集群' }
    ];
    
    if (clusters.value.length > 0 && !selectedCluster.value) {
      selectedCluster.value = clusters.value[0]?.id;
      if (selectedCluster.value) {
        await getNamespaces();
        await getEvents();
        await loadEventStatistics();
      }
    }
  } finally {
    clustersLoading.value = false;
  }
};

const getNamespaces = async () => {
  if (!selectedCluster.value) return;

  namespacesLoading.value = true;
  try {
    const res = await getNamespacesListApi(selectedCluster.value);
    // 根据API返回结构处理数据
    if (Array.isArray(res)) {
      namespaces.value = res.map((ns: any) => ns.name || ns);
    } else if (res && res.items) {
      namespaces.value = res.items.map((ns: any) => ns.name || ns);
    } else {
      namespaces.value = [];
    }
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
    const params: GetEventListReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value || undefined,
      event_type: selectedEventType.value || undefined,
      limit_days: limitDays.value,
      limit: pageSize.value,
      // 注意: continue 参数用于分页，这里可能需要根据具体实现调整
    };
    
    const res = await getEventList(params);
    
    // 处理API返回的数据结构
    if (res && typeof res === 'object' && 'items' in res) {
      events.value = (res as any).items || [];
      total.value = (res as any).total || events.value.length;
    } else if (Array.isArray(res)) {
      events.value = res;
      total.value = res.length;
    } else {
      events.value = [];
      total.value = 0;
    }
    
    message.success('事件数据加载成功');
  } catch (error: any) {
    message.error(error.message || '获取事件列表失败');
    events.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

const loadEventStatistics = async () => {
  if (!selectedCluster.value) {
    message.warning('请先选择集群');
    return;
  }

  statisticsLoading.value = true;
  try {
    const params: GetEventStatisticsReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value || undefined,
      start_time: new Date(Date.now() - limitDays.value * 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date().toISOString(),
      group_by: 'type'
    };
    
    const res = await getEventStatistics(params);
    statistics.value = res;
    
    // 同时获取事件汇总信息
    const summaryParams: GetEventSummaryReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value || undefined,
      start_time: params.start_time,
      end_time: params.end_time
    };
    
    const summaryRes = await getEventSummary(summaryParams);
    summary.value = summaryRes;
    
    // 获取事件趋势数据
    await getEventTrendsData();
    
    message.success('事件统计加载成功');
  } catch (error: any) {
    message.error(error.message || '获取事件统计失败');
  } finally {
    statisticsLoading.value = false;
  }
};

const getEventTrendsData = async () => {
  if (!selectedCluster.value) return;

  try {
    const params: GetEventTrendsReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value || undefined,
      start_time: new Date(Date.now() - limitDays.value * 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date().toISOString(),
      interval: trendInterval.value,
      event_type: selectedEventType.value || undefined
    };
    
    const res = await getEventTrends(params);
    eventTrends.value = res || [];
  } catch (error: any) {
    console.error('获取事件趋势失败:', error);
    eventTrends.value = [];
  }
};

// 事件处理函数
const refreshData = () => {
  getEvents();
  loadEventStatistics();
};

const handleClusterChange = () => {
  selectedNamespace.value = '';
  events.value = [];
  currentPage.value = 1;
  total.value = 0;
  statistics.value = null;
  summary.value = null;
  
  // 重置相关事件状态
  isViewingRelatedEvents.value = false;
  originalEvents.value = [];
  relatedEventSource.value = null;
  
  getNamespaces();
  getEvents();
  loadEventStatistics();
};

const handleNamespaceChange = () => {
  currentPage.value = 1;
  
  // 重置相关事件状态
  isViewingRelatedEvents.value = false;
  originalEvents.value = [];
  relatedEventSource.value = null;
  
  getEvents();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  
  // 重置相关事件状态
  isViewingRelatedEvents.value = false;
  originalEvents.value = [];
  relatedEventSource.value = null;
  
  getEvents();
  loadEventStatistics();
};

const handleTrendIntervalChange = () => {
  getEventTrendsData();
};

const handleSearch = () => {
  // 搜索逻辑已在计算属性中实现
};

const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  getEvents();
};

const showEventDetails = (event: K8sEvent) => {
  currentEvent.value = event;
  eventDetailsVisible.value = true;
};

const showRelatedEvents = async (event: K8sEvent) => {
  if (!selectedCluster.value || !event.involved_object.namespace) return;
  
  try {
    loading.value = true;
    
    // 保存原始事件数据
    if (!isViewingRelatedEvents.value) {
      originalEvents.value = [...events.value];
      isViewingRelatedEvents.value = true;
      relatedEventSource.value = {
        kind: event.involved_object.kind,
        name: event.involved_object.name,
        namespace: event.involved_object.namespace
      };
    }
    
    let relatedEvents: K8sEvent[] = [];
    
    // 根据对象类型选择不同的 API
    switch (event.involved_object.kind) {
      case 'Pod':
        relatedEvents = await getEventsByPod({
          cluster_id: selectedCluster.value,
          namespace: event.involved_object.namespace,
          pod_name: event.involved_object.name
        });
        break;
      case 'Deployment':
        relatedEvents = await getEventsByDeployment({
          cluster_id: selectedCluster.value,
          namespace: event.involved_object.namespace,
          deployment_name: event.involved_object.name
        });
        break;
      case 'Service':
        relatedEvents = await getEventsByService({
          cluster_id: selectedCluster.value,
          namespace: event.involved_object.namespace,
          service_name: event.involved_object.name
        });
        break;
      default:
        // 其他类型的对象，使用通用的事件查询
        const params: GetEventListReq = {
          cluster_id: selectedCluster.value,
          namespace: event.involved_object.namespace,
          involved_object_kind: event.involved_object.kind,
          involved_object_name: event.involved_object.name
        };
        const eventRes = await getEventList(params);
        // 处理API返回的数据结构
        if (Array.isArray(eventRes)) {
          relatedEvents = eventRes;
        } else if (eventRes && typeof eventRes === 'object' && 'items' in eventRes) {
          relatedEvents = (eventRes as any).items || [];
        } else {
          relatedEvents = [];
        }
        break;
    }
    
    // 确保相关事件是数组
    const relatedEventsArray = Array.isArray(relatedEvents) ? relatedEvents : [];
    events.value = relatedEventsArray;
    total.value = events.value.length;
    eventDetailsVisible.value = false;
    message.success(`已加载 ${event.involved_object.name} 相关事件`);
  } catch (error: any) {
    message.error(error.message || '获取相关事件失败');
  } finally {
    loading.value = false;
  }
};

const handleBackToAllEvents = async () => {
  try {
    loading.value = true;
    
    // 恢复原始事件数据
    if (originalEvents.value.length > 0) {
      events.value = [...originalEvents.value];
      total.value = events.value.length;
    } else {
      // 如果没有保存的原始数据，重新获取所有事件
      await getEvents();
    }
    
    // 重置相关事件状态
    isViewingRelatedEvents.value = false;
    originalEvents.value = [];
    relatedEventSource.value = null;
    
    message.success('已返回全部事件');
  } catch (error: any) {
    message.error(error.message || '返回全部事件失败');
  } finally {
    loading.value = false;
  }
};

const handleExportEvents = async () => {
  if (!selectedCluster.value) return;

  exportLoading.value = true;
  try {
    const params: GetEventListReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value || undefined,
      event_type: selectedEventType.value || undefined,
      limit_days: limitDays.value
    };
    
    // 获取所有事件数据进行导出
    const allEventsRes = await getEventList(params);
    
    // 处理API返回的数据结构
    let eventList: K8sEvent[] = [];
    if (Array.isArray(allEventsRes)) {
      eventList = allEventsRes;
    } else if (allEventsRes && typeof allEventsRes === 'object' && 'items' in allEventsRes) {
      eventList = (allEventsRes as any).items || [];
    }
    
    // 创建 CSV 内容
    const csvHeaders = ['类型', '原因', '消息', '对象类型', '对象名称', '命名空间', '次数', '首次时间', '最后时间'];
    const csvRows = [csvHeaders.join(',')];
    eventList.forEach((event) => {
      const row = [
        getEventTypeText(event.type),
        getEventReasonText(event.reason),
        `"${event.message.replace(/"/g, '""')}"`,
        event.involved_object.kind,
        event.involved_object.name,
        event.involved_object.namespace,
        event.count.toString(),
        event.first_timestamp,
        event.last_timestamp
      ];
      csvRows.push(row.join(','));
    });
    
    // 下载 CSV 文件
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `k8s-events-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
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
    const beforeTime = new Date(Date.now() - cleanupDays.value * 24 * 60 * 60 * 1000).toISOString();
    
    const params: CleanupOldEventsReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value || undefined,
      before_time: beforeTime,
      event_type: selectedEventType.value || undefined,
      dry_run: false
    };
    
    await cleanupOldEvents(params);
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

/* ==================== 相关事件提示 ==================== */
.related-events-banner {
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
  background: #f6ffed;
}

.related-events-alert {
  border-radius: 6px;
  border: 1px solid #b7eb8f;
}

.related-events-alert :deep(.ant-alert-message) {
  font-weight: 500;
  color: #000000d9;
}

.related-events-alert :deep(.ant-alert-description) {
  color: #00000073;
  font-size: 13px;
}

/* ==================== 返回按钮样式 ==================== */
.back-button {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  border-color: #d9d9d9;
  color: #000000d9;
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
}

.back-button:hover {
  border-color: #1677ff;
  color: #1677ff;
  transform: translateX(-2px);
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

/* ==================== 图表容器 ==================== */
.chart-container {
  background: #ffffff;
  border-radius: 8px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f0f0;
  overflow: hidden;
}

.chart-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #000000d9;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-content {
  padding: 20px 24px;
}

.trend-chart {
  height: 300px;
  width: 100%;
}

/* ==================== 统计网格 ==================== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stats-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f0f0;
}

.stats-card h4 {
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: #000000d9;
  display: flex;
  align-items: center;
  gap: 8px;
}

.reason-list, .object-list {
  space: 12px 0;
}

.reason-item, .object-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.reason-item:last-child, .object-item:last-child {
  border-bottom: none;
}

.reason-name, .object-name {
  font-size: 14px;
  color: #000000d9;
  font-weight: 500;
  min-width: 120px;
}

.reason-stats, .object-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.reason-count, .object-count {
  font-size: 14px;
  color: #000000d9;
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}

.reason-bar, .object-bar {
  flex: 1;
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
  max-width: 150px;
}

.reason-bar-fill, .object-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #1677ff 0%, #69c0ff 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* ==================== 响应式设计 ==================== */
@media (max-width: 1400px) {
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .details-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
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
