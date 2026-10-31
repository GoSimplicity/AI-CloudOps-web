<script setup lang="ts">
import { computed, ref } from 'vue';
import { Alert, Badge, Button } from 'ant-design-vue';
import {
  ArrowLeftOutlined,
  DisconnectOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue';
import { useRouter } from 'vue-router';
import { useSshTerminal } from './use-ssh-terminal';
import 'xterm/css/xterm.css';

const props = defineProps<{ kind: 'local' | 'cloud'; resourceId: string }>();
const viewport = ref<HTMLElement | null>(null);
const router = useRouter();
const { state, error, connect, disconnect } = useSshTerminal(viewport, {
  kind: () => props.kind,
  resourceId: () => props.resourceId,
});
const labels = {
  idle: '未连接',
  connecting: '连接中',
  connected: '连接已建立',
  disconnected: '连接已关闭',
  error: '连接失败',
} as const;
const tones = {
  idle: 'default',
  connecting: 'processing',
  connected: 'success',
  disconnected: 'warning',
  error: 'error',
} as const;
const listPath = computed(() =>
  props.kind === 'local'
    ? '/local_resource_management'
    : '/cloud_resource_management',
);
</script>

<template>
  <section class="ssh-terminal" aria-label="SSH 交互终端">
    <div class="ssh-terminal__toolbar">
      <div class="ssh-terminal__status" role="status" aria-live="polite">
        <Badge :status="tones[state]" :text="labels[state]" />
        <span class="ssh-terminal__identity"
          >资源 #{{ resourceId || '未指定' }}</span
        >
      </div>
      <div class="ssh-terminal__actions">
        <Button aria-label="资源列表" @click="router.push(listPath)">
          <ArrowLeftOutlined />资源列表
        </Button>
        <Button
          aria-label="重新连接"
          :disabled="state === 'connecting'"
          @click="connect"
        >
          <ReloadOutlined />重新连接
        </Button>
        <Button
          v-if="state === 'connecting' || state === 'connected'"
          danger
          aria-label="关闭连接"
          @click="disconnect"
        >
          <DisconnectOutlined />关闭连接
        </Button>
      </div>
    </div>
    <Alert v-if="error" :message="error" type="error" show-icon />
    <div
      ref="viewport"
      class="ssh-terminal__viewport"
      aria-label="终端输入与输出"
    ></div>
    <p class="ssh-terminal__hint">
      在终端内输入命令，Ctrl+C 中断，窗口大小自动同步。重新连接会清空本地显示
    </p>
  </section>
</template>

<style scoped>
.ssh-terminal {
  display: flex;
  flex-direction: column;
  gap: var(--ops-space-md);
  min-width: 0;
}
.ssh-terminal__toolbar,
.ssh-terminal__status,
.ssh-terminal__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ops-space-sm);
}
.ssh-terminal__toolbar {
  justify-content: space-between;
}
.ssh-terminal__identity,
.ssh-terminal__hint {
  color: var(--ops-muted);
  font-size: 13px;
}
.ssh-terminal__hint {
  margin: 0;
}
.ssh-terminal__viewport {
  min-width: 0;
  width: 100%;
  height: clamp(300px, calc(100dvh - 285px), 840px);
  padding: var(--ops-space-sm);
  overflow: hidden;
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  background: #0d1117;
}
@media (max-width: 640px) {
  .ssh-terminal__toolbar {
    align-items: flex-start;
  }
  .ssh-terminal__actions {
    width: 100%;
  }
  .ssh-terminal__actions :deep(.ant-btn) {
    flex: 1;
  }
}
</style>
