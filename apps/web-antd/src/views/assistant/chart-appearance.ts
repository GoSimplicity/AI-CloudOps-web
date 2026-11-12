import { onBeforeUnmount, onMounted } from 'vue';

/** Canvas图表需要浏览器解析后的实际颜色，不能直接传CSS变量字符串 */
export function chartColors() {
  const probe = document.createElement('span');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  document.body.append(probe);
  const read = (token: string, fallback: string) => {
    probe.style.color = `var(${token})`;
    return getComputedStyle(probe).color || fallback;
  };
  const colors = {
    accent: read('--ops-accent', '#1677ff'),
    border: read('--ops-border', '#dddddd'),
    ground: read('--ops-ground', '#f6f6f6'),
    muted: read('--ops-muted', '#767676'),
    surface: read('--ops-surface', '#ffffff'),
    text: read('--ops-ink', '#202020'),
  };
  probe.remove();
  return colors;
}

export function useChartAppearance(refresh: () => void) {
  let observer: MutationObserver | undefined;
  let disposed = false;
  onMounted(() => {
    observer = new MutationObserver(() => {
      if (!disposed) refresh();
    });
    observer.observe(document.documentElement, {
      attributeFilter: ['class', 'style'],
      attributes: true,
    });
  });
  onBeforeUnmount(() => {
    disposed = true;
    observer?.disconnect();
  });
}
