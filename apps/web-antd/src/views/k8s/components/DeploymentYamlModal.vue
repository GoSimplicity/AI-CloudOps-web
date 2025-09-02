<template>
  <a-modal
    :open="visible"
    title="Deployment YAML 配置"
    width="900px"
    class="cluster-modal yaml-modal"
    :footer="null"
    @cancel="$emit('close')"
  >
    <a-alert v-if="deployment" class="modal-alert" type="info" show-icon>
      <template #message>
        <span>{{ deployment.name }} ({{ deployment.namespace }})</span>
      </template>
      <template #description>
        <div>状态: {{ deployment.available_replicas || 0 }}/{{ deployment.replicas || 0 }} | 创建于: {{ formatDate(deployment.created_at || '') }}</div>
      </template>
    </a-alert>
    
    <div class="yaml-actions">
      <a-button type="primary" size="small" @click="copyYaml">
        <template #icon><CopyOutlined /></template>
        复制
      </a-button>
    </div>
    <pre class="yaml-editor">{{ yaml }}</pre>
  </a-modal>
</template>

<script lang="ts" setup>
import { message } from 'ant-design-vue';
import { CopyOutlined } from '@ant-design/icons-vue';
import type { K8sDeployment } from '../../../api';

interface Props {
  visible: boolean
  deployment: K8sDeployment | null
  yaml: string
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: []
}>();

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 复制YAML
const copyYaml = async () => {
  try {
    await navigator.clipboard.writeText(props.yaml);
    message.success('YAML 已复制到剪贴板');
  } catch (err) {
    message.error('复制失败，请手动选择并复制');
  }
};
</script>

<style scoped>
.yaml-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}

.yaml-editor {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  padding: 16px;
  background-color: #fafafa;
  border-radius: 4px;
  border: 1px solid #f0f0f0;
  overflow: auto;
  max-height: 500px;
  margin: 0;
}

.modal-alert {
  margin-bottom: 20px;
  border-radius: 6px;
}
</style>
