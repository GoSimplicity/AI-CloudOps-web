<template>
  <div class="process-basic-config">
    <a-form ref="formRef" :model="formData" :rules="formRules" layout="vertical">
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="流程名称" name="name">
            <a-input v-model:value="formData.name" placeholder="请输入流程名称" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="关联表单" name="form_design_id">
            <a-select 
              v-model:value="formData.form_design_id" 
              placeholder="请选择关联表单" 
              style="width: 100%"
              show-search 
              :filter-option="false" 
              option-label-prop="children"
              :not-found-content="formSelectorLoading ? undefined : '无数据'"
              @search="handleFormSearch" 
              @dropdown-visible-change="handleFormDropdownChange"
              allow-clear 
              :loading="formSelectorLoading"
            >
              <a-select-option v-for="form in forms" :key="form.id" :value="form.id">
                {{ form.name }}
              </a-select-option>
            </a-select>
            <div class="field-hint">
              <InfoCircleOutlined /> 只能选择已发布的表单设计
            </div>
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item label="分类" name="category_id">
            <a-select 
              v-model:value="formData.category_id" 
              placeholder="请选择分类" 
              style="width: 100%"
              show-search 
              :filter-option="false" 
              option-label-prop="children"
              :not-found-content="categorySelectorLoading ? undefined : '无数据'"
              @search="handleCategorySearch" 
              @dropdown-visible-change="handleCategoryDropdownChange"
              allow-clear 
              :loading="categorySelectorLoading"
            >
              <a-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="状态" name="status">
            <a-radio-group v-model:value="formData.status">
              <a-radio :value="ProcessStatus.Draft">草稿</a-radio>
              <a-radio :value="ProcessStatus.Published">已发布</a-radio>
              <a-radio :value="ProcessStatus.Archived">已归档</a-radio>
            </a-radio-group>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="默认流程">
            <a-checkbox v-model:checked="formData.is_default">设为默认流程</a-checkbox>
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="描述" name="description">
        <a-textarea v-model:value="formData.description" :rows="3" placeholder="请输入流程描述" />
      </a-form-item>

      <a-form-item label="标签" name="tags">
        <a-select
          v-model:value="formData.tags"
          mode="tags"
          placeholder="输入标签后按回车添加"
          style="width: 100%"
          :token-separators="[',']"
        >
        </a-select>
      </a-form-item>

      <a-form-item label="流程定义" name="definition">
        <a-textarea 
          v-model:value="definitionJsonString" 
          :rows="8" 
          placeholder="请粘贴流程设计的JSON定义" 
          :class="{ 'json-error': jsonError }"
        />
        <div v-if="jsonError" class="json-error-message">
          {{ jsonError }}
        </div>
      </a-form-item>
    </a-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { InfoCircleOutlined } from '@ant-design/icons-vue';
import { 
  ProcessStatus,
  type CreateWorkorderProcessReq 
} from '#/api/core/workorder/workorder_process';
import { type WorkorderCategoryItem, listWorkorderCategory } from '#/api/core/workorder/workorder_category';
import { type WorkorderFormDesignItem, listWorkorderFormDesign, FormDesignStatus } from '#/api/core/workorder/workorder_form_design';

// Props
interface Props {
  modelValue: Partial<CreateWorkorderProcessReq>;
}

// Emits
interface Emits {
  (e: 'update:modelValue', value: Partial<CreateWorkorderProcessReq>): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 表单引用
const formRef = ref();

// 数据列表
const forms = ref<WorkorderFormDesignItem[]>([]);
const categories = ref<WorkorderCategoryItem[]>([]);

// 选择器状态
const formSelectorLoading = ref(false);
const categorySelectorLoading = ref(false);

// 搜索参数
const formSearchText = ref('');
const categorySearchText = ref('');

// JSON 相关状态
const jsonError = ref<string>('');

// 表单数据 - 使用 computed 避免循环更新
const formData = computed<Partial<CreateWorkorderProcessReq>>({
  get: () => props.modelValue || {
    name: '',
    description: '',
    form_design_id: 0,
    category_id: undefined,
    status: ProcessStatus.Draft,
    tags: [],
    is_default: 0,
    definition: undefined
  },
  set: (value) => {
    emit('update:modelValue', value);
  }
});

// JSON 字符串的计算属性
const definitionJsonString = computed<string>({
  get: () => {
    if (!formData.value.definition) {
      return '';
    }
    try {
      return JSON.stringify(formData.value.definition, null, 2);
    } catch {
      return '';
    }
  },
  set: (value: string) => {
    jsonError.value = '';
    
    if (!value.trim()) {
      const newFormData = { ...formData.value };
      newFormData.definition = undefined;
      formData.value = newFormData;
      return;
    }

    try {
      const parsed = JSON.parse(value);
      const newFormData = { ...formData.value };
      newFormData.definition = parsed;
      formData.value = newFormData;
    } catch (error: any) {
      jsonError.value = `JSON格式错误: ${error.message}`;
    }
  }
});

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入流程名称', trigger: 'blur' },
    { min: 3, max: 50, message: '长度应为3到50个字符', trigger: 'blur' }
  ],
  form_design_id: [
    { required: true, message: '请选择关联表单', trigger: 'change' }
  ],
  definition: [
    {
      validator: (_rule: any, _value: any) => {
        if (jsonError.value) {
          return Promise.reject(new Error(jsonError.value));
        }
        return Promise.resolve();
      },
      trigger: 'change'
    }
  ]
};

/**
 * 加载表单列表
 */
const loadForms = async (search?: string): Promise<void> => {
  formSelectorLoading.value = true;
  try {
    const params = {
      page: 1,
      size: 50,
      search: search || formSearchText.value || undefined,
      status: FormDesignStatus.Published // 只获取已发布的表单
    };

    const res = await listWorkorderFormDesign(params) as any;
    if (res && res.items) {
      forms.value = res.items || [];
    }
  } catch (error: any) {

    forms.value = [];
  } finally {
    formSelectorLoading.value = false;
  }
};

/**
 * 加载分类列表
 */
const loadCategories = async (search?: string): Promise<void> => {
  categorySelectorLoading.value = true;
  try {
    const params = {
      page: 1,
      size: 50,
      search: search || categorySearchText.value || undefined
    };

    const res = await listWorkorderCategory(params) as any;
    if (res && res.items) {
      categories.value = res.items || [];
    }
  } catch (error: any) {

    categories.value = [];
  } finally {
    categorySelectorLoading.value = false;
  }
};

// 选择器搜索处理
const handleFormSearch = (value: string): void => {
  formSearchText.value = value;
  loadForms(value);
};

const handleCategorySearch = (value: string): void => {
  categorySearchText.value = value;
  loadCategories(value);
};

const handleFormDropdownChange = (open: boolean): void => {
  if (open) {
    loadForms();
  }
};

const handleCategoryDropdownChange = (open: boolean): void => {
  if (open) {
    loadCategories();
  }
};

// 验证方法
const validate = async (): Promise<boolean> => {
  try {
    await formRef.value?.validate();
    return true;
  } catch (error) {
    return false;
  }
};

// 重置方法
const resetFields = (): void => {
  formRef.value?.resetFields();
  jsonError.value = '';
};

// 暴露方法给父组件
defineExpose({
  validate,
  resetFields
});

// 初始化
onMounted(async () => {
  await Promise.all([
    loadForms(),
    loadCategories()
  ]);
});
</script>

<style scoped>
.process-basic-config {
  padding: 16px 0;
}

.json-error {
  border-color: #ff4d4f !important;
  box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.2) !important;
}

.json-error-message {
  color: #ff4d4f;
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.4;
}

.field-hint {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 4px;
  line-height: 1.4;
}

@media (max-width: 768px) {
  .process-basic-config :deep(.ant-col) {
    margin-bottom: 16px;
  }
}
</style>
