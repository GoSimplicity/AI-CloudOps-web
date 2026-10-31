<script lang="ts" setup>
import { computed } from 'vue';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { BookOpenText, CircleHelp, MdiGithub } from '@vben/icons';
import { BasicLayout, LockScreen, UserDropdown } from '@vben/layouts';
import { storeToRefs, useAccessStore, useUserStore } from '@vben/stores';
import { openWindow } from '@vben/utils';

import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import AI from '#/views/ai/ai.vue';

import InboxNotification from './components/InboxNotification.vue';

const projectURL = 'https://github.com/GoSimplicity/AI-CloudOps';

const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();

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
</script>

<template>
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :description="userStore.userInfo?.email || userStore.userInfo?.username"
        :menus
        :text="userStore.userInfo?.realName || userStore.userInfo?.username"
        @logout="handleLogout"
      />
    </template>
    <template #notification>
      <InboxNotification />
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
        :loading="loginLoading"
        :username-placeholder="userStore.userInfo?.username || '请输入账号'"
        password-placeholder="请输入密码"
        @submit="authStore.authLogin"
      />
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
  <AI />
</template>
