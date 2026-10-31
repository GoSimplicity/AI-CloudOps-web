<template>
  <div class="field-config">
    <a-form class="config-form" layout="vertical">
      <div class="config-section">
        <div class="section-title">
          <span>基础配置</span>
        </div>
        <a-row :gutter="16">
          <a-col :md="8" :span="24">
            <a-form-item class="form-item" label="字段类型">
              <a-select
                v-model:value="localField.type"
                class="field-select"
                @change="handleTypeChange"
              >
                <a-select-option value="text">
                  <span class="option-content">📝 文本框</span>
                </a-select-option>
                <a-select-option value="number">
                  <span class="option-content">🔢 数字</span>
                </a-select-option>
                <a-select-option value="password">
                  <span class="option-content">🔒 密码</span>
                </a-select-option>
                <a-select-option value="textarea">
                  <span class="option-content">📄 多行文本</span>
                </a-select-option>
                <a-select-option value="date">
                  <span class="option-content">📅 日期</span>
                </a-select-option>
                <a-select-option value="select">
                  <span class="option-content">📋 下拉选项</span>
                </a-select-option>
                <a-select-option value="radio">
                  <span class="option-content">🔘 单选框</span>
                </a-select-option>
                <a-select-option value="checkbox">
                  <span class="option-content">☑️ 复选框</span>
                </a-select-option>
                <a-select-option value="switch">
                  <span class="option-content">🎚️ 开关</span>
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>

          <a-col :md="8" :span="24">
            <a-form-item class="form-item" label="标签名称">
              <a-input
                v-model:value="localField.label"
                class="config-input"
                placeholder="请输入字段标签"
              />
            </a-form-item>
          </a-col>

          <a-col :md="8" :span="24">
            <a-form-item class="form-item" label="字段名称">
              <a-input
                v-model:value="localField.name"
                class="config-input"
                placeholder="英文、数字、下划线"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :md="12" :span="24">
            <a-form-item class="form-item" label="占位符文本">
              <a-input
                v-model:value="localField.placeholder"
                class="config-input"
                placeholder="输入框的提示文本"
              />
            </a-form-item>
          </a-col>

          <a-col :md="6" :span="24">
            <a-form-item class="form-item switch-item" label="是否必填">
              <a-switch
                v-model:checked="isRequired"
                checked-children="必填"
                un-checked-children="可选"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </div>

      <!-- 默认值配置 -->
      <div v-if="showDefaultValue" class="config-section">
        <div class="section-title">
          <span>默认值设置</span>
        </div>
        <a-row>
          <a-col :span="24">
            <a-form-item class="form-item" label="默认值">
              <template
                v-if="
                  localField.type === 'text' ||
                  localField.type === 'password' ||
                  localField.type === 'textarea'
                "
              >
                <a-input
                  v-model:value="localField.default"
                  class="config-input"
                  placeholder="请输入默认值"
                />
              </template>
              <template v-else-if="localField.type === 'number'">
                <a-input-number
                  v-model:value="localField.default"
                  class="config-input"
                  placeholder="请输入默认数值"
                  style="width: 100%"
                />
              </template>
              <template v-else-if="localField.type === 'switch'">
                <a-switch
                  v-model:checked="localField.default"
                  checked-children="开"
                  un-checked-children="关"
                />
              </template>
              <template
                v-else-if="
                  localField.type === 'select' || localField.type === 'radio'
                "
              >
                <a-select
                  v-model:value="localField.default"
                  allow-clear
                  class="config-input"
                  placeholder="请选择默认值"
                >
                  <a-select-option
                    v-for="(option, index) in localField.options || []"
                    :key="index"
                    :value="option"
                  >
                    {{ option }}
                  </a-select-option>
                </a-select>
              </template>
              <template v-else-if="localField.type === 'checkbox'">
                <a-checkbox-group
                  v-model:value="localField.default"
                  class="checkbox-group"
                >
                  <a-checkbox
                    v-for="(option, index) in localField.options || []"
                    :key="index"
                    :value="option"
                    class="checkbox-item"
                  >
                    {{ option }}
                  </a-checkbox>
                </a-checkbox-group>
              </template>
            </a-form-item>
          </a-col>
        </a-row>
      </div>

      <!-- 选项配置 -->
      <div v-if="needsOptions" class="config-section">
        <div class="section-title">
          <span>选项配置</span>
          <a-button
            class="add-option-btn"
            size="small"
            type="link"
            @click="addOption"
          >
            <PlusOutlined /> 添加选项
          </a-button>
        </div>
        <div class="options-list">
          <div
            v-for="(option, index) in localField.options || []"
            :key="index"
            class="option-item"
          >
            <div class="option-header">
              <span class="option-index">选项 {{ index + 1 }}</span>
              <a-button
                class="remove-option-btn"
                danger
                size="small"
                type="text"
                @click="removeOption(index)"
              >
                <DeleteOutlined />
              </a-button>
            </div>
            <a-row :gutter="12">
              <a-col :span="24">
                <a-input
                  :value="option"
                  class="option-input"
                  placeholder="选项文本"
                  @update:value="(value: string) => updateOption(index, value)"
                />
              </a-col>
            </a-row>
          </div>

          <div
            v-if="!localField.options || localField.options.length === 0"
            class="add-option-area"
          >
            <a-button
              class="add-option-large"
              size="large"
              type="dashed"
              @click="addOption"
            >
              <PlusOutlined /> 添加第一个选项
            </a-button>
          </div>
        </div>
      </div>
    </a-form>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue';
import {
  type FormField,
  FormFieldType,
} from '#/api/core/workorder/workorder_form_design';

interface Props {
  field: FormField;
}

interface Emits {
  (e: 'update', field: FormField): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 创建本地字段的深拷贝
const localField = ref<FormField>(JSON.parse(JSON.stringify(props.field)));

// 处理必填状态的转换
const isRequired = computed({
  get: () => localField.value.required === 1,
  set: (value: boolean) => {
    localField.value.required = value ? 1 : 0;
  },
});

// 计算属性
const needsOptions = computed(() => {
  return [
    FormFieldType.Select,
    FormFieldType.Radio,
    FormFieldType.Checkbox,
  ].includes(localField.value.type as any);
});

const showDefaultValue = computed(() => {
  return ![FormFieldType.Date].includes(localField.value.type as any);
});

// 标记更新是否来自props
let isUpdatingFromProps = false;

// 监听字段变化并发出更新事件
watch(
  localField,
  (newField) => {
    if (!isUpdatingFromProps) {
      emit('update', JSON.parse(JSON.stringify(newField)));
    }
  },
  { deep: true },
);

// 监听props变化
watch(
  () => props.field,
  (newField) => {
    if (JSON.stringify(localField.value) !== JSON.stringify(newField)) {
      isUpdatingFromProps = true;
      nextTick(() => {
        localField.value = JSON.parse(JSON.stringify(newField));
        setTimeout(() => {
          isUpdatingFromProps = false;
        }, 0);
      });
    }
  },
  { deep: true },
);

// 处理类型变化
const handleTypeChange = (type: string) => {
  localField.value.type = type;

  // 根据类型初始化选项和默认值
  if (
    needsOptions.value &&
    (!localField.value.options || localField.value.options.length === 0)
  ) {
    localField.value.options = ['选项1', '选项2'];
  } else if (!needsOptions.value) {
    localField.value.options = undefined;
  }

  // 重置默认值
  switch (type) {
    case FormFieldType.Checkbox: {
      localField.value.default = [];
      break;
    }
    case FormFieldType.Number: {
      localField.value.default = 0;
      break;
    }
    case FormFieldType.Switch: {
      localField.value.default = false;
      break;
    }
    case FormFieldType.Date: {
      localField.value.default = undefined;
      break;
    }
    default: {
      localField.value.default = '';
    }
  }
};

// 添加选项
const addOption = () => {
  if (!localField.value.options) {
    localField.value.options = [];
  }
  const optionIndex = localField.value.options.length + 1;
  localField.value.options.push(`选项${optionIndex}`);
};

// 删除选项
const removeOption = (index: number) => {
  if (localField.value.options && localField.value.options.length > index) {
    localField.value.options.splice(index, 1);
  }
};

// 更新选项
const updateOption = (index: number, value: string) => {
  if (localField.value.options && localField.value.options.length > index) {
    localField.value.options[index] = value;
  }
};
</script>

<style scoped>
.field-config {
  background: var(--ops-ground);
  border-radius: var(--ops-radius);
  overflow: hidden;
}

.config-form {
  padding: 0;
}

.config-section {
  background: var(--ops-surface);
  margin-bottom: 16px;
  border-radius: var(--ops-radius);
  border: 1px solid var(--ops-border);
  overflow: hidden;
}

.section-title {
  background: var(--ops-accent);
  padding: 12px 20px;
  border-bottom: 1px solid var(--ops-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #495057;
  font-size: 14px;
}

.config-section .ant-row {
  padding: 20px;
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

.config-input,
.field-select {
  border-radius: 6px;
  transition: all 0.3s ease;
}

.config-input:focus,
.config-input:hover,
.field-select:focus,
.field-select:hover {
  border-color: #1890ff;
  box-shadow: 0 2px 4px rgba(24, 144, 255, 0.1);
}

.option-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-item {
  padding: 8px 12px;
  border: 1px solid var(--ops-border);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.checkbox-item:hover {
  border-color: #1890ff;
  background: #f0f8ff;
}

.add-option-btn {
  color: #1890ff;
  padding: 0;
  height: auto;
}

.options-list {
  padding: 20px;
  padding-top: 0;
}

.option-item {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: var(--ops-radius);
  padding: 16px;
  margin-bottom: 12px;
  transition: all 0.3s ease;
}

.option-item:hover {
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
}

.option-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.option-index {
  font-weight: 500;
  color: #495057;
  font-size: 13px;
}

.remove-option-btn {
  color: #dc3545;
  padding: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.remove-option-btn:hover {
  background: #f8d7da;
}

.option-input {
  border-radius: 6px;
}

.add-option-area {
  text-align: center;
  padding: 40px 20px;
}

.add-option-large {
  height: 48px;
  border: 2px dashed var(--ops-border);
  border-radius: var(--ops-radius);
  font-weight: 500;
}

.add-option-large:hover {
  border-color: #1890ff;
  color: #1890ff;
}

@media (max-width: 768px) {
  .section-title {
    padding: 10px 16px;
    font-size: 13px;
  }

  .config-section .ant-row {
    padding: 16px;
  }

  .option-item {
    padding: 12px;
  }

  .option-header {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .options-list {
    padding: 16px;
    padding-top: 0;
  }
}
</style>
