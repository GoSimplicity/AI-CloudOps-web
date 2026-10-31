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
  useAccessStore: () => ({ accessToken: 'token' }),
}));
vi.mock('#/utils/permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/utils/permission')>()),
  usePermission: () => ({ can: () => true, hasPerm: () => true }),
}));

const job = (id: number, job_type: number) => ({
  id,
  name: `job-${id}`,
  job_type,
  status: 1,
  is_built_in: 2,
  schedule: '@every 1h',
  max_retry: 0,
  last_run_status: 0,
});
const rows = [job(2, 2), job(3, 3), job(4, 4), job(5, 5)];

let wrapper: undefined | VueWrapper;
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
  const style = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    style(element),
  );
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function start(allowLocalExec?: boolean) {
  const data: Record<string, unknown> = { items: rows, total: rows.length };
  if (allowLocalExec !== undefined) data.allow_local_exec = allowLocalExec;
  client.get.mockResolvedValue(data);
  wrapper = mount(Management, {
    attachTo: document.body,
    global: { plugins: [Antd] },
  });
  await flushPromises();
}

// 按行取操作列按钮：0 详情、1 编辑、2 启停、3 立即执行、4 删除
function actionButtons(id: number) {
  const row = wrapper!.find(`tr[data-row-key="${id}"]`);
  return row.findAll('.k8s-action-column button');
}

async function openJobTypeOptions() {
  const create = wrapper!
    .findAll('button')
    .find((item) => item.text().replace(/\s/g, '').includes('创建任务'))!;
  await create.trigger('click');
  await flushPromises();
  const select = document.body.querySelectorAll(
    '.ant-modal .ant-select-selector',
  )[0]!;
  select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await flushPromises();
  return [...document.body.querySelectorAll('.ant-select-item-option')].map(
    (item) => ({
      text: item.textContent?.trim(),
      disabled: item.classList.contains('ant-select-item-option-disabled'),
    }),
  );
}

describe('sEC-03A 本地命令/脚本开关（真实页面）', () => {
  it('开关关闭：新建表单禁用命令行/脚本选项并给出说明，默认类型为 HTTP', async () => {
    await start(false);
    const options = await openJobTypeOptions();
    expect(options).toEqual([
      { disabled: true, text: '命令行' },
      { disabled: false, text: 'HTTP请求' },
      { disabled: true, text: '脚本任务' },
      { disabled: false, text: 'SSH远程' },
    ]);
    expect(
      document.body
        .querySelector('.ant-modal .ant-select-selection-item')
        ?.textContent?.trim(),
    ).toBe('HTTP请求');
    expect(document.body.textContent).toContain(
      '本地命令/脚本任务已停用（cron.allow_local_exec=false），请改用 HTTP 或 SSH 任务',
    );
  });

  it('开关打开：命令行/脚本选项可选且无停用说明', async () => {
    await start(true);
    const options = await openJobTypeOptions();
    expect(options.every((item) => !item.disabled)).toBe(true);
    expect(document.body.textContent).not.toContain('本地命令/脚本任务已停用');
  });

  it('开关关闭：已有命令行/脚本任务的编辑与立即执行按钮禁用，HTTP/SSH 任务不受影响', async () => {
    await start(false);
    for (const id of [2, 4]) {
      const buttons = actionButtons(id);
      expect(buttons[1]!.attributes('disabled')).toBeDefined();
      expect(buttons[3]!.attributes('disabled')).toBeDefined();
    }
    for (const id of [3, 5]) {
      const buttons = actionButtons(id);
      expect(buttons[1]!.attributes('disabled')).toBeUndefined();
      expect(buttons[3]!.attributes('disabled')).toBeUndefined();
    }
  });

  it('开关打开或旧后端未返回字段：命令行/脚本任务的编辑与立即执行按钮可用', async () => {
    for (const flag of [true, undefined]) {
      await start(flag);
      for (const id of [2, 4]) {
        const buttons = actionButtons(id);
        expect(buttons[1]!.attributes('disabled')).toBeUndefined();
        expect(buttons[3]!.attributes('disabled')).toBeUndefined();
      }
      wrapper!.unmount();
      wrapper = undefined;
    }
  });
});
