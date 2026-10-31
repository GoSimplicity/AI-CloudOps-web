import type { FormInstance } from 'ant-design-vue';

import type { K8sYamlTask } from '#/api/core/k8s/k8s_yaml';

import { defineComponent, h, ref } from 'vue';

import { flushPromises, mount } from '@vue/test-utils';
import { Form, message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTaskPage } from './Task';

const owner = vi.hoisted(() => ({ generation: 0, uid: '1' }));
const api = vi.hoisted(() => ({
  applyYamlTask: vi.fn(),
  checkYamlTemplate: vi.fn(),
  createYamlTask: vi.fn(),
  createYamlTemplate: vi.fn(),
  deleteYamlTask: vi.fn(),
  deleteYamlTemplate: vi.fn(),
  getYamlTaskDetail: vi.fn(),
  getYamlTaskList: vi.fn(),
  getYamlTemplateDetail: vi.fn(),
  getYamlTemplateList: vi.fn(),
  updateYamlTask: vi.fn(),
  updateYamlTemplate: vi.fn(),
}));
vi.mock('#/api/core/k8s/k8s_yaml', () => api);
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: owner.uid } }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => owner.generation }),
}));
vi.mock('ant-design-vue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ant-design-vue')>()),
  message: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  Modal: { confirm: vi.fn() },
}));
const cleanups: Array<() => void> = [];
function form(validate: () => Promise<Record<string, unknown>>) {
  const instance = ref<FormInstance>();
  const wrapper = mount(
    defineComponent({
      setup: () => () => h(Form, { model: {}, ref: instance }),
    }),
  );
  const control = instance.value;
  if (!control) throw new Error('Expected mounted form instance');
  vi.spyOn(control, 'validate').mockImplementation(validate);
  cleanups.push(() => wrapper.unmount());
  return control;
}
function deferred<T>() {
  let complete: ((value: T) => void) | undefined;
  let reject: ((reason: Error) => void) | undefined;
  const promise = new Promise<T>((resolve, fail) => {
    complete = resolve;
    reject = fail;
  });
  return {
    fail(error: Error) {
      if (!reject) throw new Error('Expected pending request');
      reject(error);
    },
    promise,
    resolve(value: T) {
      if (!complete) throw new Error('Expected pending request');
      complete(value);
    },
  };
}

function record(id?: number): K8sYamlTask {
  return {
    cluster_id: 7,

    id,
    name: 'fixture-record',
    template_id: 1,
    user_id: 1,
  };
}
async function confirm() {
  const onOk = vi.mocked(Modal.confirm).mock.calls.at(-1)?.[0]?.onOk;
  if (typeof onOk !== 'function')
    throw new Error('Expected confirmation dialog');
  await onOk(() => {});
}
beforeEach(() => {
  vi.resetAllMocks();
  owner.uid = '1';
  owner.generation = 0;
  api.getYamlTaskList.mockResolvedValue({ total: 0, items: [] });
  api.getYamlTemplateList.mockResolvedValue({ total: 0, items: [] });
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
});

describe('yaml 任务 标识与异步操作范围', () => {
  it('缺少ID的详情与删除不发请求，使用固定提示', async () => {
    const page = useTaskPage();
    page.filterClusterId.value = 7;
    await page.showTaskDetail(record());
    page.deleteTask(record());
    expect(api.getYamlTaskDetail).not.toHaveBeenCalled();
    expect(api.deleteYamlTask).not.toHaveBeenCalled();
    expect(Modal.confirm).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith(
      '任务标识缺失或无效，请刷新列表后重试',
    );
  });

  it('缺少ID的编辑与混合批量删除在任何写请求前拒绝', async () => {
    const page = useTaskPage();
    page.filterClusterId.value = 7;
    page.openEditModal(record());
    page.editFormRef.value = form(async () => ({}));
    await page.submitEditForm();
    page.selectedRows.value = [record(1), record()];
    page.batchOperation('删除');
    expect(Modal.confirm).not.toHaveBeenCalled();
    expect(api.updateYamlTask).not.toHaveBeenCalled();
    expect(api.deleteYamlTask).not.toHaveBeenCalled();
  });

  it.each([
    'close',
    'reopen',
    'form',
    'target',
    'cluster',
    'owner',
    'generation',
  ])('表单验证期间%s变化取消旧编辑，不重定向新目标', async (change) => {
    const page = useTaskPage();
    page.filterClusterId.value = 7;
    const initial = record(1);
    page.openEditModal(initial);
    let complete: ((value: Record<string, unknown>) => void) | undefined;
    const pending = new Promise<Record<string, unknown>>((resolve) => {
      complete = resolve;
    });
    page.editFormRef.value = form(() => pending);
    const submitting = page.submitEditForm();
    if (change === 'close') page.closeEditModal();
    if (change === 'form') page.editFormRef.value = form(async () => ({}));
    if (change === 'reopen') {
      page.closeEditModal();
      page.openEditModal(initial);
    }
    if (change === 'target') page.openEditModal(record(2));
    if (change === 'cluster') page.filterClusterId.value = 8;
    if (change === 'owner') owner.uid = '2';
    if (change === 'generation') owner.generation++;
    if (!complete) throw new Error('Expected pending form validation');
    complete({});
    await submitting;
    expect(api.updateYamlTask).not.toHaveBeenCalled();
  });

  it.each(['cluster', 'owner', 'generation'])(
    '删除确认期间%s变化不发送旧操作',
    async (change) => {
      const page = useTaskPage();
      page.filterClusterId.value = 7;
      page.deleteTask(record(1));
      if (change === 'cluster') page.filterClusterId.value = 8;
      if (change === 'owner') owner.uid = '2';
      if (change === 'generation') owner.generation++;
      await confirm();
      expect(api.deleteYamlTask).not.toHaveBeenCalled();
    },
  );

  it.each(['success', 'failure'])(
    '前账户迟到的详情%s不恢复旧记录或提示',
    async (outcome) => {
      const page = useTaskPage();
      page.filterClusterId.value = 7;
      let complete: ((value: K8sYamlTask) => void) | undefined;
      let fail: ((reason: Error) => void) | undefined;
      const pending = new Promise<K8sYamlTask>((resolve, reject) => {
        complete = resolve;
        fail = reject;
      });
      api.getYamlTaskDetail.mockReturnValueOnce(pending);
      const loading = page.showTaskDetail(record(1));
      owner.uid = '2';
      if (!complete || !fail)
        throw new Error('Expected pending detail request');
      if (outcome === 'success') complete(record(1));
      else fail(new Error('fixture-private-response'));
      await loading;
      expect(page.currentTaskDetail.value).toBeNull();
      expect(message.error).not.toHaveBeenCalled();
    },
  );

  it.each([
    undefined,
    Number.NaN,
    Infinity,
    -Infinity,
    0,
    -1,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])('持久ID %s 不是正safe整数时任何接口都不调用', async (id) => {
    const page = useTaskPage();
    page.filterClusterId.value = 7;
    await page.showTaskDetail(record(id));
    page.deleteTask(record(id));
    page.openEditModal(record(id));
    page.editFormRef.value = form(async () => ({}));
    await page.submitEditForm();
    page.selectedRows.value = [record(1), record(id)];
    page.batchOperation('删除');
    expect(Modal.confirm).not.toHaveBeenCalled();
    page.openExecuteModal(record(id));
    await page.submitExecuteForm();
    page.openCreateModal();
    page.createFormModel.value.template_id = id;
    page.formRef.value = form(async () => ({}));
    await page.submitCreateForm();
    for (const request of Object.values(api))
      expect(request).not.toHaveBeenCalled();
  });

  it.each(['replace', 'reopen'])(
    '详情%s后旧成功/失败和finally都不能覆盖新请求',
    async (mode) => {
      const page = useTaskPage();
      page.filterClusterId.value = 7;
      let resolveOld: ((value: K8sYamlTask) => void) | undefined;
      let rejectOld: ((reason: Error) => void) | undefined;
      let resolveNew: ((value: K8sYamlTask) => void) | undefined;
      const oldResponse = new Promise<K8sYamlTask>((resolve, reject) => {
        resolveOld = resolve;
        rejectOld = reject;
      });
      const newResponse = new Promise<K8sYamlTask>((resolve) => {
        resolveNew = resolve;
      });
      const initial = record(1);
      api.getYamlTaskDetail
        .mockReturnValueOnce(oldResponse)
        .mockReturnValueOnce(newResponse);
      const oldLoading = page.showTaskDetail(initial);
      if (mode === 'reopen') page.closeDetailModal();
      const next = mode === 'reopen' ? initial : record(2);
      const newLoading = page.showTaskDetail(next);
      expect(page.detailLoading.value).toBe(true);
      if (!resolveOld || !rejectOld || !resolveNew)
        throw new Error('Expected pending detail requests');
      if (mode === 'replace') resolveOld(initial);
      else rejectOld(new Error('fixture-private-old-detail'));
      await oldLoading;
      expect(page.currentTaskDetail.value).toBeNull();
      expect(page.detailLoading.value).toBe(true);
      expect(message.error).not.toHaveBeenCalled();
      resolveNew(next);
      await newLoading;
      expect(page.currentTaskDetail.value).toEqual(next);
      expect(page.detailLoading.value).toBe(false);
    },
  );

  it('新详情已经完成后旧详情迟到也不能覆盖它', async () => {
    const page = useTaskPage();
    page.filterClusterId.value = 7;
    let resolveOld: ((value: K8sYamlTask) => void) | undefined;
    const oldResponse = new Promise<K8sYamlTask>((resolve) => {
      resolveOld = resolve;
    });
    api.getYamlTaskDetail
      .mockReturnValueOnce(oldResponse)
      .mockResolvedValueOnce(record(2));
    const oldLoading = page.showTaskDetail(record(1));
    await page.showTaskDetail(record(2));
    if (!resolveOld) throw new Error('Expected pending old detail');
    resolveOld(record(1));
    await oldLoading;
    expect(page.currentTaskDetail.value?.id).toBe(2);
    expect(page.detailLoading.value).toBe(false);
  });

  it('有效ID保持正常编辑与删除参数', async () => {
    const page = useTaskPage();
    page.filterClusterId.value = 7;
    page.openEditModal(record(12));
    page.editFormRef.value = form(async () => ({}));
    await page.submitEditForm();
    expect(api.updateYamlTask).toHaveBeenCalledWith(
      expect.objectContaining({ cluster_id: 7, id: 12 }),
    );
    page.deleteTask(record(13));
    await confirm();
    expect(api.deleteYamlTask).toHaveBeenCalledWith({ cluster_id: 7, id: 13 });
  });
});

it('任务创建缺少模板ID、执行缺少任务ID时不发请求', async () => {
  const page = useTaskPage();
  page.filterClusterId.value = 7;
  page.openCreateModal();
  page.formRef.value = form(async () => ({}));
  await page.submitCreateForm();
  expect(api.createYamlTask).not.toHaveBeenCalled();
  expect(message.warning).toHaveBeenCalledWith('请选择任务模板');
  page.openExecuteModal(record());
  await page.submitExecuteForm();
  expect(api.applyYamlTask).not.toHaveBeenCalled();
});

describe('yaml Task mutation completion ownership', () => {
  it.each(['success', 'failure'])(
    '旧编辑%s及finally不能关闭重开的表单或清新loading',
    async (outcome) => {
      const page = useTaskPage();
      page.filterClusterId.value = 7;
      const old = deferred<Record<string, unknown>>();
      const next = deferred<Record<string, unknown>>();
      api.updateYamlTask
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(next.promise);
      page.openEditModal(record(1));
      page.editFormRef.value = form(async () => ({}));
      const first = page.submitEditForm();
      await flushPromises();
      page.closeEditModal();
      page.openEditModal(record(2));
      page.editFormRef.value = form(async () => ({}));
      const second = page.submitEditForm();
      await flushPromises();
      expect(page.submitLoading.value).toBe(true);
      if (outcome === 'success') old.resolve({});
      else old.fail(new Error('fixture-private-old-edit'));
      await first;
      expect(page.isEditModalVisible.value).toBe(true);
      expect(page.currentOperationTask.value?.id).toBe(2);
      expect(page.submitLoading.value).toBe(true);
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
      next.resolve({});
      await second;
      expect(page.submitLoading.value).toBe(false);
      expect(page.isEditModalVisible.value).toBe(false);
    },
  );

  it.each(['success', 'failure'])(
    '旧创建%s不关闭新账户创建模态或清新loading',
    async (outcome) => {
      const page = useTaskPage();
      page.filterClusterId.value = 7;
      const old = deferred<Record<string, unknown>>();
      const next = deferred<Record<string, unknown>>();
      api.createYamlTask
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(next.promise);
      page.openCreateModal();
      page.createFormModel.value.name = 'fixture-create';
      page.createFormModel.value.template_id = 1;
      page.formRef.value = form(async () => ({}));
      const first = page.submitCreateForm();
      await flushPromises();
      owner.uid = '2';
      page.closeCreateModal();
      page.openCreateModal();
      page.createFormModel.value.name = 'fixture-create';
      page.createFormModel.value.template_id = 1;
      page.formRef.value = form(async () => ({}));
      const second = page.submitCreateForm();
      await flushPromises();
      expect(page.submitLoading.value).toBe(true);
      if (outcome === 'success') old.resolve({});
      else old.fail(new Error('fixture-private-old-create'));
      await first;
      expect(page.isCreateModalVisible.value).toBe(true);
      expect(page.submitLoading.value).toBe(true);
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
      next.resolve({});
      await second;
      expect(page.submitLoading.value).toBe(false);
      expect(page.isCreateModalVisible.value).toBe(false);
    },
  );

  it('跨创建和编辑模态的共享loading只由当前提交清理', async () => {
    const page = useTaskPage();
    page.filterClusterId.value = 7;
    const old = deferred<Record<string, unknown>>();
    const next = deferred<Record<string, unknown>>();
    api.createYamlTask.mockReturnValueOnce(old.promise);
    api.updateYamlTask.mockReturnValueOnce(next.promise);
    page.openCreateModal();
    page.createFormModel.value.name = 'fixture-create';
    page.createFormModel.value.template_id = 1;
    page.formRef.value = form(async () => ({}));
    const first = page.submitCreateForm();
    await flushPromises();
    page.closeCreateModal();
    page.openEditModal(record(2));
    page.editFormRef.value = form(async () => ({}));
    const second = page.submitEditForm();
    await flushPromises();
    // 旧创建模态的迟到关闭回调也不能复位当前编辑的共享loading。
    page.closeCreateModal();
    expect(page.submitLoading.value).toBe(true);
    old.resolve({});
    await first;
    expect(page.isEditModalVisible.value).toBe(true);
    expect(page.submitLoading.value).toBe(true);
    next.resolve({});
    await second;
    expect(page.submitLoading.value).toBe(false);
  });

  it.each(['owner', 'cluster'])(
    '删除请求失败前%s变化时不向新范围提示或刷新',
    async (change) => {
      const page = useTaskPage();
      page.filterClusterId.value = 7;
      const old = deferred<Record<string, unknown>>();
      api.deleteYamlTask.mockReturnValueOnce(old.promise);
      page.deleteTask(record(1));
      const submitting = confirm();
      await flushPromises();
      if (change === 'owner') owner.uid = '2';
      else page.filterClusterId.value = 8;
      old.fail(new Error('fixture-private-old-delete'));
      await submitting;
      expect(message.error).not.toHaveBeenCalled();
      expect(api.getYamlTaskList).not.toHaveBeenCalled();
    },
  );

  it.each(['rows', 'keys'])(
    '批量确认前替换%s选择不会发送未确认的新行',
    async (change) => {
      const page = useTaskPage();
      page.filterClusterId.value = 7;
      page.selectedRows.value = [record(1), record(2)];
      page.selectedRowKeys.value = [1, 2];
      page.batchOperation('删除');
      if (change === 'rows') page.selectedRows.value = [record(3)];
      page.selectedRowKeys.value = [3];
      await confirm();
      expect(api.deleteYamlTask).not.toHaveBeenCalled();
      expect(page.selectedRowKeys.value).toEqual([3]);
    },
  );

  it.each([
    { count: 1, outcome: 'success' },
    { count: 1, outcome: 'failure' },
    { count: 2, outcome: 'success' },
    { count: 2, outcome: 'failure' },
  ])(
    '批量$count行的旧$outcome不能继续删除或清掉新选择',
    async ({ count, outcome }) => {
      const page = useTaskPage();
      page.filterClusterId.value = 7;
      const old = deferred<Record<string, unknown>>();
      api.deleteYamlTask.mockReturnValueOnce(old.promise);
      page.selectedRows.value = [record(1), record(2)].slice(0, count);
      page.selectedRowKeys.value = [1, 2].slice(0, count);
      page.batchOperation('删除');
      const submitting = confirm();
      await flushPromises();
      expect(api.deleteYamlTask).toHaveBeenCalledTimes(1);
      page.selectedRows.value = [record(3)];
      page.selectedRowKeys.value = [3];
      if (outcome === 'success') old.resolve({});
      else old.fail(new Error('fixture-private-old-batch'));
      await submitting;
      expect(api.deleteYamlTask).toHaveBeenCalledTimes(1);
      expect(api.deleteYamlTask).toHaveBeenCalledWith({ cluster_id: 7, id: 1 });
      expect(page.selectedRowKeys.value).toEqual([3]);
      expect(page.selectedRows.value.map((item) => item.id)).toEqual([3]);
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
      expect(api.getYamlTaskList).not.toHaveBeenCalled();
    },
  );
});

it.each(['success', 'failure'])(
  '相同记录的旧执行%s不关闭重开后的新执行或清loading',
  async (outcome) => {
    const page = useTaskPage();
    page.filterClusterId.value = 7;
    const target = record(1);
    const old = deferred<Record<string, unknown>>();
    const next = deferred<Record<string, unknown>>();
    api.applyYamlTask
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise);
    page.openExecuteModal(target);
    const first = page.submitExecuteForm();
    page.closeExecuteModal();
    page.openExecuteModal(target);
    const second = page.submitExecuteForm();
    if (outcome === 'success') old.resolve({});
    else old.fail(new Error('fixture-private-old-execution'));
    await first;
    expect(page.isExecuteModalVisible.value).toBe(true);
    expect(page.executeLoading.value).toBe(true);
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    next.resolve({});
    await second;
    expect(page.isExecuteModalVisible.value).toBe(false);
    expect(page.executeLoading.value).toBe(false);
  },
);
