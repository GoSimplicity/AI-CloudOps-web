<template>
  <a-modal 
    :open="visible" 
    title="Service 端点详情" 
    width="800px" 
    class="cluster-modal"
    :footer="null"
    @cancel="$emit('close')"
  >
    <a-alert 
      v-if="service" 
      class="modal-alert" 
      type="info" 
      show-icon
    >
      <template #message>
        <span>{{ service.name }} ({{ service.namespace }})</span>
      </template>
      <template #description>
        <div>端点总数: {{ endpoints.length }}</div>
      </template>
    </a-alert>

    <a-table 
      :data-source="endpoints" 
      :columns="columns" 
      :loading="loading" 
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'ready'">
          <a-tag :color="record.ready ? 'green' : 'red'">
            {{ record.ready ? '就绪' : '未就绪' }}
          </a-tag>
        </template>
      </template>
    </a-table>
  </a-modal>
</template>

<script lang="ts" setup>
import type { K8sService, ServiceEndpoint } from '../../../api';

defineProps<{
  visible: boolean;
  service: K8sService | null;
  endpoints: ServiceEndpoint[];
  loading?: boolean;
}>();

defineEmits<{
  close: [];
}>();

// 表格列配置
const columns = [
  { title: 'IP地址', dataIndex: 'ip', key: 'ip' },
  { title: '端口', dataIndex: 'port', key: 'port', width: '100px' },
  { title: '协议', dataIndex: 'protocol', key: 'protocol', width: '100px' },
  { title: '状态', key: 'ready', width: '100px' },
  { title: '节点', dataIndex: 'node_name', key: 'node_name' }
];
</script>
