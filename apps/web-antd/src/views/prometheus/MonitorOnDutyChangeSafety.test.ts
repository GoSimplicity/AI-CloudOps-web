import type { FormInstance } from 'ant-design-vue';

import { defineComponent, h } from 'vue';

import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, {
  DatePicker,
  message,
  Modal,
  Select,
  Table,
} from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MonitorOnDutyGroup from './MonitorOnDutyGroup.vue';

const control = vi.hoisted(() => ({
  allowed: true,
  session: { generation: 0, uid: '1' },
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: control.session.uid } }),
}));
vi.mock('#/store', async () => {
  const { reactive } = await import('vue');
  control.session = reactive(control.session);
  return {
    useAuthStore: () => ({
      getAuthGeneration: () => control.session.generation,
    }),
  };
});
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({
    can: () => control.allowed,
    hasPerm: () => control.allowed,
  }),
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const client = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));

// Popup visibility is AntD's contract; keep each real menu bound to its row.
const InlineDropdown = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', [slots.default?.(), slots.overlay?.()]),
});

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('测试前置条件缺失');
  return value;
}
function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((error: Error) => void) | undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return {
    promise,
    reject(error: Error) {
      required(reject)(error);
    },
    resolve(value: T) {
      required(resolve)(value);
    },
  };
}
const user = (id: number, username = `user-${id}`) => ({
  id,
  real_name: username,
  username,
});
const group = (id: number, name = 'group-a') => ({
  create_user_name: 'operator',
  created_at: '2026-11-03T00:00:00Z',
  description: '',
  enable: 1,
  id,
  name,
  shift_days: 7,
  today_duty_user: user(id === 101 ? 6 : 2),
  updated_at: '2026-11-03T00:00:00Z',
  user_id: 1,
  users: [user(1), user(2)],
});
const changes = (groupId: number) => ({
  total: 1,
  items: [
    {
      create_user_name: 'operator',
      created_at: '2026-11-03T00:00:00Z',
      date: '2026-11-03',
      id: groupId,
      on_duty_group_id: groupId,
      on_duty_user_id: 2,
      origin_user_id: 1,
      reason: `change-for-${groupId}`,
      updated_at: '',
      user_id: 1,
    },
  ],
});
let wrapper: VueWrapper;
let unmounted = false;
let groups: ReturnType<typeof group>[];

beforeEach(async () => {
  vi.clearAllMocks();
  control.allowed = true;
  control.session.uid = '1';
  control.session.generation = 0;
  groups = [group(101), group(202, 'group-b')];
  client.get.mockImplementation((path: string) => {
    if (path === '/monitor/onduty_groups/list')
      return Promise.resolve({ total: groups.length, items: groups });
    if (path === '/user/list')
      return Promise.resolve({
        total: 4,
        items: [user(1), user(2), user(3), user(6)],
      });
    if (path.startsWith('/monitor/onduty_groups/changes/'))
      return Promise.resolve(changes(Number(path.split('/').at(-1))));
    if (path.startsWith('/monitor/onduty_groups/detail/'))
      return Promise.resolve(
        groups.find((group) => path.endsWith(`/${group.id}`)),
      );
    throw new Error('Unexpected offline fixture endpoint');
  });
  client.post.mockResolvedValue({});
  client.put.mockResolvedValue({});
  client.delete.mockResolvedValue({});
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
  const computedStyle = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    computedStyle(element),
  );
  unmounted = false;
  wrapper = mount(MonitorOnDutyGroup, {
    attachTo: document.body,
    global: {
      plugins: [Antd],
      stubs: { ADropdown: InlineDropdown, Icon: true },
    },
  });
  await flushPromises();
});
afterEach(() => {
  if (!unmounted) wrapper.unmount();
  message.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function modal(title = '新增调班记录') {
  return required(
    wrapper
      .findAllComponents(Modal)
      .find((modal) => modal.props('title') === title),
  );
}
function row(name = 'group-a') {
  return required(
    wrapper.findAll('tbody tr').find((row) => row.text().includes(name)),
  );
}
async function records(name = 'group-a') {
  await required(
    row(name)
      .findAll('.ant-menu-item')
      .find((item) => item.text().includes('调班记录')),
  ).trigger('click');
  await flushPromises();
}
async function create() {
  required(
    document.querySelector<HTMLButtonElement>('.change-header button'),
  ).click();
  await flushPromises();
}
async function close(title = '新增调班记录') {
  modal(title).vm.$emit('cancel');
  await flushPromises();
}
function person(placeholder: string) {
  return required(
    wrapper
      .findAllComponents(Select)
      .find((select) => select.props('placeholder') === placeholder),
  );
}
async function setDate(value: Dayjs | null) {
  const picker = wrapper.getComponent(DatePicker);
  picker.vm.$emit('update:value', value);
  picker.vm.$emit('change', value, value?.format('YYYY-MM-DD') || '');
  await flushPromises();
}
async function fill(date = dayjs('2026-11-04T00:30:00')) {
  await setDate(date);
  person('请选择原值班人员').vm.$emit('update:value', 1);
  person('请选择调班后人员').vm.$emit('update:value', 2);
  await new DOMWrapper(
    required(
      document.querySelector<HTMLTextAreaElement>(
        'textarea[placeholder="请输入调班原因（可选）"]',
      ),
    ),
  ).setValue('  handoff  ');
  await flushPromises();
}
async function submit() {
  modal().vm.$emit('ok');
  await flushPromises();
}
function isValidationControl(
  value: unknown,
): value is Pick<FormInstance, 'validate'> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'validate' in value &&
    typeof value.validate === 'function'
  );
}
function validationControl() {
  const value = wrapper.vm.$.refs.createChangeFormRef;
  if (!isValidationControl(value)) throw new Error('真实调班表单校验接口缺失');
  return value;
}
function changeReads() {
  return client.get.mock.calls.filter(([path]) =>
    String(path).startsWith('/monitor/onduty_groups/changes/'),
  ).length;
}

describe('调班记录表单与组/账号范围', () => {
  it('真实校验通过后发送准确组/日期/人员与trim原因并刷新当前组', async () => {
    vi.stubEnv('TZ', 'Asia/Shanghai');
    await records();
    await create();
    await fill();
    await submit();
    expect(client.post).toHaveBeenCalledWith('/monitor/onduty_groups/changes', {
      date: '2026-11-04',
      on_duty_group_id: 101,
      on_duty_user_id: 2,
      origin_user_id: 1,
      reason: 'handoff',
    });
    expect(message.success).toHaveBeenCalledWith('创建调班记录成功');
    expect(modal().props('open')).toBe(false);
    expect(changeReads()).toBe(2);
  });

  it('真实必填校验不通过不发API并释放本窗口loading', async () => {
    await records();
    await create();
    await submit();
    await vi.waitFor(() =>
      expect(
        document.querySelector('.ant-form-item-explain-error'),
      ).not.toBeNull(),
    );
    expect(client.post).not.toHaveBeenCalled();
    expect(modal().props('confirmLoading')).toBe(false);
    expect(message.error).not.toHaveBeenCalled();
  });

  it('当前记录第三页新增调班后回到实际刷新第一页', async () => {
    await records();
    const table = modal('调班记录').getComponent(Table);
    client.get.mockResolvedValueOnce({ ...changes(101), total: 50 });
    table.vm.$emit('change', { current: 3, pageSize: 10 });
    await flushPromises();
    await create();
    await fill();
    await submit();
    const pagination = table.props('pagination');
    if (!pagination || typeof pagination !== 'object')
      throw new Error('调班记录分页缺失');
    expect(pagination.current).toBe(1);
    expect(client.get).toHaveBeenLastCalledWith(
      '/monitor/onduty_groups/changes/101',
      { params: { page: 1, size: 10 } },
    );
  });

  it('缺少实际validate接口时失败关闭', async () => {
    wrapper.unmount();
    wrapper = mount(MonitorOnDutyGroup, {
      attachTo: document.body,
      global: {
        plugins: [Antd],
        stubs: { ADropdown: InlineDropdown, AForm: true, Icon: true },
      },
    });
    await flushPromises();
    await records();
    await create();
    await submit();
    expect(client.post).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith('表单尚未就绪，请稍后重试');
  });

  it('日期变化清掉旧origin且不会从另一组today用户推断原人员', async () => {
    await required(
      row()
        .findAll('button')
        .find((button) => button.text().replaceAll(/\s/g, '') === '查看'),
    ).trigger('click');
    await flushPromises();
    await close('值班组详情');
    await records('group-b');
    await create();
    await setDate(dayjs('2026-11-04'));
    expect(person('请选择原值班人员').props('value')).toBeNull();
    person('请选择原值班人员').vm.$emit('update:value', 1);
    await setDate(dayjs('2026-11-05'));
    expect(person('请选择原值班人员').props('value')).toBeNull();
  });

  it.each(['请选择原值班人员', '请选择调班后人员'])(
    '%s的非法ID即便校验resolved也不提交',
    async (placeholder) => {
      await records();
      await create();
      await fill();
      person(placeholder).vm.$emit('update:value', 0);
      await flushPromises();
      vi.spyOn(validationControl(), 'validate').mockResolvedValueOnce({});
      await submit();
      expect(client.post).not.toHaveBeenCalled();
      expect(modal().props('confirmLoading')).toBe(false);
    },
  );

  it('无效Dayjs对象即便校验resolved也不调用format后发送', async () => {
    await records();
    await create();
    await fill();
    await setDate(dayjs('not-a-date'));
    person('请选择原值班人员').vm.$emit('update:value', 1);
    vi.spyOn(validationControl(), 'validate').mockResolvedValueOnce({});
    await submit();
    expect(client.post).not.toHaveBeenCalled();
  });

  it.each(['date', 'origin', 'new user', 'reason'] as const)(
    '校验pending中%s改变不能借用旧校验',
    async (field) => {
      await records();
      await create();
      await fill();
      const pending = deferred<Record<string, unknown>>();
      vi.spyOn(validationControl(), 'validate').mockReturnValueOnce(
        pending.promise,
      );
      await submit();
      if (field === 'date') await setDate(dayjs('2026-11-05'));
      if (field === 'origin')
        person('请选择原值班人员').vm.$emit('update:value', 3);
      if (field === 'new user')
        person('请选择调班后人员').vm.$emit('update:value', 3);
      if (field === 'reason')
        await new DOMWrapper(
          required(
            document.querySelector<HTMLTextAreaElement>(
              'textarea[placeholder="请输入调班原因（可选）"]',
            ),
          ),
        ).setValue('changed');
      pending.resolve({});
      await flushPromises();
      expect(client.post).not.toHaveBeenCalled();
      expect(modal().props('confirmLoading')).toBe(false);
    },
  );

  it.each(['close', 'group', 'account', 'generation', 'unmount'] as const)(
    '校验pending后%s使旧提交失效',
    async (boundary) => {
      await records();
      await create();
      await fill();
      const pending = deferred<Record<string, unknown>>();
      vi.spyOn(validationControl(), 'validate').mockReturnValueOnce(
        pending.promise,
      );
      await submit();
      if (boundary === 'close') await close();
      if (boundary === 'group') await records('group-b');
      if (boundary === 'account') control.session.uid = '2';
      if (boundary === 'generation') control.session.generation++;
      if (boundary === 'unmount') {
        wrapper.unmount();
        unmounted = true;
      }
      pending.resolve({});
      await flushPromises();
      expect(client.post).not.toHaveBeenCalled();
    },
  );

  it.each(['resolve', 'reject'] as const)(
    'a旧提交%s不关闭b的新表单或清其loading',
    async (outcome) => {
      const old = deferred<object>();
      const fresh = deferred<object>();
      await records();
      await create();
      await fill();
      client.post.mockReturnValueOnce(old.promise);
      await submit();
      await records('group-b');
      await create();
      await fill();
      client.post.mockReturnValueOnce(fresh.promise);
      await submit();
      const reads = changeReads();
      if (outcome === 'resolve') old.resolve({});
      else old.reject(new Error('private-old-change'));
      await flushPromises();
      expect(modal().props('open')).toBe(true);
      expect(modal().props('confirmLoading')).toBe(true);
      expect(changeReads()).toBe(reads);
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
      fresh.resolve({});
      await flushPromises();
      expect(required(client.post.mock.calls.at(-1))[1]).toEqual(
        expect.objectContaining({ on_duty_group_id: 202 }),
      );
    },
  );

  it('同一表单校验/提交pending不重复外发', async () => {
    const pending = deferred<object>();
    await records();
    await create();
    await fill();
    client.post.mockReturnValueOnce(pending.promise);
    await submit();
    await submit();
    expect(client.post).toHaveBeenCalledTimes(1);
    pending.resolve({});
    await flushPromises();
  });

  it('同组关窗重开后旧校验拒绝不能清新窗口loading', async () => {
    await records();
    await create();
    await fill();
    const old = deferred<Record<string, unknown>>();
    vi.spyOn(validationControl(), 'validate').mockReturnValueOnce(old.promise);
    await submit();
    await close();
    await create();
    await fill();
    const fresh = deferred<Record<string, unknown>>();
    vi.spyOn(validationControl(), 'validate').mockReturnValueOnce(
      fresh.promise,
    );
    await submit();
    old.reject(new Error('old validation failed'));
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(modal().props('confirmLoading')).toBe(true);
    fresh.resolve({});
    await flushPromises();
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it('同组关窗重开后旧写入失败不能清新提交loading或弹错', async () => {
    const old = deferred<object>();
    const fresh = deferred<object>();
    await records();
    await create();
    await fill();
    client.post.mockReturnValueOnce(old.promise);
    await submit();
    await close();
    await create();
    await fill();
    client.post.mockReturnValueOnce(fresh.promise);
    await submit();
    old.reject(new Error('old write failed'));
    await flushPromises();
    expect(modal().props('confirmLoading')).toBe(true);
    expect(message.error).not.toHaveBeenCalled();
    fresh.resolve({});
    await flushPromises();
    expect(message.success).toHaveBeenCalledTimes(1);
  });

  it('校验等待期间撤销权限不提交且仍释放本窗口loading', async () => {
    await records();
    await create();
    await fill();
    const pending = deferred<Record<string, unknown>>();
    vi.spyOn(validationControl(), 'validate').mockReturnValueOnce(
      pending.promise,
    );
    await submit();
    control.allowed = false;
    pending.resolve({});
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(modal().props('confirmLoading')).toBe(false);
  });

  it('a调班记录读取迟到不覆盖b或清b的新loading', async () => {
    const a = deferred<ReturnType<typeof changes>>();
    const b = deferred<ReturnType<typeof changes>>();
    client.get.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    await records();
    await records('group-b');
    a.resolve(changes(101));
    await flushPromises();
    expect(document.querySelector('.change-header')?.textContent).toContain(
      'group-b',
    );
    expect(document.body.textContent).not.toContain('change-for-101');
    expect(document.querySelector('.ant-spin-spinning')).not.toBeNull();
    b.resolve(changes(202));
    await flushPromises();
    expect(document.body.textContent).toContain('change-for-202');
  });

  it('关闭记录窗后迟到读取不能重开', async () => {
    const pending = deferred<ReturnType<typeof changes>>();
    client.get.mockReturnValueOnce(pending.promise);
    await records();
    await close('调班记录');
    pending.resolve(changes(101));
    await flushPromises();
    expect(modal('调班记录').props('open')).toBe(false);
  });

  it('旧人员选项回执不污染新组窗口或清其loading', async () => {
    const a = deferred<{ items: ReturnType<typeof user>[]; total: number }>();
    const b = deferred<{ items: ReturnType<typeof user>[]; total: number }>();
    await records();
    client.get.mockReturnValueOnce(a.promise);
    await create();
    await records('group-b');
    client.get.mockReturnValueOnce(b.promise);
    await create();
    a.resolve({ total: 1, items: [user(99, 'stale-private-user')] });
    await flushPromises();
    expect(person('请选择原值班人员').props('options')).toEqual([]);
    expect(person('请选择原值班人员').props('loading')).toBe(true);
    b.resolve({ total: 1, items: [user(3, 'fresh-user')] });
    await flushPromises();
    expect(person('请选择原值班人员').props('options')).toEqual([
      { label: 'fresh-user', value: 3 },
    ]);
  });

  it('用户选项移除非法ID且搜索只采用最新结果', async () => {
    await records();
    client.get.mockResolvedValueOnce({
      total: 4,
      items: [user(0), user(-1), user(Number.NaN), user(9, 'valid-user')],
    });
    await create();
    expect(person('请选择原值班人员').props('options')).toEqual([
      { label: 'valid-user', value: 9 },
    ]);
    const old = deferred<{ items: ReturnType<typeof user>[]; total: number }>();
    client.get.mockReturnValueOnce(old.promise);
    person('请选择原值班人员').vm.$emit('search', 'old');
    await flushPromises();
    client.get.mockResolvedValueOnce({
      total: 1,
      items: [user(3, 'fresh-search')],
    });
    person('请选择原值班人员').vm.$emit('search', 'fresh');
    await flushPromises();
    old.resolve({ total: 1, items: [user(8, 'stale-search')] });
    await flushPromises();
    expect(person('请选择原值班人员').props('options')).toEqual([
      { label: 'fresh-search', value: 3 },
    ]);
  });

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('非法组ID %s 不创建换班窗口或请求记录', async (id) => {
    groups = [group(id)];
    await wrapper
      .get('.ops-page__filters .ant-input-search-button')
      .trigger('click');
    await flushPromises();
    await records();
    expect(changeReads()).toBe(0);
    expect(modal('调班记录').props('open')).toBe(false);
  });
});
