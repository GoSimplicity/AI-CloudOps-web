<template>
  <a-modal
    :open="visible"
    title="Deployment 指标"
    width="1000px"
    class="cluster-modal metrics-modal"
    :footer="null"
    @cancel="$emit('close')"
  >
    <a-alert v-if="deployment" class="modal-alert" type="info" show-icon>
      <template #message>
        <span>{{ deployment.name }} ({{ deployment.namespace }})</span>
      </template>
      <template #description>
        <div>实时监控指标数据</div>
      </template>
    </a-alert>
    
    <a-spin :spinning="loading">
      <div v-if="metrics" class="metrics-content">
        <!-- 概览卡片 -->
        <div class="metrics-overview">
          <div class="metric-card cpu-card">
            <div class="metric-icon">
              <BarChartOutlined />
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ metrics.cpu_usage || 0 }}%</div>
              <div class="metric-label">CPU 使用率</div>
            </div>
          </div>
          
          <div class="metric-card memory-card">
            <div class="metric-icon">
              <PieChartOutlined />
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ metrics.memory_usage || 0 }}%</div>
              <div class="metric-label">内存使用率</div>
            </div>
          </div>
          
          <div class="metric-card network-card">
            <div class="metric-icon">
              <GlobalOutlined />
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ metrics.network_in || 0 }}/{{ metrics.network_out || 0 }}</div>
              <div class="metric-label">网络 IO (MB/s)</div>
            </div>
          </div>
          
          <div class="metric-card availability-card">
            <div class="metric-icon">
              <CheckCircleOutlined />
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ metrics.availability_rate || 0 }}%</div>
              <div class="metric-label">可用性</div>
            </div>
          </div>
        </div>
        
        <!-- 详细指标 -->
        <div class="metrics-details">
          <a-row :gutter="16">
            <a-col :span="12">
              <div class="detail-card">
                <h4>副本状态</h4>
                <div class="detail-content">
                  <div class="detail-item">
                    <span class="detail-label">就绪副本:</span>
                    <span class="detail-value">{{ metrics.replicas_ready || 0 }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">总副本:</span>
                    <span class="detail-value">{{ metrics.replicas_total || 0 }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">重启次数:</span>
                    <span class="detail-value">{{ metrics.restart_count || 0 }}</span>
                  </div>
                </div>
              </div>
            </a-col>
            <a-col :span="12">
              <div class="detail-card">
                <h4>存储与时间</h4>
                <div class="detail-content">
                  <div class="detail-item">
                    <span class="detail-label">磁盘使用率:</span>
                    <span class="detail-value">{{ metrics.disk_usage || 0 }}%</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">最后更新:</span>
                    <span class="detail-value">{{ formatDateTime(metrics.last_updated) }}</span>
                  </div>
                </div>
              </div>
            </a-col>
          </a-row>
        </div>
      </div>
      
      <a-empty v-else description="暂无指标数据">
        <template #image>
          <BarChartOutlined style="font-size: 64px; color: #d9d9d9;" />
        </template>
      </a-empty>
    </a-spin>
  </a-modal>
</template>

<script lang="ts" setup>
import {
  BarChartOutlined,
  PieChartOutlined,
  GlobalOutlined,
  CheckCircleOutlined
} from '@ant-design/icons-vue';
import type { K8sDeployment } from '../../../api';

interface Props {
  visible: boolean
  deployment: K8sDeployment | null
  metrics: any
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
});

defineEmits<{
  close: []
}>();

// 日期时间格式化
const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};
</script>

<style scoped>
.modal-alert {
  margin-bottom: 20px;
  border-radius: 6px;
}

.metrics-content {
  padding: 16px 0;
}

.metrics-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.metric-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  border: 1px solid #f0f0f0;
  transition: all 0.3s ease;
}

.metric-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.metric-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 16px;
}

.cpu-card .metric-icon {
  background: rgba(22, 119, 255, 0.1);
  color: #1677ff;
}

.memory-card .metric-icon {
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
}

.network-card .metric-icon {
  background: rgba(250, 173, 20, 0.1);
  color: #faad14;
}

.availability-card .metric-icon {
  background: rgba(114, 46, 209, 0.1);
  color: #722ed1;
}

.metric-info {
  flex: 1;
}

.metric-value {
  font-size: 24px;
  font-weight: 600;
  color: #000000d9;
  line-height: 1.2;
  margin-bottom: 4px;
}

.metric-label {
  font-size: 14px;
  color: #00000073;
}

.metrics-details {
  margin-top: 24px;
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
  color: #000000d9;
  font-size: 16px;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  color: #00000073;
  font-weight: 500;
  font-size: 14px;
}

.detail-value {
  color: #000000d9;
  font-weight: 600;
  font-size: 14px;
}
</style>
