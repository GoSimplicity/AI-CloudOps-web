import { computed, onBeforeUnmount, watch } from 'vue';
import { useAccessStore, useUserStore } from '@vben/stores';
import { assistantOwner } from '#/utils/assistant-account-scope';

/** 每个固定任务通道独立计数，身份变化和卸载统一废弃迟到结果 */
export function useAiRequestScope(resetForOwner: () => void) {
  const user = useUserStore();
  const access = useAccessStore();
  const owner = computed(() =>
    assistantOwner(user.userInfo, access.accessToken),
  );
  let generation = 0;
  let disposed = false;
  watch(
    owner,
    () => {
      generation += 1;
      resetForOwner();
    },
    { flush: 'sync' },
  );
  onBeforeUnmount(() => {
    disposed = true;
    generation += 1;
  });
  function createLane() {
    let version = 0;
    return {
      begin() {
        return { owner: owner.value, generation, version: ++version };
      },
      current(ticket: { owner: string; generation: number; version: number }) {
        return (
          !disposed &&
          !!owner.value &&
          ticket.owner === owner.value &&
          ticket.generation === generation &&
          ticket.version === version
        );
      },
      invalidate() {
        version += 1;
      },
    };
  }
  return { owner, createLane };
}
