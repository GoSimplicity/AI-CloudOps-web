<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import OpsPage from '#/components/ops/OpsPage.vue';

import SshTerminal from './components/SshTerminal.vue';

const route = useRoute();
const resourceId = computed(() =>
  typeof route.params.id === 'string' ? route.params.id : '',
);
</script>

<template>
  <OpsPage
    description="使用资源配置建立 SSH 会话并执行交互操作"
    title="本地资源终端"
  >
    <SshTerminal :resource-id="resourceId" kind="local" />
  </OpsPage>
</template>
