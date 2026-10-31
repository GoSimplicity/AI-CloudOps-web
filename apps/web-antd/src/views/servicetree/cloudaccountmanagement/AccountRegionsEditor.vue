<script setup lang="ts">
import {
  CloudProvider,
  type CloudAccountRegionInput,
} from '#/api/core/tree/tree_account';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { FormItemRest, message, Modal } from 'ant-design-vue';
import {
  getAvailableRegions,
  type AvailableRegion,
} from '#/api/core/tree/tree_account_region';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';
import { computeProviderName, isSupportedAccountProvider } from './provider';

const props = defineProps<{
  disabled?: boolean;
  provider: number;
  accountId?: number;
  accountEnabled?: boolean;
  canRead?: boolean;
}>();
const regions = defineModel<CloudAccountRegionInput[]>({ required: true });
const available = ref<AvailableRegion[]>([]);
const loading = ref(false);
let request = 0;
let alive = true;
watch(
  () => [
    props.provider,
    props.accountId,
    props.canRead,
    props.accountEnabled,
    props.disabled,
  ],
  () => {
    request++;
    available.value = [];
    loading.value = false;
  },
);
onBeforeUnmount(() => {
  alive = false;
  request++;
});

async function loadRegions(live: boolean) {
  if (
    !alive ||
    props.disabled ||
    !props.canRead ||
    !isSupportedAccountProvider(props.provider) ||
    (live && (!props.accountId || !props.accountEnabled))
  )
    return;
  const ticket = ++request;
  loading.value = true;
  try {
    const result = await getAvailableRegions(
      live
        ? { cloud_account_id: props.accountId! }
        : { provider: props.provider },
    );
    if (
      ticket === request &&
      alive &&
      props.canRead &&
      !props.disabled &&
      (!live || props.accountEnabled)
    )
      available.value = Array.isArray(result?.regions) ? result.regions : [];
  } catch (error) {
    if (ticket === request && shouldNotifyPageError(error))
      message.error('地域查询失败，请重试或手动填写');
  } finally {
    if (ticket === request) loading.value = false;
  }
}
function confirmLiveRegions() {
  if (!props.accountId || !props.accountEnabled || !props.canRead) return;
  const accountId = props.accountId;
  const provider = props.provider;
  Modal.confirm({
    title: '查询云端可用地域',
    content: `将使用已保存的账户凭据查询${computeProviderName(provider)}，不会使用表单中未保存的密钥。`,
    okText: '确认查询',
    cancelText: '取消',
    onOk: () => {
      if (
        !alive ||
        props.disabled ||
        props.accountId !== accountId ||
        props.provider !== provider
      )
        return;
      return loadRegions(true);
    },
  });
}
const codes = computed({
  get: () => regions.value.map((item) => item.region),
  set: (values: string[]) => {
    const unique = [
      ...new Set(values.map((value) => value.trim()).filter(Boolean)),
    ];
    const existing = new Map(regions.value.map((item) => [item.region, item]));
    const regionNames = new Map(
      available.value.map((item) => [item.region, item.region_name]),
    );
    const previousDefault = regions.value.find(
      (item) => item.is_default,
    )?.region;
    const nextDefault = unique.includes(previousDefault ?? '')
      ? previousDefault
      : unique[0];
    regions.value = unique.map((region) => ({
      region,
      region_name:
        existing.get(region)?.region_name || regionNames.get(region) || '',
      description: existing.get(region)?.description ?? '',
      is_default: region === nextDefault,
      ...(existing.get(region)?.project_id !== undefined
        ? { project_id: existing.get(region)!.project_id }
        : {}),
    }));
  },
});
function updateProjectID(region: string, value: string) {
  regions.value = regions.value.map((item) =>
    item.region === region ? { ...item, project_id: value } : item,
  );
}
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
const options = computed(() => {
  const items = new Map<
    string,
    { value: string; label: string; disabled?: boolean }
  >();
  for (const item of available.value)
    items.set(item.region, {
      value: item.region,
      label: item.region_name
        ? `${item.region_name} (${item.region})`
        : item.region,
      disabled: !item.available,
    });
  for (const item of regions.value)
    if (!items.has(item.region))
      items.set(item.region, {
        value: item.region,
        label: item.region_name
          ? `${item.region_name} (${item.region})`
          : item.region,
      });
  return [...items.values()];
});
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
      :placeholder="
        provider === CloudProvider.GCP
          ? '输入可用区代码，如 us-central1-a'
          : provider === CloudProvider.Azure
            ? '输入 Azure 地域，如 eastus'
            : '输入地域代码，回车添加，可选择多个'
      "
      aria-label="授权地域代码"
    />
    <p class="region-hint">
      按账户授权范围手动填写；地域参考仅供参考，云端查询使用已保存凭据。
    </p>
    <p v-if="provider === CloudProvider.Azure" class="region-hint">
      填写 Azure 地域代码，例如 eastus；云端查询只核验已配置的启用地域。
    </p>
    <p v-if="provider === CloudProvider.GCP" class="region-hint">
      每一项填写 GCP 可用区，例如 us-central1-a；这不是区域名称，项目 ID
      在凭据中配置。
    </p>
    <p v-if="provider === CloudProvider.HuaweiCloud" class="region-hint">
      华为云每个地域都需要对应的项目
      ID；云端查询只核验已配置的启用地域，不代表完整地域目录。
    </p>
    <a-space v-if="canRead && isSupportedAccountProvider(provider)">
      <a-button :disabled="disabled || loading" @click="loadRegions(false)">
        加载地域参考
      </a-button>
      <a-button
        v-if="accountId"
        :disabled="disabled || loading || !accountEnabled"
        @click="confirmLiveRegions"
      >
        查询云端地域
      </a-button>
    </a-space>
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
    <FormItemRest v-if="provider === CloudProvider.HuaweiCloud">
      <div v-for="item in regions" :key="item.region" class="project-field">
        <label :for="`project-${item.region}`">{{ item.region }} 项目 ID</label>
        <a-input
          :id="`project-${item.region}`"
          :value="item.project_id ?? ''"
          :disabled="disabled"
          :maxlength="64"
          :aria-label="`${item.region} 项目 ID`"
          placeholder="请输入该地域的项目 ID"
          @update:value="(value: string) => updateProjectID(item.region, value)"
        />
      </div>
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
.project-field {
  display: grid;
  gap: var(--ops-space-xs);
}
</style>
