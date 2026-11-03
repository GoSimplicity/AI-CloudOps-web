import { useUserStore } from '@vben/stores';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SystemApi from './SystemApi.vue';

const control = vi.hoisted(() => ({
  auth: { generation: 0 },
  permissions: { create: true, delete: true, detail: true, update: true },
}));
vi.mock('#/store/auth', async () => {
  const { reactive } = await import('vue');
  control.auth = reactive(control.auth);
  return {
    useAuthStore: () => ({ getAuthGeneration: () => control.auth.generation }),
  };
});
vi.mock('#/utils/permission', async () => {
  const { reactive } = await import('vue');
  control.permissions = reactive(control.permissions);
  return {
    usePermission: () => ({
      can: () => control.permissions.delete,
      hasPerm: (path: string) => {
        if (path === '/api/apis/create') return control.permissions.create;
        if (path === '/api/apis/update/:id') return control.permissions.update;
        if (path === '/api/apis/detail/:id') return control.permissions.detail;
        return true;
      },
    }),
  };
});
const api = vi.hoisted(() => ({
  createApiApi: vi.fn(),
  deleteApiApi: vi.fn(),
  getApiDetailApi: vi.fn(),
  getApiStatisticsApi: vi.fn(),
  listApisApi: vi.fn(),
  updateApiApi: vi.fn(),
}));
vi.mock('#/api/core/system/api', () => api);

interface ApiRow {
  id: number;
  name: string;
  path: string;
  method: number;
  category?: number;
  is_public: number;
}
interface PageState {
  apiList: ApiRow[];
  apiStatistics: { private_count: number; public_count: number };
  loading: boolean;
  submitLoading: boolean;
  modalVisible: boolean;
  viewModalVisible: boolean;
  viewApiData: ApiRow | null;
  modalTitle: string;
  formData: ApiRow;
  formRef: { validate: () => Promise<unknown> } | undefined;
  searchParams: { search: string };
  closeForm: () => void;
  closeView: () => void;
  fetchApiList: () => Promise<void>;
  fetchApiStatistics: () => Promise<void>;
  handleAdd: () => void;
  handleEdit: (row: ApiRow) => Promise<void>;
  handleView: (row: ApiRow) => Promise<void>;
  handleSubmit: () => Promise<void>;
  handleAccessChange: (row: ApiRow, access: number) => Promise<void>;
  handleDelete: (row: ApiRow) => void;
}
function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('测试前置条件缺失');
  return value;
}
function deferred<T>() {
  let done: ((value: T) => void) | undefined;
  let fail: ((error: Error) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    done = resolve;
    fail = reject;
  });
  return {
    promise,
    reject: (error: Error) => required(fail)(error),
    resolve: (value: T) => required(done)(value),
  };
}
const row = (id: number, access = 2): ApiRow => ({
  category: 0,
  id,
  is_public: access,
  method: 1,
  name: `api-${id}`,
  path: `/fixture/${id}`,
});
const account = (userId = '1') => ({
  avatar: '',
  realName: '',
  userId,
  username: 'operator',
});
let wrapper: VueWrapper;
let state: PageState;
let unmounted = false;
let confirmations: Parameters<typeof Modal.confirm>[0][];
beforeEach(async () => {
  vi.clearAllMocks();
  control.auth.generation = 0;
  Object.assign(control.permissions, {
    create: true,
    delete: true,
    detail: true,
    update: true,
  });
  const pinia = createPinia();
  setActivePinia(pinia);
  useUserStore().setUserInfo(account());
  api.listApisApi.mockImplementation(async () => ({
    total: 2,
    items: [row(101), row(202)],
  }));
  api.getApiStatisticsApi.mockResolvedValue({
    private_count: 2,
    public_count: 0,
  });
  api.getApiDetailApi.mockImplementation(async (id: number) => row(id));
  api.createApiApi.mockResolvedValue(null);
  api.updateApiApi.mockResolvedValue(null);
  api.deleteApiApi.mockResolvedValue(null);
  vi.spyOn(message, 'error');
  vi.spyOn(message, 'success');
  confirmations = [];
  vi.spyOn(Modal, 'confirm').mockImplementation((options) => {
    confirmations.push(options);
    return { destroy: vi.fn(), update: vi.fn() };
  });
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
  wrapper = mount(SystemApi, {
    attachTo: document.body,
    global: { plugins: [pinia, Antd], stubs: { Icon: true } },
  });
  state = Reflect.get(wrapper.vm.$, 'setupState') as PageState;
  unmounted = false;
  await flushPromises();
});
afterEach(() => {
  if (!unmounted) wrapper.unmount();
  message.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function openCreate() {
  state.handleAdd();
  await flushPromises();
  Object.assign(state.formData, row(0));
  validation(async () => ({}));
}
function validation(validate: () => Promise<unknown>) {
  return vi
    .spyOn(required(state.formRef), 'validate')
    .mockImplementation(validate);
}
function firstRow() {
  return required(state.apiList[0]);
}

describe('接口管理实际SFC隔离', () => {
  it('真实必填校验失败与未就绪Form都不能创建', async () => {
    state.handleAdd();
    await flushPromises();
    await state.handleSubmit();
    expect(api.createApiApi).not.toHaveBeenCalled();
    state.formRef = undefined;
    await state.handleSubmit();
    expect(api.createApiApi).not.toHaveBeenCalled();
  });
  it('旧0目录按私有2编辑，保留category0', async () => {
    api.getApiDetailApi.mockResolvedValueOnce(row(101, 0));
    await state.handleEdit(firstRow());
    await flushPromises();
    expect(state.formData.is_public).toBe(2);
    expect(state.formData.category).toBe(0);
    validation(async () => ({}));
    await state.handleSubmit();
    expect(api.updateApiApi).toHaveBeenCalledWith(
      expect.objectContaining({ category: 0, id: 101, is_public: 2 }),
    );
  });
  it('category缺省和公开1仍按用户输入发送', async () => {
    await openCreate();
    state.formData.category = undefined;
    state.formData.is_public = 1;
    await state.handleSubmit();
    expect(api.createApiApi).toHaveBeenCalledWith(
      expect.objectContaining({ category: undefined, is_public: 1 }),
    );
  });
  it.each([0, 3])('不发送非法表单is_public=%s', async (access) => {
    await openCreate();
    state.formData.is_public = access;
    await state.handleSubmit();
    expect(api.createApiApi).not.toHaveBeenCalled();
  });
  it('validate等待后切到编辑B不能把新建A变成更新B', async () => {
    await openCreate();
    const gate = deferred<unknown>();
    validation(() => gate.promise);
    const pending = state.handleSubmit();
    await state.handleEdit(required(state.apiList[1]));
    await flushPromises();
    gate.resolve({});
    await pending;
    expect(api.createApiApi).not.toHaveBeenCalled();
    expect(api.updateApiApi).not.toHaveBeenCalled();
    expect(state.formData.id).toBe(202);
  });
  it.each(['uid', 'generation'])(
    '验证等待期间%s变化，旧表单清空且不提交',
    async (kind) => {
      await openCreate();
      const gate = deferred<unknown>();
      validation(() => gate.promise);
      const pending = state.handleSubmit();
      if (kind === 'uid') useUserStore().setUserInfo(account('2'));
      else control.auth.generation++;
      gate.resolve({});
      await pending;
      await flushPromises();
      expect(api.createApiApi).not.toHaveBeenCalled();
      expect(state.modalVisible).toBe(false);
      expect(state.formData.name).toBe('');
    },
  );
  it('validate等待期间字段或权限变化不发送', async () => {
    await openCreate();
    const gate = deferred<unknown>();
    validation(() => gate.promise);
    const pending = state.handleSubmit();
    state.formData.name = 'changed';
    control.permissions.create = false;
    gate.resolve({});
    await pending;
    expect(api.createApiApi).not.toHaveBeenCalled();
    expect(state.submitLoading).toBe(false);
  });
  it('取消并重开同种窗口后旧validate不提交', async () => {
    await openCreate();
    const gate = deferred<unknown>();
    validation(() => gate.promise);
    const pending = state.handleSubmit();
    state.closeForm();
    await openCreate();
    gate.resolve({});
    await pending;
    expect(api.createApiApi).not.toHaveBeenCalled();
    expect(state.modalVisible).toBe(true);
  });
  it('旧创建回执和finally不能关闭或清理新窗口提交', async () => {
    const old = deferred<unknown>();
    const newer = deferred<unknown>();
    api.createApiApi
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(newer.promise);
    await openCreate();
    const first = state.handleSubmit();
    await flushPromises();
    state.closeForm();
    await openCreate();
    const second = state.handleSubmit();
    await flushPromises();
    old.resolve(null);
    await first;
    expect(state.modalVisible).toBe(true);
    expect(state.submitLoading).toBe(true);
    newer.resolve(null);
    await second;
    expect(state.modalVisible).toBe(false);
  });
  it('创建已外发后继续编辑字段，旧回执不关闭当前新草稿', async () => {
    const gate = deferred<unknown>();
    api.createApiApi.mockReturnValueOnce(gate.promise);
    await openCreate();
    const pending = state.handleSubmit();
    await flushPromises();
    expect(api.createApiApi).toHaveBeenCalledTimes(1);
    state.formData.name = 'unsaved-next-draft';
    gate.resolve(null);
    await pending;
    expect(state.modalVisible).toBe(true);
    expect(state.formData.name).toBe('unsaved-next-draft');
    expect(state.submitLoading).toBe(false);
  });
  it('校验已开始时重复提交只校验和发送一次', async () => {
    await openCreate();
    const gate = deferred<unknown>();
    const validate = validation(() => gate.promise);
    const pending = state.handleSubmit();
    await state.handleSubmit();
    expect(validate).toHaveBeenCalledTimes(1);
    gate.resolve({});
    await pending;
    expect(api.createApiApi).toHaveBeenCalledTimes(1);
  });
  it('编辑A/B/A迟到详情只接纳最后一次A', async () => {
    const a = deferred<ApiRow>();
    const b = deferred<ApiRow>();
    const last = deferred<ApiRow>();
    api.getApiDetailApi
      .mockReturnValueOnce(a.promise)
      .mockReturnValueOnce(b.promise)
      .mockReturnValueOnce(last.promise);
    const oldA = state.handleEdit(firstRow());
    const oldB = state.handleEdit(required(state.apiList[1]));
    const newA = state.handleEdit(firstRow());
    last.resolve({ ...row(101), name: 'latest-a' });
    await newA;
    b.resolve(row(202));
    await oldB;
    a.resolve(row(101));
    await oldA;
    expect(state.formData.name).toBe('latest-a');
    expect(state.modalTitle).toBe('编辑API');
  });
  it('迟到编辑详情不覆盖新建窗口', async () => {
    const gate = deferred<ApiRow>();
    api.getApiDetailApi.mockReturnValueOnce(gate.promise);
    const pending = state.handleEdit(firstRow());
    await openCreate();
    gate.resolve(row(101));
    await pending;
    expect(state.modalTitle).toBe('新建API');
    expect(state.formData.id).toBe(0);
  });
  it('关闭详情或同目标重开隔离迟到响应', async () => {
    const old = deferred<ApiRow>();
    const current = deferred<ApiRow>();
    api.getApiDetailApi
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    const first = state.handleView(firstRow());
    state.closeView();
    const second = state.handleView(firstRow());
    current.resolve({ ...row(101), name: 'new-detail' });
    await second;
    old.resolve(row(101));
    await first;
    expect(state.viewApiData?.name).toBe('new-detail');
    state.closeView();
    expect(state.viewModalVisible).toBe(false);
  });
  it('旧列表/统计成功与finally不覆盖较新请求', async () => {
    const old = deferred<{ items: ApiRow[]; total: number }>();
    const newer = deferred<{ items: ApiRow[]; total: number }>();
    api.listApisApi
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(newer.promise);
    const first = state.fetchApiList();
    state.searchParams.search = 'new';
    const second = state.fetchApiList();
    old.resolve({ total: 1, items: [row(1)] });
    await first;
    expect(state.loading).toBe(true);
    newer.resolve({ total: 1, items: [row(2)] });
    await second;
    expect(firstRow().id).toBe(2);
    const oldStats = deferred<{
      private_count: number;
      public_count: number;
    }>();
    const newStats = deferred<{
      private_count: number;
      public_count: number;
    }>();
    api.getApiStatisticsApi
      .mockReturnValueOnce(oldStats.promise)
      .mockReturnValueOnce(newStats.promise);
    const a = state.fetchApiStatistics();
    const b = state.fetchApiStatistics();
    newStats.resolve({ private_count: 0, public_count: 2 });
    await b;
    oldStats.resolve({ private_count: 0, public_count: 99 });
    await a;
    expect(state.apiStatistics.public_count).toBe(2);
  });
  it('访问权限串行且旧失败不回滚重载的新行', async () => {
    const gate = deferred<unknown>();
    api.updateApiApi.mockReturnValueOnce(gate.promise);
    const source = firstRow();
    const pending = state.handleAccessChange(source, 1);
    await state.handleAccessChange(source, 2);
    state.handleDelete(source);
    expect(api.updateApiApi).toHaveBeenCalledTimes(1);
    expect(Modal.confirm).not.toHaveBeenCalled();
    api.listApisApi.mockResolvedValueOnce({ total: 1, items: [row(101, 1)] });
    await state.fetchApiList();
    gate.reject(new Error('fixture-private-canary'));
    await pending;
    expect(firstRow().is_public).toBe(1);
    expect(message.error).not.toHaveBeenCalledWith('fixture-private-canary');
  });
  it('删除确认只能执行一次且实时检查权限', async () => {
    state.handleDelete(firstRow());
    const confirm = required(confirmations[0]);
    control.permissions.delete = false;
    await confirm.onOk?.();
    expect(api.deleteApiApi).not.toHaveBeenCalled();
    control.permissions.delete = true;
    await confirm.onOk?.();
    expect(api.deleteApiApi).not.toHaveBeenCalled();
    state.handleDelete(firstRow());
    const next = required(confirmations[1]);
    await next.onOk?.();
    await next.onOk?.();
    expect(api.deleteApiApi).toHaveBeenCalledTimes(1);
  });
  it('删除确认期间sameUID重登不能借新身份发送', async () => {
    state.handleDelete(firstRow());
    const confirm = required(confirmations[0]);
    control.auth.generation++;
    await confirm.onOk?.();
    expect(api.deleteApiApi).not.toHaveBeenCalled();
  });
  it('删除取消后重开同记录，旧确认不能删除', async () => {
    const source = firstRow();
    state.handleDelete(source);
    const old = required(confirmations[0]);
    old.onCancel?.();
    state.handleDelete(source);
    await old.onOk?.();
    expect(api.deleteApiApi).not.toHaveBeenCalled();
    await required(confirmations[1]).onOk?.();
    expect(api.deleteApiApi).toHaveBeenCalledTimes(1);
  });
  it('删除已外发后换账号，旧回执不刷新新账号或提示成功', async () => {
    const gate = deferred<unknown>();
    api.deleteApiApi.mockReturnValueOnce(gate.promise);
    state.handleDelete(firstRow());
    const pending = required(confirmations[0]).onOk?.();
    await flushPromises();
    expect(api.deleteApiApi).toHaveBeenCalledTimes(1);
    useUserStore().setUserInfo(account('2'));
    await flushPromises();
    const confirmation = required(vi.mocked(Modal.confirm).mock.results[0]);
    if (confirmation.type !== 'return') throw new Error('测试确认框未创建');
    expect(confirmation.value.destroy).toHaveBeenCalledTimes(1);
    const listCalls = api.listApisApi.mock.calls.length;
    gate.resolve(null);
    await pending;
    expect(api.listApisApi).toHaveBeenCalledTimes(listCalls);
    expect(message.success).not.toHaveBeenCalled();
  });
  it('同账号重登隔离访问切换的失败回执', async () => {
    const gate = deferred<unknown>();
    api.updateApiApi.mockReturnValueOnce(gate.promise);
    const pending = state.handleAccessChange(firstRow(), 1);
    control.auth.generation++;
    await flushPromises();
    // A stable owner explicitly refreshes; the ownership watcher performs no I/O.
    await state.fetchApiList();
    gate.reject(new Error('fixture-private-canary'));
    await pending;
    expect(firstRow().is_public).toBe(2);
    expect(message.error).not.toHaveBeenCalled();
  });
  it('未授权操作入口及非法ID都不发送', async () => {
    Object.assign(control.permissions, {
      create: false,
      delete: false,
      detail: false,
      update: false,
    });
    state.handleAdd();
    await state.handleEdit(firstRow());
    await state.handleView(firstRow());
    state.handleDelete(firstRow());
    await state.handleAccessChange(firstRow(), 1);
    expect(api.getApiDetailApi).not.toHaveBeenCalled();
    expect(api.updateApiApi).not.toHaveBeenCalled();
    expect(Modal.confirm).not.toHaveBeenCalled();
    Object.assign(control.permissions, {
      create: true,
      delete: true,
      detail: true,
      update: true,
    });
    api.listApisApi.mockResolvedValueOnce({ total: 1, items: [row(0)] });
    await state.fetchApiList();
    await state.handleEdit(firstRow());
    await state.handleView(firstRow());
    state.handleDelete(firstRow());
    await state.handleAccessChange(firstRow(), 1);
    expect(api.getApiDetailApi).not.toHaveBeenCalled();
    expect(api.updateApiApi).not.toHaveBeenCalled();
    expect(api.deleteApiApi).not.toHaveBeenCalled();
  });
  it.each([0, 5])('未支持method=%s不发送', async (method) => {
    await openCreate();
    state.formData.method = method;
    await state.handleSubmit();
    expect(api.createApiApi).not.toHaveBeenCalled();
  });
  it('过期列表失败不清新数据或回显原错误', async () => {
    const gate = deferred<{ items: ApiRow[]; total: number }>();
    api.listApisApi.mockReturnValueOnce(gate.promise);
    const pending = state.fetchApiList();
    await state.fetchApiList();
    gate.reject(new Error('fixture-private-canary'));
    await pending;
    expect(state.apiList).toHaveLength(2);
    expect(message.error).not.toHaveBeenCalled();
  });
  it('请求期间只修改筛选输入也能释放当前loading，且不接纳旧条件数据', async () => {
    const gate = deferred<{ items: ApiRow[]; total: number }>();
    api.listApisApi.mockReturnValueOnce(gate.promise);
    const pending = state.fetchApiList();
    state.searchParams.search = 'not-yet-searched';
    gate.resolve({ total: 1, items: [row(999)] });
    await pending;
    expect(state.loading).toBe(false);
    expect(firstRow().id).toBe(101);
  });
  it('删除占用同记录，取消确认后才允许切换', async () => {
    const source = firstRow();
    state.handleDelete(source);
    await state.handleAccessChange(source, 1);
    expect(api.updateApiApi).not.toHaveBeenCalled();
    required(confirmations[0]).onCancel?.();
    await state.handleAccessChange(source, 1);
    expect(api.updateApiApi).toHaveBeenCalledTimes(1);
  });
  it('打开另一删除确认不释放已外发删除的同记录互斥', async () => {
    const source = firstRow();
    const gate = deferred<unknown>();
    api.deleteApiApi.mockReturnValueOnce(gate.promise);
    state.handleDelete(source);
    const pending = required(confirmations[0]).onOk?.();
    await flushPromises();
    state.handleDelete(required(state.apiList[1]));
    await state.handleAccessChange(source, 1);
    expect(api.updateApiApi).not.toHaveBeenCalled();
    required(confirmations[1]).onCancel?.();
    gate.resolve(null);
    await pending;
  });
  it('generation先变而profile尚未清理时只清理，不以过渡身份请求', async () => {
    const lists = api.listApisApi.mock.calls.length;
    const statistics = api.getApiStatisticsApi.mock.calls.length;
    control.auth.generation++;
    await flushPromises();
    expect(api.listApisApi).toHaveBeenCalledTimes(lists);
    expect(api.getApiStatisticsApi).toHaveBeenCalledTimes(statistics);
    expect(state.apiList).toEqual([]);
    useUserStore().setUserInfo(null);
    await flushPromises();
    expect(api.listApisApi).toHaveBeenCalledTimes(lists);
    expect(api.getApiStatisticsApi).toHaveBeenCalledTimes(statistics);
  });
  it('查看A等待期间打开新建，迟到详情不得重开查看窗口', async () => {
    const gate = deferred<ApiRow>();
    api.getApiDetailApi.mockReturnValueOnce(gate.promise);
    const pending = state.handleView(firstRow());
    await openCreate();
    gate.resolve(row(101));
    await pending;
    expect(state.modalVisible).toBe(true);
    expect(state.modalTitle).toBe('新建API');
    expect(state.viewModalVisible).toBe(false);
    expect(state.viewApiData).toBeNull();
  });
  it('编辑A等待期间查看B，迟到编辑不得同时打开第二窗口', async () => {
    const edit = deferred<ApiRow>();
    const view = deferred<ApiRow>();
    api.getApiDetailApi
      .mockReturnValueOnce(edit.promise)
      .mockReturnValueOnce(view.promise);
    const pendingEdit = state.handleEdit(firstRow());
    const pendingView = state.handleView(required(state.apiList[1]));
    view.resolve(row(202));
    await pendingView;
    edit.resolve(row(101));
    await pendingEdit;
    expect(state.viewModalVisible).toBe(true);
    expect(state.viewApiData?.id).toBe(202);
    expect(state.modalVisible).toBe(false);
  });
  it('未提交的搜索输入不阻止仍owned同一行回滚，且不提示或刷新旧query', async () => {
    const source = firstRow();
    const gate = deferred<unknown>();
    api.updateApiApi.mockReturnValueOnce(gate.promise);
    const lists = api.listApisApi.mock.calls.length;
    const statistics = api.getApiStatisticsApi.mock.calls.length;
    const pending = state.handleAccessChange(source, 1);
    state.searchParams.search = 'not-submitted';
    gate.reject(new Error('fixture-private-canary'));
    await pending;
    expect(firstRow()).toBe(source);
    expect(source.is_public).toBe(2);
    expect(message.error).not.toHaveBeenCalled();
    expect(api.listApisApi).toHaveBeenCalledTimes(lists);
    expect(api.getApiStatisticsApi).toHaveBeenCalledTimes(statistics);
  });
  it('卸载后验证回执不能外发或修改状态', async () => {
    await openCreate();
    const gate = deferred<unknown>();
    validation(() => gate.promise);
    const pending = state.handleSubmit();
    wrapper.unmount();
    unmounted = true;
    gate.resolve({});
    await pending;
    expect(api.createApiApi).not.toHaveBeenCalled();
  });
});
