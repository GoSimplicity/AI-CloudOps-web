import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDeferred } from '../../../../../../internal/test-utils/deferred';
import { useClusterRoleBindingPage } from '../clusterrolebinding/ClusterRoleBinding';
import { useDaemonSetPage } from '../daemonset/DaemonSet';
import { useIngressPage } from '../ingress/Ingress';
import { useNodePage } from '../node/Node';
import { usePVPage } from '../pv/PV';
import { usePVCPage } from '../pvc/PVC';
import { useRolePage } from '../role/Role';
import { useRoleBindingPage } from '../rolebinding/RoleBinding';
import { useSecretPage } from '../secret/Secret';
import { useStatefulSetPage } from '../statefulset/StatefulSet';
import { useTaskPage } from '../task/Task';
import { useTemplatePage } from '../template/Template';

const client = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('ant-design-vue', () => ({
  message: { error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  Modal: { confirm: vi.fn() },
}));
const cases = [
  {
    create: () => {
      const state = useTaskPage();
      return {
        clear: state.clearTasks,
        fetch: state.fetchTasks,
        namespace: undefined,
        state,
        items: state.tasks,
      };
    },
    name: 'YAML任务',
  },
  {
    create: () => {
      const state = useTemplatePage();
      return {
        clear: state.clearTemplates,
        fetch: state.fetchTemplates,
        namespace: undefined,
        state,
        items: state.templates,
      };
    },
    name: 'YAML模板',
  },
  {
    create: () => {
      const state = useStatefulSetPage();
      return {
        clear: state.clearStatefulSets,
        fetch: state.fetchStatefulSets,
        namespace: state.filterNamespace,
        state,
        items: state.statefulSets,
      };
    },
    name: 'StatefulSet',
  },
  {
    create: () => {
      const state = useDaemonSetPage();
      return {
        clear: state.clearDaemonSets,
        fetch: state.fetchDaemonSets,
        namespace: state.filterNamespace,
        state,
        items: state.daemonSets,
      };
    },
    name: 'DaemonSet',
  },
  {
    create: () => {
      const state = useIngressPage();
      return {
        clear: state.clearIngresses,
        fetch: state.fetchIngresses,
        namespace: state.filterNamespace,
        state,
        items: state.ingresses,
      };
    },
    name: 'Ingress',
  },
  {
    create: () => {
      const state = useSecretPage();
      return {
        clear: state.clearSecrets,
        fetch: state.fetchSecrets,
        namespace: state.filterNamespace,
        state,
        items: state.secrets,
      };
    },
    name: 'Secret',
  },
  {
    create: () => {
      const state = usePVCPage();
      return {
        clear: state.clearPVCs,
        fetch: state.fetchPVCs,
        namespace: state.filterNamespace,
        state,
        items: state.pvcs,
      };
    },
    name: 'PVC',
  },
  {
    create: () => {
      const state = useRolePage();
      return {
        clear: state.clearRoles,
        fetch: state.fetchRoles,
        namespace: state.filterNamespace,
        state,
        items: state.roles,
      };
    },
    name: 'Role',
  },
  {
    create: () => {
      const state = useRoleBindingPage();
      return {
        clear: state.clearRoleBindings,
        fetch: state.fetchRoleBindings,
        namespace: state.filterNamespace,
        state,
        items: state.roleBindings,
      };
    },
    name: 'RoleBinding',
  },
  {
    create: () => {
      const state = useNodePage();
      return {
        clear: state.clearNodes,
        fetch: state.fetchNodes,
        namespace: undefined,
        state,
        items: state.nodes,
      };
    },
    name: 'Node',
  },
  {
    create: () => {
      const state = usePVPage();
      return {
        clear: state.clearPVs,
        fetch: state.fetchPVs,
        namespace: undefined,
        state,
        items: state.pvs,
      };
    },
    name: 'PV',
  },
  {
    create: () => {
      const state = useClusterRoleBindingPage();
      return {
        clear: state.clearClusterRoleBindings,
        fetch: state.fetchClusterRoleBindings,
        namespace: undefined,
        state,
        items: state.clusterRoleBindings,
      };
    },
    name: 'ClusterRoleBinding',
  },
];
beforeEach(() => vi.clearAllMocks());
for (const testCase of cases) {
  describe(`${testCase.name} 资源查询边界`, () => {
    it.each(['success', 'failure'])(
      '旧集群迟到 %s 不覆盖当前资源',
      async (outcome) => {
        const page = testCase.create();
        page.state.filterClusterId.value = 1;
        if (page.namespace) page.namespace.value = 'alpha';
        const old = createDeferred<{
          items: { cluster_id: number; name: string; namespace: string }[];
          total: number;
        }>();
        client.get.mockReturnValueOnce(old.promise);
        const pending = page.fetch();
        page.state.filterClusterId.value = 2;
        if (page.namespace) page.namespace.value = 'beta';
        client.get.mockResolvedValueOnce({
          total: 1,
          items: [{ cluster_id: 2, name: 'current', namespace: 'beta' }],
        });
        await page.fetch();
        if (outcome === 'failure') old.reject(new Error('stale failure'));
        else
          old.resolve({
            total: 1,
            items: [{ cluster_id: 1, name: 'old', namespace: 'alpha' }],
          });
        await pending;
        expect(page.items.value.map((item) => item.name)).toEqual(['current']);
        expect(page.state.loadError.value).toBe('');
      },
    );
    it('失败清空旧资源和选择，重试能够恢复', async () => {
      const page = testCase.create();
      page.state.filterClusterId.value = 1;
      client.get.mockResolvedValueOnce({
        total: 1,
        items: [{ cluster_id: 1, name: 'old', namespace: 'alpha' }],
      });
      await page.fetch();
      page.state.rowSelection.value.onChange(['old'], []);
      client.get.mockRejectedValueOnce(new Error('failed'));
      await page.fetch();
      expect(page.items.value).toEqual([]);
      expect(page.state.total.value).toBe(0);
      expect(page.state.rowSelection.value.selectedRowKeys).toEqual([]);
      expect(page.state.loadError.value).toContain('重试');
      expect(page.state.loading.value).toBe(false);
      client.get.mockResolvedValueOnce({
        total: 1,
        items: [{ cluster_id: 1, name: 'recovered', namespace: 'alpha' }],
      });
      await page.fetch();
      expect(page.items.value.map((item) => item.name)).toEqual(['recovered']);
      expect(page.state.loadError.value).toBe('');
    });
    it('清空集群后待返回请求不能重新显示旧数据', async () => {
      const page = testCase.create();
      page.state.filterClusterId.value = 1;
      const old = createDeferred<{
        items: { cluster_id: number; name: string; namespace: string }[];
        total: number;
      }>();
      client.get.mockReturnValueOnce(old.promise);
      const pending = page.fetch();
      page.state.filterClusterId.value = undefined;
      page.clear();
      old.resolve({
        total: 1,
        items: [{ cluster_id: 1, name: 'old', namespace: 'alpha' }],
      });
      await pending;
      expect(page.items.value).toEqual([]);
      expect(page.state.total.value).toBe(0);
      expect(page.state.loading.value).toBe(false);
    });
  });
}

describe('yAML 模板目录隔离', () => {
  it('切换集群后迟到目录不能污染新任务的模板选择', async () => {
    const state = useTaskPage();
    state.filterClusterId.value = 1;
    const old = createDeferred<{
      items: { id: number; name: string }[];
      total: number;
    }>();
    client.get.mockReturnValueOnce(old.promise);
    const pending = state.fetchTemplates(true);
    state.filterClusterId.value = 2;
    state.clearTemplates();
    client.get.mockResolvedValueOnce({
      total: 1,
      items: [{ id: 2, name: 'current' }],
    });
    await state.fetchTemplates(true);
    old.resolve({ total: 1, items: [{ id: 1, name: 'old' }] });
    await pending;
    expect(state.templates.value.map((item) => item.name)).toEqual(['current']);
    expect(state.templatesLoading.value).toBe(false);
  });
});

it('yAML 任务名称搜索按真实 name 参数发送', async () => {
  const state = useTaskPage();
  state.filterClusterId.value = 1;
  state.searchText.value = 'task-name';
  client.get.mockResolvedValue({ total: 0, items: [] });
  await state.fetchTasks();
  expect(client.get).toHaveBeenLastCalledWith('/k8s/yaml_task/1/list', {
    params: expect.objectContaining({ name: 'task-name' }),
  });
});
