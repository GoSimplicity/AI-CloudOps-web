<template>
  <div class="k8s-overview-cards">
    <div
      v-for="card in cards"
      :key="card.label"
      class="overview-card"
      :class="card.type"
    >
      <div class="card-icon">
        <component :is="card.icon" />
      </div>
      <div class="card-info">
        <div class="card-number">{{ card.value }}</div>
        <div class="card-label">{{ card.label }}</div>
      </div>
      <div v-if="card.trend" class="card-trend" :class="card.trend.type">
        <component :is="getTrendIcon(card.trend.type)" />
        <span>{{ card.trend.value }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { 
  ArrowUpOutlined, 
  ArrowDownOutlined, 
  MinusOutlined 
} from '@ant-design/icons-vue'

interface CardTrend {
  type: 'up' | 'down' | 'stable'
  value: string
}

interface OverviewCard {
  label: string
  value: string | number
  icon: any
  type?: string
  trend?: CardTrend
}

interface Props {
  cards: OverviewCard[]
}

defineProps<Props>()

const getTrendIcon = (type: string) => {
  const iconMap = {
    'up': ArrowUpOutlined,
    'down': ArrowDownOutlined,
    'stable': MinusOutlined
  }
  return iconMap[type as keyof typeof iconMap] || MinusOutlined
}
</script>

<style scoped>
.k8s-overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.overview-card {
  position: relative;
  padding: 24px;
  background: white;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
}

.overview-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.card-icon {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f6f8ff;
  border-radius: 8px;
  font-size: 20px;
  color: #1677ff;
}

.card-info {
  margin-right: 50px;
}

.card-number {
  font-size: 32px;
  font-weight: 600;
  color: #262626;
  margin-bottom: 4px;
  line-height: 1;
}

.card-label {
  font-size: 14px;
  color: #8c8c8c;
  font-weight: 400;
}

.card-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 500;
}

.card-trend.up {
  color: #52c41a;
}

.card-trend.down {
  color: #ff4d4f;
}

.card-trend.stable {
  color: #8c8c8c;
}

/* 不同类型的卡片样式 */
.overview-card.total {
  border-left: 4px solid #1677ff;
}

.overview-card.running {
  border-left: 4px solid #52c41a;
}

.overview-card.warning {
  border-left: 4px solid #faad14;
}

.overview-card.error {
  border-left: 4px solid #ff4d4f;
}

@media (max-width: 768px) {
  .k8s-overview-cards {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }
  
  .overview-card {
    padding: 16px;
  }
  
  .card-number {
    font-size: 24px;
  }
  
  .card-icon {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }
}
</style>
