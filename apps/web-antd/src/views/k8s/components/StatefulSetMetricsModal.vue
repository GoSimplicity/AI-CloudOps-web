<template>
  <a-modal
    :open="visible"
    title="StatefulSet 指标"
    width="1000px"
    class="cluster-modal metrics-modal"
    :footer="null"
    @cancel="$emit('close')"
  >
    <a-alert v-if="statefulSet" class="modal-alert" type="info" show-icon>
      <template #message>
        <span>{{ statefulSet.name }} ({{ statefulSet.namespace }})</span>
      </template>
      <template #description>
        <div>CPU/内存使用情况及网络IO监控</div>
      </template>
    </a-alert>

    <div class="metrics-container">
      <a-spin :spinning="loading" tip="正在加载指标数据...">
        <div v-if="!loading && !metrics" class="no-metrics">
          <a-empty description="暂无指标数据" />
        </div>
        
        <div v-else-if="metrics" class="metrics-content">
          <a-row :gutter="[16, 16]">
            <!-- CPU 使用率 -->
            <a-col :span="12">
              <a-card title="CPU 使用率" size="small">
                <div class="metric-item">
                  <div class="metric-value">{{ metrics.cpu_usage || '0' }}%</div>
                  <a-progress
                    :percent="parseFloat(metrics.cpu_usage || '0')"
                    size="small"
                    :status="getProgressStatus(parseFloat(metrics.cpu_usage || '0'))"
                  />
                </div>
              </a-card>
            </a-col>

            <!-- 内存使用率 -->
            <a-col :span="12">
              <a-card title="内存使用率" size="small">
                <div class="metric-item">
                  <div class="metric-value">{{ metrics.memory_usage || '0' }}%</div>
                  <a-progress
                    :percent="parseFloat(metrics.memory_usage || '0')"
                    size="small"
                    :status="getProgressStatus(parseFloat(metrics.memory_usage || '0'))"
                  />
                </div>
              </a-card>
            </a-col>

            <!-- 网络接收 -->
            <a-col :span="12">
              <a-card title="网络接收" size="small">
                <div class="metric-item">
                  <div class="metric-value">{{ formatBytes(metrics.network_rx || 0) }}/s</div>
                  <div class="metric-label">入站流量</div>
                </div>
              </a-card>
            </a-col>

            <!-- 网络发送 -->
            <a-col :span="12">
              <a-card title="网络发送" size="small">
                <div class="metric-item">
                  <div class="metric-value">{{ formatBytes(metrics.network_tx || 0) }}/s</div>
                  <div class="metric-label">出站流量</div>
                </div>
              </a-card>
            </a-col>

            <!-- Pod 数量 -->
            <a-col :span="12">
              <a-card title="Pod 数量" size="small">
                <div class="metric-item">
                  <div class="metric-value">{{ metrics.pod_count || 0 }}</div>
                  <div class="metric-label">活跃 Pod</div>
                </div>
              </a-card>
            </a-col>

            <!-- 存储使用 -->
            <a-col :span="12">
              <a-card title="存储使用" size="small">
                <div class="metric-item">
                  <div class="metric-value">{{ formatBytes(metrics.disk_usage || 0) }}</div>
                  <div class="metric-label">已使用存储</div>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <!-- 详细信息 -->
          <a-card title="详细信息" size="small" style="margin-top: 16px;">
            <a-row :gutter="[16, 8]">
              <a-col :span="8">
                <div class="detail-item">
                  <div class="detail-label">副本状态</div>
                  <div class="detail-value">{{ metrics.ready_replicas || 0 }}/{{ metrics.replicas || 0 }}</div>
                </div>
              </a-col>
              <a-col :span="8">
                <div class="detail-item">
                  <div class="detail-label">重启次数</div>
                  <div class="detail-value">{{ metrics.restart_count || 0 }}</div>
                </div>
              </a-col>
              <a-col :span="8">
                <div class="detail-item">
                  <div class="detail-label">运行时长</div>
                  <div class="detail-value">{{ formatUptime(metrics.uptime || 0) }}</div>
                </div>
              </a-col>
            </a-row>
          </a-card>
        </div>
      </a-spin>
    </div>
  </a-modal>
</template>

<script lang="ts" setup>
import type { K8sStatefulSet } from '../../../api';

interface Props {
  visible: boolean
  statefulSet: K8sStatefulSet | null
  metrics: any
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
});

const emit = defineEmits<{
  close: []
}>();

// 获取进度条状态
const getProgressStatus = (percent: number) => {
  if (percent >= 90) return 'exception';
  if (percent >= 70) return 'active';
  return 'success';
};

// 格式化字节数
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 格式化运行时长
const formatUptime = (seconds: number) => {
  if (!seconds) return '0分钟';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}天${hours}小时`;
  } else if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
};
</script>

<style scoped>
.metrics-container {
  min-height: 400px;
}

.no-metrics {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.metrics-content {
  padding: 8px 0;
}

.metric-item {
  text-align: center;
}

.metric-value {
  font-size: 24px;
  font-weight: 600;
  color: #1677ff;
  margin-bottom: 8px;
}

.metric-label {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.detail-item {
  text-align: center;
  padding: 8px 0;
}

.detail-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.detail-value {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.modal-alert {
  margin-bottom: 20px;
  border-radius: 6px;
}

:deep(.ant-card-head-title) {
  font-size: 14px;
  font-weight: 500;
}

:deep(.ant-card-body) {
  padding: 12px;
}
</style>
