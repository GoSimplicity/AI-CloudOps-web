<template>
  <div class="k8s-page-header">
    <div class="header-content">
      <div class="title-section">
        <div class="page-title">
          <component :is="titleIcon" class="title-icon" />
          <h1>{{ title }}</h1>
        </div>
        <p v-if="subtitle" class="page-subtitle">{{ subtitle }}</p>
      </div>
      <div class="header-actions">
        <slot name="actions">
          <a-button @click="$emit('refresh')" :loading="loading">
            <template #icon><ReloadOutlined /></template>
            刷新
          </a-button>
        </slot>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ReloadOutlined } from '@ant-design/icons-vue'

interface Props {
  title: string
  subtitle?: string
  titleIcon?: any
  loading?: boolean
}

defineProps<Props>()

defineEmits<{
  refresh: []
}>()
</script>

<style scoped>
.k8s-page-header {
  margin-bottom: 24px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.title-section {
  flex: 1;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 8px 0;
}

.title-icon {
  font-size: 24px;
  color: #1677ff;
}

.page-title h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #262626;
}

.page-subtitle {
  margin: 0;
  font-size: 14px;
  color: #8c8c8c;
  line-height: 1.5;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .page-title h1 {
    font-size: 20px;
  }
}
</style>
