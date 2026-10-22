<script lang="ts" setup>
import { AuthenticationLogin } from '@vben/common-ui';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
</script>

<template>
  <AuthenticationLogin
    :loading="authStore.loginLoading"
    password-placeholder="请输入密码"
    username-placeholder="请输入用户名"
    title="登录运维工作台"
    sub-title="使用您的组织账号继续"
    :show-code-login="false"
    :show-qrcode-login="false"
    :show-third-party-login="false"
    :show-register="false"
    :show-forget-password="false"
    @submit="authStore.authLogin"
  />
</template>
