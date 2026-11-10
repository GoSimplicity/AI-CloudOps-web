import { computed } from 'vue';

import { formatLoginLockCountdown } from '#/api/login-lock';
import { useAuthStore } from '#/store';

/** 登录页与重新登录弹窗共用：有剩余秒数就倒计时并禁用，否则只展示兜底文案 */
export function useLoginLockPresentation() {
  const authStore = useAuthStore();
  const loginLocked = computed(() => authStore.loginLockRemainingSeconds > 0);
  const lockHint = computed(() =>
    loginLocked.value
      ? formatLoginLockCountdown(authStore.loginLockRemainingSeconds)
      : authStore.loginLockHint,
  );
  return { lockHint, loginLocked };
}
