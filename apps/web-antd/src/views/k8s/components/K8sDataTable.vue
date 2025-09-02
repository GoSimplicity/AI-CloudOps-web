<template>
  <div class="k8s-data-table">
    <!-- 结果信息头部 -->
    <div v-if="showHeader && dataSource.length > 0" class="table-header">
      <div class="result-info">
        <span class="result-count">共 {{ total || dataSource.length }} 个{{ resourceName }}</span>
        <div class="env-tags">
          <slot name="tags" />
        </div>
      </div>
    </div>

    <!-- 数据表格 -->
    <a-table
      :columns="columns"
      :data-source="dataSource"
      :row-selection="rowSelection"
      :loading="loading"
      :row-key="rowKey"
      :pagination="paginationConfig"
      @change="handleTableChange"
      :class="tableClass"
      :scroll="scroll"
      :size="size"
    >
      <!-- 动态插槽传递 -->
      <template 
        v-for="(_, slotName) in validSlots" 
        :key="slotName" 
        #[slotName]="slotProps"
      >
        <slot :name="slotName" v-bind="slotProps || {}" />
      </template>

      <!-- 默认空状态 -->
      <template #emptyText>
        <div class="empty-state">
          <component v-if="emptyIcon" :is="emptyIcon" class="empty-icon" />
          <p>{{ emptyText || `暂无${resourceName}数据` }}</p>
          <a-button v-if="showRefreshOnEmpty" type="primary" @click="$emit('refresh')">
            刷新数据
          </a-button>
        </div>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component, useSlots } from 'vue'

// 获取插槽
const slots = useSlots()

// 安全过滤插槽，避免null值导致的错误
const validSlots = computed(() => {
  const result: Record<string, any> = {}
  if (slots) {
    Object.keys(slots).forEach(slotName => {
      const slotValue = slots[slotName]
      if (slotValue && slotName && slotName !== 'emptyText') {
        result[slotName] = slotValue
      }
    })
  }
  return result
})

interface Props {
  // 表格数据
  columns: any[]
  dataSource: any[]
  loading?: boolean
  rowKey?: string | ((record: any) => string)
  
  // 分页配置
  currentPage?: number
  pageSize?: number
  total?: number
  showSizeChanger?: boolean
  showQuickJumper?: boolean
  pageSizeOptions?: string[]
  
  // 行选择
  selectedRows?: any[]
  rowSelection?: any
  
  // 表格样式
  tableClass?: string
  scroll?: any
  size?: 'small' | 'middle' | 'large'
  
  // 头部信息
  showHeader?: boolean
  resourceName?: string
  
  // 空状态
  emptyIcon?: Component
  emptyText?: string
  showRefreshOnEmpty?: boolean
}

interface Emits {
  (e: 'change', pagination: any, filters: any, sorter: any): void
  (e: 'update:currentPage', page: number): void
  (e: 'update:pageSize', size: number): void
  (e: 'refresh'): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  rowKey: 'id',
  currentPage: 1,
  pageSize: 12,
  showSizeChanger: true,
  showQuickJumper: true,
  pageSizeOptions: () => ['12', '24', '48', '96'],
  selectedRows: () => [],
  tableClass: 'k8s-resource-table',
  size: 'middle',
  showHeader: true,
  resourceName: '资源',
  showRefreshOnEmpty: true
})

const emit = defineEmits<Emits>()

// 分页配置
const paginationConfig = computed(() => {
  const totalCount = props.total ?? props.dataSource?.length ?? 0
  if (totalCount === 0) return false
  
  return {
    current: props.currentPage,
    pageSize: props.pageSize,
    total: totalCount,
    showSizeChanger: props.showSizeChanger,
    showQuickJumper: props.showQuickJumper,
    showTotal: (total: number, range: number[]) => 
      `显示 ${range?.[0] || 0}-${range?.[1] || 0} 条，共 ${total} 条数据`,
    pageSizeOptions: props.pageSizeOptions
  }
})

// 表格变更处理
const handleTableChange = (pagination: any, filters: any, sorter: any) => {
  if (pagination?.current && pagination.current !== props.currentPage) {
    emit('update:currentPage', pagination.current)
  }
  if (pagination?.pageSize && pagination.pageSize !== props.pageSize) {
    emit('update:pageSize', pagination.pageSize)
  }
  emit('change', pagination || {}, filters || {}, sorter || {})
}
</script>

<style scoped>
.k8s-data-table {
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.table-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.result-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.result-count {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.env-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

:deep(.k8s-resource-table) {
  border-radius: 0;
}

:deep(.k8s-resource-table .ant-table-thead > tr > th) {
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
  font-weight: 600;
  color: #262626;
}

:deep(.k8s-resource-table .ant-table-tbody > tr:hover > td) {
  background: #f5f5f5;
}

:deep(.k8s-resource-table .ant-table-tbody > tr > td) {
  border-bottom: 1px solid #f0f0f0;
  padding: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 48px;
  color: #d9d9d9;
  margin-bottom: 16px;
}

.empty-state p {
  margin: 0 0 16px 0;
  color: #999;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .table-header {
    padding: 16px;
  }
  
  .result-info {
    flex-direction: column;
    align-items: flex-start;
  }
  
  :deep(.k8s-resource-table .ant-table-tbody > tr > td) {
    padding: 12px 8px;
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .table-header {
    padding: 12px;
  }
  
  .result-count {
    font-size: 13px;
  }
}
</style>
