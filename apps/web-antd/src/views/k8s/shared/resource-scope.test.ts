import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStatefulSetPage } from '../statefulset/StatefulSet';
import { useDaemonSetPage } from '../daemonset/DaemonSet';
import { useIngressPage } from '../ingress/Ingress';
import { useSecretPage } from '../secret/Secret';
import { usePVCPage } from '../pvc/PVC';
import { useRolePage } from '../role/Role';
import { useRoleBindingPage } from '../rolebinding/RoleBinding';
import { useNodePage } from '../node/Node';
import { usePVPage } from '../pv/PV';
import { useClusterRoleBindingPage } from '../clusterrolebinding/ClusterRoleBinding';
import { useTaskPage } from '../task/Task';
import { useTemplatePage } from '../template/Template';

const client = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('ant-design-vue', () => ({
  message: { error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  Modal: { confirm: vi.fn() },
}));
const cases = [
  {
    name: 'YAML任务',
    create: () => {
      const state = useTaskPage();
      return {
        state,
        namespace: undefined,
        items: state.tasks,
        fetch: state.fetchTasks,
        clear: state.clearTasks,
      };
    },
  },
  {
    name: 'YAML模板',
    create: () => {
      const state = useTemplatePage();
      return {
        state,
        namespace: undefined,
        items: state.templates,
        fetch: state.fetchTemplates,
        clear: state.clearTemplates,
      };
    },
  },
  {
    name: 'StatefulSet',
    create: () => {
      const state = useStatefulSetPage();
      return {
        state,
        namespace: state.filterNamespace,
        items: state.statefulSets,
        fetch: state.fetchStatefulSets,
        clear: state.clearStatefulSets,
      };
    },
  },
  {
    name: 'DaemonSet',
    create: () => {
      const state = useDaemonSetPage();
      return {
        state,
        namespace: state.filterNamespace,
        items: state.daemonSets,
        fetch: state.fetchDaemonSets,
        clear: state.clearDaemonSets,
      };
    },
  },
  {
    name: 'Ingress',
    create: () => {
      const state = useIngressPage();
      return {
        state,
        namespace: state.filterNamespace,
        items: state.ingresses,
        fetch: state.fetchIngresses,
        clear: state.clearIngresses,
      };
    },
  },
  {
    name: 'Secret',
    create: () => {
      const state = useSecretPage();
      return {
        state,
        namespace: state.filterNamespace,
        items: state.secrets,
        fetch: state.fetchSecrets,
        clear: state.clearSecrets,
      };
    },
  },
  {
    name: 'PVC',
    create: () => {
      const state = usePVCPage();
      return {
        state,
        namespace: state.filterNamespace,
        items: state.pvcs,
        fetch: state.fetchPVCs,
        clear: state.clearPVCs,
      };
    },
  },
  {
    name: 'Role',
    create: () => {
      const state = useRolePage();
      return {
        state,
        namespace: state.filterNamespace,
        items: state.roles,
        fetch: state.fetchRoles,
        clear: state.clearRoles,
      };
    },
  },
  {
    name: 'RoleBinding',
    create: () => {
      const state = useRoleBindingPage();
      return {
        state,
        namespace: state.filterNamespace,
        items: state.roleBindings,
        fetch: state.fetchRoleBindings,
        clear: state.clearRoleBindings,
      };
    },
  },
  {
    name: 'Node',
    create: () => {
      const state = useNodePage();
      return {
        state,
        namespace: undefined,
        items: state.nodes,
        fetch: state.fetchNodes,
        clear: state.clearNodes,
      };
    },
  },
  {
    name: 'PV',
    create: () => {
      const state = usePVPage();
      return {
        state,
        namespace: undefined,
        items: state.pvs,
        fetch: state.fetchPVs,
        clear: state.clearPVs,
      };
    },
  },
  {
    name: 'ClusterRoleBinding',
    create: () => {
      const state = useClusterRoleBindingPage();
      return {
        state,
        namespace: undefined,
        items: state.clusterRoleBindings,
        fetch: state.fetchClusterRoleBindings,
        clear: state.clearClusterRoleBindings,
      };
    },
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
        const old = Promise.withResolvers<{
          items: { cluster_id: number; name: string; namespace: string }[];
          total: number;
        }>();
        client.get.mockReturnValueOnce(old.promise);
        const pending = page.fetch();
        page.state.filterClusterId.value = 2;
        if (page.namespace) page.namespace.value = 'beta';
        client.get.mockResolvedValueOnce({
          items: [{ name: 'current', namespace: 'beta', cluster_id: 2 }],
          total: 1,
        });
        await page.fetch();
        if (outcome === 'failure') old.reject(new Error('stale failure'));
        else
          old.resolve({
            items: [{ name: 'old', namespace: 'alpha', cluster_id: 1 }],
            total: 1,
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
        items: [{ name: 'old', namespace: 'alpha', cluster_id: 1 }],
        total: 1,
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
        items: [{ name: 'recovered', namespace: 'alpha', cluster_id: 1 }],
        total: 1,
      });
      await page.fetch();
      expect(page.items.value.map((item) => item.name)).toEqual(['recovered']);
      expect(page.state.loadError.value).toBe('');
    });
    it('清空集群后待返回请求不能重新显示旧数据', async () => {
      const page = testCase.create();
      page.state.filterClusterId.value = 1;
      const old = Promise.withResolvers<{
        items: { cluster_id: number; name: string; namespace: string }[];
        total: number;
      }>();
      client.get.mockReturnValueOnce(old.promise);
      const pending = page.fetch();
      page.state.filterClusterId.value = undefined;
      page.clear();
      old.resolve({
        items: [{ name: 'old', namespace: 'alpha', cluster_id: 1 }],
        total: 1,
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
    const old = Promise.withResolvers<{
      items: { id: number; name: string }[];
      total: number;
    }>();
    client.get.mockReturnValueOnce(old.promise);
    const pending = state.fetchTemplates(true);
    state.filterClusterId.value = 2;
    state.clearTemplates();
    client.get.mockResolvedValueOnce({
      items: [{ id: 2, name: 'current' }],
      total: 1,
    });
    await state.fetchTemplates(true);
    old.resolve({ items: [{ id: 1, name: 'old' }], total: 1 });
    await pending;
    expect(state.templates.value.map((item) => item.name)).toEqual(['current']);
    expect(state.templatesLoading.value).toBe(false);
  });
});

it('yAML 任务名称搜索按真实 name 参数发送', async () => {
  const state = useTaskPage();
  state.filterClusterId.value = 1;
  state.searchText.value = 'task-name';
  client.get.mockResolvedValue({ items: [], total: 0 });
  await state.fetchTasks();
  expect(client.get).toHaveBeenLastCalledWith('/k8s/yaml_task/1/list', {
    params: expect.objectContaining({ name: 'task-name' }),
  });
});
