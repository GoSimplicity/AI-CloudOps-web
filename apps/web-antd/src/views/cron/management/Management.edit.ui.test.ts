import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Management from './Management.vue';

const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({ accessToken: 'fixture' }),
}));
vi.mock('#/utils/permission', async (original) => ({
  ...(await original<typeof import('#/utils/permission')>()),
  usePermission: () => ({ can: () => true, hasPerm: () => true }),
}));

let wrapper: VueWrapper;
const fixture = {
  id: 3,
  name: 'http-job',
  description: '',
  job_type: 3,
  status: 1,
  is_built_in: 2,
  schedule: '@every 1h',
  timeout: 60,
  max_retry: 0,
  http_method: 'POST',
  http_url: 'https://old.invalid',
  http_headers: [{ key: 'Authorization', value: 'fixture-secret' }],
  http_body: 'old-body',
  args: [],
  environment: [],
  ssh_environment: [],
  last_run_status: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  client.get.mockImplementation((path: string) =>
    path.includes('/detail')
      ? Promise.resolve(structuredClone(fixture))
      : Promise.resolve({ items: [fixture], total: 1, allow_local_exec: true }),
  );
  client.put.mockResolvedValue(undefined);
  client.post.mockResolvedValue({ valid: true, next_run_times: [] });
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

async function changeInput(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`control not found: ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flushPromises();
}
function clickButton(text: string) {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>('.ant-modal button'),
  ].find((item) => item.textContent?.trim() === text);
  if (!button) throw new Error(`button not found: ${text}`);
  button.click();
}

describe('定时任务编辑完整交互', () => {
  it('编辑HTTP配置、验证当前表达式并保存，未改的敏感请求头保持原值', async () => {
    wrapper = mount(Management, {
      attachTo: document.body,
      global: { plugins: [Antd] },
    });
    await flushPromises();
    const editButton = wrapper
      .find('tr[data-row-key="3"]')
      .findAll('.k8s-action-column button')[1];
    await editButton!.trigger('click');
    await flushPromises();
    await changeInput(
      'input[placeholder="例：0 0 * * * (每天午夜执行)"]',
      '0 9 * * *',
    );
    await changeInput(
      'input[placeholder="https://example.com/api/endpoint"]',
      'https://new.invalid',
    );
    const secret = document.querySelector<HTMLInputElement>(
      'input[placeholder="Header值"]',
    );
    expect(secret?.type).toBe('password');
    clickButton('验证');
    await flushPromises();
    expect(client.post).toHaveBeenCalledWith('/cron/validate-schedule', {
      schedule: '0 9 * * *',
    });
    clickButton('保存修改');
    await flushPromises();
    expect(client.put).toHaveBeenCalledWith(
      '/cron/job/3/update',
      expect.objectContaining({
        schedule: '0 9 * * *',
        http_url: 'https://new.invalid',
        http_method: 'POST',
        http_body: 'old-body',
        http_headers: [{ key: 'Authorization', value: 'fixture-secret' }],
        max_retry: 0,
      }),
    );
  });
});
