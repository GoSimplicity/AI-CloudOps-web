<template>
  <div class="dynamic-form-container">
    <!-- 表单设计器 -->
    <div class="form-designer" v-if="showDesigner">
      <a-card class="designer-card">
        <template #title>
          <div class="card-title">
            <FormOutlined />
            <span>表单设计器</span>
          </div>
        </template>
        <template #extra>
          <a-space>
            <a-button @click="saveFormDesign" type="primary" class="btn-primary">
              <template #icon>
                <SaveOutlined />
              </template>
              保存设计
            </a-button>
            <a-button @click="togglePreview" type="default" class="btn-primary">
              <template #icon>
                <EyeOutlined />
              </template>
              预览表单
            </a-button>
            <a-button @click="clearForm" type="default">
              <template #icon>
                <DeleteOutlined />
              </template>
              清空表单
            </a-button>
          </a-space>
        </template>

        <div class="designer-content">
          <!-- 表单基础信息配置 -->
          <div class="form-meta-config">
            <div class="config-header">
              <h4>表单基础信息</h4>
            </div>
            <a-row :gutter="16">
              <a-col :span="24" :md="8">
                <a-form-item label="表单名称" class="form-item">
                  <a-input 
                    v-model:value="formMeta.name" 
                    placeholder="请输入表单名称" 
                    class="config-input"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="8">
                <a-form-item label="表单分类" class="form-item">
                  <a-select 
                    v-model:value="formMeta.category_id" 
                    placeholder="请选择分类" 
                    class="config-input"
                    allow-clear
                    :loading="categoryLoading"
                    :dropdown-render="dropdownRender"
                    @dropdown-visible-change="onCategoryDropdownVisibleChange"
                  >
                    <a-select-option 
                      v-for="category in categories" 
                      :key="category.id" 
                      :value="category.id"
                    >
                      {{ category.name }}
                    </a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="8">
                <a-form-item label="表单状态" class="form-item">
                  <a-select 
                    v-model:value="formMeta.status" 
                    placeholder="请选择状态" 
                    class="config-input"
                  >
                    <a-select-option :value="FormDesignStatus.Draft">草稿</a-select-option>
                    <a-select-option :value="FormDesignStatus.Published">已发布</a-select-option>
                    <a-select-option :value="FormDesignStatus.Archived">已归档</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="24" :md="16">
                <a-form-item label="表单描述" class="form-item">
                  <a-textarea 
                    v-model:value="formMeta.description" 
                    placeholder="请输入表单描述" 
                    :rows="2"
                    class="config-input"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="8">
                <a-form-item label="标签" class="form-item">
                  <a-select 
                    v-model:value="formMeta.tags" 
                    mode="tags" 
                    placeholder="输入标签后按回车" 
                    class="config-input"
                  />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="24" :md="12">
                <a-form-item label="是否为模板" class="form-item switch-item">
                  <a-switch 
                    v-model:checked="isTemplate" 
                    checked-children="是"
                    un-checked-children="否"
                  />
                </a-form-item>
              </a-col>
            </a-row>
          </div>

          <!-- 字段类型选择区域 -->
          <div class="field-controls">
            <div class="controls-header">
              <h4>选择字段类型</h4>
              <span class="controls-desc">点击下方按钮添加表单字段</span>
            </div>
            <div class="field-buttons">
              <a-button @click="addFieldType('text')" class="field-btn">
                <PlusOutlined />
                <span>文本框</span>
              </a-button>
              <a-button @click="addFieldType('number')" class="field-btn">
                <PlusOutlined />
                <span>数字</span>
              </a-button>
              <a-button @click="addFieldType('password')" class="field-btn">
                <PlusOutlined />
                <span>密码</span>
              </a-button>
              <a-button @click="addFieldType('textarea')" class="field-btn">
                <PlusOutlined />
                <span>多行文本</span>
              </a-button>
              <a-button @click="addFieldType('date')" class="field-btn">
                <PlusOutlined />
                <span>日期</span>
              </a-button>
              <a-button @click="addFieldType('select')" class="field-btn">
                <PlusOutlined />
                <span>下拉选项</span>
              </a-button>
              <a-button @click="addFieldType('radio')" class="field-btn">
                <PlusOutlined />
                <span>单选框</span>
              </a-button>
              <a-button @click="addFieldType('checkbox')" class="field-btn">
                <PlusOutlined />
                <span>复选框</span>
              </a-button>
              <a-button @click="addFieldType('switch')" class="field-btn">
                <PlusOutlined />
                <span>开关</span>
              </a-button>
            </div>
          </div>

          <!-- 配置管理操作区域 -->
          <div class="config-actions">
            <div class="actions-header">
              <h4>配置管理</h4>
              <span class="actions-desc">导入、导出和管理表单配置</span>
            </div>
            <div class="action-buttons">
              <a-button @click="toggleJsonViewer" class="action-btn">
                <template #icon>
                  <CodeOutlined />
                </template>
                <span>查看 JSON</span>
              </a-button>
              <a-button @click="copyJson" class="action-btn">
                <template #icon>
                  <CopyOutlined />
                </template>
                <span>复制配置</span>
              </a-button>
              <a-button @click="exportConfig" class="action-btn">
                <template #icon>
                  <DownloadOutlined />
                </template>
                <span>导出文件</span>
              </a-button>
              <a-upload 
                :show-upload-list="false"
                :before-upload="importConfig"
                accept=".json"
                class="upload-wrapper"
              >
                <a-button class="action-btn">
                  <template #icon>
                    <UploadOutlined />
                  </template>
                  <span>导入配置</span>
                </a-button>
              </a-upload>
            </div>
          </div>

          <!-- 字段列表 -->
          <div class="field-list" v-if="formSchema.fields.length > 0">
            <div class="list-header">
              <h4>表单字段配置</h4>
              <span class="field-count">共 {{ formSchema.fields.length }} 个字段</span>
            </div>
            <a-collapse>
              <a-collapse-panel 
                v-for="(field, index) in formSchema.fields" 
                :key="index"
                :header="getFieldDisplayName(field)"
                class="field-panel"
              >
                <template #extra>
                  <div class="field-actions" @click.stop>
                    <a-tooltip title="上移">
                      <a-button 
                        type="text" 
                        size="small" 
                        @click="moveField(index, -1)"
                        :disabled="index === 0"
                        class="action-btn-small"
                      >
                        <UpOutlined />
                      </a-button>
                    </a-tooltip>
                    <a-tooltip title="下移">
                      <a-button 
                        type="text" 
                        size="small" 
                        @click="moveField(index, 1)"
                        :disabled="index === formSchema.fields.length - 1"
                        class="action-btn-small"
                      >
                        <DownOutlined />
                      </a-button>
                    </a-tooltip>
                    <a-tooltip title="删除">
                      <a-button 
                        type="text" 
                        danger 
                        size="small" 
                        @click="removeField(index)"
                        class="action-btn-small"
                      >
                        <DeleteOutlined />
                      </a-button>
                    </a-tooltip>
                  </div>
                </template>

                <FieldConfig 
                  :field="field" 
                  @update="updateField(index, $event)"
                />
              </a-collapse-panel>
            </a-collapse>
          </div>

          <div v-else class="empty-form">
            <a-empty description="暂无表单字段">
              <template #image>
                <FormOutlined style="font-size: 48px; color: #d9d9d9;" />
              </template>
              <div class="empty-desc">
                <p>请在上方选择字段类型开始设计表单</p>
                <a-button type="primary" @click="addFieldType('text')" ghost>
                  <PlusOutlined /> 添加第一个字段
                </a-button>
              </div>
            </a-empty>
          </div>
        </div>
      </a-card>
    </div>

    <!-- 表单预览 -->
    <div class="form-preview" v-if="!showDesigner">
      <a-card class="preview-card">
        <template #title>
          <div class="card-title">
            <EyeOutlined />
            <span>表单预览</span>
          </div>
        </template>
        <template #extra>
          <a-space>
            <a-button @click="togglePreview" type="default">
              <template #icon>
                <EditOutlined />
              </template>
              返回设计
            </a-button>
            <a-button @click="resetForm" type="default">
              重置数据
            </a-button>
            <a-button @click="submitForm" type="primary" class="btn-primary">
              提交表单
            </a-button>
          </a-space>
        </template>

        <div class="preview-content">
          <div class="preview-header">
            <h3>{{ formMeta.name || '动态表单' }}</h3>
            <p v-if="formMeta.description" class="preview-description">
              {{ formMeta.description }}
            </p>
            <a-alert
              message="预览模式"
              description="您可以查看和填写表单字段，点击提交按钮查看表单数据。"
              type="info"
              show-icon
              banner
              class="preview-notice"
            />
          </div>
          
          <DynamicForm 
            :fields="formSchema.fields" 
            v-model:data="formData"
            :rules="formRules"
            @submit="handleSubmit"
            ref="dynamicFormRef"
          />
        </div>
      </a-card>
    </div>

    <!-- JSON 配置查看 -->
    <a-modal 
      :open="showJsonViewer" 
      title="表单配置 JSON" 
      :width="800"
      :footer="null" 
      @cancel="toggleJsonViewer"
      class="json-modal"
    >
      <div class="json-viewer">
        <div class="json-actions">
          <a-space>
            <a-button @click="copyJson" size="small">
              <CopyOutlined /> 复制配置
            </a-button>
            <a-button @click="exportConfig" size="small">
              <DownloadOutlined /> 导出文件
            </a-button>
          </a-space>
        </div>
        <pre class="json-content">{{ JSON.stringify(formSchema, null, 2) }}</pre>
      </div>
    </a-modal>

    <!-- 分类选择弹窗 -->
    <a-modal 
      :open="showCategoryModal" 
      title="选择表单分类" 
      :width="600"
      @cancel="closeCategoryModal"
      :footer="null"
      class="category-modal"
    >
      <div class="category-modal-content">
        <div class="category-search">
          <a-input-search
            v-model:value="categorySearch"
            placeholder="搜索分类名称"
            @search="searchCategories"
            @input="onCategorySearchInput"
            enter-button
            allow-clear
          />
        </div>
        
        <div class="category-list">
          <a-spin :spinning="categoryLoading">
            <div v-if="categories.length > 0" class="category-items">
              <div 
                v-for="category in categories" 
                :key="category.id"
                class="category-item"
                :class="{ active: formMeta.category_id === category.id }"
                @click="selectCategory(category)"
              >
                <div class="category-name">{{ category.name }}</div>
                <div class="category-desc" v-if="category.description">{{ category.description }}</div>
              </div>
            </div>
            <a-empty v-else description="暂无分类数据" />
          </a-spin>
        </div>
        
        <div class="category-pagination" v-if="categoryPagination.total > 0">
          <a-pagination
            v-model:current="categoryPagination.page"
            v-model:page-size="categoryPagination.size"
            :total="categoryPagination.total"
            :show-size-changer="true"
            :show-quick-jumper="true"
            :show-total="(total: number, range: [number, number]) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`"
            @change="onCategoryPageChange"
            @show-size-change="onCategorySizeChange"
          />
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { message } from 'ant-design-vue';
import {
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  FormOutlined,
  UpOutlined,
  DownOutlined,
  CodeOutlined,
  DownloadOutlined,
  UploadOutlined,
  CopyOutlined,
  SaveOutlined
} from '@ant-design/icons-vue';
import FieldConfig from './components/FieldConfig.vue';
import DynamicForm from './components/DynamicForm.vue';
import { 
  FormDesignStatus, 
  FormFieldType,
  type FormField, 
  type FormSchema,
  type CreateWorkorderFormDesignReq,
  createWorkorderFormDesign,
} from '#/api/core/workorder/workorder_form_design';
import type { WorkorderCategoryItem, ListWorkorderCategoryReq } from '#/api/core/workorder/workorder_category';
import { listWorkorderCategory } from '#/api/core/workorder/workorder_category';

// 响应式数据
const showDesigner = ref(true);
const showJsonViewer = ref(false);
const showCategoryModal = ref(false);
const dynamicFormRef = ref();
const categories = ref<WorkorderCategoryItem[]>([]);
const categoryLoading = ref(false);
const categorySearch = ref('');

// 分页数据
const categoryPagination = reactive({
  page: 1,
  size: 10,
  total: 0
});

// 表单元数据
const formMeta = reactive({
  name: '',
  description: '',
  status: FormDesignStatus.Draft,
  category_id: undefined as number | undefined,
  tags: [] as string[],
});

const isTemplate = ref(false);

// 表单结构
const formSchema = reactive<FormSchema>({
  fields: []
});

const formData = ref<Record<string, any>>({});
const formRules = computed(() => {
  const rules: Record<string, any[]> = {};
  formSchema.fields.forEach(field => {
    if (field.required) {
      rules[field.name] = [
        { required: true, message: `请输入${field.label}`, trigger: 'blur' }
      ];
    }
  });
  return rules;
});

// 字段类型映射
const fieldTypeMap: Record<string, string> = {
  [FormFieldType.Text]: '文本框',
  [FormFieldType.Number]: '数字',
  [FormFieldType.Password]: '密码',
  [FormFieldType.Textarea]: '多行文本',
  [FormFieldType.Select]: '下拉选项',
  [FormFieldType.Radio]: '单选框',
  [FormFieldType.Checkbox]: '复选框',
  [FormFieldType.Date]: '日期',
  [FormFieldType.Switch]: '开关'
};

/**
 * 加载分类数据（支持分页和搜索）
 */
const loadCategories = async (resetPage = false) => {
  if (resetPage) {
    categoryPagination.page = 1;
  }
  
  categoryLoading.value = true;
  try {
    const params: ListWorkorderCategoryReq = {
      page: categoryPagination.page,
      size: categoryPagination.size,
      search: categorySearch.value
    };
    
    const response = await listWorkorderCategory(params);
    categories.value = response.items || [];
    categoryPagination.total = response.total || 0;
  } catch (error) {
    console.error('加载分类失败:', error);
    message.error('加载分类数据失败');
  } finally {
    categoryLoading.value = false;
  }
};

/**
 * 分类下拉框显示状态变化
 */
const onCategoryDropdownVisibleChange = (visible: boolean) => {
  if (visible) {
    showCategoryModal.value = true;
  }
};

/**
 * 关闭分类选择弹窗
 */
const closeCategoryModal = () => {
  showCategoryModal.value = false;
  categorySearch.value = '';
  categoryPagination.page = 1;
  categoryPagination.size = 10;
};

/**
 * 选择分类
 */
const selectCategory = (category: WorkorderCategoryItem) => {
  formMeta.category_id = category.id;
  closeCategoryModal();
  message.success(`已选择分类：${category.name}`);
};

/**
 * 搜索分类
 */
const searchCategories = () => {
  loadCategories(true);
};

/**
 * 分类搜索输入变化（去抖处理）
 */
let searchTimer: NodeJS.Timeout;
const onCategorySearchInput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadCategories(true);
  }, 500);
};

/**
 * 分类分页改变
 */
const onCategoryPageChange = (page: number, size: number) => {
  categoryPagination.page = page;
  categoryPagination.size = size;
  loadCategories();
};

/**
 * 分类每页条数改变
 */
const onCategorySizeChange = (_current: number, size: number) => {
  categoryPagination.page = 1;
  categoryPagination.size = size;
  loadCategories();
};

/**
 * 自定义下拉框渲染（用于触发弹窗）
 */
const dropdownRender = () => {
  // 这个函数不会被调用，因为我们通过 dropdown-visible-change 事件来处理
  return null;
};

// 监听分类弹窗显示状态，初始化数据
watch(showCategoryModal, (visible) => {
  if (visible) {
    loadCategories(true);
  }
});

// 生成唯一字段名
const generateFieldName = (type: string) => {
  const count = formSchema.fields.length + 1;
  return `${type}_field_${count}`;
};

// 获取字段显示名称
const getFieldDisplayName = (field: FormField) => {
  const typeText = fieldTypeMap[field.type];
  const labelText = field.label || '未命名';
  const requiredText = field.required ? '（必填）' : '（可选）';
  return `${typeText} - ${labelText} ${requiredText}`;
};

// 添加字段
const addFieldType = (type: string) => {
  const fieldNumber = formSchema.fields.length + 1;
  const field: FormField = {
    name: generateFieldName(type),
    type,
    label: `${fieldTypeMap[type]}${fieldNumber}`,
    required: 0,
    placeholder: `请输入${fieldTypeMap[type]}`,
    default: getDefaultValue(type),
    options: needsOptions(type) ? ['选项1', '选项2'] : undefined
  };
  
  formSchema.fields.push(field);
  message.success(`已添加${fieldTypeMap[type]}字段`);
};

// 获取默认值
const getDefaultValue = (type: string) => {
  switch (type) {
    case FormFieldType.Checkbox:
      return [];
    case FormFieldType.Number:
      return 0;
    case FormFieldType.Switch:
      return false;
    default:
      return '';
  }
};

// 判断是否需要选项
const needsOptions = (type: string) => {
  return [FormFieldType.Select, FormFieldType.Radio, FormFieldType.Checkbox].includes(type as any);
};

// 更新字段
const updateField = (index: number, updatedField: FormField) => {
  formSchema.fields[index] = JSON.parse(JSON.stringify(updatedField));
};

// 移除字段
const removeField = (index: number) => {
  const field = formSchema.fields[index];
  formSchema.fields.splice(index, 1);
  
  if (field && field.name in formData.value) {
    delete formData.value[field.name];
  }
  
  message.success(`已删除字段: ${field?.label}`);
};

// 移动字段
const moveField = (index: number, direction: number) => {
  const newIndex = index + direction;
  if (newIndex >= 0 && newIndex < formSchema.fields.length) {
    const temp = formSchema.fields[index];
    formSchema.fields[index] = formSchema.fields[newIndex]!;
    formSchema.fields[newIndex] = temp!;
    message.success('字段位置已调整');
  }
};

// 切换预览模式
const togglePreview = () => {
  if (showDesigner.value && formSchema.fields.length === 0) {
    message.warning('请先添加表单字段');
    return;
  }
  
  showDesigner.value = !showDesigner.value;
  if (!showDesigner.value) {
    initFormData();
  }
};

// 初始化表单数据
const initFormData = () => {
  const data: Record<string, any> = {};
  formSchema.fields.forEach(field => {
    if (field.default !== undefined) {
      data[field.name] = field.default;
    } else {
      data[field.name] = getDefaultValue(field.type);
    }
  });
  formData.value = data;
};

// 重置表单数据
const resetForm = () => {
  initFormData();
  if (dynamicFormRef.value) {
    dynamicFormRef.value.resetForm();
  }
  message.success('表单数据已重置');
};

// 清空表单配置
const clearForm = () => {
  if (formSchema.fields.length === 0) {
    message.info('表单已为空');
    return;
  }
  
  formSchema.fields = [];
  formData.value = {};
  message.success('表单配置已清空');
};

// 保存表单设计
const saveFormDesign = async () => {
  if (!formMeta.name) {
    message.error('请输入表单名称');
    return;
  }
  
  if (formSchema.fields.length === 0) {
    message.error('请至少添加一个表单字段');
    return;
  }

  try {
    const data: CreateWorkorderFormDesignReq = {
      name: formMeta.name,
      description: formMeta.description,
      schema: formSchema,
      status: formMeta.status,
      category_id: formMeta.category_id,
      tags: formMeta.tags,
      is_template: isTemplate.value ? 1 : 2
    };

    await createWorkorderFormDesign(data);
    message.success('表单设计保存成功');
  } catch (error) {
    message.error('保存失败，请重试');
  }
};

// 提交表单
const submitForm = async () => {
  if (dynamicFormRef.value) {
    try {
      await dynamicFormRef.value.validate();
      handleSubmit(formData.value);
    } catch (error) {
      message.error('表单验证失败，请检查输入');
    }
  }
};

// 处理表单提交
const handleSubmit = (data: Record<string, any>) => {
  console.log('表单数据:', data);
  message.success('表单提交成功！数据已输出到控制台');
};

// 切换JSON查看器
const toggleJsonViewer = () => {
  showJsonViewer.value = !showJsonViewer.value;
};

// 复制JSON配置
const copyJson = async () => {
  const text = JSON.stringify(formSchema, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    message.success('配置已复制到剪贴板');
  } catch (error) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (successful) {
      message.success('配置已复制到剪贴板');
    } else {
      message.error('复制失败，请手动复制');
    }
  }
};

// 导出配置
const exportConfig = () => {
  const dataStr = JSON.stringify(formSchema, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `form-design-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  message.success('表单设计导出成功');
};

// 导入配置
const importConfig = (file: File) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const config = JSON.parse(e.target?.result as string);
      if (config.fields && Array.isArray(config.fields)) {
        formSchema.fields = config.fields;
        message.success('表单设计导入成功');
      } else {
        message.error('文件格式不正确');
      }
    } catch (error) {
      message.error('文件解析失败');
    }
  };
  reader.readAsText(file);
  return false;
};

// 组件挂载时加载数据
onMounted(() => {
  // 初始化时不加载分类数据，只在用户点击下拉框时加载
});
</script>

<style scoped>
.dynamic-form-container {
  padding: 20px;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.designer-card,
.preview-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #e8e8e8;
  margin-bottom: 20px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #1f2937;
}

.btn-primary {
  background: linear-gradient(135deg, #1890ff 0%, #40a9ff 100%);
  border: none;
  box-shadow: 0 2px 4px rgba(24, 144, 255, 0.2);
}

.btn-primary:hover {
  background: linear-gradient(135deg, #40a9ff 0%, #1890ff 100%);
  box-shadow: 0 4px 8px rgba(24, 144, 255, 0.3);
}

.designer-content {
  padding: 16px;
}

.form-meta-config {
  background: white;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid #e8e8e8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.config-header {
  margin-bottom: 20px;
  text-align: center;
}

.config-header h4 {
  margin: 0 0 8px 0;
  color: #1f2937;
  font-size: 16px;
  font-weight: 600;
}

.field-controls {
  background: white;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid #e8e8e8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.controls-header {
  margin-bottom: 20px;
  text-align: center;
}

.controls-header h4 {
  margin: 0 0 8px 0;
  color: #1f2937;
  font-size: 16px;
  font-weight: 600;
}

.controls-desc {
  color: #6b7280;
  font-size: 14px;
}

.field-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.field-btn {
  height: 48px;
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.3s ease;
  background: #fafafa;
}

.field-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
  background: #f0f8ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(24, 144, 255, 0.15);
}

.field-btn span {
  font-size: 12px;
  font-weight: 500;
}

.config-actions {
  background: white;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid #e8e8e8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.actions-header {
  margin-bottom: 20px;
  text-align: center;
}

.actions-header h4 {
  margin: 0 0 8px 0;
  color: #1f2937;
  font-size: 16px;
  font-weight: 600;
}

.actions-desc {
  color: #6b7280;
  font-size: 14px;
}

.action-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.action-btn {
  height: 48px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.3s ease;
  background: #fafafa;
  width: 100%;
}

.action-btn:hover {
  border-color: #40a9ff;
  color: #40a9ff;
  background: #f0f8ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(64, 169, 255, 0.15);
}

.action-btn span {
  font-size: 12px;
  font-weight: 500;
}

.upload-wrapper {
  width: 100%;
}

.upload-wrapper :deep(.ant-upload) {
  width: 100%;
  display: block;
}

.field-list {
  background: white;
  border-radius: 8px;
  padding: 24px;
  border: 1px solid #e8e8e8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.list-header h4 {
  margin: 0;
  color: #1f2937;
  font-size: 16px;
  font-weight: 600;
}

.field-count {
  color: #6b7280;
  font-size: 14px;
  background: #f3f4f6;
  padding: 4px 12px;
  border-radius: 12px;
}

.field-panel :deep(.ant-collapse-header) {
  background: #fafafa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  margin-bottom: 8px;
  padding: 12px 16px;
  font-weight: 500;
}

.field-panel :deep(.ant-collapse-content) {
  border: 1px solid #e8e8e8;
  border-top: none;
  border-radius: 0 0 8px 8px;
  margin-bottom: 8px;
}

.field-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn-small {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.action-btn-small:hover {
  background: #f0f0f0;
}

.empty-form {
  background: white;
  border-radius: 8px;
  padding: 60px 24px;
  text-align: center;
  border: 1px solid #e8e8e8;
}

.empty-desc {
  margin-top: 16px;
}

.empty-desc p {
  color: #6b7280;
  margin-bottom: 16px;
}

.preview-content {
  padding: 24px;
  background: #fafafa;
  border-radius: 8px;
  margin: 16px;
}

.preview-header {
  text-align: center;
  margin-bottom: 32px;
  padding: 24px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
}

.preview-header h3 {
  margin: 0 0 12px 0;
  font-size: 24px;
  color: #1f2937;
  font-weight: 600;
}

.preview-description {
  margin: 0 0 20px 0;
  color: #6b7280;
  font-size: 16px;
  line-height: 1.6;
}

.preview-notice {
  margin: 20px 0 0 0;
}

.json-modal :deep(.ant-modal-content) {
  border-radius: 8px;
}

.json-viewer {
  max-height: 60vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.json-actions {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.json-content {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 16px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  overflow: auto;
  max-height: 50vh;
  color: #495057;
}

.form-item {
  margin-bottom: 16px;
}

.form-item :deep(.ant-form-item-label) {
  font-weight: 500;
  color: #374151;
}

.switch-item {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.config-input {
  border-radius: 6px;
  transition: all 0.3s ease;
}

.config-input:focus,
.config-input:hover {
  border-color: #1890ff;
  box-shadow: 0 2px 4px rgba(24, 144, 255, 0.1);
}

/* 分类选择弹窗样式 */
.category-modal :deep(.ant-modal-content) {
  border-radius: 8px;
}

.category-modal-content {
  max-height: 60vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.category-search {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.category-list {
  flex: 1;
  overflow: hidden;
  margin-bottom: 16px;
}

.category-items {
  max-height: 300px;
  overflow-y: auto;
  padding-right: 8px;
}

.category-item {
  padding: 12px 16px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #fafafa;
}

.category-item:hover {
  border-color: #1890ff;
  background: #f0f8ff;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
}

.category-item.active {
  border-color: #1890ff;
  background: #e6f7ff;
  color: #1890ff;
}

.category-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.category-desc {
  font-size: 12px;
  color: #6b7280;
}

.category-pagination {
  border-top: 1px solid #f0f0f0;
  padding-top: 16px;
  text-align: center;
}

.category-items::-webkit-scrollbar {
  width: 6px;
}

.category-items::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.category-items::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.category-items::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

@media (max-width: 768px) {
  .dynamic-form-container {
    padding: 12px;
  }
  
  .field-buttons,
  .action-buttons {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .field-btn,
  .action-btn {
    height: 40px;
    font-size: 12px;
  }
  
  .field-btn span,
  .action-btn span {
    font-size: 11px;
  }
  
  .preview-content {
    padding: 16px;
    margin: 8px;
  }
  
  .preview-header {
    padding: 16px;
  }
  
  .preview-header h3 {
    font-size: 20px;
  }
  
  .list-header {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  
  .field-actions {
    flex-wrap: wrap;
  }
  
  .category-modal-content {
    max-height: 50vh;
  }
  
  .category-items {
    max-height: 200px;
  }
}

@media (max-width: 480px) {
  .field-buttons,
  .action-buttons {
    grid-template-columns: 1fr;
  }
  
  .controls-header,
  .actions-header,
  .config-header {
    text-align: left;
  }
  
  .preview-header h3 {
    font-size: 18px;
  }
  
  .preview-description {
    font-size: 14px;
  }
  
  .category-modal-content {
    max-height: 40vh;
  }
}

.field-panel {
  transition: all 0.3s ease;
}

.field-panel:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.json-content::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.json-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.json-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.json-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
