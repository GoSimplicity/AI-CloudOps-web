<template>
  <div class="page-header">
    <div class="header-content">
      <div class="title-section">
        <div class="page-title">
          <component :is="titleIcon" class="title-icon" />
          <h1>{{ title }}</h1>
        </div>
        <p class="page-subtitle">{{ subtitle }}</p>
      </div>
      <div class="header-actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  title: string
  subtitle: string
  titleIcon: Component
}

defineProps<Props>()
</script>

<style scoped>
.page-header {
  background: #fff;
  border-radius: 8px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
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
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: #00000073;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .header-content {
    flex-direction: column;
    gap: 20px;
  }
  
  .header-actions {
    justify-content: flex-end;
  }
}

@media (max-width: 768px) {
  .header-content {
    padding: 20px 16px;
  }
  
  .page-title h1 {
    font-size: 20px;
  }
  
  .title-icon {
    font-size: 24px;
    margin-right: 12px;
  }
}
</style>
