<template>
  <div class="k8s-data-table">
    <a-table
      :dataSource="dataSource"
      :columns="columns"
      :loading="loading"
      :rowSelection="rowSelection"
      :pagination="paginationConfig"
      @change="handleChange"
      :rowKey="rowKey"
      :size="size"
      :scroll="scroll"
      class="data-table"
    >
      <template #bodyCell="{ column, record, index }">
        <slot name="bodyCell" :column="column" :record="record" :index="index" />
      </template>

      <template #emptyText>
        <div class="empty-state">
          <a-empty :description="emptyText">
            <slot name="emptyAction" />
          </a-empty>
        </div>
      </template>
    </a-table>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

interface Props {
  dataSource: any[]
  columns: any[]
  loading?: boolean
  rowSelection?: any
  pagination?: any
  rowKey?: string
  size?: 'small' | 'middle' | 'large'
  scroll?: any
  emptyText?: string
}

interface Emits {
  (e: 'change', pagination: any, filters: any, sorter: any): void
}

const props = withDefaults(defineProps<Props>(), {
  rowKey: 'id',
  size: 'small',
  emptyText: '暂无数据'
})

const emit = defineEmits<Emits>()

const paginationConfig = computed(() => {
  if (props.pagination === false) return false
  
  return {
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) => 
      `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
    pageSizeOptions: ['10', '20', '30', '50'],
    ...props.pagination
  }
})

const handleChange = (pagination: any, filters: any, sorter: any) => {
  emit('change', pagination, filters, sorter)
}
</script>

<style scoped>
.k8s-data-table {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.data-table {
  border-radius: 8px;
}

.empty-state {
  padding: 40px 0;
}

@media (max-width: 768px) {
  .k8s-data-table {
    padding: 12px;
  }
}
</style>
