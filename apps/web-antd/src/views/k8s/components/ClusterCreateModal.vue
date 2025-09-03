<template>
  <a-modal
    :open="visible"
    title="创建集群"
    width="800px"
    :confirm-loading="loading"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      layout="vertical"
      class="cluster-create-form"
    >
      <div class="form-row">
        <a-form-item
          label="集群名称"
          name="name"
          class="form-item-half"
        >
          <a-input
            v-model:value="formData.name"
            placeholder="请输入集群名称"
          />
        </a-form-item>

        <a-form-item
          label="环境"
          name="env"
          class="form-item-half"
        >
          <a-select
            v-model:value="formData.env"
            placeholder="选择环境"
          >
            <a-select-option :value="Env.Prod">生产环境</a-select-option>
            <a-select-option :value="Env.Dev">开发环境</a-select-option>
            <a-select-option :value="Env.Stage">预发环境</a-select-option>
            <a-select-option :value="Env.Rc">测试环境</a-select-option>
            <a-select-option :value="Env.Press">灰度环境</a-select-option>
          </a-select>
        </a-form-item>
      </div>

      <div class="form-row">
        <a-form-item
          label="API Server 地址"
          name="api_server_addr"
          class="form-item-half"
        >
          <a-input
            v-model:value="formData.api_server_addr"
            placeholder="https://k8s-api.example.com:6443"
          />
        </a-form-item>

        <a-form-item
          label="版本"
          name="version"
          class="form-item-half"
        >
          <a-input
            v-model:value="formData.version"
            placeholder="v1.28.0"
          />
        </a-form-item>
      </div>

      <div class="form-row">
        <a-form-item
          label="CPU 请求量"
          name="cpu_request"
          class="form-item-quarter"
        >
          <a-input
            v-model:value="formData.cpu_request"
            placeholder="100m"
            addon-after="m"
          />
        </a-form-item>

        <a-form-item
          label="CPU 限制量"
          name="cpu_limit"
          class="form-item-quarter"
        >
          <a-input
            v-model:value="formData.cpu_limit"
            placeholder="500m"
            addon-after="m"
          />
        </a-form-item>

        <a-form-item
          label="内存请求量"
          name="memory_request"
          class="form-item-quarter"
        >
          <a-input
            v-model:value="formData.memory_request"
            placeholder="128Mi"
            addon-after="Mi"
          />
        </a-form-item>

        <a-form-item
          label="内存限制量"
          name="memory_limit"
          class="form-item-quarter"
        >
          <a-input
            v-model:value="formData.memory_limit"
            placeholder="512Mi"
            addon-after="Mi"
          />
        </a-form-item>
      </div>

      <a-form-item
        label="操作超时时间"
        name="action_timeout_seconds"
      >
        <a-input-number
          v-model:value="formData.action_timeout_seconds"
          :min="30"
          :max="300"
          placeholder="60"
          addon-after="秒"
          style="width: 200px"
        />
      </a-form-item>

      <a-form-item
        label="限制命名空间"
        name="restrict_namespace"
      >
        <a-select
          v-model:value="formData.restrict_namespace"
          mode="tags"
          placeholder="输入命名空间名称，支持多个"
          :token-separators="[',']"
        />
      </a-form-item>

      <a-form-item
        label="KubeConfig 内容"
        name="kube_config_content"
      >
        <a-textarea
          v-model:value="formData.kube_config_content"
          placeholder="请粘贴完整的 kubeconfig 文件内容"
          :rows="8"
          show-count
        />
      </a-form-item>

      <a-form-item
        label="标签"
        name="tags"
      >
        <div class="tags-section">
          <div
            v-for="(tag, index) in formData.tags"
            :key="index"
            class="tag-input-row"
          >
            <a-input
              v-model:value="tag.key"
              placeholder="标签键"
              style="width: 200px"
            />
            <span class="tag-separator">=</span>
            <a-input
              v-model:value="tag.value"
              placeholder="标签值"
              style="width: 200px"
            />
            <a-button
              type="text"
              danger
              @click="removeTag(index)"
              :disabled="(formData.tags?.length || 0) <= 1"
            >
              <template #icon><DeleteOutlined /></template>
            </a-button>
          </div>
          <a-button type="dashed" @click="addTag" block>
            <template #icon><PlusOutlined /></template>
            添加标签
          </a-button>
        </div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script lang="ts" setup>
import { ref, reactive, watch } from 'vue'
import { 
  PlusOutlined, 
  DeleteOutlined 
} from '@ant-design/icons-vue'
import type { FormInstance } from 'ant-design-vue'
import { 
  Env, 
  ClusterStatus, 
  type CreateClusterReq
} from '#/api/core/k8s/k8s_cluster'

interface Props {
  visible: boolean
  loading?: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'create', data: CreateClusterReq): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const formRef = ref<FormInstance>()

const formData = reactive<CreateClusterReq>({
  name: '',
  env: Env.Dev,
  api_server_addr: '',
  version: '',
  cpu_request: '100m',
  cpu_limit: '500m',
  memory_request: '128Mi',
  memory_limit: '512Mi',
  action_timeout_seconds: 60,
  restrict_namespace: [],
  kube_config_content: '',
  status: ClusterStatus.Running,
  tags: [{ key: '', value: '' }]
})

const rules = {
  name: [
    { required: true, message: '请输入集群名称', trigger: 'blur' },
    { min: 2, max: 50, message: '集群名称长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  env: [
    { required: true, message: '请选择环境', trigger: 'change' }
  ],
  api_server_addr: [
    { required: true, message: '请输入 API Server 地址', trigger: 'blur' },
    { pattern: /^https?:\/\/.+/, message: 'API Server 地址格式不正确', trigger: 'blur' }
  ],
  kube_config_content: [
    { required: true, message: '请输入 KubeConfig 内容', trigger: 'blur' }
  ]
}

const addTag = () => {
  formData.tags?.push({ key: '', value: '' })
}

const removeTag = (index: number) => {
  if (formData.tags && formData.tags.length > 1) {
    formData.tags.splice(index, 1)
  }
}

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
    
    // 过滤空标签
    const validTags = formData.tags?.filter(tag => tag.key && tag.value) || []
    
    const submitData: CreateClusterReq = {
      ...formData,
      tags: validTags
    }
    
    emit('create', submitData)
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

const handleCancel = () => {
  emit('close')
}

const resetForm = () => {
  Object.assign(formData, {
    name: '',
    env: Env.Dev,
    api_server_addr: '',
    version: '',
    cpu_request: '100m',
    cpu_limit: '500m',
    memory_request: '128Mi',
    memory_limit: '512Mi',
    action_timeout_seconds: 60,
    restrict_namespace: [],
    kube_config_content: '',
    status: ClusterStatus.Running,
    tags: [{ key: '', value: '' }]
  })
  formRef.value?.resetFields()
}

// 监听visible变化，重置表单
watch(() => props.visible, (newVal) => {
  if (!newVal) {
    resetForm()
  }
})
</script>

<style scoped>
.cluster-create-form {
  max-height: 500px;
  overflow-y: auto;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-item-half {
  flex: 1;
}

.form-item-quarter {
  flex: 1;
}

.tags-section {
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 12px;
  background: #fafafa;
}

.tag-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.tag-input-row:last-of-type {
  margin-bottom: 12px;
}

.tag-separator {
  color: #8c8c8c;
  font-weight: 500;
}

.cluster-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.cluster-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cluster-icon {
  color: #1677ff;
}

.cluster-name {
  font-weight: 500;
}

.cluster-meta {
  display: flex;
  gap: 4px;
}

@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    gap: 0;
  }
  
  .cluster-option {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>
