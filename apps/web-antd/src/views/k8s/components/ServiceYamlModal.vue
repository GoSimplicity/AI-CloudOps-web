<template>
  <a-modal 
    :open="visible" 
    title="Service YAML 配置" 
    width="900px" 
    class="cluster-modal yaml-modal"
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
        <div>类型: {{ service.type }} | 集群IP: {{ service.cluster_ip }}</div>
      </template>
    </a-alert>

    <div class="yaml-actions">
      <a-button type="primary" size="small" @click="copyYaml">
        <template #icon>
          <CopyOutlined />
        </template>
        复制
      </a-button>
    </div>
    <pre class="yaml-editor">{{ yaml }}</pre>
  </a-modal>
</template>

<script lang="ts" setup>
import { message } from 'ant-design-vue';
import { CopyOutlined } from '@ant-design/icons-vue';
import type { K8sService } from '../../../api';

const props = defineProps<{
  visible: boolean;
  service: K8sService | null;
  yaml: string;
}>();

defineEmits<{
  close: [];
}>();

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
  margin-bottom: 16px;
  display: flex;
  justify-content: flex-end;
}

.yaml-editor {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 16px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  max-height: 500px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
