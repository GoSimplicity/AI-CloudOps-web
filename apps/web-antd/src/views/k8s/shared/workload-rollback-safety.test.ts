import type { useDaemonSetPage } from '../daemonset/DaemonSet';
import type { useDeploymentPage } from '../deployment/Deployment';
import type { useStatefulSetPage } from '../statefulset/StatefulSet';

import { reactive } from 'vue';

import { flushPromises, mount } from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DaemonSet from '../daemonset/DaemonSet.vue';
import Deployment from '../deployment/Deployment.vue';
import StatefulSet from '../statefulset/StatefulSet.vue';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const captured = vi.hoisted(() => ({
  daemon: undefined as ReturnType<typeof useDaemonSetPage> | undefined,
  deployment: undefined as ReturnType<typeof useDeploymentPage> | undefined,
  generation: 0,
  owner: { uid: '1' },
  revision: 2 as unknown,
  stateful: undefined as ReturnType<typeof useStatefulSetPage> | undefined,
}));
vi.mock('#/api/request', () => ({ requestClient: api }));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: captured.owner.uid } }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => captured.generation }),
}));
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({ can: () => true }),
}));
// 包装真实业务 composable，只取得页面状态控制夹具，不替换其历史读取或关闭行为。
vi.mock('../daemonset/DaemonSet', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../daemonset/DaemonSet')>();
  return {
    ...original,
    useDaemonSetPage: () => {
      const page = original.useDaemonSetPage();
      captured.daemon = page;
      return page;
    },
  };
});
vi.mock('../deployment/Deployment', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../deployment/Deployment')>();
  return {
    ...original,
    useDeploymentPage: () => {
      const page = original.useDeploymentPage();
      captured.deployment = page;
      return page;
    },
  };
});
vi.mock('../statefulset/StatefulSet', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../statefulset/StatefulSet')>();
  return {
    ...original,
    useStatefulSetPage: () => {
      const page = original.useStatefulSetPage();
      captured.stateful = page;
      return page;
    },
  };
});

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Expected rollback fixture');
  return value;
}

function resource(name = 'owned-workload') {
  return {
    available_replicas: 1,
    cluster_id: 7,
    created_at: '',
    current_number_scheduled: 1,
    current_replicas: 1,
    desired_number_scheduled: 1,
    name,
    namespace: 'owned-namespace',
    number_available: 1,
    number_misscheduled: 0,
    number_ready: 1,
    number_unavailable: 0,
    ready_replicas: 1,
    replicas: 1,
    service_name: 'headless',
    status: 1 as const,
    uid: `resource-${name}`,
    updated_at: '',
    updated_number_scheduled: 1,
    updated_replicas: 1,
  };
}

const cases = [
  {
    component: DaemonSet,
    kind: 'daemonset',
    label: 'DaemonSet',
    page() {
      const page = required(captured.daemon);
      return {
        close: page.closeHistoryModal,
        cluster: page.filterClusterId,
        history: page.daemonSetHistory,
        historyLoading: page.historyLoading,
        isHistoryCurrent: page.isHistoryCurrent,
        namespace: page.filterNamespace,
        open: (name?: string, invalid?: Record<string, unknown>) => {
          const record = resource(name);
          Object.assign(record, invalid);
          return page.showHistoryModal(record);
        },
        target: page.currentOperationDaemonSet,
        visible: page.isHistoryModalVisible,
      };
    },
  },
  {
    component: StatefulSet,
    kind: 'statefulset',
    label: 'StatefulSet',
    page() {
      const page = required(captured.stateful);
      return {
        close: page.closeHistoryModal,
        cluster: page.filterClusterId,
        history: page.statefulSetHistory,
        historyLoading: page.historyLoading,
        isHistoryCurrent: page.isHistoryCurrent,
        namespace: page.filterNamespace,
        open: (name?: string, invalid?: Record<string, unknown>) => {
          const record = resource(name);
          Object.assign(record, invalid);
          return page.showHistoryModal(record);
        },
        target: page.currentOperationStatefulSet,
        visible: page.isHistoryModalVisible,
      };
    },
  },
  {
    component: Deployment,
    kind: 'deployment',
    label: 'Deployment',
    page() {
      const page = required(captured.deployment);
      return {
        close: page.closeHistoryModal,
        cluster: page.filterClusterId,
        history: page.deploymentHistory,
        historyLoading: page.historyLoading,
        isHistoryCurrent: page.isHistoryCurrent,
        namespace: page.filterNamespace,
        open: (name?: string, invalid?: Record<string, unknown>) => {
          const record = resource(name);
          Object.assign(record, invalid);
          return page.showHistoryModal(record);
        },
        target: page.currentOperationDeployment,
        visible: page.isHistoryModalVisible,
      };
    },
  },
];

const wrappers: ReturnType<typeof mount>[] = [];
const unsafeSegments = [
  ...['/', '\\', '?', '#', '%'].map((character) => `part${character}rest`),
  ...Array.from(
    { length: 33 },
    (_, code) => `part${String.fromCodePoint(code)}rest`,
  ),
  `part${String.fromCodePoint(127)}rest`,
  '.',
  '..',
];
function deferred() {
  let resolve: ((value: object) => void) | undefined;
  let reject: ((error: Error) => void) | undefined;
  const promise = new Promise<object>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return {
    fail(error: Error) {
      required(reject)(error);
    },
    promise,
    resolve(value: object = {}) {
      required(resolve)(value);
    },
  };
}

function confirmation(index = -1) {
  return required(vi.mocked(Modal.confirm).mock.calls.at(index)?.[0]);
}

async function accept(index = -1) {
  const onOk = confirmation(index).onOk;
  if (typeof onOk !== 'function')
    throw new Error('Expected confirmation callback');
  await onOk(() => {});
}

beforeEach(() => {
  vi.resetAllMocks();
  captured.generation = 0;
  captured.owner = reactive({ uid: '1' });
  captured.revision = 2;
  captured.daemon = undefined;
  captured.deployment = undefined;
  captured.stateful = undefined;
  api.get.mockImplementation(async (path: string) =>
    path.endsWith('/history')
      ? {
          items: [
            {
              date: '',
              message: 'offline-fixture',
              revision: captured.revision,
            },
          ],
        }
      : { total: 0, items: [] },
  );
  api.post.mockResolvedValue({});
  vi.spyOn(Modal, 'confirm').mockImplementation(() => ({
    destroy: vi.fn(),
    update: vi.fn(),
  }));
  vi.spyOn(message, 'success');
  vi.spyOn(message, 'error');
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
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  message.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

for (const testCase of cases) {
  describe(`${testCase.label} 历史回滚确认的会话和目标隔离`, () => {
    async function start() {
      const wrapper = mount(testCase.component, {
        attachTo: document.body,
        global: {
          plugins: [Antd],
          stubs: { Icon: true, OpsPage: { template: '<div><slot /></div>' } },
        },
      });
      wrappers.push(wrapper);
      await flushPromises();
      const page = testCase.page();
      page.cluster.value = 7;
      page.namespace.value = 'owned-namespace';
      await page.open();
      await flushPromises();
      return { page, wrapper };
    }

    async function requestConfirmation() {
      const button = [
        ...document.querySelectorAll<HTMLButtonElement>('button'),
      ].find((item) => item.textContent?.trim() === '回滚到此版本');
      required(button).click();
      await flushPromises();
    }

    it('正常确认只发送捕获的目标及原API合同；重复onOk不会重复提交', async () => {
      const { page } = await start();
      await requestConfirmation();
      expect(confirmation().content).toContain('owned-workload');
      await accept();
      await accept();
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.post).toHaveBeenCalledWith(
        `/k8s/${testCase.kind}/7/owned-namespace/owned-workload/rollback`,
        testCase.kind === 'deployment'
          ? { revision: 2 }
          : {
              cluster_id: 7,
              name: 'owned-workload',
              namespace: 'owned-namespace',
              revision: 2,
            },
      );
      expect(message.success).toHaveBeenCalledWith(
        `${testCase.label} 回滚到版本 2 成功`,
      );
      expect(page.visible.value).toBe(false);
      expect(
        api.get.mock.calls.some(
          ([path]) => path === `/k8s/${testCase.kind}/7/list`,
        ),
      ).toBe(true);
    });

    it.each([
      'target',
      'cluster',
      'namespace',
      'close-reopen',
      'owner',
      'same-user-login',
      'owner-away-back',
      'unmount',
    ])('%s后旧确认不得外发', async (change) => {
      const { page, wrapper } = await start();
      await requestConfirmation();
      if (change === 'target') await page.open('other-workload');
      if (change === 'cluster') page.cluster.value = 8;
      if (change === 'namespace') page.namespace.value = 'other-namespace';
      if (change === 'close-reopen') {
        page.close();
        await page.open();
      }
      if (change === 'owner') captured.owner.uid = '2';
      if (change === 'same-user-login') captured.generation++;
      if (change === 'owner-away-back') {
        captured.owner.uid = '2';
        captured.owner.uid = '1';
      }
      if (change === 'unmount') wrapper.unmount();
      await accept();
      expect(api.post).not.toHaveBeenCalled();
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
    });

    it.each(['success', 'failure'])(
      '回滚在途时换目标后旧%s不关闭新history或刷新新列表',
      async (outcome) => {
        const { page } = await start();
        const pending = deferred();
        api.post.mockReturnValueOnce(pending.promise);
        await requestConfirmation();
        const submitting = accept();
        await page.open('other-workload');
        await flushPromises();
        const reads = api.get.mock.calls.length;
        if (outcome === 'success') pending.resolve();
        else pending.fail(new Error('private-server-fixture'));
        await submitting;
        expect(page.visible.value).toBe(true);
        expect(page.target.value?.name).toBe('other-workload');
        expect(api.get).toHaveBeenCalledTimes(reads);
        expect(message.success).not.toHaveBeenCalled();
        expect(message.error).not.toHaveBeenCalled();
      },
    );

    it.each(['success', 'failure'])(
      '回滚在途同资源关闭再打开，旧%s仍不能关闭新窗口',
      async (outcome) => {
        const { page } = await start();
        const pending = deferred();
        api.post.mockReturnValueOnce(pending.promise);
        await requestConfirmation();
        const submitting = accept();
        page.close();
        await page.open();
        const reads = api.get.mock.calls.length;
        if (outcome === 'success') pending.resolve();
        else pending.fail(new Error('private-server-fixture'));
        await submitting;
        expect(page.visible.value).toBe(true);
        expect(api.get).toHaveBeenCalledTimes(reads);
        expect(message.success).not.toHaveBeenCalled();
        expect(message.error).not.toHaveBeenCalled();
      },
    );

    it.each(['owner', 'same-user-login'])(
      '回滚在途%s变化后旧回执静默',
      async (change) => {
        const { page } = await start();
        const pending = deferred();
        api.post.mockReturnValueOnce(pending.promise);
        await requestConfirmation();
        const submitting = accept();
        if (change === 'owner') captured.owner.uid = '2';
        else captured.generation++;
        const reads = api.get.mock.calls.length;
        pending.resolve();
        await submitting;
        expect(page.visible.value).toBe(change !== 'owner');
        expect(api.get).toHaveBeenCalledTimes(reads);
        expect(message.success).not.toHaveBeenCalled();
        expect(message.error).not.toHaveBeenCalled();
      },
    );

    it('新确认替代旧确认，取消后保留的旧回调同样拒绝', async () => {
      await start();
      await requestConfirmation();
      await requestConfirmation();
      await accept(0);
      expect(api.post).not.toHaveBeenCalled();
      const onCancel = confirmation().onCancel;
      if (typeof onCancel !== 'function')
        throw new Error('Expected cancel callback');
      await onCancel(() => {});
      await accept();
      expect(api.post).not.toHaveBeenCalled();
    });

    it.each([
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      '2',
      null,
    ])('非法revision %s不创建确认也不外发', async (revision) => {
      captured.revision = revision;
      await start();
      await requestConfirmation();
      expect(Modal.confirm).not.toHaveBeenCalled();
      expect(api.post).not.toHaveBeenCalled();
    });

    it.each([
      { cluster_id: 0 },
      { cluster_id: -7 },
      { cluster_id: 1.5 },
      { namespace: '' },
      { name: ' ' },
      { namespace: undefined },
      { name: null },
    ])('非法目标%j不借用筛选冒认目标', async (invalid) => {
      const { page } = await start();
      const button = required(
        [...document.querySelectorAll<HTMLButtonElement>('button')].find(
          (item) => item.textContent?.trim() === '回滚到此版本',
        ),
      );
      Object.assign(required(page.target.value), invalid);
      button.click();
      await flushPromises();
      expect(Modal.confirm).not.toHaveBeenCalled();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('当前操作失败仍使用既有固定提示且不带服务原错', async () => {
      await start();
      api.post.mockRejectedValueOnce(new Error('private-server-fixture'));
      await requestConfirmation();
      await accept();
      expect(message.error).toHaveBeenCalledTimes(1);
      expect(message.error).toHaveBeenCalledWith(
        `${testCase.label} 回滚到版本 2 失败`,
      );
      expect(message.success).not.toHaveBeenCalled();
    });

    it('新history读取中旧success/finally不得塞回旧revision或清新loading', async () => {
      const { page } = await start();
      const old = deferred();
      const latest = deferred();
      api.get
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(latest.promise);
      const first = page.open('old-workload');
      const second = page.open('new-workload');
      expect(page.history.value).toEqual([]);
      expect(page.historyLoading.value).toBe(true);
      old.resolve({
        items: [{ date: '', message: 'old-history', revision: 3 }],
      });
      await first;
      expect(page.history.value).toEqual([]);
      expect(page.historyLoading.value).toBe(true);
      expect(page.visible.value).toBe(false);
      latest.resolve({
        items: [{ date: '', message: 'new-history', revision: 9 }],
      });
      await second;
      await flushPromises();
      expect(page.history.value.map((item) => item.revision)).toEqual([9]);
      expect(page.historyLoading.value).toBe(false);
      await requestConfirmation();
      await accept();
      expect(api.post).toHaveBeenCalledWith(
        `/k8s/${testCase.kind}/7/owned-namespace/new-workload/rollback`,
        testCase.kind === 'deployment'
          ? { revision: 9 }
          : {
              cluster_id: 7,
              name: 'new-workload',
              namespace: 'owned-namespace',
              revision: 9,
            },
      );
    });

    it.each(['success', 'failure'])(
      '新history已显示后旧读取%s不覆盖新revision或目标',
      async (outcome) => {
        const { page } = await start();
        const old = deferred();
        const latest = deferred();
        api.get
          .mockReturnValueOnce(old.promise)
          .mockReturnValueOnce(latest.promise);
        const first = page.open('old-workload');
        const second = page.open('new-workload');
        latest.resolve({
          items: [{ date: '', message: 'new-history', revision: 9 }],
        });
        await second;
        if (outcome === 'success')
          old.resolve({
            items: [{ date: '', message: 'old-history', revision: 3 }],
          });
        else old.fail(new Error('private-history-fixture'));
        await first;
        expect(page.history.value.map((item) => item.revision)).toEqual([9]);
        expect(page.target.value?.name).toBe('new-workload');
        expect(page.isHistoryCurrent()).toBe(true);
        expect(page.historyLoading.value).toBe(false);
        expect(message.error).not.toHaveBeenCalled();
      },
    );

    it.each(['close-reopen', 'same-user-login', 'owner'])(
      'history读取%s后同名新窗口不认领旧revision',
      async (change) => {
        const { page } = await start();
        const old = deferred();
        const latest = deferred();
        api.get
          .mockReturnValueOnce(old.promise)
          .mockReturnValueOnce(latest.promise);
        const first = page.open();
        if (change === 'close-reopen') page.close();
        if (change === 'same-user-login') captured.generation++;
        if (change === 'owner') captured.owner.uid = '2';
        const second = page.open();
        old.resolve({
          items: [{ date: '', message: 'old-history', revision: 3 }],
        });
        await first;
        expect(page.history.value).toEqual([]);
        expect(page.historyLoading.value).toBe(true);
        expect(page.visible.value).toBe(false);
        latest.resolve({
          items: [{ date: '', message: 'new-history', revision: 9 }],
        });
        await second;
        expect(page.history.value.map((item) => item.revision)).toEqual([9]);
        expect(page.isHistoryCurrent()).toBe(true);
      },
    );

    it.each([
      'close',
      'unmount',
      'cluster',
      'namespace',
      'owner',
      'same-user-login',
    ])('history读取中%s后旧结果不再打开窗口', async (change) => {
      const { page, wrapper } = await start();
      const old = deferred();
      api.get.mockReturnValueOnce(old.promise);
      const first = page.open();
      if (change === 'close') page.close();
      if (change === 'unmount') wrapper.unmount();
      if (change === 'cluster') page.cluster.value = 8;
      if (change === 'namespace') page.namespace.value = 'other-namespace';
      if (change === 'owner') captured.owner.uid = '2';
      if (change === 'same-user-login') captured.generation++;
      old.resolve({
        items: [{ date: '', message: 'old-history', revision: 3 }],
      });
      await first;
      expect(page.history.value).toEqual([]);
      expect(page.visible.value).toBe(false);
      expect(page.isHistoryCurrent()).toBe(false);
      expect(message.error).not.toHaveBeenCalled();
    });

    it('同UID重登后旧已加载history不能开启一次新的回滚确认', async () => {
      const { page } = await start();
      captured.generation++;
      await requestConfirmation();
      expect(page.isHistoryCurrent()).toBe(false);
      expect(Modal.confirm).not.toHaveBeenCalled();
      expect(api.post).not.toHaveBeenCalled();
    });

    it.each([
      { cluster_id: 0 },
      { cluster_id: Number.NaN },
      { cluster_id: '7' },
      { namespace: '' },
      { name: null },
    ])('非法history目标%j也不发读取请求', async (invalid) => {
      const { page } = await start();
      api.get.mockClear();
      await page.open('invalid-workload', invalid);
      expect(api.get).not.toHaveBeenCalled();
      expect(page.target.value?.name).toBe('owned-workload');
    });

    it.each(
      unsafeSegments.flatMap((value) =>
        ['name', 'namespace'].map((field) => ({ field, value })),
      ),
    )(
      '不安全路径段%j不能读取历史，也不能由旧DOM事件触发回滚',
      async ({ field, value }) => {
        const { page } = await start();
        const button = required(
          [...document.querySelectorAll<HTMLButtonElement>('button')].find(
            (item) => item.textContent?.trim() === '回滚到此版本',
          ),
        );
        api.get.mockClear();
        await page.open('unsafe-workload', { [field]: value });
        expect(api.get).not.toHaveBeenCalled();
        Object.assign(required(page.target.value), { [field]: value });
        button.click();
        await flushPromises();
        expect(Modal.confirm).not.toHaveBeenCalled();
        expect(api.post).not.toHaveBeenCalled();
        expect(message.error).toHaveBeenCalledWith(
          '回滚目标或版本无效，请重新打开版本历史后重试',
        );
        expect(
          vi
            .mocked(message.error)
            .mock.calls.every(
              ([text]) =>
                text === '回滚目标或版本无效，请重新打开版本历史后重试',
            ),
        ).toBe(true);
      },
    );

    it('正常点号和横线名称保持原样进入读取和回滚路径', async () => {
      const { page } = await start();
      page.namespace.value = 'team-x';
      await page.open('worker.app-v2', { namespace: 'team-x' });
      await flushPromises();
      expect(api.get).toHaveBeenCalledWith(
        `/k8s/${testCase.kind}/7/team-x/worker.app-v2/history`,
      );
      await requestConfirmation();
      await accept();
      expect(api.post).toHaveBeenCalledWith(
        `/k8s/${testCase.kind}/7/team-x/worker.app-v2/rollback`,
        testCase.kind === 'deployment'
          ? { revision: 2 }
          : {
              cluster_id: 7,
              name: 'worker.app-v2',
              namespace: 'team-x',
              revision: 2,
            },
      );
    });
  });
}
