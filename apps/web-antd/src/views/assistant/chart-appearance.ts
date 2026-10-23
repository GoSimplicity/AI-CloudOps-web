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
    text: read('--ops-ink', '#202020'),
    muted: read('--ops-muted', '#767676'),
    border: read('--ops-border', '#dddddd'),
    surface: read('--ops-surface', '#ffffff'),
    ground: read('--ops-ground', '#f6f6f6'),
    accent: read('--ops-accent', '#1677ff'),
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
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
  });
  onBeforeUnmount(() => {
    disposed = true;
    observer?.disconnect();
  });
}
