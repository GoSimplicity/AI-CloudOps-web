<template>
  <a-modal 
    :open="visible" 
    title="创建Service" 
    width="900px" 
    class="cluster-modal" 
    :footer="null"
    @cancel="$emit('close')"
  >
    <a-alert class="modal-alert" type="info" show-icon>
      <template #message>创建新的Service</template>
      <template #description>Service用于暴露运行在一组Pod上的应用程序</template>
    </a-alert>

    <a-form 
      :model="formData" 
      :rules="formRules" 
      ref="formRef"
      layout="vertical" 
      style="margin-top: 24px;"
    >
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="Service名称" name="name">
            <a-input v-model:value="formData.name" placeholder="请输入Service名称" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="命名空间" name="namespace">
            <a-select v-model:value="formData.namespace" placeholder="选择命名空间">
              <a-select-option v-for="ns in namespaces" :key="ns.name" :value="ns.name">
                {{ ns.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="Service类型" name="type">
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

    <div class="modal-footer">
      <a-button @click="$emit('close')">取消</a-button>
      <a-button type="primary" @click="handleSubmit" :loading="loading">
        创建Service
      </a-button>
    </div>
  </a-modal>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { createServiceApi } from '../../../api';
import type { CreateServiceReq } from '../../../api';
import { ServicePortConfig, ServiceLabelsConfig } from './index';

interface NamespaceItem {
  name: string;
}

const props = defineProps<{
  visible: boolean;
  clusterId: number;
  defaultNamespace: string;
  namespaces: NamespaceItem[];
}>();

const emit = defineEmits<{
  close: [];
  success: [];
}>();

// 状态
const loading = ref(false);
const formRef = ref();

// 表单数据
const formData = ref<CreateServiceReq>({
  cluster_id: 0,
  name: '',
  namespace: 'default',
  type: 'ClusterIP',
  ports: [{
    name: '',
    protocol: 'TCP',
    port: 80,
    target_port: 80
  }],
  selector: {},
  labels: {},
  annotations: {}
});

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入Service名称', trigger: 'blur' },
    { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: 'Service名称必须符合DNS规范', trigger: 'blur' }
  ],
  namespace: [
    { required: true, message: '请选择命名空间', trigger: 'change' }
  ],
  type: [
    { required: true, message: '请选择Service类型', trigger: 'change' }
  ]
};

// 监听visible变化，重置表单
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    resetForm();
  }
});

// 重置表单
const resetForm = () => {
  formData.value = {
    cluster_id: props.clusterId,
    name: '',
    namespace: props.defaultNamespace || 'default',
    type: 'ClusterIP',
    ports: [{
      name: '',
      protocol: 'TCP',
      port: 80,
      target_port: 80
    }],
    selector: {},
    labels: {},
    annotations: {}
  };
  
  // 清除表单验证状态
  if (formRef.value) {
    formRef.value.resetFields();
  }
};

// 提交创建
const handleSubmit = async () => {
  if (!props.clusterId) {
    message.error('请先选择集群');
    return;
  }

  try {
    await formRef.value.validate();
  } catch (error) {
    message.error('请检查表单输入');
    return;
  }

  loading.value = true;
  try {
    formData.value.cluster_id = props.clusterId;
    await createServiceApi(formData.value);
    message.success('Service创建成功');
    emit('success');
    emit('close');
  } catch (error: any) {
    console.error('创建Service失败:', error);
    message.error(error.message || '创建Service失败');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}
</style>
