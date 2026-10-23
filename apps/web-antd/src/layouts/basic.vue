<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import { computed, ref } from 'vue';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { BookOpenText, CircleHelp, MdiGithub } from '@vben/icons';
import {
  BasicLayout,
  LockScreen,
  Notification,
  UserDropdown,
} from '@vben/layouts';
import { storeToRefs, useAccessStore, useUserStore } from '@vben/stores';
import { openWindow } from '@vben/utils';

import { $t } from '#/locales';
import { useAuthStore } from '#/store';

import AI from '#/views/ai/ai.vue';

// 通知源接入前保持真实空态，不生成演示消息
const notifications = ref<NotificationItem[]>([]);
const projectURL = 'https://github.com/GoSimplicity/AI-CloudOps';

const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const showDot = computed(() =>
  notifications.value.some((item) => !item.isRead),
);

const menus = computed(() => [
  {
    handler: () => {
      openWindow(`${projectURL}#readme`, {
        target: '_blank',
      });
    },
    icon: BookOpenText,
    text: $t('widgets.document'),
  },
  {
    handler: () => {
      openWindow(projectURL, {
        target: '_blank',
      });
    },
    icon: MdiGithub,
    text: 'GitHub',
  },
  {
    handler: () => {
      openWindow(`${projectURL}/issues`, {
        target: '_blank',
      });
    },
    icon: CircleHelp,
    text: $t('widgets.qa'),
  },
]);

const { loginLoading } = storeToRefs(authStore);

const avatar = computed(() => {
  return userStore.userInfo?.avatar || '';
});

async function handleLogout() {
  await authStore.logout(false);
}

function handleNoticeClear() {
  notifications.value = [];
}

function handleMakeAll() {
  notifications.value.forEach((item) => (item.isRead = true));
}
</script>

<template>
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.realName || userStore.userInfo?.username"
        :description="userStore.userInfo?.email || userStore.userInfo?.username"
        @logout="handleLogout"
      />
    </template>
    <template #notification>
      <Notification
        :dot="showDot"
        :notifications="notifications"
        empty-text="通知源尚未接入"
        @clear="handleNoticeClear"
        @make-all="handleMakeAll"
      />
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
        :loading="loginLoading"
        password-placeholder="请输入密码"
        :username-placeholder="userStore.userInfo?.username || '请输入账号'"
        @submit="authStore.authLogin"
      />
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
  <AI />
</template>
