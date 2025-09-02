<template>
  <a-modal 
    :open="visible" 
    title="编辑Service" 
    width="1000px" 
    class="cluster-modal edit-service-modal" 
    :footer="null"
    @cancel="$emit('close')"
  >
    <a-alert 
      v-if="service" 
      class="modal-alert" 
      type="info" 
      show-icon
    >
      <template #message>编辑Service: {{ service.name }}</template>
      <template #description>修改Service配置和属性</template>
    </a-alert>

    <!-- 编辑模式切换 -->
    <div class="edit-mode-switcher">
      <a-radio-group v-model:value="currentEditMode" @change="handleEditModeChange">
        <a-radio-button value="form">
          <EditOutlined />
          可视化编辑
        </a-radio-button>
        <a-radio-button value="yaml">
          <CodeOutlined />
          YAML编辑
        </a-radio-button>
      </a-radio-group>
    </div>

    <!-- 可视化编辑模式 -->
    <div v-if="currentEditMode === 'form'">
      <a-form :model="formData" layout="vertical" style="margin-top: 24px;">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="Service名称">
              <a-input v-model:value="formData.name" placeholder="Service名称" :disabled="true" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间">
              <a-input v-model:value="formData.namespace" placeholder="命名空间" :disabled="true" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="Service类型">
          <a-select v-model:value="formData.type" placeholder="选择Service类型">
            <a-select-option value="ClusterIP">ClusterIP</a-select-option>
            <a-select-option value="NodePort">NodePort</a-select-option>
            <a-select-option value="LoadBalancer">LoadBalancer</a-select-option>
            <a-select-option value="ExternalName">ExternalName</a-select-option>
          </a-select>
        </a-form-item>

        <!-- 端口配置 -->
        <ServicePortConfig v-model:ports="formData.ports" :serviceType="formData.type" />

        <!-- 选择器 -->
        <ServiceLabelsConfig v-model:labels="formData.selector" title="选择器" />

        <!-- 标签 -->
        <ServiceLabelsConfig v-model:labels="formData.labels" title="标签" />

        <!-- 注解 -->
        <ServiceLabelsConfig v-model:labels="formData.annotations" title="注解" />
      </a-form>
    </div>

    <!-- YAML编辑模式 -->
    <div v-if="currentEditMode === 'yaml'" class="yaml-edit-container">
      <ServiceYamlEditor v-model:yaml="editYaml" :loading="loading" />
    </div>

    <div class="modal-footer">
      <a-button @click="$emit('close')">取消</a-button>
      <a-button type="primary" @click="handleSubmit" :loading="loading">
        <template #icon>
          <CodeOutlined v-if="currentEditMode === 'yaml'" />
          <EditOutlined v-else />
        </template>
        {{ currentEditMode === 'yaml' ? '应用YAML' : '更新配置' }}
      </a-button>
    </div>
  </a-modal>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { EditOutlined, CodeOutlined } from '@ant-design/icons-vue';
import { updateServiceApi, getServiceYamlApi } from '../../../api';
import type { K8sService, UpdateServiceReq, K8sYaml } from '../../../api';
import { ServicePortConfig, ServiceLabelsConfig, ServiceYamlEditor } from './index';

const props = defineProps<{
  visible: boolean;
  service: K8sService | null;
  clusterId: number;
}>();

const emit = defineEmits<{
  close: [];
  success: [];
}>();

// 状态
const loading = ref(false);
const currentEditMode = ref<'form' | 'yaml'>('form');
const editYaml = ref('');

// 表单数据
const formData = ref<UpdateServiceReq>({
  cluster_id: 0,
  name: '',
  namespace: '',
  type: 'ClusterIP',
  ports: [],
  selector: {},
  labels: {},
  annotations: {}
});

// 监听service变化，初始化表单
watch(() => props.service, async (newService) => {
  if (newService && props.visible) {
    formData.value = {
      cluster_id: props.clusterId,
      name: newService.name,
      namespace: newService.namespace,
      type: newService.type,
      ports: newService.ports || [],
      selector: newService.selector || {},
      labels: newService.labels || {},
      annotations: newService.annotations || {}
    };

    // 预加载YAML内容
    await loadYamlContent();
  }
}, { immediate: true, deep: true });

// 加载YAML内容
const loadYamlContent = async () => {
  if (!props.service || !props.clusterId) return;
  
  try {
    const res = await getServiceYamlApi(props.clusterId, props.service.namespace, props.service.name);
    if (res && typeof res === 'object' && 'yaml' in res) {
      editYaml.value = (res as K8sYaml).yaml;
    } else if (typeof res === 'string') {
      editYaml.value = res;
    } else {
      editYaml.value = JSON.stringify(res, null, 2);
    }
  } catch (error: any) {
    console.error('预加载YAML失败:', error);
    editYaml.value = '# 获取YAML失败，请刷新重试';
  }
};

// 编辑模式切换
const handleEditModeChange = () => {
  // 模式切换时的逻辑，暂时不需要特殊处理
};

// 提交更新
const handleSubmit = async () => {
  if (!props.service || !props.clusterId) {
    message.error('缺少必要参数');
    return;
  }

  loading.value = true;
  try {
    if (currentEditMode.value === 'yaml') {
      // YAML模式更新
      if (!editYaml.value || editYaml.value.trim() === '') {
        message.error('YAML内容不能为空');
        return;
      }

      // 验证YAML格式
      try {
        const yaml = await import('js-yaml');
        yaml.load(editYaml.value);
      } catch (yamlError: any) {
        message.error('YAML格式错误: ' + (yamlError.message || '请检查格式'));
        return;
      }

      // 构建YAML更新请求
      const yamlUpdateData: UpdateServiceReq = {
        cluster_id: props.clusterId,
        name: props.service.name,
        namespace: props.service.namespace,
        yaml: editYaml.value
      };

      await updateServiceApi(
        props.clusterId,
        props.service.namespace,
        props.service.name,
        yamlUpdateData
      );
      message.success('Service YAML更新成功');
    } else {
      // 表单模式更新
      formData.value.cluster_id = props.clusterId;
      await updateServiceApi(
        props.clusterId,
        props.service.namespace,
        props.service.name,
        formData.value
      );
      message.success('Service配置更新成功');
    }

    emit('success');
    emit('close');
  } catch (error: any) {
    console.error('更新Service失败:', error);
    message.error(error.message || '更新Service失败');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.edit-service-modal :deep(.ant-modal-body) {
  max-height: 80vh;
  overflow-y: auto;
}

.edit-mode-switcher {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 16px 0;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}

.edit-mode-switcher .ant-radio-group {
  display: flex;
  justify-content: center;
}

.edit-mode-switcher .ant-radio-button-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-weight: 500;
}

.yaml-edit-container {
  margin-top: 24px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}
</style>
  
