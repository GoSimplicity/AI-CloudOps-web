import { flushPromises, mount } from '@vue/test-utils';
import { Form, FormItem, message } from 'ant-design-vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

import { useClusterPage } from './Cluster';

const client = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
// 只替换 message / Modal，Form 保持 ant-design-vue 真实实现，走真实校验
vi.mock('ant-design-vue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ant-design-vue')>()),
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  Modal: { confirm: vi.fn() },
}));

// jsdom 没有 matchMedia，a-form-item 内部的栅格响应式监听需要它
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.clearAllMocks();
  client.get.mockReset();
  client.put.mockReset();
  client.post.mockReset();
});

type Page = ReturnType<typeof useClusterPage>;

// 把 useClusterPage 的 formModel / formRules / formRef 接到真实的 a-form 上
const mountWithForm = (page: Page) => {
  const Harness = defineComponent({
    setup() {
      return () =>
        h(
          Form,
          {
            ref: page.formRef,
            model: page.formModel.value,
            rules: page.formRules.value,
          },
          () =>
            ['name', 'api_server_addr', 'kube_config_content'].map((name) =>
              h(FormItem, { name }),
            ),
        );
    },
  });
  return mount(Harness);
};

const WHITESPACE = '   \n\t  \n ';
const VALID_KUBECONFIG = `apiVersion: v1\nkind: Config\n${'x'.repeat(120)}`;
const record = {
  id: 1,
  name: 'example',
  restrict_namespace: [],
  status: 1,
  has_kube_config: true,
};
const detail = { ...record };

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const validationErrors = async (page: Page, fields: string[]) => {
  try {
    await page.formRef.value!.validateFields(fields);
    return [];
  } catch (error) {
    return (
      error as { errorFields: { errors: string[] }[] }
    ).errorFields.flatMap((f) => f.errors);
  }
};

describe('kubeconfig 纯空白处理（真实表单校验）', () => {
  it('编辑时纯空白通过校验，且更新请求不带 kube_config_content', async () => {
    const page = useClusterPage();
    mountWithForm(page);
    client.get.mockResolvedValueOnce(detail);
    await page.openEdit(record);
    await flushPromises();

    page.formModel.value.kube_config_content = WHITESPACE;
    await flushPromises();
    // 未归一前直接校验也应通过（validator 先 trim）
    expect(await validationErrors(page, ['kube_config_content'])).toEqual([]);

    client.get.mockResolvedValueOnce(detail); // 危险操作对比
    client.get.mockResolvedValueOnce({ items: [], total: 0 }); // 刷新列表
    client.put.mockResolvedValueOnce({});
    await page.submitForm();

    expect(message.warning).not.toHaveBeenCalled();
    expect(client.put).toHaveBeenCalledTimes(1);
    const [, body] = client.put.mock.calls[0]!;
    expect(body).not.toHaveProperty('kube_config_content');
  });

  it('编辑时填写过短的非空内容仍被拦下', async () => {
    const page = useClusterPage();
    mountWithForm(page);
    client.get.mockResolvedValueOnce(detail);
    await page.openEdit(record);
    await flushPromises();

    page.formModel.value.kube_config_content = '  apiVersion: v1  ';
    await flushPromises();
    expect(await validationErrors(page, ['kube_config_content'])).toEqual([
      'KubeConfig 内容过短，请检查是否完整',
    ]);
    await page.submitForm();
    expect(message.warning).toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
  });

  it('新建时纯空白报必填，不发创建请求', async () => {
    const page = useClusterPage();
    mountWithForm(page);
    page.openCreate();
    page.formModel.value.name = 'demo';
    page.formModel.value.kube_config_content = WHITESPACE;
    await flushPromises();

    expect(await validationErrors(page, ['kube_config_content'])).toEqual([
      '请输入 KubeConfig 内容',
    ]);

    await page.submitForm();
    expect(message.warning).toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalled();
    expect(await validationErrors(page, ['kube_config_content'])).toEqual([
      '请输入 KubeConfig 内容',
    ]);
  });
});

describe('编辑详情晚到不覆盖后续打开的表单', () => {
  it('晚到的编辑详情不会覆盖随后打开的新建表单', async () => {
    const page = useClusterPage();
    const pending = deferred<Record<string, unknown>>();
    client.get.mockReturnValueOnce(pending.promise);

    const editing = page.openEdit(record);
    page.openCreate();
    page.formModel.value.name = 'new-cluster';

    pending.resolve({ ...detail, name: 'stale-detail', has_kube_config: true });
    await editing;

    expect(page.isEdit.value).toBe(false);
    expect(page.isModalVisible.value).toBe(true);
    expect(page.editDetailLoading.value).toBe(false);
    expect(page.editHasKubeConfig.value).toBe(false);
    expect(page.formModel.value).not.toHaveProperty('id');
    expect(page.formModel.value.name).toBe('new-cluster');
  });

  it('晚到的编辑详情失败不会关闭随后打开的新建表单', async () => {
    const page = useClusterPage();
    const pending = deferred<Record<string, unknown>>();
    client.get.mockReturnValueOnce(pending.promise);

    const editing = page.openEdit(record);
    page.openCreate();
    pending.reject(new Error('timeout'));
    await editing;

    expect(page.isModalVisible.value).toBe(true);
    expect(message.error).not.toHaveBeenCalled();
  });

  it('当前这次编辑的详情正常写回', async () => {
    const page = useClusterPage();
    client.get.mockResolvedValueOnce({ ...detail, name: 'fresh-name' });
    await page.openEdit(record);
    expect(page.formModel.value.name).toBe('fresh-name');
    expect(page.editDetailLoading.value).toBe(false);
  });
});

describe('取消/保存后清空 kubeconfig 输入', () => {
  it('取消弹窗后清空 kube_config_content', () => {
    const page = useClusterPage();
    page.openCreate();
    page.formModel.value.kube_config_content = VALID_KUBECONFIG;
    page.closeModal();
    expect(page.isModalVisible.value).toBe(false);
    expect(page.formModel.value.kube_config_content).toBe('');
  });

  it('新建保存成功后清空 kube_config_content，请求里带完整内容', async () => {
    const page = useClusterPage();
    mountWithForm(page);
    page.openCreate();
    page.formModel.value.name = 'demo';
    page.formModel.value.kube_config_content = VALID_KUBECONFIG;
    await flushPromises();

    client.post.mockResolvedValueOnce({});
    client.get.mockResolvedValueOnce({ items: [], total: 0 });
    await page.submitForm();

    expect(client.post).toHaveBeenCalledTimes(1);
    const [, body] = client.post.mock.calls[0]!;
    expect(body).toMatchObject({ kube_config_content: VALID_KUBECONFIG });
    expect(page.isModalVisible.value).toBe(false);
    expect(page.formModel.value.kube_config_content).toBe('');
  });

  it('编辑保存成功后清空 kube_config_content', async () => {
    const page = useClusterPage();
    mountWithForm(page);
    client.get.mockResolvedValueOnce(detail);
    await page.openEdit(record);
    await flushPromises();
    page.formModel.value.kube_config_content = VALID_KUBECONFIG;
    await flushPromises();

    client.get.mockResolvedValueOnce(detail); // 危险操作对比
    client.get.mockResolvedValueOnce({ items: [], total: 0 });
    client.put.mockResolvedValueOnce({});
    await page.submitForm();

    expect(client.put).toHaveBeenCalledTimes(1);
    const [, body] = client.put.mock.calls[0]!;
    expect(body).toMatchObject({ kube_config_content: VALID_KUBECONFIG });
    expect(page.formModel.value.kube_config_content).toBe('');
  });

  it('保存失败时保留输入，便于用户修正后重试', async () => {
    const page = useClusterPage();
    mountWithForm(page);
    page.openCreate();
    page.formModel.value.name = 'demo';
    page.formModel.value.kube_config_content = VALID_KUBECONFIG;
    await flushPromises();
    client.post.mockRejectedValueOnce(new Error('bad kubeconfig'));
    await page.submitForm();
    expect(page.isModalVisible.value).toBe(true);
    expect(page.formModel.value.kube_config_content).toBe(VALID_KUBECONFIG);
  });
});
