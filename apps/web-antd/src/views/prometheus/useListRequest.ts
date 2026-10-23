import { onBeforeUnmount, ref, type Ref } from 'vue';

/** 同一页面只接受最新列表响应，卸载后不再提交状态 */
export function useListRequest(loading: Ref<boolean>) {
  const loadError = ref('');
  let revision = 0;
  let disposed = false;
  onBeforeUnmount(() => {
    disposed = true;
    revision += 1;
  });

  function beginRequest() {
    const current = ++revision;
    loading.value = true;
    loadError.value = '';
    const isCurrent = () => !disposed && current === revision;
    return {
      isCurrent,
      fail(error: unknown, fallback: string) {
        if (!isCurrent()) return false;
        loadError.value =
          error instanceof Error && error.message ? error.message : fallback;
        return true;
      },
      finish() {
        if (isCurrent()) loading.value = false;
      },
    };
  }
  return { loadError, beginRequest };
}
