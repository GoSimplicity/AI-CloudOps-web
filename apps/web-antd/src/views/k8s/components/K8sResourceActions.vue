<template>
  <div class="resource-actions">
    <a-dropdown :trigger="['click']" placement="bottomRight">
      <a-button type="text" size="small">
        <template #icon>
          <MoreOutlined />
        </template>
      </a-button>
      <template #overlay>
        <a-menu @click="handleMenuClick">
          <a-menu-item 
            v-for="action in filteredActions" 
            :key="action.key"
            :disabled="action.disabled"
            :class="{ 'danger-action': action.danger }"
          >
            <component 
              v-if="action.icon" 
              :is="action.icon" 
              class="action-icon"
            />
            {{ action.label }}
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { MoreOutlined } from '@ant-design/icons-vue'

interface ActionItem {
  key: string
  label: string
  icon?: Component
  disabled?: boolean
  danger?: boolean
  permission?: string
  condition?: () => boolean
}

interface Props {
  actions: ActionItem[]
  record?: any
  permissions?: string[]
}

interface Emits {
  (e: 'action', key: string, record?: any): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const filteredActions = computed(() => {
  return props.actions.filter(action => {
    // 检查权限
    if (action.permission && props.permissions) {
      if (!props.permissions.includes(action.permission)) {
        return false
      }
    }
    
    // 检查条件
    if (action.condition) {
      return action.condition()
    }
    
    return true
  })
})

const handleMenuClick = ({ key }: { key: string }) => {
  emit('action', key, props.record)
}
</script>

<style scoped>
.resource-actions {
  display: inline-block;
}

.action-icon {
  margin-right: 8px;
}

:deep(.danger-action) {
  color: #ff4d4f !important;
}

:deep(.danger-action:hover) {
  background-color: #fff2f0 !important;
}
</style>
