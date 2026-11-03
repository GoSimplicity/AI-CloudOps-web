import { aiResponse } from './ai.mjs';
import { cloudResponse } from './cloud.mjs';
import { createInboxResponse } from './inbox.mjs';
import { k8sResponse, timestamp } from './k8s.mjs';

export { cluster } from './k8s.mjs';
export function page(items, url) {
  const search = (
    url.searchParams.get('search') ??
    url.searchParams.get('name') ??
    ''
  ).toLowerCase();
  const namespace = url.searchParams.get('namespace');
  const filtered = items.filter(
    (item) =>
      (!namespace || !item.namespace || namespace === item.namespace) &&
      (!search ||
        String(item.name ?? '')
          .toLowerCase()
          .includes(search)),
  );
  const current = Math.max(
    1,
    Math.trunc(Number(url.searchParams.get('page')) || 1),
  );
  const size = Math.min(
    100,
    Math.max(
      1,
      Math.trunc(
        Number(
          url.searchParams.get('size') ?? url.searchParams.get('page_size'),
        ) || 10,
      ),
    ),
  );
  return {
    page: current,
    size,
    total: filtered.length,
    items: filtered.slice((current - 1) * size, current * size),
  };
}
export function createFixtures() {
  const ai = aiResponse();
  const inbox = createInboxResponse();
  let sample = 0;
  return (method, url, payload) => {
    if (
      method === 'GET' &&
      ['/api/system/info', '/api/system/metrics'].includes(url.pathname)
    ) {
      sample++;
      return {
        arch: 'amd64',
        cpu_cores: 8,
        cpu_model: 'Simulated CPU',
        cpu_usage: 23 + (sample % 6),
        disk_total: 100,
        disk_usage: 32,
        disk_used: 32,
        hostname: 'demo-simulated-host',
        last_update_time:
          Math.floor(Date.parse(timestamp) / 1000) + sample * 30,
        load_avg_1: 1.2,
        load_avg_5: 1.1,
        load_avg_15: 1,
        memory_total: 16_384,
        memory_usage: 37.5,
        memory_used: 6144,
        network_in: 102_400 + sample * 1024,
        network_out: 51_200 + sample * 512,
        os: 'Demo Linux',
        os_version: 'simulated',
        process_count: 126,
        source: 'simulated',
        uptime: 86_400 + sample * 30,
      };
    }
    return (
      inbox(method, url, page) ??
      cloudResponse(method, url, page) ??
      k8sResponse(method, url, page) ??
      ai(method, url, payload)
    );
  };
}
