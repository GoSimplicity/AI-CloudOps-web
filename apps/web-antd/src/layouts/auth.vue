<script lang="ts" setup>
import { updatePreferences, usePreferences } from '@vben/preferences';

const { isDark } = usePreferences();
function toggleTheme() {
  updatePreferences({ theme: { mode: isDark.value ? 'light' : 'dark' } });
}
</script>

<template>
  <div class="ops-auth">
    <header class="ops-auth-header">
      <a href="/" class="ops-wordmark" aria-label="CloudOps 首页"
        >CLOUD<span>OPS</span></a
      >
      <button class="ops-theme-switch" type="button" @click="toggleTheme">
        {{ isDark ? '切换浅色' : '切换深色' }}
      </button>
    </header>
    <main class="ops-auth-main">
      <section class="ops-auth-intro" aria-label="运维控制台">
        <p class="ops-eyebrow">INFRASTRUCTURE / OPERATIONS</p>
        <h1>让每一次操作<br />都有依据。</h1>
        <p>
          集中管理基础设施、监控告警与运维工单。<br />诊断、审批、执行，保留完整操作记录。
        </p>
        <div class="ops-auth-scope">
          <span>资源管理</span><span>监控告警</span><span>智能诊断</span>
        </div>
      </section>
      <section class="ops-auth-form" aria-label="账户登录">
        <RouterView />
        <p class="ops-auth-help">
          账号由管理员分配。如需重置密码，请联系管理员。
        </p>
      </section>
    </main>
    <footer class="ops-auth-footer">AI-CloudOps <span>运维工作台</span></footer>
  </div>
</template>

<style scoped>
.ops-auth {
  min-height: 100dvh;
  background: var(--ops-ground);
  color: var(--ops-ink);
  display: flex;
  flex-direction: column;
}
.ops-auth-header,
.ops-auth-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 5vw;
}
.ops-auth-header {
  border-bottom: 1px solid var(--ops-border);
}
.ops-wordmark {
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.04em;
}
.ops-wordmark span {
  color: var(--ops-accent);
}
.ops-theme-switch {
  font-size: 13px;
  border: 1px solid var(--ops-border);
  padding: 8px 12px;
  border-radius: var(--ops-radius);
  background: var(--ops-surface);
}
.ops-auth-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 420px;
  align-items: center;
  gap: 8vw;
  width: min(1080px, 90vw);
  margin: 48px auto;
}
.ops-eyebrow {
  font:
    12px SFMono-Regular,
    Consolas,
    monospace;
  letter-spacing: 0.12em;
  color: var(--ops-accent);
}
.ops-auth-intro h1 {
  font-size: clamp(32px, 4vw, 48px);
  font-weight: 650;
  line-height: 1.35;
  letter-spacing: -0.035em;
  margin: 24px 0;
}
.ops-auth-intro > p:last-of-type {
  color: var(--ops-muted);
  font-size: 15px;
  line-height: 1.8;
}
.ops-auth-scope {
  display: flex;
  gap: 24px;
  border-top: 1px solid var(--ops-border);
  margin-top: 40px;
  padding-top: 16px;
  font-size: 12px;
  color: var(--ops-muted);
}
.ops-auth-form {
  padding: 36px;
  border: 1px solid var(--ops-border);
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
}
.ops-auth-help {
  font-size: 12px;
  color: var(--ops-muted);
  line-height: 1.7;
  border-top: 1px solid var(--ops-border);
  padding-top: 24px;
  margin-top: 24px;
}
.ops-auth-footer {
  color: var(--ops-muted);
  font-size: 12px;
}
@media (max-width: 760px) {
  .ops-auth-main {
    grid-template-columns: 1fr;
    max-width: 440px;
    gap: 32px;
  }
  .ops-auth-intro {
    display: none;
  }
  .ops-auth-form {
    padding: 28px;
  }
}
</style>
