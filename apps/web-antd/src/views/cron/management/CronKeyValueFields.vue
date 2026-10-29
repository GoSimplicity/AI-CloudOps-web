<script setup lang="ts">
import { PlusOutlined } from '@ant-design/icons-vue';
import type { KeyValue } from '#/api/core/cron/cron';

const props = defineProps<{
  items: KeyValue[];
  keyPlaceholder: string;
  valuePlaceholder: string;
  addText: string;
}>();
const emit = defineEmits<{ change: [items: KeyValue[]] }>();

function update(index: number, field: keyof KeyValue, value: string) {
  emit(
    'change',
    props.items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item,
    ),
  );
}
function remove(index: number) {
  emit(
    'change',
    props.items.filter((_, i) => i !== index),
  );
}
function add() {
  emit('change', [...props.items, { key: '', value: '' }]);
}
</script>

<template>
  <a-form-item-rest>
    <div class="k8s-key-value-inputs">
      <div
        v-for="(item, index) in items"
        :key="index"
        class="k8s-key-value-row"
      >
        <a-input
          :value="item.key"
          :placeholder="keyPlaceholder"
          class="k8s-form-input"
          @update:value="update(index, 'key', $event)"
        />
        <a-input-password
          :value="item.value"
          :placeholder="valuePlaceholder"
          class="k8s-form-input"
          @update:value="update(index, 'value', $event)"
        />
        <a-button type="primary" danger size="small" @click="remove(index)"
          >删除</a-button
        >
      </div>
      <a-button type="dashed" style="width: 100%; margin-top: 8px" @click="add">
        <template #icon><PlusOutlined /></template>{{ addText }}
      </a-button>
    </div>
  </a-form-item-rest>
</template>

<style scoped>
@import '../shared/cron-common.css';
.k8s-key-value-row :deep(.ant-input-affix-wrapper) {
  flex: 1 1 160px;
  min-width: 0;
}
@media (max-width: 640px) {
  .k8s-key-value-row :deep(.ant-input-affix-wrapper) {
    flex-basis: 100%;
  }
}
</style>
