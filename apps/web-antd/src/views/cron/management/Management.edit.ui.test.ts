import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Management from './Management.vue';

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('测试前置条件缺失');
  }
  return value;
}

const client = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
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
  args: [],
  description: '',
  environment: [],
  http_body: 'old-body',
  http_headers: [{ key: 'Authorization', value: 'fixture-secret' }],
  http_method: 'POST',
  http_url: 'https://old.invalid',
  id: 3,
  is_built_in: 2,
  job_type: 3,
  last_run_status: 0,
  max_retry: 0,
  name: 'http-job',
  schedule: '@every 1h',
  ssh_environment: [],
  status: 1,
  timeout: 60,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  client.get.mockImplementation((path: string) =>
    path.includes('/detail')
      ? Promise.resolve(structuredClone(fixture))
      : Promise.resolve({ allow_local_exec: true, total: 1, items: [fixture] }),
  );
  client.put.mockResolvedValue(undefined);
  client.post.mockResolvedValue({ next_run_times: [], valid: true });
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
  it('创建可先保存停用任务，重新打开仍保持默认启用', async () => {
    wrapper = mount(Management, {
      attachTo: document.body,
      global: { plugins: [Antd] },
    });
    await flushPromises();
    const open = required(
      wrapper
        .findAll('button')
        .find((button) => button.text().replace(/\s/g, '') === '创建任务'),
    );
    await open.trigger('click');
    await flushPromises();
    const status = required(
      required(document.querySelector('#cron-create-status')).closest(
        '.ant-select',
      ),
    );
    expect(status.textContent).toContain('启用');
    required(
      status.querySelector<HTMLElement>('.ant-select-selector'),
    ).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flushPromises();
    required(
      [
        ...document.querySelectorAll<HTMLElement>('.ant-select-item-option'),
      ].find((item) => item.textContent?.trim() === '停用（仅保存）'),
    ).click();
    await flushPromises();
    await changeInput('input[placeholder="请输入任务名称"]', '停用HTTP配置');
    await changeInput(
      'input[placeholder="例：0 0 * * * (每天午夜执行)"]',
      '@every 1h',
    );
    await changeInput(
      'input[placeholder="https://example.com/api/endpoint"]',
      'http://127.0.0.1:9/fixture',
    );
    clickButton('创建任务');
    await flushPromises();
    expect(
      [...document.querySelectorAll('.ant-form-item-explain-error')].map(
        (item) => item.textContent,
      ),
    ).toEqual([]);
    expect(client.post).toHaveBeenCalledWith(
      '/cron/job/create',
      expect.objectContaining({
        http_url: 'http://127.0.0.1:9/fixture',
        job_type: 3,
        status: 2,
      }),
    );
    expect(
      client.post.mock.calls.some(([path]) => /\/(run|enable)$/.test(path)),
    ).toBe(false);
    await open.trigger('click');
    await flushPromises();
    expect(
      required(
        required(document.querySelector('#cron-create-status')).closest(
          '.ant-select',
        ),
      ).textContent,
    ).toContain('启用');
  });

  it('编辑HTTP配置、验证当前表达式并保存，未改的敏感请求头保持原值', async () => {
    wrapper = mount(Management, {
      attachTo: document.body,
      global: { plugins: [Antd] },
    });
    await flushPromises();
    const editButton = wrapper
      .find('tr[data-row-key="3"]')
      .findAll('.k8s-action-column button')[1];
    await required(editButton).trigger('click');
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
        http_body: 'old-body',
        http_headers: [{ key: 'Authorization', value: 'fixture-secret' }],
        http_method: 'POST',
        http_url: 'https://new.invalid',
        max_retry: 0,
        schedule: '0 9 * * *',
      }),
    );
  });
});
