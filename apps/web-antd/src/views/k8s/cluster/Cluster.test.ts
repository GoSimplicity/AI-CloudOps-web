import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClusterPage } from './Cluster';

const client = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('ant-design-vue', () => ({
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  Modal: { confirm: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('集群列表恢复与编辑保护', () => {
  it('查询失败清除旧列表和选择，成功重试后恢复', async () => {
    const page = useClusterPage();
    page.clusters.value = [
      { id: 1, name: 'example', restrict_namespace: [], status: 1 },
    ];
    page.selectedRowKeys.value = [1];
    page.total.value = 1;
    client.get.mockRejectedValueOnce(new Error('unavailable'));
    await page.fetchClusters();
    expect(page.clusters.value).toEqual([]);
    expect(page.selectedRowKeys.value).toEqual([]);
    expect(page.total.value).toBe(0);
    expect(page.loadError.value).not.toBe('');
    client.get.mockResolvedValueOnce({ items: [], total: 0 });
    await page.fetchClusters();
    expect(page.loadError.value).toBe('');
  });

  it('详情加载失败不允许提交不完整的集群配置', async () => {
    const page = useClusterPage();
    client.get.mockRejectedValueOnce(new Error('unavailable'));
    await page.openEdit({
      id: 1,
      name: 'example',
      restrict_namespace: [],
      status: 1,
    });
    expect(page.isModalVisible.value).toBe(false);
    expect(page.editDetailLoading.value).toBe(false);
  });
});

const SECRET = 'client-key-data: LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tFAKE';

describe('kubeconfig 不在前端回显（P1 安全）', () => {
  it('列表即使收到旧后端的原文，也只保留 has_kube_config', async () => {
    const page = useClusterPage();
    client.get.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          name: 'legacy',
          restrict_namespace: [],
          status: 1,
          kube_config_content: SECRET,
        },
        {
          id: 2,
          name: 'new',
          restrict_namespace: [],
          status: 1,
          has_kube_config: true,
        },
      ],
      total: 2,
    });
    await page.fetchClusters();
    expect(JSON.stringify(page.clusters.value)).not.toContain(SECRET);
    expect(page.clusters.value.map((c) => c.has_kube_config)).toEqual([
      true,
      true,
    ]);
  });

  it('详情弹窗不保留原文', async () => {
    const page = useClusterPage();
    client.get.mockResolvedValueOnce({
      id: 1,
      name: 'legacy',
      restrict_namespace: [],
      status: 1,
      kube_config_content: SECRET,
    });
    await page.showClusterDetail({
      id: 1,
      name: 'legacy',
      restrict_namespace: [],
      status: 1,
    });
    expect(JSON.stringify(page.currentClusterDetail.value)).not.toContain(
      SECRET,
    );
    expect(page.currentClusterDetail.value?.has_kube_config).toBe(true);
  });

  const openEditWithDetail = async (detail: Record<string, unknown>) => {
    const page = useClusterPage();
    client.get.mockResolvedValueOnce(detail);
    await page.openEdit({
      id: 1,
      name: 'example',
      restrict_namespace: [],
      status: 1,
      has_kube_config: true,
    });
    // 跳过表单校验与危险操作确认，只测提交载荷
    page.formRef.value = { validate: vi.fn().mockResolvedValue(true) } as never;
    client.get.mockResolvedValue(detail);
    return page;
  };

  it('编辑时表单不回填原文，留空提交不带 kube_config_content', async () => {
    const detail = {
      id: 1,
      name: 'example',
      restrict_namespace: [],
      status: 1,
      has_kube_config: true,
    };
    const page = await openEditWithDetail(detail);
    expect(page.isModalVisible.value).toBe(true);
    expect(page.formModel.value.kube_config_content).toBe('');
    expect(page.editHasKubeConfig.value).toBe(true);
    // 编辑时 kubeconfig 非必填
    const rules = page.formRules.value.kube_config_content ?? [];
    expect(rules.some((r) => 'required' in r && r.required)).toBe(false);

    client.put.mockResolvedValueOnce({});
    client.get.mockResolvedValueOnce(detail); // 危险操作对比
    client.get.mockResolvedValueOnce({ items: [], total: 0 }); // 刷新列表
    await page.submitForm();
    expect(client.put).toHaveBeenCalledTimes(1);
    const [url, body] = client.put.mock.calls[0]!;
    expect(url).toBe('/k8s/cluster/1/update');
    expect(body).not.toHaveProperty('kube_config_content');
  });

  it('填写替换内容时整段提交新 kubeconfig', async () => {
    const detail = {
      id: 1,
      name: 'example',
      restrict_namespace: [],
      status: 1,
      has_kube_config: true,
    };
    const page = await openEditWithDetail(detail);
    const replacement = `apiVersion: v1\nkind: Config\n${'x'.repeat(120)}`;
    page.formModel.value.kube_config_content = replacement;
    client.put.mockResolvedValueOnce({});
    await page.submitForm();
    const [, body] = client.put.mock.calls[0]!;
    expect(body).toMatchObject({ kube_config_content: replacement });
  });

  it('新建时 kubeconfig 仍必填', () => {
    const page = useClusterPage();
    page.openCreate();
    const rules = page.formRules.value.kube_config_content ?? [];
    expect(rules.some((r) => 'required' in r && r.required)).toBe(true);
  });
});
