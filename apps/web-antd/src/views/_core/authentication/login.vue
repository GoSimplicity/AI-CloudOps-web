<script lang="ts" setup>
import { AuthenticationLogin } from '@vben/common-ui';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
</script>

<template>
  <AuthenticationLogin
    :loading="authStore.loginLoading"
    :show-code-login="false"
    :show-forget-password="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-third-party-login="false"
    password-placeholder="请输入密码"
    sub-title="使用您的组织账号继续"
    title="登录运维工作台"
    username-placeholder="请输入用户名"
    @submit="authStore.authLogin"
  />
</template>
