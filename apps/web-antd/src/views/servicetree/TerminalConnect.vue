<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import OpsPage from '#/components/ops/OpsPage.vue';
import SshTerminal from './components/SshTerminal.vue';

const route = useRoute();
const resourceId = computed(() =>
  typeof route.query.id === 'string' ? route.query.id : '',
);
</script>

<template>
  <OpsPage
    title="云资源终端"
    description="使用资源配置建立 SSH 会话并执行交互操作"
  >
    <SshTerminal kind="cloud" :resource-id="resourceId" />
  </OpsPage>
</template>
