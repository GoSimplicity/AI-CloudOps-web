<script lang="ts" setup>
import { AuthenticationLogin } from '@vben/common-ui';

import { useAuthStore } from '#/store';
import { useLoginLockPresentation } from '#/store/use-login-lock';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const { lockHint, loginLocked } = useLoginLockPresentation();
</script>

<template>
  <AuthenticationLogin
    :disabled="loginLocked"
    :loading="authStore.loginLoading"
    :show-code-login="false"
    :show-forget-password="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-third-party-login="false"
    :submit-hint="lockHint"
    password-placeholder="请输入密码"
    sub-title="使用您的组织账号继续"
    title="登录运维工作台"
    username-placeholder="请输入用户名"
    @submit="authStore.authLogin"
  />
</template>
