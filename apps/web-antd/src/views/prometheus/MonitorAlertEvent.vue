<script setup lang="ts">
import OpsPage from '#/components/ops/OpsPage.vue';
import { useListRequest } from './useListRequest';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { DownOutlined } from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
import { useUserStore } from '@vben/stores';
import {
  eventAlertClaimApi,
  type EventAlertClaimReq,
  eventAlertSilenceApi,
  type EventAlertSilenceReq,
  eventAlertUnSilenceApi,
  type EventAlertUnSilenceReq,
  getMonitorAlertEventListApi,
  type GetMonitorAlertEventListReq,
  type MonitorAlertEvent,
  MonitorAlertEventStatus,
} from '#/api/core/prometheus/prometheus_alert_event';
import { useAuthStore } from '#/store';
import { getAvatarColor } from '#/utils/avatar-color';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';

let disposed = false;
let detailRevision = 0;
const mutationVersions = new Map<number, number>();
let mutationRevision = 0;
onBeforeUnmount(() => {
  disposed = true;
  detailRevision += 1;
  mutationVersions.clear();
});

const operationOwner = (): string | undefined => {
  const userId = Number(useUserStore().userInfo?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) return undefined;
  return JSON.stringify([userId, useAuthStore().getAuthGeneration()]);
};

const validRecordId = (id: unknown): id is number =>
  typeof id === 'number' && Number.isSafeInteger(id) && id > 0;

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
  { dataIndex: 'id', fixed: 'left', key: 'id', title: 'ID', width: 80 },
  {
    dataIndex: 'alert_name',
    fixed: 'left',
    key: 'alert_name',
    title: '告警名称',
    width: 200,
  },
  {
    align: 'center' as const,
    dataIndex: 'status',
    key: 'status',
    title: '告警状态',
    width: 120,
  },
  {
    dataIndex: 'send_group_id',
    key: 'send_group_id',
    title: '发送组ID',
    width: 120,
  },
  {
    align: 'center' as const,
    dataIndex: 'event_times',
    key: 'event_times',
    title: '触发次数',
    width: 100,
  },
  { dataIndex: 'silence_id', key: 'silence_id', title: '静默ID', width: 120 },
  {
    dataIndex: 'ren_ling_user_id',
    key: 'ren_ling_user_id',
    title: '认领用户',
    width: 120,
  },
  { dataIndex: 'labels', key: 'labels', title: '标签组', width: 200 },
  {
    dataIndex: 'send_group_id',
    key: 'send_group_name',
    title: '发送组',
    width: 120,
  },
  {
    dataIndex: 'alert_rule_name',
    key: 'alert_rule_name',
    title: '规则名称',
    width: 150,
  },
  { dataIndex: 'created_at', key: 'created_at', title: '创建时间', width: 180 },
  {
    align: 'center' as const,
    fixed: 'right',
    key: 'action',
    title: '操作',
    width: 200,
  },
];

// 状态数据
const loading = ref(false);
const { loadError, beginRequest } = useListRequest(loading);
const searchText = ref('');
const statusFilter = ref<string | undefined>(undefined);
const eventTimesFilter = ref<number | undefined>(undefined);
const data = ref<MonitorAlertEvent[]>([]);

// 防抖处理
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
onBeforeUnmount(() => {
  if (searchTimeout) clearTimeout(searchTimeout);
});

// 分页配置
const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  size: 'default' as const,
});

// 统计数据
const stats = reactive({
  total: 0,
  firing: 0,
  silenced: 0,
  claimed: 0,
  resolved: 0,
});

// 对话框状态
const detailDialogVisible = ref(false);

// 详情对话框数据
const detailDialog = reactive({
  form: null as MonitorAlertEvent | null,
});

const getAlertStatusClass = (record: MonitorAlertEvent): string => {
  switch (record.status) {
    case MonitorAlertEventStatus.FIRING: {
      return 'status-firing';
    }
    case MonitorAlertEventStatus.SILENCED: {
      return 'status-silenced';
    }
    case MonitorAlertEventStatus.CLAIMED: {
      return 'status-claimed';
    }
    case MonitorAlertEventStatus.RESOLVED: {
      return 'status-resolved';
    }
    case MonitorAlertEventStatus.UPGRADED: {
      return 'status-claimed';
    }
    default: {
      return 'status-unknown';
    }
  }
};

const getStatusColor = (status: MonitorAlertEventStatus): string => {
  switch (status) {
    case MonitorAlertEventStatus.FIRING: {
      return 'error';
    }
    case MonitorAlertEventStatus.SILENCED: {
      return 'warning';
    }
    case MonitorAlertEventStatus.CLAIMED: {
      return 'processing';
    }
    case MonitorAlertEventStatus.RESOLVED: {
      return 'success';
    }
    case MonitorAlertEventStatus.UPGRADED: {
      return 'purple';
    }
    default: {
      return 'default';
    }
  }
};

const getStatusText = (status: MonitorAlertEventStatus): string => {
  switch (status) {
    case MonitorAlertEventStatus.FIRING: {
      return '告警中';
    }
    case MonitorAlertEventStatus.SILENCED: {
      return '已屏蔽';
    }
    case MonitorAlertEventStatus.CLAIMED: {
      return '已认领';
    }
    case MonitorAlertEventStatus.RESOLVED: {
      return '已恢复';
    }
    case MonitorAlertEventStatus.UPGRADED: {
      return '已升级';
    }
    default: {
      return '未知';
    }
  }
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
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFullDateTime = (timestamp: string): string => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('zh-CN');
};

// 更新统计数据
const updateStats = () => {
  stats.total = data.value.length;
  stats.firing = data.value.filter(
    (item) => item.status === MonitorAlertEventStatus.FIRING,
  ).length;
  stats.silenced = data.value.filter(
    (item) => item.status === MonitorAlertEventStatus.SILENCED,
  ).length;
  stats.claimed = data.value.filter(
    (item) => item.status === MonitorAlertEventStatus.CLAIMED,
  ).length;
  stats.resolved = data.value.filter(
    (item) => item.status === MonitorAlertEventStatus.RESOLVED,
  ).length;
};

// 数据加载
const fetchResources = async (): Promise<void> => {
  const request = beginRequest();
  try {
    const params: GetMonitorAlertEventListReq = {
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      search: searchText.value || undefined,
      status: statusFilter.value,
    };

    const response = await getMonitorAlertEventListApi(params);
    if (!request.isCurrent()) return;
    if (response) {
      const count = eventTimesFilter.value;
      data.value = (response.items || []).filter(
        (item: MonitorAlertEvent) =>
          count === undefined ||
          (count === 1 ? item.event_times === 1 : item.event_times >= count),
      );
      paginationConfig.total = response.total || 0;
      updateStats();
    }
  } catch (error: any) {
    if (!request.fail(error, '加载告警事件列表失败')) return;
    data.value = [];
    paginationConfig.total = 0;
    updateStats();
    if (shouldNotifyPageError(error)) message.error(loadError.value);
  } finally {
    request.finish();
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
};

const showDetailDialog = (record: MonitorAlertEvent): void => {
  detailRevision += 1;
  detailDialog.form = record;
  detailDialogVisible.value = true;
};

// 对话框关闭
const closeDetailDialog = (): void => {
  detailRevision += 1;
  detailDialogVisible.value = false;
};

// 确认框绑定打开时的账号与事件，不能借用切换后的身份执行旧操作。
const confirmEventAction = (
  record: MonitorAlertEvent,
  action: {
    closeDetail: boolean;
    label: string;
    run: (id: number, userId: number) => Promise<unknown>;
  },
): void => {
  if (disposed) return;
  const id = record.id;
  const userId = Number(useUserStore().userInfo?.userId);
  if (!validRecordId(id) || !validRecordId(userId)) {
    message.warning('告警或账号标识无效，请刷新后重试');
    return;
  }
  const owner = operationOwner();
  const name = record.alert_name;
  const detailTicket = detailRevision;
  const fromDetail = detailDialogVisible.value && detailDialog.form?.id === id;
  const inScope = () =>
    !disposed &&
    record.id === id &&
    operationOwner() === owner &&
    (!fromDetail || detailRevision === detailTicket);
  let confirmationConsumed = false;
  Modal.confirm({
    title: `确认${action.label}`,
    content: `您确定要${action.label}告警 "${name}" 吗？`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      if (confirmationConsumed || !inScope()) return;
      confirmationConsumed = true;
      const ticket = ++mutationRevision;
      mutationVersions.set(id, ticket);
      const isCurrent = () => inScope() && mutationVersions.get(id) === ticket;
      try {
        // Modal 自己等待此 Promise；列表 loading 只由列表请求管理。
        await action.run(id, userId);
        if (!isCurrent()) return;
        message.success(`${action.label}告警 "${name}" 成功`);
        fetchResources();
        if (action.closeDetail && fromDetail && detailDialog.form?.id === id) {
          closeDetailDialog();
        }
      } catch (error: unknown) {
        if (isCurrent() && shouldNotifyPageError(error)) {
          message.error(
            error instanceof Error && error.message
              ? error.message
              : `${action.label}告警失败`,
          );
        }
      } finally {
        if (mutationVersions.get(id) === ticket) {
          mutationVersions.delete(id);
        }
      }
    },
  });
};

const handleCancelSilence = (record: MonitorAlertEvent): void => {
  confirmEventAction(record, {
    label: '取消屏蔽',
    closeDetail: false,
    run: (id, userId) => {
      const params: EventAlertUnSilenceReq = { id, user_id: userId };
      return eventAlertUnSilenceApi(params);
    },
  });
};

const handleMenuClick = (command: string, record: MonitorAlertEvent): void => {
  switch (command) {
    case 'unsilence': {
      handleCancelSilence(record);
      break;
    }
    case 'detail': {
      showDetailDialog(record);
      break;
    }
  }
};

const handleSilence = (record: MonitorAlertEvent): void => {
  confirmEventAction(record, {
    label: '屏蔽',
    closeDetail: true,
    run: (id, userId) => {
      const params: EventAlertSilenceReq = { id, user_id: userId, time: '2h' };
      return eventAlertSilenceApi(params);
    },
  });
};

const handleClaim = (record: MonitorAlertEvent): void => {
  confirmEventAction(record, {
    label: '认领',
    closeDetail: true,
    run: (id, userId) => {
      const params: EventAlertClaimReq = { id, user_id: userId };
      return eventAlertClaimApi(params);
    },
  });
};

// 生命周期钩子
onMounted(() => {
  fetchResources();
});
</script>

<template>
  <OpsPage description="按状态查询事件，认领或管理静默" title="告警事件">
    <!-- 页面标题 -->
    <template #filters>
      <div class="search-filters">
        <a-input-search
          v-model:value="searchText"
          allow-clear
          class="search-input"
          placeholder="搜索告警事件名称..."
          @change="handleSearchChange"
          @search="handleSearch"
        />
        <a-select
          v-model:value="statusFilter"
          allow-clear
          class="filter-select"
          placeholder="告警状态"
          @change="handleStatusChange"
        >
          <a-select-option :value="undefined">全部状态</a-select-option>
          <a-select-option value="firing">告警中</a-select-option>
          <a-select-option value="silenced">已屏蔽</a-select-option>
          <a-select-option value="claimed">已认领</a-select-option>
          <a-select-option value="resolved">已恢复</a-select-option>
        </a-select>
        <a-select
          v-model:value="eventTimesFilter"
          allow-clear
          class="filter-select"
          placeholder="触发次数（本页）"
          @change="handleEventTimesChange"
        >
          <a-select-option :value="undefined">全部</a-select-option>
          <a-select-option :value="1">1次</a-select-option>
          <a-select-option :value="5">5次以上</a-select-option>
          <a-select-option :value="10">10次以上</a-select-option>
        </a-select>
        <a-button class="reset-btn" @click="handleResetFilters">
          重置
        </a-button>
      </div>
    </template>

    <!-- 统计卡片 -->
    <template #summary>
      <div class="stats-row">
        <a-row :gutter="[16, 16]">
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.total"
                :value-style="{ color: '#3f8600' }"
                title="本页总告警事件"
              >
                <template #prefix>
                  <Icon icon="carbon:container-registry" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.firing"
                :value-style="{ color: '#cf1322' }"
                title="本页告警中事件"
              >
                <template #prefix>
                  <Icon icon="carbon:warning-alt" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.silenced"
                :value-style="{ color: '#faad14' }"
                title="本页已屏蔽事件"
              >
                <template #prefix>
                  <Icon icon="carbon:data-table" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.claimed"
                :value-style="{ color: '#52c41a' }"
                title="本页已认领事件"
              >
                <template #prefix>
                  <Icon icon="carbon:server" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
        </a-row>
      </div>
    </template>

    <a-alert
      v-if="loadError"
      :message="loadError"
      role="alert"
      show-icon
      type="error"
    >
      <template #action>
        <a-button :loading="loading" size="small" @click="fetchResources">
          重试
        </a-button>
      </template>
    </a-alert>

    <!-- 表格容器 -->
    <div class="table-container">
      <a-card>
        <a-table
          :columns="columns"
          :data-source="data"
          :loading="loading"
          :pagination="paginationConfig"
          :scroll="{ x: 1600 }"
          bordered
          row-key="id"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'alert_name'">
              <div class="alert-name-cell">
                <div
                  class="alert-badge"
                  :class="getAlertStatusClass(record)"
                ></div>
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
                <a-tag
                  v-for="label in record.labels || []"
                  :key="label"
                  class="tech-tag label-tag"
                >
                  {{ label }}
                </a-tag>
                <span
                  v-if="!(record.labels && record.labels.length)"
                  class="empty-text"
                  >无标签</span
                >
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
                <a-avatar
                  size="small"
                  :style="{
                    backgroundColor: getAvatarColor(
                      (record.send_group?.name as string) || '',
                    ),
                  }"
                >
                  {{ getInitials((record.send_group?.name as string) || '') }}
                </a-avatar>
                <span class="group-name">{{
                  (record.send_group?.name as string) ||
                  `ID: ${record.send_group_id}`
                }}</span>
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
                  <a-button
                    size="small"
                    type="primary"
                    @click="handleSilence(record)"
                  >
                    <template #icon>
                      <Icon icon="mdi:bell-off-outline" />
                    </template>
                  </a-button>
                </a-tooltip>
                <a-tooltip title="认领告警">
                  <a-button
                    size="small"
                    type="default"
                    @click="handleClaim(record)"
                  >
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
    <a-modal
      :footer="null"
      :open="detailDialogVisible"
      :width="previewDialogWidth"
      class="detail-dialog"
      title="告警事件详情"
      @cancel="closeDetailDialog"
    >
      <div v-if="detailDialog.form" class="alert-details">
        <div class="detail-header">
          <h2>{{ detailDialog.form.alert_name }}</h2>
          <div class="detail-badges">
            <a-tag :color="getStatusColor(detailDialog.form.status)">
              {{ getStatusText(detailDialog.form.status) }}
            </a-tag>
          </div>
        </div>

        <a-descriptions :column="1" :labelStyle="{ width: '150px' }" bordered>
          <a-descriptions-item label="告警ID">
            {{ detailDialog.form.id }}
          </a-descriptions-item>
          <a-descriptions-item label="告警名称">
            {{ detailDialog.form.alert_name }}
          </a-descriptions-item>
          <a-descriptions-item label="告警状态">
            <a-tag :color="getStatusColor(detailDialog.form.status)">
              {{ getStatusText(detailDialog.form.status) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="发送组ID">
            {{ detailDialog.form.send_group_id || '未分配' }}
          </a-descriptions-item>
          <a-descriptions-item label="发送组名称">
            {{ (detailDialog.form.send_group?.name as string) || '未分配' }}
          </a-descriptions-item>
          <a-descriptions-item label="触发次数">
            {{ detailDialog.form.event_times }}次
          </a-descriptions-item>
          <a-descriptions-item label="静默ID">
            {{ detailDialog.form.silence_id || '无' }}
          </a-descriptions-item>
          <a-descriptions-item label="认领用户ID">
            {{ detailDialog.form.ren_ling_user_id || '未认领' }}
          </a-descriptions-item>
          <a-descriptions-item label="规则名称">
            {{ detailDialog.form.alert_name || '未知' }}
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatFullDateTime(detailDialog.form?.created_at || '') }}
          </a-descriptions-item>
          <a-descriptions-item label="标签组">
            <div class="tag-container">
              <a-tag
                v-for="label in detailDialog.form.labels || []"
                :key="label"
                class="tech-tag label-tag"
              >
                {{ label }}
              </a-tag>
              <span
                v-if="
                  !(detailDialog.form.labels && detailDialog.form.labels.length)
                "
                class="empty-text"
                >无标签</span
              >
            </div>
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button type="primary" @click="handleSilence(detailDialog.form)">
            屏蔽告警
          </a-button>
          <a-button type="default" @click="handleClaim(detailDialog.form)">
            认领告警
          </a-button>
        </div>
      </div>
    </a-modal>
  </OpsPage>
</template>

<style scoped>
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
  border-radius: var(--ops-radius);
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
  background-color: var(--ops-border);
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
  border-left: 1px solid #52c41a;
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
  color: var(--ops-ink);
}

.times-unit {
  font-size: 12px;
  color: var(--ops-muted);
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
  color: var(--ops-muted);
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
  color: var(--ops-ink);
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
