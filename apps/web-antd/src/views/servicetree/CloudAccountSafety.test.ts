import type { CloudAccount } from '#/api/core/tree/tree_account';

import { reactive } from 'vue';

import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import Antd, { Drawer, Form, message, Modal, Switch } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CloudAccountStatus,
  CloudProvider,
} from '#/api/core/tree/tree_account';

import CloudAccountManagement from './CloudAccountManagement.vue';

const api = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
const csv = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  flags: {
    create: true,
    delete: true,
    detail: true,
    edit: true,
    status: true,
    verify: true,
  } as Record<string, boolean>,
  generation: 0,
  rows: [] as CloudAccount[],
  user: { userInfo: { userId: '1' } } as {
    userInfo: { userId: string } | null;
  },
}));
vi.mock('#/api/request', () => ({ requestClient: api }));
vi.mock('#/utils/export-csv', () => ({ downloadCsv: csv }));
vi.mock('@vben/stores', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vben/stores')>()),
  useUserStore: () => state.user,
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => state.generation }),
}));
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({
    can: () => state.flags.delete,
    hasPerm: (code: string) => {
      const key = code.endsWith('/update') ? 'edit' : code.split('/').at(-1);
      return key ? (state.flags[key] ?? true) : true;
    },
  }),
}));

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Expected cloud account safety fixture');
  return value;
}

function account(id = 7, name = 'owned-account'): CloudAccount {
  return {
    account_alias: 'owned-alias',
    account_id: 'owned-id',
    create_user_name: 'operator',
    description: 'owned-description',
    id,
    name,
    provider: CloudProvider.AliCloud,
    regions: [{ cloud_account_id: id, id: 1, region: 'cn-fixture', status: 1 }],
    status: CloudAccountStatus.Enabled,
  };
}

function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((error: Error) => void) | undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return {
    fail() {
      required(reject)(new Error('private-provider-fixture'));
    },
    promise,
    resolve(value: T) {
      required(resolve)(value);
    },
  };
}

let wrapper: ReturnType<typeof mount> | undefined;
async function start() {
  wrapper = mount(CloudAccountManagement, {
    attachTo: document.body,
    global: { plugins: [Antd] },
  });
  await flushPromises();
  return wrapper;
}
function row(id = 7) {
  return required(wrapper).get(`tr[data-row-key="${id}"]`);
}
async function rowAction(label: string, id = 7) {
  const icon = row(id).get(`[aria-label="${label}"]`);
  required(icon.element.closest('button')).click();
  await flushPromises();
}
async function action(text: string, selector = 'button') {
  await flushPromises();
  const button = [...document.querySelectorAll<HTMLButtonElement>(selector)]
    .reverse()
    .find((item) => item.textContent?.replace(/\s/g, '') === text);
  required(button).click();
  await flushPromises();
}
async function status(checked: boolean, id = 7, detail = false) {
  const control = detail
    ? required(wrapper).findAllComponents(Switch).at(-1)
    : row(id).findComponent(Switch);
  required(control).vm.$emit('change', checked);
  await flushPromises();
}
function confirm() {
  return required(vi.mocked(Modal.confirm).mock.calls.at(-1)?.[0]);
}
async function accept() {
  const onOk = confirm().onOk;
  if (typeof onOk !== 'function') throw new Error('Expected confirmation');
  await onOk(() => {});
}
async function closeDetail() {
  required(wrapper).findComponent(Drawer).vm.$emit('close');
  await flushPromises();
}
function changeOwner(uid = '2') {
  state.generation++;
  state.user.userInfo = null;
  state.user.userInfo = { userId: uid };
}
async function fill(placeholder: string, value: string) {
  const input = required(
    document.querySelector<HTMLInputElement>(
      `input[placeholder="${placeholder}"]`,
    ),
  );
  await new DOMWrapper(input).setValue(value);
}

beforeEach(() => {
  vi.resetAllMocks();
  state.flags = reactive({
    create: true,
    delete: true,
    detail: true,
    edit: true,
    status: true,
    verify: true,
  });
  state.user = reactive({ userInfo: { userId: '1' } });
  state.generation = 0;
  state.rows = [account()];
  api.get.mockImplementation(async (path: string) => {
    if (path.endsWith('/detail')) {
      const id = Number(path.split('/').at(-2));
      return { ...required(state.rows.find((item) => item.id === id)) };
    }
    return {
      total: state.rows.length,
      items: state.rows.map((item) => ({ ...item })),
    };
  });
  api.post.mockResolvedValue({});
  api.put.mockResolvedValue({});
  api.delete.mockResolvedValue({});
  vi.spyOn(Modal, 'confirm').mockImplementation(() => ({
    destroy: vi.fn(),
    update: vi.fn(),
  }));
  vi.spyOn(message, 'success');
  vi.spyOn(message, 'error');
  vi.spyOn(message, 'warning');
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addListener: vi.fn(),
      matches: false,
      removeListener: vi.fn(),
    })),
  );
  const style = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    style(element),
  );
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  message.destroy();
  Modal.destroyAll();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('云账户确认动作归属', () => {
  for (const operation of ['delete', 'verify'] as const) {
    const icon = operation === 'delete' ? 'delete' : 'safety-certificate';
    const request = () => (operation === 'delete' ? api.delete : api.post);

    it.each(['list', 'detail'])(
      `${operation}从%s发起只提交一次，保持既有HTTP合同`,
      async (source) => {
        await start();
        if (source === 'detail') {
          await rowAction('eye');
          await action(
            operation === 'delete' ? '删除' : '验证凭证',
            '.ant-drawer button',
          );
        } else await rowAction(icon);
        expect(request()).not.toHaveBeenCalled();
        await accept();
        await accept();
        expect(request()).toHaveBeenCalledTimes(1);
        expect(request()).toHaveBeenCalledWith(
          `/tree/cloud/account/7/${operation}`,
        );
      },
    );

    it.each([
      'owner',
      'same-user-login',
      'epoch-only',
      'permission',
      'reload',
      'cancel',
      'unmount',
    ])(`${operation}确认后%s变化不借新身份/新列表外发`, async (change) => {
      await start();
      await rowAction(icon);
      if (change === 'owner') changeOwner();
      if (change === 'same-user-login') changeOwner('1');
      if (change === 'epoch-only') state.generation++;
      if (change === 'permission') state.flags[operation] = false;
      if (change === 'reload') await action('刷新');
      if (change === 'unmount') required(wrapper).unmount();
      if (change === 'cancel') {
        const onCancel = confirm().onCancel;
        if (typeof onCancel !== 'function') throw new Error('Expected cancel');
        await onCancel(() => {});
      }
      await accept();
      expect(request()).not.toHaveBeenCalled();
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
    });

    it.each(['success', 'failure'])(
      `${operation}在途换owner后旧%s不提示也不刷新新列表`,
      async (outcome) => {
        await start();
        const pending = deferred<object>();
        request().mockReturnValueOnce(pending.promise);
        await rowAction(icon);
        const submitting = accept();
        changeOwner();
        state.rows = [account(7, 'new-owner-account')];
        await action('刷新');
        const reads = api.get.mock.calls.length;
        if (outcome === 'success') pending.resolve({});
        else pending.fail();
        await submitting;
        expect(api.get).toHaveBeenCalledTimes(reads);
        expect(row().text()).toContain('new-owner-account');
        expect(message.success).not.toHaveBeenCalled();
        expect(message.error).not.toHaveBeenCalled();
      },
    );

    it.each([
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ])(`${operation}非法id %s不产生确认或请求`, async (id) => {
      state.rows = [{ ...account(), id }];
      await start();
      const button = required(wrapper)
        .get(`[aria-label="${icon}"]`)
        .element.closest('button');
      required(button).click();
      await flushPromises();
      expect(Modal.confirm).not.toHaveBeenCalled();
      expect(request()).not.toHaveBeenCalled();
    });

    it(`${operation}保留当前操作错误提示且不回显服务原错`, async () => {
      await start();
      request().mockRejectedValueOnce(new Error('private-provider-fixture'));
      await rowAction(icon);
      await accept();
      expect(message.error).toHaveBeenCalledWith(
        operation === 'delete' ? '删除失败' : '凭据验证失败，账户配置已保留',
      );
    });

    it(`${operation}在途重复onOk不能重复发请求`, async () => {
      await start();
      const pending = deferred<object>();
      request().mockReturnValueOnce(pending.promise);
      await rowAction(icon);
      const submitting = accept();
      await accept();
      expect(request()).toHaveBeenCalledTimes(1);
      pending.resolve({});
      await submitting;
    });
  }

  it('验证前关闭的启用状态不能被旧确认绕过', async () => {
    await start();
    await rowAction('safety-certificate');
    await status(false);
    await accept();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('删除A的迟到成功不关闭其后新打开的B详情', async () => {
    state.rows = [account(), account(8, 'account-b')];
    await start();
    await rowAction('eye');
    await rowAction('delete');
    const pending = deferred<object>();
    api.delete.mockReturnValueOnce(pending.promise);
    const submitting = accept();
    await closeDetail();
    await rowAction('eye', 8);
    pending.resolve({});
    await submitting;
    await flushPromises();
    expect(required(wrapper).findComponent(Drawer).props('open')).toBe(true);
    expect(document.querySelector('.ant-drawer')?.textContent).toContain(
      'account-b',
    );
  });
});

describe('云账户状态回执隔离', () => {
  it.each(['list', 'detail'])(
    '从%s切换状态保留HTTP合同及同代详情同步',
    async (source) => {
      await start();
      await rowAction('eye');
      await status(false, 7, source === 'detail');
      expect(api.put).toHaveBeenCalledWith('/tree/cloud/account/7/status', {
        status: 2,
      });
      expect(row().findComponent(Switch).props('checked')).toBe(false);
      expect(
        required(wrapper).findAllComponents(Switch).at(-1)?.props('checked'),
      ).toBe(false);
    },
  );

  it.each(['old-first', 'new-first'])(
    '同记录并发状态%s，只有最新意图控制状态和loading',
    async (order) => {
      await start();
      const old = deferred<object>();
      const latest = deferred<object>();
      api.put
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(latest.promise);
      await status(false);
      await status(true);
      if (order === 'old-first') {
        old.resolve({});
        await flushPromises();
        expect(row().findComponent(Switch).props('loading')).toBe(true);
        expect(message.success).not.toHaveBeenCalled();
        latest.resolve({});
      } else {
        latest.resolve({});
        await flushPromises();
        old.resolve({});
      }
      await flushPromises();
      expect(row().findComponent(Switch).props('checked')).toBe(true);
      expect(row().findComponent(Switch).props('loading')).toBe(false);
      expect(message.success).toHaveBeenCalledTimes(1);
      expect(message.success).toHaveBeenCalledWith('账户已启用');
    },
  );

  it.each(['success', 'failure'])(
    '旧状态%s不能清掉新owner同id请求的loading',
    async (outcome) => {
      await start();
      const old = deferred<object>();
      const latest = deferred<object>();
      api.put
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(latest.promise);
      await status(false);
      changeOwner();
      state.rows = [
        {
          ...account(7, 'new-owner-account'),
          status: CloudAccountStatus.Disabled,
        },
      ];
      await action('刷新');
      await status(true);
      if (outcome === 'success') old.resolve({});
      else old.fail();
      await flushPromises();
      expect(row().findComponent(Switch).props('loading')).toBe(true);
      expect(row().findComponent(Switch).props('checked')).toBe(false);
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
      latest.resolve({});
      await flushPromises();
      expect(row().findComponent(Switch).props('loading')).toBe(false);
      expect(row().findComponent(Switch).props('checked')).toBe(true);
    },
  );

  it('状态迟到不改关闭重开后的同id详情', async () => {
    await start();
    await rowAction('eye');
    const old = deferred<object>();
    api.put.mockReturnValueOnce(old.promise);
    await status(false);
    await closeDetail();
    await rowAction('eye');
    old.resolve({});
    await flushPromises();
    expect(row().findComponent(Switch).props('checked')).toBe(false);
    expect(
      required(wrapper).findAllComponents(Switch).at(-1)?.props('checked'),
    ).toBe(true);
  });

  it('状态权限在途撤销后不改状态或提示，但释放本次loading', async () => {
    await start();
    const pending = deferred<object>();
    api.put.mockReturnValueOnce(pending.promise);
    await status(false);
    state.flags.status = false;
    pending.resolve({});
    await flushPromises();
    expect(row().findComponent(Switch).props('checked')).toBe(true);
    expect(row().findComponent(Switch).props('loading')).toBe(false);
    expect(message.success).not.toHaveBeenCalled();
  });

  it('换代后旧列表不能作为新状态动作的来源', async () => {
    await start();
    state.generation++;
    await status(false);
    expect(api.put).not.toHaveBeenCalled();
  });

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('非法状态目标id %s不外发', async (id) => {
    state.rows = [{ ...account(), id }];
    await start();
    required(wrapper).findComponent(Switch).vm.$emit('change', false);
    await flushPromises();
    expect(api.put).not.toHaveBeenCalled();
  });
});

describe('云账户读边界与凭据表单清理', () => {
  it('旧owner列表响应不能覆盖新owner列表', async () => {
    await start();
    const old = deferred<object>();
    api.get.mockReturnValueOnce(old.promise);
    await action('刷新');
    changeOwner();
    state.rows = [account(7, 'new-owner-account')];
    await action('刷新');
    old.resolve({ total: 1, items: [account(7, 'old-owner-private')] });
    await flushPromises();
    expect(row().text()).toContain('new-owner-account');
    expect(document.body.textContent).not.toContain('old-owner-private');
  });

  it.each(['create', 'edit'])(
    '%s的validate在owner变化后迟到，旧凭据已清空且不外发',
    async (mode) => {
      await start();
      await (mode === 'edit' ? rowAction('edit') : action('添加账户'));
      await fill('请输入云账户名称', 'fixture-account');
      await fill('请输入 Access Key', 'fixture-write-only-key');
      await fill('请输入 Secret Key', 'fixture-write-only-secret');
      const pending = deferred<Record<string, unknown>>();
      const form = required(wrapper).findComponent(Form);
      const forms = required(wrapper).findAllComponents(Form);
      const accountForm = required(
        forms.find((item) => item.classes().includes('account-form')),
      );
      expect(form.exists()).toBe(true);
      vi.spyOn(
        required(accountForm.vm.$.exposed),
        'validate',
      ).mockImplementation(() => pending.promise);
      await action(
        mode === 'edit' ? '更新' : '添加',
        '.modern-modal .ant-modal-footer button',
      );
      changeOwner(mode === 'edit' ? '1' : '2');
      await flushPromises();
      expect(required(wrapper).findComponent(Modal).props('open')).toBe(false);
      expect(
        [...document.querySelectorAll<HTMLInputElement>('input')].map(
          (input) => input.value,
        ),
      ).not.toContain('fixture-write-only-key');
      pending.resolve({});
      await flushPromises();
      expect(api.post).not.toHaveBeenCalled();
      expect(api.put).not.toHaveBeenCalled();
    },
  );
});

describe('云账户CSV可见合同', () => {
  it('旧登录代的已加载列表不允许导出', async () => {
    await start();
    state.generation++;
    await action('导出当前页');
    expect(csv).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith(
      '账户会话已变化，请刷新列表后导出',
    );
  });
  it('空列表仅提示，无下载和成功提示', async () => {
    state.rows = [];
    await start();
    await action('导出当前页');
    expect(csv).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith('没有可导出的数据');
    expect(message.success).not.toHaveBeenCalled();
  });

  it('导出保留中文列插入次序和对应值，不自动触发凭据验证', async () => {
    await start();
    await action('导出当前页');
    expect(csv).toHaveBeenCalledWith(
      expect.stringMatching(/^云账户列表_.+\.csv$/),
      [
        [
          '账户名称',
          '云厂商',
          '地域',
          '账户ID',
          '账户别名',
          '状态',
          '创建人',
          '创建时间',
          '更新时间',
          '描述',
        ],
        [
          'owned-account',
          '阿里云',
          'cn-fixture',
          'owned-id',
          'owned-alias',
          '已启用',
          'operator',
          '-',
          '-',
          'owned-description',
        ],
      ],
    );
    expect(api.post).not.toHaveBeenCalled();
  });
});
