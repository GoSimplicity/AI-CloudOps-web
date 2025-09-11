<template>
  <div class="alert-events-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-actions">
        <div class="search-filters">
          <a-input-search v-model:value="searchText" placeholder="搜索告警事件名称..." class="search-input"
            @search="handleSearch" @change="handleSearchChange" allow-clear />
          <a-select v-model:value="statusFilter" placeholder="告警状态" class="filter-select" @change="handleStatusChange"
            allow-clear>
            <a-select-option :value="undefined">全部状态</a-select-option>
            <a-select-option value="firing">告警中</a-select-option>
            <a-select-option value="silenced">已屏蔽</a-select-option>
            <a-select-option value="claimed">已认领</a-select-option>
            <a-select-option value="resolved">已恢复</a-select-option>
          </a-select>
          <a-select v-model:value="eventTimesFilter" placeholder="触发次数" class="filter-select"
            @change="handleEventTimesChange" allow-clear>
            <a-select-option :value="undefined">全部</a-select-option>
            <a-select-option value="1">1次</a-select-option>
            <a-select-option value="5">5次以上</a-select-option>
            <a-select-option value="10">10次以上</a-select-option>
          </a-select>
          <a-button @click="handleResetFilters" class="reset-btn">
            重置
          </a-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <a-row :gutter="[16, 16]">
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic title="总告警事件" :value="stats.total" :value-style="{ color: '#3f8600' }">
              <template #prefix>
                <Icon icon="carbon:container-registry" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic title="告警中事件" :value="stats.firing" :value-style="{ color: '#cf1322' }">
              <template #prefix>
                <Icon icon="carbon:warning-alt" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic title="已屏蔽事件" :value="stats.silenced" :value-style="{ color: '#faad14' }">
              <template #prefix>
                <Icon icon="carbon:data-table" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic title="已认领事件" :value="stats.claimed" :value-style="{ color: '#52c41a' }">
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
          bordered :scroll="{ x: 1600 }" @change="handleTableChange">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'alert_name'">
              <div class="alert-name-cell">
                <div class="alert-badge" :class="getAlertStatusClass(record)"></div>
                <span class="alert-name-text">{{ record.alert_name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ getStatusText(record.status) }}
              </a-tag>
            </template>

            <template v-if="column.key === 'labels'">
              <div class="tag-container">
                <a-tag v-for="label in (record.labels || [])" :key="label" class="tech-tag label-tag">
                  {{ label }}
                </a-tag>
                <span v-if="!(record.labels && record.labels.length)" class="empty-text">无标签</span>
              </div>
            </template>

            <template v-if="column.key === 'event_times'">
              <div class="event-times-info">
                <span class="times-value">{{ record.event_times }}</span>
                <span class="times-unit">次</span>
              </div>
            </template>

            <template v-if="column.key === 'send_group_name'">
              <div class="group-info">
                <a-avatar size="small" :style="{ backgroundColor: getAvatarColor((record.send_group?.name as string) || '') }">
                  {{ getInitials((record.send_group?.name as string) || '') }}
                </a-avatar>
                <span class="group-name">{{ (record.send_group?.name as string) || `ID: ${record.send_group_id}` }}</span>
              </div>
            </template>

            <template v-if="column.key === 'created_at'">
              <div class="date-info">
                <span class="date">{{ formatDate(record.created_at) }}</span>
                <span class="time">{{ formatTime(record.created_at) }}</span>
              </div>
            </template>

            <template v-if="column.key === 'action'">
              <div class="action-buttons">
                <a-tooltip title="屏蔽告警">
                  <a-button type="primary" size="small" @click="handleSilence(record)">
                    <template #icon>
                      <Icon icon="mdi:bell-off-outline" />
                    </template>
                  </a-button>
                </a-tooltip>
                <a-tooltip title="认领告警">
                  <a-button type="default" size="small" @click="handleClaim(record)">
                    <template #icon>
                      <Icon icon="mdi:hand-back-right-outline" />
                    </template>
                  </a-button>
                </a-tooltip>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleMenuClick(e.key, record)">
                      <a-menu-item key="unsilence">
                        <Icon icon="mdi:bell-ring-outline" /> 取消屏蔽
                      </a-menu-item>
                      <a-menu-divider />
                      <a-menu-item key="detail">查看详情</a-menu-item>
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

    <!-- 详情对话框 -->
    <a-modal :open="detailDialogVisible" title="告警事件详情" :width="previewDialogWidth" :footer="null"
      @cancel="closeDetailDialog" class="detail-dialog">
      <div v-if="detailDialog.form" class="alert-details">
        <div class="detail-header">
          <h2>{{ detailDialog.form.alert_name }}</h2>
          <div class="detail-badges">
            <a-tag :color="getStatusColor(detailDialog.form.status)">
              {{ getStatusText(detailDialog.form.status) }}
            </a-tag>
          </div>
        </div>

        <a-descriptions bordered :column="1" :labelStyle="{ width: '150px' }">
          <a-descriptions-item label="告警ID">{{ detailDialog.form.id }}</a-descriptions-item>
          <a-descriptions-item label="告警名称">{{ detailDialog.form.alert_name }}</a-descriptions-item>
          <a-descriptions-item label="告警状态">
            <a-tag :color="getStatusColor(detailDialog.form.status)">
              {{ getStatusText(detailDialog.form.status) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="发送组ID">{{ detailDialog.form.send_group_id || '未分配' }}</a-descriptions-item>
          <a-descriptions-item label="发送组名称">{{ (detailDialog.form.send_group?.name as string) || '未分配' }}</a-descriptions-item>
          <a-descriptions-item label="触发次数">{{ detailDialog.form.event_times }}次</a-descriptions-item>
          <a-descriptions-item label="静默ID">{{ detailDialog.form.silence_id || '无' }}</a-descriptions-item>
          <a-descriptions-item label="认领用户ID">{{ detailDialog.form.ren_ling_user_id || '未认领' }}</a-descriptions-item>
          <a-descriptions-item label="规则名称">{{ detailDialog.form.alert_name || '未知' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatFullDateTime(detailDialog.form?.created_at || '') }}</a-descriptions-item>
          <a-descriptions-item label="标签组">
            <div class="tag-container">
              <a-tag v-for="label in (detailDialog.form.labels || [])" :key="label" class="tech-tag label-tag">
                {{ label }}
              </a-tag>
              <span v-if="!(detailDialog.form.labels && detailDialog.form.labels.length)" class="empty-text">无标签</span>
            </div>
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button type="primary" @click="handleSilence(detailDialog.form)">屏蔽告警</a-button>
          <a-button type="default" @click="handleClaim(detailDialog.form)">认领告警</a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { DownOutlined } from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
import { useUserStore } from '@vben/stores';
import {
  getMonitorAlertEventListApi,
  eventAlertSilenceApi,
  eventAlertClaimApi,
  eventAlertUnSilenceApi,
  type MonitorAlertEvent,
  type GetMonitorAlertEventListReq,
  type EventAlertSilenceReq,
  type EventAlertClaimReq,
  type EventAlertUnSilenceReq,
  MonitorAlertEventStatus,
} from '#/api/core/prometheus/prometheus_alert_event';

// 响应式对话框宽度
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
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80, fixed: 'left' },
  { title: '告警名称', dataIndex: 'alert_name', key: 'alert_name', width: 200, fixed: 'left' },
  { title: '告警状态', dataIndex: 'status', key: 'status', width: 120, align: 'center' as const },
  { title: '发送组ID', dataIndex: 'send_group_id', key: 'send_group_id', width: 120 },
  { title: '触发次数', dataIndex: 'event_times', key: 'event_times', width: 100, align: 'center' as const },
  { title: '静默ID', dataIndex: 'silence_id', key: 'silence_id', width: 120 },
  { title: '认领用户', dataIndex: 'ren_ling_user_id', key: 'ren_ling_user_id', width: 120 },
  { title: '标签组', dataIndex: 'labels', key: 'labels', width: 200 },
  { title: '发送组', dataIndex: 'send_group_id', key: 'send_group_name', width: 120 },
  { title: '规则名称', dataIndex: 'alert_rule_name', key: 'alert_rule_name', width: 150 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
  { title: '操作', key: 'action', width: 200, align: 'center' as const, fixed: 'right' }
];

// 状态数据
const loading = ref(false);
const searchText = ref('');
const statusFilter = ref<string | undefined>(undefined);
const eventTimesFilter = ref<number | undefined>(undefined);
const data = ref<MonitorAlertEvent[]>([]);

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
  firing: 0,
  silenced: 0,
  claimed: 0,
  resolved: 0
});

// 对话框状态
const detailDialogVisible = ref(false);

// 详情对话框数据
const detailDialog = reactive({
  form: null as MonitorAlertEvent | null
});


const getAlertStatusClass = (record: MonitorAlertEvent): string => {
  switch (record.status) {
    case MonitorAlertEventStatus.FIRING: return 'status-firing';
    case MonitorAlertEventStatus.SILENCED: return 'status-silenced';
    case MonitorAlertEventStatus.CLAIMED: return 'status-claimed';
    case MonitorAlertEventStatus.RESOLVED: return 'status-resolved';
    case MonitorAlertEventStatus.UPGRADED: return 'status-claimed';
    default: return 'status-unknown';
  }
};

const getStatusColor = (status: MonitorAlertEventStatus): string => {
  switch (status) {
    case MonitorAlertEventStatus.FIRING: return 'error';
    case MonitorAlertEventStatus.SILENCED: return 'warning';
    case MonitorAlertEventStatus.CLAIMED: return 'processing';
    case MonitorAlertEventStatus.RESOLVED: return 'success';
    case MonitorAlertEventStatus.UPGRADED: return 'purple';
    default: return 'default';
  }
};

const getStatusText = (status: MonitorAlertEventStatus): string => {
  switch (status) {
    case MonitorAlertEventStatus.FIRING: return '告警中';
    case MonitorAlertEventStatus.SILENCED: return '已屏蔽';
    case MonitorAlertEventStatus.CLAIMED: return '已认领';
    case MonitorAlertEventStatus.RESOLVED: return '已恢复';
    case MonitorAlertEventStatus.UPGRADED: return '已升级';
    default: return '未知';
  }
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

const formatDate = (timestamp: string): string => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('zh-CN');
};

const formatTime = (timestamp: string): string => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const formatFullDateTime = (timestamp: string): string => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('zh-CN');
};

// 更新统计数据
const updateStats = () => {
  stats.total = data.value.length;
  stats.firing = data.value.filter(item => item.status === MonitorAlertEventStatus.FIRING).length;
  stats.silenced = data.value.filter(item => item.status === MonitorAlertEventStatus.SILENCED).length;
  stats.claimed = data.value.filter(item => item.status === MonitorAlertEventStatus.CLAIMED).length;
  stats.resolved = data.value.filter(item => item.status === MonitorAlertEventStatus.RESOLVED).length;
};

// 数据加载
const fetchResources = async (): Promise<void> => {
  loading.value = true;
  try {
    const params: GetMonitorAlertEventListReq = {
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      search: searchText.value || undefined,
      status: statusFilter.value,
    };

    const response = await getMonitorAlertEventListApi(params);
    if (response) {
      data.value = response.items || [];
      paginationConfig.total = response.total || 0;
      updateStats();
    }
  } catch (error: any) {
    console.error('加载告警事件列表失败:', error);
    message.error(error.message || '加载告警事件列表失败');
  } finally {
    loading.value = false;
  }
};

// 事件处理
const handleTableChange = (pagination: any): void => {
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  fetchResources();
};

const handleSearch = (): void => {
  paginationConfig.current = 1;
  fetchResources();
};

const handleSearchChange = (): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    paginationConfig.current = 1;
    fetchResources();
  }, 500);
};

const handleStatusChange = (): void => {
  paginationConfig.current = 1;
  fetchResources();
};

const handleEventTimesChange = (): void => {
  paginationConfig.current = 1;
  fetchResources();
};

const handleResetFilters = (): void => {
  searchText.value = '';
  statusFilter.value = undefined;
  eventTimesFilter.value = undefined;
  paginationConfig.current = 1;
  fetchResources();
  message.success('过滤条件已重置');
};

const handleMenuClick = (command: string, record: MonitorAlertEvent): void => {
  switch (command) {
    case 'unsilence':
      handleCancelSilence(record);
      break;
    case 'detail':
      showDetailDialog(record);
      break;
  }
};

const showDetailDialog = (record: MonitorAlertEvent): void => {
  detailDialog.form = record;
  detailDialogVisible.value = true;
};



// 处理屏蔽告警
const handleSilence = async (record: MonitorAlertEvent) => {
  Modal.confirm({
    title: '确认屏蔽',
    content: `您确定要屏蔽告警 "${record.alert_name}" 吗？`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      try {
        loading.value = true;
        const userStore = useUserStore();
        const currentUserId = Number(userStore.userInfo?.userId) || 0;
        const params: EventAlertSilenceReq = {
          id: record.id!,
          user_id: currentUserId,
          time: '2h',
        };
        await eventAlertSilenceApi(params);
        message.success(`屏蔽告警 "${record.alert_name}" 成功`);
        fetchResources();
        detailDialogVisible.value = false;
      } catch (error: any) {
        message.error(error.message || `屏蔽告警 "${record.alert_name}" 失败`);
        console.error(error);
      } finally {
        loading.value = false;
      }
    },
  });
};

// 处理认领告警
const handleClaim = async (record: MonitorAlertEvent) => {
  Modal.confirm({
    title: '确认认领',
    content: `您确定要认领告警 "${record.alert_name}" 吗？`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      try {
        loading.value = true;
        const userStore = useUserStore();
        const currentUserId = Number(userStore.userInfo?.userId) || 0;
        const params: EventAlertClaimReq = {
          id: record.id!,
          user_id: currentUserId,
        };
        await eventAlertClaimApi(params);
        message.success(`认领告警 "${record.alert_name}" 成功`);
        fetchResources();
        detailDialogVisible.value = false;
      } catch (error: any) {
        message.error(error.message || `认领告警 "${record.alert_name}" 失败`);
        console.error(error);
      } finally {
        loading.value = false;
      }
    },
  });
};

// 处理取消屏蔽告警
const handleCancelSilence = async (record: MonitorAlertEvent) => {
  Modal.confirm({
    title: '确认取消屏蔽',
    content: `您确定要取消屏蔽告警 "${record.alert_name}" 吗？`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      try {
        loading.value = true;
        const userStore = useUserStore();
        const currentUserId = Number(userStore.userInfo?.userId) || 0;
        const params: EventAlertUnSilenceReq = {
          id: record.id!,
          user_id: currentUserId,
        };
        await eventAlertUnSilenceApi(params);
        message.success(`取消屏蔽告警 "${record.alert_name}" 成功`);
        fetchResources();
      } catch (error: any) {
        message.error(error.message || `取消屏蔽告警 "${record.alert_name}" 失败`);
        console.error(error);
      } finally {
        loading.value = false;
      }
    },
  });
};

// 对话框关闭
const closeDetailDialog = (): void => {
  detailDialogVisible.value = false;
};

// 生命周期钩子
onMounted(() => {
  fetchResources();
});
</script>

<style scoped>
.alert-events-container {
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

.alert-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.alert-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-firing {
  background-color: #ff4d4f;
}

.status-silenced {
  background-color: #faad14;
}

.status-claimed {
  background-color: #1890ff;
}

.status-resolved {
  background-color: #52c41a;
}

.status-unknown {
  background-color: #d9d9d9;
}

.alert-name-text {
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

.event-times-info {
  display: flex;
  align-items: center;
  gap: 2px;
}

.times-value {
  font-weight: 600;
  font-size: 14px;
  color: #333;
}

.times-unit {
  font-size: 12px;
  color: #666;
}

.group-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-name {
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

/* 详情对话框样式 */
.detail-dialog .alert-details {
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
  .alert-events-container {
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

  .group-info {
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }

  .group-name {
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
.detail-dialog :deep(.ant-modal) {
  max-width: calc(100vw - 16px);
  margin: 8px;
}

@media (max-width: 768px) {
  .detail-dialog :deep(.ant-modal-body) {
    padding: 16px;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }
}
</style>
