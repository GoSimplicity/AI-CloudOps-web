import { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  markHttpErrorNotified,
  resetHttpErrorNoticeTracking,
} from '#/api/http-error-notice';
import {
  createBusinessError,
  notifyBusinessError,
} from '#/utils/permission/business-error';

import {
  EMPTY_VALUE_MESSAGE,
  REDACTED_PLACEHOLDER,
  YAML_BLOCK_REDACTED_MESSAGE,
  YAML_QUOTED_REDACTED_MESSAGE,
} from './secret-data';
import { useSecretPage } from './Secret';

/**
 * SEC-25/26 规则 1（reveal 明文）与规则 2（更新 data）——页面组合函数层。
 * 所有值都是明显的假值；断言里不出现任何真实凭据。
 */
const api = vi.hoisted(() => ({
  detail: vi.fn(),
  reveal: vi.fn(),
  update: vi.fn(),
  updateByYaml: vi.fn(),
  list: vi.fn(),
}));
vi.mock('#/api/core/k8s/k8s_secret', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_secret')>()),
  getSecretDetailsApi: api.detail,
  revealSecretApi: api.reveal,
  updateSecretApi: api.update,
  updateSecretByYamlApi: api.updateByYaml,
  getSecretListApi: api.list,
}));

const FAKE = 'fake-plain-value-for-test';
const FAKE_B64 = btoa(FAKE);
const RECORD = {
  cluster_id: 1,
  namespace: 'ns-a',
  name: 'secret-a',
  type: 'Opaque',
  data: { alpha: '', beta: '' },
  data_keys: [
    { key: 'alpha', size: 11 },
    { key: 'beta', size: 12 },
  ],
  string_data: {},
  labels: {},
  annotations: {},
  redacted: true,
} as any;

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(message, 'error').mockImplementation((() => {}) as any);
  vi.spyOn(message, 'success').mockImplementation((() => {}) as any);
  vi.spyOn(message, 'warning').mockImplementation((() => {}) as any);
  api.detail.mockResolvedValue({ ...RECORD });
  api.list.mockResolvedValue({ items: [], total: 0 });
  api.update.mockResolvedValue({});
  api.reveal.mockImplementation(async (params: { keys: string[] }) => ({
    cluster_id: 1,
    namespace: 'ns-a',
    name: 'secret-a',
    type: 'Opaque',
    data: Object.fromEntries(params.keys.map((key) => [key, FAKE_B64])),
    string_data: {},
    keys: params.keys,
  }));
});
afterEach(() => {
  vi.restoreAllMocks();
  resetHttpErrorNoticeTracking();
});

describe('规则 1：详情不再前端解码，明文按键调 reveal', () => {
  it('打开详情只列键名与字节数，不调 reveal、不出现明文', async () => {
    const page = useSecretPage();
    await page.showSecretDetail(RECORD);
    expect(page.secretDetailDataKeys.value).toEqual([
      { key: 'alpha', size: 11 },
      { key: 'beta', size: 12 },
    ]);
    expect(api.reveal).not.toHaveBeenCalled();
    expect(page.revealedValues.value).toEqual({});
  });

  it('点「查看」：按键调 reveal（cluster/namespace/name/keys），值只存在页面局部', async () => {
    const page = useSecretPage();
    await page.showSecretDetail(RECORD);
    await page.revealSecretKey('alpha');
    expect(api.reveal).toHaveBeenCalledTimes(1);
    expect(api.reveal).toHaveBeenCalledWith({
      cluster_id: 1,
      namespace: 'ns-a',
      name: 'secret-a',
      keys: ['alpha'],
    });
    expect(page.revealedValues.value).toEqual({ alpha: FAKE });
    page.hideRevealedKey('alpha');
    expect(page.revealedValues.value).toEqual({});
  });

  it('复制：调 reveal 取值，但不把明文留在页面上', async () => {
    const page = useSecretPage();
    await page.showSecretDetail(RECORD);
    await expect(page.getPlainValueForCopy('beta')).resolves.toBe(FAKE);
    expect(api.reveal).toHaveBeenCalledWith(
      expect.objectContaining({ keys: ['beta'] }),
    );
    expect(page.revealedValues.value).toEqual({});
    // 已查看过的键直接复用，不再多写一条审计
    await page.revealSecretKey('alpha');
    api.reveal.mockClear();
    await expect(page.getPlainValueForCopy('alpha')).resolves.toBe(FAKE);
    expect(api.reveal).not.toHaveBeenCalled();
  });

  it('关闭详情 / 打开另一个 Secret 时清空明文；关闭后才返回的 reveal 结果被丢弃', async () => {
    const page = useSecretPage();
    await page.showSecretDetail(RECORD);
    await page.revealSecretKey('alpha');
    page.closeDetailModal();
    expect(page.revealedValues.value).toEqual({});

    await page.showSecretDetail(RECORD);
    let resolve!: (value: unknown) => void;
    api.reveal.mockImplementationOnce(
      () => new Promise((done) => (resolve = done)),
    );
    const pending = page.revealSecretKey('alpha');
    await page.showSecretDetail({ ...RECORD, name: 'secret-b' });
    resolve({ data: { alpha: FAKE_B64 }, string_data: {}, keys: ['alpha'] });
    await pending;
    expect(page.revealedValues.value).toEqual({});
  });

  it('reveal 业务错误（200 + code=1）已由请求层提示：页面不再弹第二条', async () => {
    const page = useSecretPage();
    await page.showSecretDetail(RECORD);
    const error = createBusinessError(200, '键不存在');
    notifyBusinessError(error, () => {}, '');
    api.reveal.mockRejectedValueOnce(error);
    await expect(page.revealSecretKey('alpha')).resolves.toBeUndefined();
    expect(message.error).not.toHaveBeenCalled();
    expect(page.revealedValues.value).toEqual({});
  });

  it('P3-3：reveal 失败且请求层已弹过通用错误（如网络错误）：页面不再弹第二条', async () => {
    const page = useSecretPage();
    await page.showSecretDetail(RECORD);
    const error = new Error('fake network failure');
    markHttpErrorNotified(
      error,
      'http-error:网络异常，请检查您的网络连接后重试。',
    );
    api.reveal.mockRejectedValueOnce(error);
    await expect(page.revealSecretKey('alpha')).resolves.toBeUndefined();
    expect(message.error).not.toHaveBeenCalled();
  });

  it('P3-3：reveal 失败且请求层没提示过：页面弹一条「获取明文失败」', async () => {
    const page = useSecretPage();
    await page.showSecretDetail(RECORD);
    api.reveal.mockRejectedValueOnce(new Error('local failure'));
    await expect(page.revealSecretKey('alpha')).resolves.toBeUndefined();
    expect(message.error).toHaveBeenCalledTimes(1);
    expect(message.error).toHaveBeenCalledWith('获取明文失败');
  });
});

describe('规则 2：更新 Secret 的 data', () => {
  async function openEdit() {
    const page = useSecretPage();
    page.formRef.value = { validate: vi.fn(async () => ({})) } as any;
    await page.openEditModal(RECORD);
    return page;
  }
  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, reject, resolve };
  }
  const keysOf = (page: ReturnType<typeof useSecretPage>) =>
    page.editDataRows.value.map((row) => row.key);

  it('P2/P3-2：打开编辑时重新拉详情，用最新键列表，不用列表行里可能过期的 data_keys', async () => {
    api.detail.mockResolvedValueOnce({
      ...RECORD,
      data: { alpha: '', gamma: '' },
      data_keys: [
        { key: 'alpha', size: 11 },
        { key: 'gamma', size: 13 },
      ],
    });
    const page = await openEdit();
    expect(api.detail).toHaveBeenCalledTimes(1);
    expect(api.detail).toHaveBeenCalledWith({
      cluster_id: 1,
      namespace: 'ns-a',
      name: 'secret-a',
    });
    expect(keysOf(page)).toEqual(['alpha', 'gamma']);
    page.setEditDataValue(page.editDataRows.value[1]!, FAKE);
    await page.submitEditForm();
    // 列表里过期的 beta 不会被当作原有键发出；集群里新出现的 gamma 不会被误删
    expect(lastPayload().data).toEqual({ alpha: '', gamma: FAKE_B64 });
  });

  it('P2/P3-2：详情返回前弹窗处于加载中，不显示旧键、不能提交', async () => {
    const pending = deferred<unknown>();
    api.detail.mockReturnValueOnce(pending.promise);
    const page = useSecretPage();
    page.formRef.value = { validate: vi.fn(async () => ({})) } as any;
    const opening = page.openEditModal(RECORD);
    expect(page.isEditModalVisible.value).toBe(true);
    expect(page.editDataLoading.value).toBe(true);
    expect(page.editDataRows.value).toEqual([]);
    await page.submitEditForm();
    expect(api.update).not.toHaveBeenCalled();
    pending.resolve({ ...RECORD });
    await opening;
    expect(page.editDataLoading.value).toBe(false);
    expect(keysOf(page)).toEqual(['alpha', 'beta']);
  });

  it('P2/P3-2：拉详情失败（请求层没提示过）：关闭弹窗，只弹一条「获取 Secret 详情失败」', async () => {
    api.detail.mockRejectedValueOnce(new Error('local failure'));
    const page = await openEdit();
    expect(message.error).toHaveBeenCalledTimes(1);
    expect(message.error).toHaveBeenCalledWith('获取 Secret 详情失败');
    expect(page.isEditModalVisible.value).toBe(false);
    expect(page.editDataLoading.value).toBe(false);
    expect(page.editDataRows.value).toEqual([]);
    expect(page.currentOperationSecret.value).toBeNull();
  });

  it.each([
    [
      '通用 http-error（如网络错误）',
      () => {
        const error = new Error('fake network failure');
        markHttpErrorNotified(error, 'http-error:网络异常');
        return error;
      },
    ],
    [
      '业务错误（已弹后端原文）',
      () => {
        const error = createBusinessError(200, '假的业务错误');
        notifyBusinessError(error, () => {}, '');
        return error;
      },
    ],
    ['403', () => ({ response: { status: 403 } })],
  ])(
    'P2/P3-2：拉详情失败且请求层已提示（%s）：页面不再弹第二条',
    async (_, makeError) => {
      api.detail.mockRejectedValueOnce(makeError());
      const page = await openEdit();
      expect(message.error).not.toHaveBeenCalled();
      expect(page.isEditModalVisible.value).toBe(false);
      expect(page.editDataRows.value).toEqual([]);
    },
  );

  it('P2/P3-2：加载中关闭弹窗，之后返回的详情被丢弃', async () => {
    const pending = deferred<unknown>();
    api.detail.mockReturnValueOnce(pending.promise);
    const page = useSecretPage();
    const opening = page.openEditModal(RECORD);
    page.closeEditModal();
    pending.resolve({ ...RECORD });
    await opening;
    expect(page.isEditModalVisible.value).toBe(false);
    expect(page.editDataRows.value).toEqual([]);
    expect(page.editDataLoading.value).toBe(false);
    expect(page.currentOperationSecret.value).toBeNull();
  });

  it('P2/P3-2：加载中关闭弹窗，之后才失败：不弹提示', async () => {
    const pending = deferred<unknown>();
    api.detail.mockReturnValueOnce(pending.promise);
    const page = useSecretPage();
    const opening = page.openEditModal(RECORD);
    page.closeEditModal();
    pending.reject(new Error('late failure'));
    await opening;
    expect(message.error).not.toHaveBeenCalled();
    expect(page.isEditModalVisible.value).toBe(false);
  });

  it('P2/P3-2：加载中切到另一行：只用最后一行的详情，先发的请求晚返回也不串', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    api.detail
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const page = useSecretPage();
    const openA = page.openEditModal(RECORD);
    const recordB = {
      ...RECORD,
      name: 'secret-b',
      data: { delta: '' },
      data_keys: [{ key: 'delta', size: 5 }],
    };
    const openB = page.openEditModal(recordB);
    second.resolve({ ...recordB });
    await openB;
    first.resolve({ ...RECORD });
    await openA;
    expect(page.currentOperationSecret.value?.name).toBe('secret-b');
    expect(page.editFormModel.value.name).toBe('secret-b');
    expect(keysOf(page)).toEqual(['delta']);
    expect(page.isEditModalVisible.value).toBe(true);
    expect(page.editDataLoading.value).toBe(false);
  });

  it('P3-2：关闭编辑弹窗时清空 editDataRows（含已输入的值）', async () => {
    const page = await openEdit();
    page.setEditDataValue(page.editDataRows.value[0]!, FAKE);
    page.addEditDataRow('extra');
    page.closeEditModal();
    expect(page.editDataRows.value).toEqual([]);
    expect(page.isEditModalVisible.value).toBe(false);
  });
  function lastPayload() {
    return api.update.mock.calls.at(-1)![0];
  }

  it('第四轮：labels / annotations 取自重新拉取的详情，覆盖列表行；提交的是详情里的值', async () => {
    const pending = deferred<unknown>();
    api.detail.mockReturnValueOnce(pending.promise);
    const page = useSecretPage();
    page.formRef.value = { validate: vi.fn(async () => ({})) } as any;
    const staleRow = {
      ...RECORD,
      labels: { app: 'fake-stale', removed: 'fake-stale' },
      annotations: { note: 'fake-stale' },
    };
    const opening = page.openEditModal(staleRow);
    // 加载中不展示列表行里可能过期的 labels / annotations
    expect(page.editFormModel.value.labels).toEqual({});
    expect(page.editFormModel.value.annotations).toEqual({});
    pending.resolve({
      ...RECORD,
      labels: { app: 'fake-fresh', added: 'fake-fresh' },
      // 详情接口可能返回 JSON 字符串
      annotations: JSON.stringify({ note: 'fake-fresh' }),
    });
    await opening;
    expect(page.editFormModel.value.labels).toEqual({
      app: 'fake-fresh',
      added: 'fake-fresh',
    });
    expect(page.editFormModel.value.annotations).toEqual({
      note: 'fake-fresh',
    });
    await page.submitEditForm();
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(lastPayload().labels).toEqual({
      app: 'fake-fresh',
      added: 'fake-fresh',
    });
    expect(lastPayload().annotations).toEqual({ note: 'fake-fresh' });
  });

  it('incr5：string_data 取自重新拉取的详情，覆盖列表行；提交的是详情里的值', async () => {
    const pending = deferred<unknown>();
    api.detail.mockReturnValueOnce(pending.promise);
    const page = useSecretPage();
    page.formRef.value = { validate: vi.fn(async () => ({})) } as any;
    const opening = page.openEditModal({
      ...RECORD,
      string_data: { stale: 'fake-stale', shared: 'fake-stale' },
    });
    // 加载中不展示列表行里可能过期的 string_data
    expect(page.editFormModel.value.string_data).toEqual({});
    pending.resolve({
      ...RECORD,
      // 详情接口可能返回 JSON 字符串
      string_data: JSON.stringify({
        shared: 'fake-fresh',
        added: 'fake-fresh',
      }),
    });
    await opening;
    expect(page.editFormModel.value.string_data).toEqual({
      shared: 'fake-fresh',
      added: 'fake-fresh',
    });
    await page.submitEditForm();
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(lastPayload().string_data).toEqual({
      shared: 'fake-fresh',
      added: 'fake-fresh',
    });
  });

  it('incr5：详情里没有 string_data：不沿用列表行的旧值', async () => {
    api.detail.mockResolvedValueOnce({ ...RECORD, string_data: undefined });
    const page = useSecretPage();
    page.formRef.value = { validate: vi.fn(async () => ({})) } as any;
    await page.openEditModal({
      ...RECORD,
      string_data: { stale: 'fake-stale' },
    });
    await page.submitEditForm();
    expect(lastPayload().string_data).toBeUndefined();
  });

  it('第四轮：详情里没有 labels / annotations：不沿用列表行的旧值', async () => {
    api.detail.mockResolvedValueOnce({
      ...RECORD,
      labels: undefined,
      annotations: undefined,
    });
    const page = useSecretPage();
    page.formRef.value = { validate: vi.fn(async () => ({})) } as any;
    await page.openEditModal({
      ...RECORD,
      labels: { app: 'fake-stale' },
      annotations: { note: 'fake-stale' },
    });
    await page.submitEditForm();
    expect(lastPayload().labels).toBeUndefined();
    expect(lastPayload().annotations).toBeUndefined();
  });

  it('第四轮：拉详情失败：不回退到列表行数据，也提交不了', async () => {
    api.detail.mockRejectedValueOnce(new Error('local failure'));
    const page = useSecretPage();
    page.formRef.value = { validate: vi.fn(async () => ({})) } as any;
    await page.openEditModal({ ...RECORD, labels: { app: 'fake-stale' } });
    expect(page.isEditModalVisible.value).toBe(false);
    expect(page.currentOperationSecret.value).toBeNull();
    await page.submitEditForm();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('data 没动：发 data: null', async () => {
    const page = await openEdit();
    expect(page.editDataRows.value.map((row) => row.key)).toEqual([
      'alpha',
      'beta',
    ]);
    // 原有键的输入框为空（不回填脱敏值）
    expect(page.editDataRows.value.every((row) => row.value === '')).toBe(true);
    await page.submitEditForm();
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(lastPayload()).toHaveProperty('data', null);
  });

  it('改了一个键：发全部键，未改的为 ""', async () => {
    const page = await openEdit();
    page.setEditDataValue(page.editDataRows.value[1]!, FAKE);
    await page.submitEditForm();
    expect(lastPayload().data).toEqual({ alpha: '', beta: FAKE_B64 });
  });

  it('删除的键不发；撤销修改后恢复为不改动', async () => {
    const page = await openEdit();
    page.removeEditDataRow(page.editDataRows.value[0]!);
    await page.submitEditForm();
    expect(lastPayload().data).toEqual({ beta: '' });

    const again = await openEdit();
    const row = again.editDataRows.value[0]!;
    again.setEditDataValue(row, FAKE);
    again.resetEditDataRow(row);
    await again.submitEditForm();
    expect(lastPayload().data).toBeNull();
  });

  it('新增键：发 base64', async () => {
    const page = await openEdit();
    const row = page.addEditDataRow('gamma');
    page.setEditDataValue(row, FAKE);
    await page.submitEditForm();
    expect(lastPayload().data).toEqual({
      alpha: '',
      beta: '',
      gamma: FAKE_B64,
    });
  });

  it('改成空值：拦截并提示「不支持设为空值，请删除该键」，不发请求', async () => {
    const page = await openEdit();
    const row = page.editDataRows.value[0]!;
    page.setEditDataValue(row, FAKE);
    page.setEditDataValue(row, '');
    expect(page.getEditDataRowError(row)).toBe(EMPTY_VALUE_MESSAGE);
    await page.submitEditForm();
    expect(api.update).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith(EMPTY_VALUE_MESSAGE);
  });

  it('任何字段都不发 <redacted>（data 值、string_data 值）', async () => {
    const page = await openEdit();
    page.setEditDataValue(page.editDataRows.value[0]!, REDACTED_PLACEHOLDER);
    await page.submitEditForm();
    expect(api.update).not.toHaveBeenCalled();

    const again = await openEdit();
    again.editFormModel.value.string_data = { s: REDACTED_PLACEHOLDER };
    await again.submitEditForm();
    expect(api.update).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledTimes(2);
  });

  function yamlPage(yaml: string) {
    const page = useSecretPage();
    page.yamlFormRef.value = { validate: vi.fn(async () => ({})) } as any;
    page.currentOperationSecret.value = { ...RECORD };
    page.yamlFormModel.value.yaml = yaml;
    return page;
  }

  it.each([
    ['双引号', `"${REDACTED_PLACEHOLDER}"`],
    ['单引号', `'${REDACTED_PLACEHOLDER}'`],
  ])(
    'P2-1：YAML 里%s的占位符：拦截并给出准确提示，不发请求',
    async (_, quoted) => {
      const page = yamlPage(
        `apiVersion: v1\nkind: Secret\ndata:\n  alpha: ${quoted}\n`,
      );
      await page.submitYamlForm();
      expect(api.updateByYaml).not.toHaveBeenCalled();
      expect(message.warning).toHaveBeenCalledTimes(1);
      expect(message.warning).toHaveBeenCalledWith(
        YAML_QUOTED_REDACTED_MESSAGE,
      );
    },
  );

  it.each(['|', '|-', '|+', '>', '>-', '>+', '|2-'])(
    '第四轮：YAML 里 %s 块标量单独一行 <redacted>：拦截并提示，不发请求',
    async (indicator) => {
      const page = yamlPage(
        `apiVersion: v1\nkind: Secret\nstringData:\n  conf: ${indicator}\n    line-one\n    <redacted>\n`,
      );
      await page.submitYamlForm();
      expect(api.updateByYaml).not.toHaveBeenCalled();
      expect(message.warning).toHaveBeenCalledTimes(1);
      expect(message.warning).toHaveBeenCalledWith(YAML_BLOCK_REDACTED_MESSAGE);
    },
  );

  it('第四轮：块里只是包含 <redacted> 的长行放行，照常提交', async () => {
    api.updateByYaml.mockResolvedValueOnce({});
    const page = yamlPage(
      `apiVersion: v1\nkind: Secret\nstringData:\n  conf: |\n    foo <redacted>\n  s: ${REDACTED_PLACEHOLDER}\n`,
    );
    await page.submitYamlForm();
    expect(message.warning).not.toHaveBeenCalled();
    expect(api.updateByYaml).toHaveBeenCalledTimes(1);
  });

  it('P2-1：YAML 里裸的 <redacted> 放行，原样提交由后端还原原值', async () => {
    api.updateByYaml.mockResolvedValueOnce({});
    const yaml = `apiVersion: v1\nkind: Secret\nmetadata:\n  name: secret-a\ndata:\n  alpha: ${REDACTED_PLACEHOLDER}\n  beta: ${FAKE_B64}\nstringData:\n  s: ${REDACTED_PLACEHOLDER}\n`;
    const page = yamlPage(yaml);
    await page.submitYamlForm();
    expect(message.warning).not.toHaveBeenCalled();
    expect(api.updateByYaml).toHaveBeenCalledTimes(1);
    const sent = api.updateByYaml.mock.calls[0]![0].yaml as string;
    expect(sent).toContain(`  alpha: ${REDACTED_PLACEHOLDER}\n`);
    expect(sent).toContain(`  s: ${REDACTED_PLACEHOLDER}\n`);
    expect(sent).not.toContain(btoa(REDACTED_PLACEHOLDER));
  });

  it('冲突（HTTP 200 + code=1）按业务错误处理：只有请求层一条提示，弹窗保留，不提示成功', async () => {
    const page = await openEdit();
    page.setEditDataValue(page.editDataRows.value[0]!, FAKE);
    const notices: string[] = [];
    const error = createBusinessError(200, 'Secret 已被修改，请刷新后重试');
    notifyBusinessError(error, (content) => notices.push(content), '');
    api.update.mockRejectedValueOnce(error);
    page.isEditModalVisible.value = true;
    await page.submitEditForm();
    await flush();
    expect(notices).toHaveLength(1);
    expect(message.error).not.toHaveBeenCalled();
    expect(message.success).not.toHaveBeenCalled();
    expect(page.isEditModalVisible.value).toBe(true);
  });
});
