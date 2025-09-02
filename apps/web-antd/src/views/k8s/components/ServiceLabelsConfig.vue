<template>
  <a-form-item :label="title">
    <div v-for="(value, key) in labels" :key="key" class="label-item">
      <a-row :gutter="8" align="middle">
        <a-col :span="10">
          <a-input 
            :value="key" 
            @change="(e: any) => updateLabelKey(String(key), e.target.value)" 
            placeholder="键" 
          />
        </a-col>
        <a-col :span="10">
          <a-input :value="value" @change="(e: any) => updateLabelValue(String(key), e.target.value)" placeholder="值" />
        </a-col>
        <a-col :span="4">
          <a-button 
            type="primary" 
            danger 
            ghost 
            size="small" 
            @click="removeLabel(String(key))"
          >
            删除
          </a-button>
        </a-col>
      </a-row>
    </div>
    <a-button type="dashed" @click="addLabel" block>
      <template #icon>
        <PlusOutlined />
      </template>
      添加{{ title }}
    </a-button>
  </a-form-item>
</template>

<script lang="ts" setup>
import { PlusOutlined } from '@ant-design/icons-vue';

const props = defineProps<{
  labels: Record<string, any>;
  title: string;
}>();

const emit = defineEmits<{
  'update:labels': [labels: Record<string, any>];
}>();

const updateLabelValue = (key: string, newValue: string) => {
  const newLabels = { ...props.labels };
  newLabels[key] = newValue;
  emit('update:labels', newLabels);
};

const addLabel = () => {
  const newLabels = { ...props.labels, '': '' };
  emit('update:labels', newLabels);
};

const removeLabel = (key: string) => {
  const newLabels = { ...props.labels };
  delete newLabels[key];
  emit('update:labels', newLabels);
};

const updateLabelKey = (oldKey: string, newKey: string) => {
  if (oldKey !== newKey && newKey.trim()) {
    const newLabels = { ...props.labels };
    const value = newLabels[oldKey];
    delete newLabels[oldKey];
    if (newKey.trim() && value !== undefined) {
      newLabels[newKey.trim()] = value;
    }
    emit('update:labels', newLabels);
  }
};
</script>

<style scoped>
.label-item {
  margin-bottom: 8px;
  padding: 8px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  background: #fafafa;
}
</style>
