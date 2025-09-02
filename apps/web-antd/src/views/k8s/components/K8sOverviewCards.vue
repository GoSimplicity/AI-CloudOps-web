<template>
  <div class="overview-cards">
    <div 
      v-for="(card, index) in cards" 
      :key="index"
      class="overview-card"
      :class="card.className"
    >
      <div class="card-icon">
        <component :is="card.icon" />
      </div>
      <div class="card-info">
        <div class="card-number">{{ card.number }}</div>
        <div class="card-label">{{ card.label }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

interface CardItem {
  icon: Component
  number: string | number
  label: string
  className?: string
}

interface Props {
  cards: CardItem[]
}

defineProps<Props>()
</script>

<style scoped>
.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.overview-card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  transition: all 0.3s;
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
}

.card-info {
  flex: 1;
}

.card-number {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 4px;
}

.card-label {
  font-size: 14px;
  color: #00000073;
}

/* 特定卡片样式 */
.overview-card.total-clusters .card-icon {
  background: rgba(22, 119, 255, 0.1);
  color: #1677ff;
}

.overview-card.running-clusters .card-icon {
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
}

.overview-card.env-types .card-icon {
  background: rgba(114, 46, 209, 0.1);
  color: #722ed1;
}

.overview-card.resource-usage .card-icon {
  background: rgba(22, 119, 255, 0.1);
  color: #1677ff;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}

@media (max-width: 480px) {
  .overview-cards {
    grid-template-columns: 1fr;
  }
  
  .overview-card {
    padding: 20px;
  }
  
  .card-icon {
    width: 40px;
    height: 40px;
    font-size: 18px;
    margin-right: 12px;
  }
  
  .card-number {
    font-size: 18px;
  }
  
  .card-label {
    font-size: 13px;
  }
}
</style>
