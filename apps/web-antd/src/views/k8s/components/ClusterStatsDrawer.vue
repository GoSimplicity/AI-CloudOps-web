<template>
  <a-drawer
    :open="visible"
    title="集群统计信息"
    width="600px"
    @close="handleClose"
  >
    <div v-if="loading" class="loading-container">
      <a-spin size="large" />
      <p>正在加载统计数据...</p>
    </div>

    <div v-else-if="stats" class="stats-content">
      <!-- 集群基本信息 -->
      <div class="stats-section">
        <h3 class="section-title">
          <ClusterOutlined />
          集群基本信息
        </h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">集群名称:</span>
            <span class="info-value">{{ cluster?.name || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">最后更新:</span>
            <span class="info-value">{{ formatTime(stats.last_update_time) }}</span>
          </div>
        </div>
      </div>

      <!-- 节点统计 -->
      <div class="stats-section">
        <h3 class="section-title">
          <DesktopOutlined />
          节点统计
        </h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">{{ stats.node_stats.total_nodes }}</div>
            <div class="stat-label">总节点数</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ stats.node_stats.ready_nodes }}</div>
            <div class="stat-label">就绪节点</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ stats.node_stats.master_nodes }}</div>
            <div class="stat-label">主节点</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ stats.node_stats.worker_nodes }}</div>
            <div class="stat-label">工作节点</div>
          </div>
        </div>
      </div>

      <!-- Pod统计 -->
      <div class="stats-section">
        <h3 class="section-title">
          <ContainerOutlined />
          Pod统计
        </h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">{{ stats.pod_stats.total_pods }}</div>
            <div class="stat-label">总Pod数</div>
          </div>
          <div class="stat-card running">
            <div class="stat-number">{{ stats.pod_stats.running_pods }}</div>
            <div class="stat-label">运行中</div>
          </div>
          <div class="stat-card pending">
            <div class="stat-number">{{ stats.pod_stats.pending_pods }}</div>
            <div class="stat-label">等待中</div>
          </div>
          <div class="stat-card failed">
            <div class="stat-number">{{ stats.pod_stats.failed_pods }}</div>
            <div class="stat-label">失败</div>
          </div>
        </div>
      </div>

      <!-- 资源统计 -->
      <div class="stats-section">
        <h3 class="section-title">
          <FundOutlined />
          资源统计
        </h3>
        <div class="resource-stats">
          <div class="resource-item">
            <div class="resource-header">
              <span class="resource-title">CPU使用率</span>
              <span class="resource-percentage">{{ stats.resource_stats.cpu_utilization }}%</span>
            </div>
            <a-progress 
              :percent="stats.resource_stats.cpu_utilization" 
              :stroke-color="getProgressColor(stats.resource_stats.cpu_utilization)"
            />
            <div class="resource-detail">
              已使用: {{ stats.resource_stats.used_cpu }} / 总量: {{ stats.resource_stats.total_cpu }}
            </div>
          </div>

          <div class="resource-item">
            <div class="resource-header">
              <span class="resource-title">内存使用率</span>
              <span class="resource-percentage">{{ stats.resource_stats.memory_utilization }}%</span>
            </div>
            <a-progress 
              :percent="stats.resource_stats.memory_utilization"
              :stroke-color="getProgressColor(stats.resource_stats.memory_utilization)"
            />
            <div class="resource-detail">
              已使用: {{ stats.resource_stats.used_memory }} / 总量: {{ stats.resource_stats.total_memory }}
            </div>
          </div>

          <div class="resource-item">
            <div class="resource-header">
              <span class="resource-title">存储使用率</span>
              <span class="resource-percentage">{{ stats.resource_stats.storage_utilization }}%</span>
            </div>
            <a-progress 
              :percent="stats.resource_stats.storage_utilization"
              :stroke-color="getProgressColor(stats.resource_stats.storage_utilization)"
            />
            <div class="resource-detail">
              已使用: {{ stats.resource_stats.used_storage }} / 总量: {{ stats.resource_stats.total_storage }}
            </div>
          </div>
        </div>
      </div>

      <!-- 工作负载统计 -->
      <div class="stats-section">
        <h3 class="section-title">
          <AppstoreOutlined />
          工作负载统计
        </h3>
        <div class="workload-grid">
          <div class="workload-item">
            <span class="workload-label">Deployments:</span>
            <span class="workload-value">{{ stats.workload_stats.deployments }}</span>
          </div>
          <div class="workload-item">
            <span class="workload-label">StatefulSets:</span>
            <span class="workload-value">{{ stats.workload_stats.statefulsets }}</span>
          </div>
          <div class="workload-item">
            <span class="workload-label">DaemonSets:</span>
            <span class="workload-value">{{ stats.workload_stats.daemonsets }}</span>
          </div>
          <div class="workload-item">
            <span class="workload-label">Services:</span>
            <span class="workload-value">{{ stats.workload_stats.services }}</span>
          </div>
          <div class="workload-item">
            <span class="workload-label">ConfigMaps:</span>
            <span class="workload-value">{{ stats.workload_stats.configmaps }}</span>
          </div>
          <div class="workload-item">
            <span class="workload-label">Secrets:</span>
            <span class="workload-value">{{ stats.workload_stats.secrets }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <a-empty description="暂无统计数据" />
    </div>
  </a-drawer>
</template>

<script lang="ts" setup>
import { 
  ClusterOutlined,
  DesktopOutlined,
  ContainerOutlined,
  FundOutlined,
  AppstoreOutlined
} from '@ant-design/icons-vue'
import type { ClusterStats, K8sCluster } from '#/api/core/k8s/k8s_cluster'

interface Props {
  visible: boolean
  cluster?: K8sCluster
  stats?: ClusterStats
  loading?: boolean
}

interface Emits {
  (e: 'close'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const handleClose = () => {
  emit('close')
}

const formatTime = (timestamp: string) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN')
}

const getProgressColor = (percent: number) => {
  if (percent < 50) return '#52c41a'
  if (percent < 80) return '#faad14'
  return '#ff4d4f'
}
</script>

<style scoped>
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.loading-container p {
  margin-top: 16px;
  color: #8c8c8c;
}

.stats-content {
  padding: 4px 0;
}

.stats-section {
  margin-bottom: 32px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #262626;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #fafafa;
  border-radius: 4px;
}

.info-label {
  color: #8c8c8c;
  font-weight: 500;
}

.info-value {
  color: #262626;
  font-weight: 500;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}

.stat-card {
  text-align: center;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}

.stat-card.running {
  background: #f6ffed;
  border-color: #b7eb8f;
}

.stat-card.pending {
  background: #fffbe6;
  border-color: #ffe58f;
}

.stat-card.failed {
  background: #fff2f0;
  border-color: #ffccc7;
}

.stat-number {
  font-size: 24px;
  font-weight: 600;
  color: #262626;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #8c8c8c;
}

.resource-stats {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.resource-item {
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}

.resource-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.resource-title {
  font-weight: 500;
  color: #262626;
}

.resource-percentage {
  font-weight: 600;
  color: #1677ff;
}

.resource-detail {
  margin-top: 8px;
  font-size: 12px;
  color: #8c8c8c;
}

.workload-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.workload-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #fafafa;
  border-radius: 4px;
  border: 1px solid #f0f0f0;
}

.workload-label {
  color: #8c8c8c;
  font-weight: 500;
}

.workload-value {
  color: #262626;
  font-weight: 600;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .workload-grid {
    grid-template-columns: 1fr;
  }
}
</style>
