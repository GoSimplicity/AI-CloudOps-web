<template>
  <OpsPage
    title="表单设计"
    description="配置字段并校验预览，保存为草稿、已发布表单或模板"
    class="dynamic-form-container"
  >
    <template #actions>
      <template v-if="showDesigner">
        <a-space>
          <a-button
            @click="saveFormDesign"
            :loading="saving"
            aria-label="保存设计"
            type="primary"
            class="btn-primary"
          >
            <template #icon>
              <SaveOutlined />
            </template>
            保存设计
          </a-button>
          <a-button @click="togglePreview" :disabled="saving" type="default">
            <template #icon>
              <EyeOutlined />
            </template>
            预览表单
          </a-button>
          <a-button @click="clearForm" :disabled="saving" type="default">
            <template #icon>
              <DeleteOutlined />
            </template>
            清空表单
          </a-button>
        </a-space> </template
      ><template v-else>
        <a-space>
          <a-button @click="togglePreview" :disabled="saving" type="default">
            <template #icon>
              <EditOutlined />
            </template>
            返回设计
          </a-button>
          <a-button @click="resetForm" type="default"> 重置数据 </a-button>
          <a-button @click="submitForm" type="primary" class="btn-primary">
            校验预览
          </a-button>
        </a-space>
      </template>
    </template>
    <a-alert
      v-if="saveError"
      :message="saveError"
      type="error"
      show-icon
      class="designer-error"
    />
    <!-- 表单设计器 -->
    <div class="form-designer" v-if="showDesigner">
      <a-card class="designer-card">
        <div class="designer-content" :inert="saving || undefined">
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
                    :maxlength="200"
                    :disabled="saving"
                    class="config-input"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="8">
                <a-form-item label="表单分类" class="form-item">
                  <a-button
                    class="category-trigger"
                    @click="showCategoryModal = true"
                    :disabled="saving"
                    block
                  >
                    {{ selectedCategory?.name ?? '选择分类' }}
                  </a-button>
                  <a-button
                    v-if="formMeta.category_id"
                    type="link"
                    :disabled="saving"
                    @click="
                      formMeta.category_id = undefined;
                      selectedCategory = null;
                    "
                  >
                    清除分类
                  </a-button>
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="8">
                <a-form-item label="表单状态" class="form-item">
                  <a-select
                    id="form-design-status"
                    v-model:value="formMeta.status"
                    placeholder="请选择状态"
                    :disabled="saving"
                    class="config-input"
                  >
                    <a-select-option :value="FormDesignStatus.Draft">
                      草稿
                    </a-select-option>
                    <a-select-option :value="FormDesignStatus.Published">
                      已发布
                    </a-select-option>
                    <a-select-option :value="FormDesignStatus.Archived">
                      已归档
                    </a-select-option>
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
                    :maxlength="1000"
                    :rows="2"
                    :disabled="saving"
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
                    :disabled="saving"
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
                    :disabled="saving"
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
              <a-button
                @click="addFieldType('text')"
                class="field-btn"
                :disabled="saving"
              >
                <PlusOutlined />
                <span>文本框</span>
              </a-button>
              <a-button
                @click="addFieldType('number')"
                class="field-btn"
                :disabled="saving"
              >
                <PlusOutlined />
                <span>数字</span>
              </a-button>
              <a-button
                @click="addFieldType('password')"
                class="field-btn"
                :disabled="saving"
              >
                <PlusOutlined />
                <span>密码</span>
              </a-button>
              <a-button
                @click="addFieldType('textarea')"
                class="field-btn"
                :disabled="saving"
              >
                <PlusOutlined />
                <span>多行文本</span>
              </a-button>
              <a-button
                @click="addFieldType('date')"
                class="field-btn"
                :disabled="saving"
              >
                <PlusOutlined />
                <span>日期</span>
              </a-button>
              <a-button
                @click="addFieldType('select')"
                class="field-btn"
                :disabled="saving"
              >
                <PlusOutlined />
                <span>下拉选项</span>
              </a-button>
              <a-button
                @click="addFieldType('radio')"
                class="field-btn"
                :disabled="saving"
              >
                <PlusOutlined />
                <span>单选框</span>
              </a-button>
              <a-button
                @click="addFieldType('checkbox')"
                class="field-btn"
                :disabled="saving"
              >
                <PlusOutlined />
                <span>复选框</span>
              </a-button>
              <a-button
                @click="addFieldType('switch')"
                class="field-btn"
                :disabled="saving"
              >
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
              <span class="field-count"
                >共 {{ formSchema.fields.length }} 个字段</span
              >
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
                        aria-label="删除字段"
                        :disabled="saving"
                        class="action-btn-small"
                      >
                        <DeleteOutlined />
                      </a-button>
                    </a-tooltip>
                  </div>
                </template>

                <FieldConfig
                  :field="field"
                  :class="{ 'field-saving': saving }"
                  @update="updateField(index, $event)"
                />
              </a-collapse-panel>
            </a-collapse>
          </div>

          <div v-else class="empty-form">
            <a-empty description="暂无表单字段">
              <template #image>
                <FormOutlined style="font-size: 48px; color: #d9d9d9" />
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
        <div class="preview-content">
          <div class="preview-header">
            <h3>{{ formMeta.name || '动态表单' }}</h3>
            <p v-if="formMeta.description" class="preview-description">
              {{ formMeta.description }}
            </p>
            <a-alert
              message="预览模式"
              description="此处仅校验字段与填写体验，不会创建或提交真实工单。"
              type="info"
              show-icon
              banner
              class="preview-notice"
            />
          </div>

          <DynamicForm
            :fields="formSchema.fields"
            :show-actions="false"
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
        <pre class="json-content">{{
          JSON.stringify(formSchema, null, 2)
        }}</pre>
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

        <a-alert
          v-if="categoryError"
          :message="categoryError"
          type="error"
          show-icon
        >
          <template #action>
            <a-button @click="loadCategories()">重试</a-button>
          </template>
        </a-alert>
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
                <div class="category-desc" v-if="category.description">
                  {{ category.description }}
                </div>
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
            :show-total="
              (total: number, range: [number, number]) =>
                `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
            "
            @change="onCategoryPageChange"
          />
        </div>
      </div>
    </a-modal>
  </OpsPage>
</template>

<script setup lang="ts">
import OpsPage from '#/components/ops/OpsPage.vue';
import { ref, reactive, computed, onBeforeUnmount, watch } from 'vue';
import { message, Modal } from 'ant-design-vue';
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
  SaveOutlined,
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
import type {
  WorkorderCategoryItem,
  ListWorkorderCategoryReq,
} from '#/api/core/workorder/workorder_category';
import { listWorkorderCategory } from '#/api/core/workorder/workorder_category';
import {
  shouldNotifyPageError,
  shouldRecordPageError,
} from '#/utils/permission/request-notice';

// 响应式数据
const showDesigner = ref(true);
const saving = ref(false);
const saveError = ref<string | null>(null);
let saveRequest = 0;
let categoryRequest = 0;
let importRequest = 0;
let clearDialog: ReturnType<typeof Modal.confirm> | undefined;
const categoryError = ref<string | null>(null);
const selectedCategory = ref<WorkorderCategoryItem | null>(null);
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
  total: 0,
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
  fields: [],
});

const formData = ref<Record<string, any>>({});
const formRules = computed(() => {
  const rules: Record<string, any[]> = {};
  formSchema.fields.forEach((field) => {
    if (field.required) {
      rules[field.name] = [
        { required: true, message: `请输入${field.label}`, trigger: 'blur' },
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
  [FormFieldType.Switch]: '开关',
};

/**
 * 加载分类数据（支持分页和搜索）
 */
const loadCategories = async (resetPage = false) => {
  const ticket = ++categoryRequest;
  categoryError.value = null;
  if (resetPage) {
    categoryPagination.page = 1;
  }

  categoryLoading.value = true;
  try {
    const params: ListWorkorderCategoryReq = {
      page: categoryPagination.page,
      size: categoryPagination.size,
      search: categorySearch.value,
    };

    const response = await listWorkorderCategory(params);
    if (ticket !== categoryRequest || !showCategoryModal.value) return;
    categories.value = response.items || [];
    categoryPagination.total = response.total || 0;
  } catch (error) {
    if (ticket !== categoryRequest || !showCategoryModal.value) return;
    categories.value = [];
    categoryPagination.total = 0;
    if (shouldRecordPageError(error))
      categoryError.value = '读取分类失败，请重试';
  } finally {
    if (ticket === categoryRequest) categoryLoading.value = false;
  }
};

/**
 * 关闭分类选择弹窗
 */
const closeCategoryModal = () => {
  categoryRequest++;
  if (searchTimer) clearTimeout(searchTimer);
  categoryLoading.value = false;
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
  selectedCategory.value = category;
  closeCategoryModal();
  message.success(`已选择分类：${category.name}`);
};

/**
 * 搜索分类
 */
const searchCategories = () => {
  if (searchTimer) clearTimeout(searchTimer);
  loadCategories(true);
};

/**
 * 分类搜索输入变化（去抖处理）
 */
let searchTimer: NodeJS.Timeout | null = null;
const onCategorySearchInput = () => {
  categoryRequest++;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadCategories(true);
  }, 500);
};

// 清理定时器
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
  categoryRequest++;
  saveRequest++;
  importRequest++;
  clearDialog?.destroy();
});

/**
 * 分类分页改变
 */
const onCategoryPageChange = (page: number, size: number) => {
  categoryPagination.page = page;
  categoryPagination.size = size;
  loadCategories();
};

// 监听分类弹窗显示状态，初始化数据
watch(showCategoryModal, (visible) => {
  if (visible) {
    loadCategories(true);
  }
});

// 生成唯一字段名
const generateFieldName = (type: string) => {
  let count = formSchema.fields.length + 1;
  const names = new Set(formSchema.fields.map((field) => field.name));
  while (names.has(`${type}_field_${count}`)) count++;
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
  if (saving.value) return;
  importRequest++;
  const fieldNumber = formSchema.fields.length + 1;
  const field: FormField = {
    name: generateFieldName(type),
    type,
    label: `${fieldTypeMap[type]}${fieldNumber}`,
    required: 0,
    placeholder: `请输入${fieldTypeMap[type]}`,
    default: getDefaultValue(type),
    options: needsOptions(type) ? ['选项1', '选项2'] : undefined,
  };

  formSchema.fields.push(field);
  message.success(`已添加${fieldTypeMap[type]}字段`);
};

// 获取默认值
const getDefaultValue = (type: string) => {
  switch (type) {
    case FormFieldType.Checkbox: {
      return [];
    }
    case FormFieldType.Number: {
      return 0;
    }
    case FormFieldType.Switch: {
      return false;
    }
    default: {
      return '';
    }
  }
};

// 判断是否需要选项
const needsOptions = (type: string) => {
  return [
    FormFieldType.Select,
    FormFieldType.Radio,
    FormFieldType.Checkbox,
  ].includes(type as any);
};

// 更新字段
const updateField = (index: number, updatedField: FormField) => {
  if (saving.value) return;
  importRequest++;
  formSchema.fields[index] = JSON.parse(JSON.stringify(updatedField));
};

// 移除字段
const removeField = (index: number) => {
  if (saving.value) return;
  importRequest++;
  const field = formSchema.fields[index];
  formSchema.fields.splice(index, 1);

  if (field && field.name in formData.value) {
    delete formData.value[field.name];
  }

  message.success(`已删除字段: ${field?.label}`);
};

// 移动字段
const moveField = (index: number, direction: number) => {
  if (saving.value) return;
  importRequest++;
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
  formSchema.fields.forEach((field) => {
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
  if (saving.value) return;
  if (formSchema.fields.length === 0) {
    message.info('表单已为空');
    return;
  }

  clearDialog = Modal.confirm({
    title: '清空表单字段',
    content: '将移除当前所有字段，基础信息保留。未保存的字段无法恢复。',
    okText: '清空字段',
    cancelText: '取消',
    okType: 'danger',
    onOk: () => {
      formSchema.fields = [];
      formData.value = {};
      importRequest++;
    },
  });
};

// 保存表单设计
const saveFormDesign = async () => {
  if (saving.value) return;
  if (!formMeta.name.trim()) {
    message.error('请输入表单名称');
    return;
  }

  if (formSchema.fields.length === 0) {
    message.error('请至少添加一个表单字段');
    return;
  }

  if (!isValidSchema(formSchema)) {
    message.error('字段名称、标签或类型无效，名称必须唯一');
    return;
  }
  const ticket = ++saveRequest;
  saving.value = true;
  saveError.value = null;
  try {
    const data: CreateWorkorderFormDesignReq = {
      name: formMeta.name.trim(),
      description: formMeta.description,
      schema: JSON.parse(JSON.stringify(formSchema)),
      status: formMeta.status,
      category_id: formMeta.category_id,
      tags: [...formMeta.tags],
      is_template: isTemplate.value ? 1 : 2,
    };

    await createWorkorderFormDesign(data);
    if (ticket === saveRequest) message.success('表单设计保存成功');
  } catch (error) {
    if (ticket === saveRequest)
      if (shouldRecordPageError(error))
        saveError.value = '保存失败，请重试，当前设计已保留';
  } finally {
    if (ticket === saveRequest) saving.value = false;
  }
};

// 提交表单
const submitForm = async () => {
  if (dynamicFormRef.value) {
    try {
      await dynamicFormRef.value.validate();
      handleSubmit(formData.value);
    } catch (error) {
      if (shouldNotifyPageError(error))
        message.error('表单验证失败，请检查输入');
    }
  }
};

// 处理表单提交
const handleSubmit = (_data: Record<string, any>) => {
  message.success('预览校验通过，未创建工单');
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
      if (shouldNotifyPageError(error)) message.error('复制失败，请手动复制');
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

const isValidSchema = (value: unknown): value is FormSchema => {
  if (
    !value ||
    typeof value !== 'object' ||
    !('fields' in value) ||
    !Array.isArray(value.fields)
  )
    return false;
  const names = new Set<string>();
  return value.fields.every((field: FormField) => {
    if (
      !field ||
      typeof field.name !== 'string' ||
      !field.name.trim() ||
      names.has(field.name) ||
      typeof field.label !== 'string' ||
      !field.label.trim() ||
      !Object.values(FormFieldType).includes(
        field.type as typeof FormFieldType.Text,
      )
    )
      return false;
    if (
      field.options !== undefined &&
      (!Array.isArray(field.options) ||
        !field.options.every((option) => typeof option === 'string'))
    )
      return false;
    if (
      field.required !== undefined &&
      field.required !== 0 &&
      field.required !== 1
    )
      return false;
    names.add(field.name);
    return true;
  });
};

// 导入配置
const importConfig = (file: File) => {
  if (saving.value) return false;
  if (file.size > 1024 * 1024) {
    message.error('配置文件不能超过1MiB');
    return false;
  }
  const ticket = ++importRequest;
  const reader = new FileReader();
  reader.onload = (e) => {
    if (ticket !== importRequest) return;
    try {
      const config = JSON.parse(e.target?.result as string);
      if (isValidSchema(config)) {
        formSchema.fields = config.fields;
        formData.value = {};
        message.success('表单设计导入成功');
      } else {
        message.error('文件格式不正确');
      }
    } catch (error) {
      message.error('文件解析失败');
    }
  };
  reader.onerror = () => {
    if (ticket === importRequest) message.error('读取配置文件失败');
  };
  reader.readAsText(file);
  return false;
};
</script>

<style scoped>
.dynamic-form-container {
  background-color: var(--ops-ground);
  min-width: 0;
}

.designer-card,
.preview-card {
  border-radius: var(--ops-radius);
  box-shadow: none;
  border: 1px solid var(--ops-border);
  margin-bottom: 20px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--ops-ink);
}

.btn-primary {
  background: var(--ops-accent);
  border: none;
  box-shadow: none;
}

.btn-primary:hover {
  background: var(--ops-accent);
  box-shadow: none;
}

.designer-content {
  padding: 16px;
}

.form-meta-config {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: var(--ops-space-lg);
  margin-bottom: var(--ops-space-lg);
  border: 1px solid var(--ops-border);
  box-shadow: none;
}

.config-header {
  margin-bottom: 20px;
  text-align: left;
}

.config-header h4 {
  margin: 0 0 8px 0;
  color: var(--ops-ink);
  font-size: 16px;
  font-weight: 600;
}

.field-controls {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: var(--ops-space-lg);
  margin-bottom: var(--ops-space-lg);
  border: 1px solid var(--ops-border);
  box-shadow: none;
}

.controls-header {
  margin-bottom: 20px;
  text-align: left;
}

.controls-header h4 {
  margin: 0 0 8px 0;
  color: var(--ops-ink);
  font-size: 16px;
  font-weight: 600;
}

.controls-desc {
  color: var(--ops-muted);
  font-size: 14px;
}

.field-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.field-btn {
  min-height: 36px;
  border: 2px dashed var(--ops-border);
  border-radius: var(--ops-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition:
    border-color 120ms ease,
    background-color 120ms ease;
  background: var(--ops-ground);
}

.field-btn:hover {
  border-color: var(--ops-accent);
  color: var(--ops-accent);
  background: var(--ops-ground);
  box-shadow: none;
}

.field-btn span {
  font-size: 12px;
  font-weight: 500;
}

.config-actions {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: var(--ops-space-lg);
  margin-bottom: var(--ops-space-lg);
  border: 1px solid var(--ops-border);
  box-shadow: none;
}

.actions-header {
  margin-bottom: 20px;
  text-align: left;
}

.actions-header h4 {
  margin: 0 0 8px 0;
  color: var(--ops-ink);
  font-size: 16px;
  font-weight: 600;
}

.actions-desc {
  color: var(--ops-muted);
  font-size: 14px;
}

.action-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.action-btn {
  min-height: 36px;
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition:
    border-color 120ms ease,
    background-color 120ms ease;
  background: var(--ops-ground);
  width: 100%;
}

.action-btn:hover {
  border-color: var(--ops-accent);
  color: var(--ops-accent);
  background: var(--ops-ground);
  box-shadow: none;
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
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: var(--ops-space-lg);
  border: 1px solid var(--ops-border);
  box-shadow: none;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ops-border);
}

.list-header h4 {
  margin: 0;
  color: var(--ops-ink);
  font-size: 16px;
  font-weight: 600;
}

.field-count {
  color: var(--ops-muted);
  font-size: 14px;
  background: var(--ops-ground);
  padding: 4px 12px;
  border-radius: var(--ops-radius);
}

.field-panel :deep(.ant-collapse-header) {
  background: var(--ops-ground);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  margin-bottom: 8px;
  padding: 12px 16px;
  font-weight: 500;
}

.field-panel :deep(.ant-collapse-content) {
  border: 1px solid var(--ops-border);
  border-top: none;
  border-radius: var(--ops-radius);
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
  border-radius: var(--ops-radius);
  transition: background-color 120ms ease;
}

.action-btn-small:hover {
  background: var(--ops-border);
}

.empty-form {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 60px 24px;
  text-align: center;
  border: 1px solid var(--ops-border);
}

.empty-desc {
  margin-top: 16px;
}

.empty-desc p {
  color: var(--ops-muted);
  margin-bottom: 16px;
}

.preview-content {
  padding: var(--ops-space-lg);
  background: var(--ops-ground);
  border-radius: var(--ops-radius);
  margin: 16px;
}

.preview-header {
  text-align: center;
  margin-bottom: 32px;
  padding: var(--ops-space-lg);
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  border: 1px solid var(--ops-border);
}

.preview-header h3 {
  margin: 0 0 12px 0;
  font-size: 24px;
  color: var(--ops-ink);
  font-weight: 600;
}

.preview-description {
  margin: 0 0 20px 0;
  color: var(--ops-muted);
  font-size: 16px;
  line-height: 1.6;
}

.preview-notice {
  margin: 20px 0 0 0;
}

.json-modal :deep(.ant-modal-content) {
  border-radius: var(--ops-radius);
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
  border-bottom: 1px solid var(--ops-border);
}

.json-content {
  background-color: var(--ops-ground);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  padding: 16px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  overflow: auto;
  max-height: 50vh;
  color: var(--ops-ink);
}

.form-item {
  margin-bottom: 16px;
}

.form-item :deep(.ant-form-item-label) {
  font-weight: 500;
  color: var(--ops-ink);
}

.switch-item {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.config-input {
  border-radius: var(--ops-radius);
  transition:
    border-color 120ms ease,
    background-color 120ms ease;
}

.config-input:focus,
.config-input:hover {
  border-color: var(--ops-accent);
  box-shadow: none;
}

/* 分类选择弹窗样式 */
.category-modal :deep(.ant-modal-content) {
  border-radius: var(--ops-radius);
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
  border-bottom: 1px solid var(--ops-border);
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
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  margin-bottom: 8px;
  cursor: pointer;
  transition:
    border-color 120ms ease,
    background-color 120ms ease;
  background: var(--ops-ground);
}

.category-item:hover {
  border-color: var(--ops-accent);
  background: var(--ops-ground);
  box-shadow: none;
}

.category-item.active {
  border-color: var(--ops-accent);
  background: var(--ops-ground);
  color: var(--ops-accent);
}

.category-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.category-desc {
  font-size: 12px;
  color: var(--ops-muted);
}

.category-pagination {
  border-top: 1px solid var(--ops-border);
  padding-top: 16px;
  text-align: left;
}

.category-items::-webkit-scrollbar {
  width: 6px;
}

.category-items::-webkit-scrollbar-track {
  background: var(--ops-ground);
  border-radius: 3px;
}

.category-items::-webkit-scrollbar-thumb {
  background: var(--ops-border);
  border-radius: 3px;
}

.category-items::-webkit-scrollbar-thumb:hover {
  background: var(--ops-muted);
}

@media (max-width: 768px) {
  .designer-content,
  .form-meta-config,
  .field-controls,
  .config-actions,
  .field-list {
    padding: var(--ops-space-sm);
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
    max-height: 65dvh;
  }
}

.field-panel {
  transition:
    border-color 120ms ease,
    background-color 120ms ease;
}

.field-panel:hover {
  box-shadow: none;
}

.json-content::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.json-content::-webkit-scrollbar-track {
  background: var(--ops-ground);
  border-radius: 3px;
}

.json-content::-webkit-scrollbar-thumb {
  background: var(--ops-border);
  border-radius: 3px;
}

.json-content::-webkit-scrollbar-thumb:hover {
  background: var(--ops-muted);
}

.designer-error {
  margin-bottom: var(--ops-space-lg);
}
.category-trigger {
  text-align: left;
}
.field-saving {
  pointer-events: none;
  opacity: 0.75;
}
.dynamic-form-container :deep(.ant-space) {
  flex-wrap: wrap;
}
.dynamic-form-container :deep(.ant-card-head) {
  min-height: 0;
}
.dynamic-form-container :deep(.field-config .config-section),
.dynamic-form-container :deep(.dynamic-form .form-container) {
  background: var(--ops-surface);
  border-color: var(--ops-border);
  box-shadow: none;
}
.dynamic-form-container :deep(.field-config .section-title) {
  color: var(--ops-ink);
  background: var(--ops-ground);
}
.dynamic-form-container :deep(.field-config .option-item) {
  background: var(--ops-ground);
  border-color: var(--ops-border);
  box-shadow: none;
}
.dynamic-form-container :deep(.field-config .option-index),
.dynamic-form-container :deep(.field-config .ant-form-item-label label) {
  color: var(--ops-ink);
}
.dynamic-form-container :deep(.field-config .checkbox-item:hover) {
  background: var(--ops-ground);
  border-color: var(--ops-accent);
}
.dynamic-form-container :deep(.field-config .config-input),
.dynamic-form-container :deep(.field-config .field-select),
.dynamic-form-container :deep(.field-config .option-input) {
  border-radius: var(--ops-radius);
  box-shadow: none;
}
.dynamic-form-container :deep(.ant-collapse-extra) {
  flex-shrink: 0;
}
@media (max-width: 640px) {
  .field-actions {
    flex-wrap: nowrap;
  }
  .field-panel :deep(.ant-collapse-header) {
    gap: 4px;
    align-items: flex-start;
  }
}
@media (prefers-reduced-motion: reduce) {
  .dynamic-form-container :deep(*) {
    transition: none !important;
    animation: none !important;
  }
}
</style>
