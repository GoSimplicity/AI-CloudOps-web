<template>
  <a-modal
    :open="visible"
    title="扩缩容 Deployment"
    @ok="handleConfirm"
    @cancel="$emit('close')"
    :confirmLoading="loading"
    class="cluster-modal"
  >
    <a-alert v-if="deployment" class="modal-alert" type="info" show-icon>
      <template #message>
        <span>{{ deployment.name }} ({{ deployment.namespace }})</span>
      </template>
      <template #description>
        <div>当前副本数: {{ deployment.replicas }}</div>
      </template>
    </a-alert>

    <a-form layout="vertical">
      <a-form-item label="目标副本数" required>
        <a-input-number 
          v-model:value="replicas" 
          :min="0" 
          :max="100" 
          style="width: 100%" 
          placeholder="请输入目标副本数"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import type { K8sDeployment } from '../../../api';

interface Props {
  visible: boolean
  deployment: K8sDeployment | null
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
});

const emit = defineEmits<{
  close: []
  confirm: [replicas: number]
}>();

const replicas = ref(1);

watch(() => props.deployment, (newDeployment) => {
  if (newDeployment) {
    replicas.value = newDeployment.replicas || 1;
  }
}, { immediate: true });

const handleConfirm = () => {
  emit('confirm', replicas.value);
};
</script>

<style scoped>
.modal-alert {
  margin-bottom: 20px;
  border-radius: 6px;
}
</style>
