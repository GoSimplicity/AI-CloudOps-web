<script setup lang="ts">
const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
const loopback =
  hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]';
const visible =
  import.meta.env.DEV &&
  import.meta.env.MODE === 'demo' &&
  import.meta.env.VITE_CLOUDOPS_DEMO === 'true' &&
  loopback;
</script>

<template>
  <span
    v-if="visible"
    aria-label="本地演示，合成数据，外部操作已关闭"
    class="demo-mode-notice"
    role="note"
    title="本地样例可查看；主机和服务树可编辑，云、集群、通知和任务执行已关闭"
  >
    <strong>本地演示</strong>
    <span class="demo-mode-notice__detail">合成数据 · 外部操作已关闭</span>
  </span>
</template>

<style scoped>
.demo-mode-notice {
  display: inline-flex;
  align-items: center;
  gap: var(--ops-space-sm);
  margin-inline: var(--ops-space-sm);
  padding: calc(var(--ops-space-sm) / 2) var(--ops-space-sm);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  background: var(--ops-surface);
  color: var(--ops-muted);
  font: inherit;
  white-space: nowrap;
}

.demo-mode-notice strong {
  color: var(--ops-accent);
}

@media (max-width: 900px) {
  .demo-mode-notice__detail {
    display: none;
  }
}
</style>
