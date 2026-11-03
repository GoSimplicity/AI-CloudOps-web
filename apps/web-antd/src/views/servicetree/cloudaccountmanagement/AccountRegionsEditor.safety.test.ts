import { reactive } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message, Modal, Select } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import AccountRegionsEditor from './AccountRegionsEditor.vue';

const account = vi.hoisted(() => {
  const user: { userInfo: { userId: string } | null } = {
    userInfo: { userId: '1' },
  };
  return { auth: { generation: 0 }, user };
});
const api = vi.hoisted(() => ({ getAvailableRegions: vi.fn() }));
vi.mock('@vben/stores', () => ({ useUserStore: () => account.user }));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => account.auth.generation }),
}));
vi.mock('#/api/request', () => ({ requestClient: { get: vi.fn() } }));
vi.mock('#/api/core/tree/tree_account_region', () => api);

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Required region query fixture is unavailable');
  }
  return value;
}

let wrapper: undefined | VueWrapper;
const confirmations: Parameters<typeof Modal.confirm>[0][] = [];
const destroyDialog = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  account.user = reactive({ userInfo: { userId: '1' } });
  account.auth = reactive({ generation: 0 });
  confirmations.length = 0;
  api.getAvailableRegions.mockResolvedValue({ regions: [] });
  vi.spyOn(Modal, 'confirm').mockImplementation((options) => {
    confirmations.push(options);
    return { destroy: destroyDialog, update: vi.fn() };
  });
  vi.stubGlobal('matchMedia', () => ({
    addListener: vi.fn(),
    matches: false,
    removeListener: vi.fn(),
  }));
  const getStyle = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    getStyle(element),
  );
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  message.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function start(accountId = 7) {
  wrapper = mount(AccountRegionsEditor, {
    attachTo: document.body,
    global: { plugins: [Antd] },
    props: {
      accountEnabled: true,
      accountId,
      canRead: true,
      modelValue: [],
      provider: 1,
    },
  });
  return wrapper;
}
async function confirm() {
  const query = required(wrapper)
    .findAll('button')
    .find((button) => button.text().includes('查询云端地域'));
  await required(query).trigger('click');
  return required(confirmations[confirmations.length - 1]);
}
async function accept(options: Parameters<typeof Modal.confirm>[0]) {
  const callback = options.onOk;
  if (typeof callback !== 'function') {
    throw new TypeError('Required region confirmation callback is unavailable');
  }
  await callback();
}

it('does not query on mount and consumes each explicit confirmation once', async () => {
  start();
  await flushPromises();
  expect(api.getAvailableRegions).not.toHaveBeenCalled();
  const options = await confirm();
  await accept(options);
  await accept(options);
  expect(api.getAvailableRegions).toHaveBeenCalledTimes(1);
  expect(api.getAvailableRegions).toHaveBeenCalledWith({ cloud_account_id: 7 });
});

it('ignores a closing dialog cancel callback after its results were accepted', async () => {
  api.getAvailableRegions.mockResolvedValue({
    regions: [{ available: true, region: 'retained', region_name: 'RETAINED' }],
  });
  start();
  const options = await confirm();
  await accept(options);
  const cancel = options.onCancel;
  if (typeof cancel !== 'function')
    throw new TypeError('Required cancel callback is unavailable');
  await cancel();
  await flushPromises();
  expect(required(wrapper).findComponent(Select).props('options')).toEqual([
    { disabled: false, label: 'RETAINED (retained)', value: 'retained' },
  ]);
});

it.each(['owner', 'epoch', 'unmount', 'cancel'])(
  'rejects an old region confirmation after %s',
  async (change) => {
    start();
    const options = await confirm();
    switch (change) {
      case 'cancel': {
        const callback = options.onCancel;
        if (typeof callback !== 'function') {
          throw new TypeError('Required cancel callback is unavailable');
        }
        await callback();
        break;
      }
      case 'epoch': {
        account.auth.generation++;
        break;
      }
      case 'owner': {
        account.user.userInfo = { userId: '2' };
        break;
      }
      case 'unmount': {
        required(wrapper).unmount();
        wrapper = undefined;
        break;
      }
      default: {
        throw new TypeError('Unknown region invalidation fixture');
      }
    }
    await accept(options);
    expect(api.getAvailableRegions).not.toHaveBeenCalled();
    expect(destroyDialog).toHaveBeenCalled();
  },
);

it('checks the fresh epoch even when the identity adapter is not reactive', async () => {
  account.auth = { generation: 0 };
  start();
  const options = await confirm();
  account.auth.generation++;
  await accept(options);
  expect(api.getAvailableRegions).not.toHaveBeenCalled();
});

it('does not cancel a query when the same principal profile is refreshed', async () => {
  start();
  const options = await confirm();
  account.user.userInfo = { userId: '1' };
  await flushPromises();
  await accept(options);
  expect(api.getAvailableRegions).toHaveBeenCalledTimes(1);
});

it('does not publish old regions or clear a new query after an identity change', async () => {
  let complete: ((value: { regions: object[] }) => void) | undefined;
  const pending = new Promise<{ regions: object[] }>((resolve) => {
    complete = resolve;
  });
  api.getAvailableRegions.mockReturnValueOnce(pending);
  start();
  const first = await confirm();
  const oldRequest = accept(first);
  account.user.userInfo = { userId: '2' };
  await flushPromises();
  const second = await confirm();
  api.getAvailableRegions.mockResolvedValueOnce({
    regions: [{ available: true, region: 'new', region_name: 'NEW-REGION' }],
  });
  await accept(second);
  required(complete)({
    regions: [{ available: true, region: 'old', region_name: 'OLD-REGION' }],
  });
  await oldRequest;
  await flushPromises();
  const options = required(wrapper).findComponent(Select).props('options');
  expect(options).toEqual([
    { disabled: false, label: 'NEW-REGION (new)', value: 'new' },
  ]);
});

it.each([
  0,
  -1,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.MAX_SAFE_INTEGER + 1,
])(
  'refuses an invalid saved account ID %s before requesting confirmation',
  (id) => {
    start(id);
    const setup = Reflect.get(required(wrapper).vm.$, 'setupState');
    const query = Reflect.get(setup, 'confirmLiveRegions');
    expect(query).toBeTypeOf('function');
    query();
    expect(confirmations).toHaveLength(0);
    expect(api.getAvailableRegions).not.toHaveBeenCalled();
  },
);

it('preserves explicit empty project metadata and omits absent metadata', async () => {
  start();
  await required(wrapper).setProps({
    modelValue: [
      { is_default: true, project_id: '', region: 'existing' },
      { is_default: false, region: 'without-project' },
    ],
  });
  required(wrapper)
    .findComponent(Select)
    .vm.$emit('update:value', ['existing', 'without-project', 'new']);
  await flushPromises();
  const event = required(required(wrapper).emitted('update:modelValue'));
  const rows = required(event[event.length - 1])[0];
  expect(rows).toEqual([
    {
      description: '',
      is_default: true,
      project_id: '',
      region: 'existing',
      region_name: '',
    },
    {
      description: '',
      is_default: false,
      region: 'without-project',
      region_name: '',
    },
    { description: '', is_default: false, region: 'new', region_name: '' },
  ]);
});
