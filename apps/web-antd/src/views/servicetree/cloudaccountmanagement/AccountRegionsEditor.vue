<script setup lang="ts">
import type { CloudAccountRegionInput } from '#/api/core/tree/tree_account';
import { computed } from 'vue';
import { FormItemRest } from 'ant-design-vue';

const regions = defineModel<CloudAccountRegionInput[]>({ required: true });
defineProps<{ disabled?: boolean }>();
const codes = computed({
  get: () => regions.value.map((item) => item.region),
  set: (values: string[]) => {
    const unique = [
      ...new Set(values.map((value) => value.trim()).filter(Boolean)),
    ];
    const existing = new Map(regions.value.map((item) => [item.region, item]));
    const previousDefault = regions.value.find(
      (item) => item.is_default,
    )?.region;
    const nextDefault = unique.includes(previousDefault ?? '')
      ? previousDefault
      : unique[0];
    regions.value = unique.map((region) => ({
      region,
      region_name: existing.get(region)?.region_name ?? '',
      description: existing.get(region)?.description ?? '',
      is_default: region === nextDefault,
    }));
  },
});
const defaultRegion = computed({
  get: () =>
    regions.value.find((item) => item.is_default)?.region ??
    regions.value[0]?.region,
  set: (value: string) => {
    regions.value = regions.value.map((item) => ({
      ...item,
      is_default: item.region === value,
    }));
  },
});
const options = computed(() =>
  regions.value.map((item) => ({
    value: item.region,
    label: item.region_name
      ? `${item.region_name} (${item.region})`
      : item.region,
  })),
);
</script>

<template>
  <div class="account-regions-editor">
    <a-select
      id="account-region-codes"
      v-model:value="codes"
      mode="tags"
      :token-separators="[',']"
      :disabled="disabled"
      :options="options"
      placeholder="输入地域代码，回车添加，可选择多个"
      aria-label="授权地域代码"
    />
    <p class="region-hint">
      按云账户授权范围填写，如 cn-hangzhou；保存不会连接云平台
    </p>
    <FormItemRest>
      <label for="account-default-region">默认地域</label>
      <a-select
        id="account-default-region"
        v-model:value="defaultRegion"
        :disabled="disabled || !codes.length"
        :options="options"
        placeholder="请选择默认地域"
      />
    </FormItemRest>
  </div>
</template>

<style scoped>
.account-regions-editor {
  display: grid;
  gap: var(--ops-space-sm);
}
.region-hint {
  margin: 0;
  color: var(--ops-muted);
  font-size: 12px;
}
</style>
