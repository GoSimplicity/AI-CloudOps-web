import { message } from 'ant-design-vue';
import yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetHttpErrorNoticeTracking } from '#/api/http-error-notice';

import * as sd from './secret-data';
import {
  encodeUtf8ToBase64,
  REDACTED_PLACEHOLDER,
  REDACTED_VALUE_MESSAGE,
  YAML_BLOCK_REDACTED_MESSAGE,
} from './secret-data';
import { useSecretPage } from './Secret';

/**
 * SEC-26 incr7（窝窝头 review-incr6）——页面组合函数层：YAML 更新 / YAML 创建 / 表单创建 / 编辑提交。
 * 只用明显的假值；断言里不出现任何真实凭据。新导出经 `sd.xxx` 访问，实现前逐条红。
 */
const msg = sd as unknown as Record<string, (...args: any[]) => string>;
const api = vi.hoisted(() => ({
  create: vi.fn(),
  createByYaml: vi.fn(),
  detail: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  updateByYaml: vi.fn(),
}));
vi.mock('#/api/core/k8s/k8s_secret', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_secret')>()),
  createSecretApi: api.create,
  createSecretByYamlApi: api.createByYaml,
  getSecretDetailsApi: api.detail,
  getSecretListApi: api.list,
  updateSecretApi: api.update,
  updateSecretByYamlApi: api.updateByYaml,
}));

const FAKE = 'fake-plain-value-for-test';
const PH_B64 = encodeUtf8ToBase64(REDACTED_PLACEHOLDER);
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
const HEAD = 'apiVersion: v1\nkind: Secret\nmetadata:\n  name: secret-a\n';

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(message, 'error').mockImplementation((() => {}) as any);
  vi.spyOn(message, 'success').mockImplementation((() => {}) as any);
  vi.spyOn(message, 'warning').mockImplementation((() => {}) as any);
  api.detail.mockResolvedValue({ ...RECORD });
  api.list.mockResolvedValue({ items: [], total: 0 });
  api.update.mockResolvedValue({});
  api.updateByYaml.mockResolvedValue({});
  api.create.mockResolvedValue({});
  api.createByYaml.mockResolvedValue({});
});
afterEach(() => {
  vi.restoreAllMocks();
  resetHttpErrorNoticeTracking();
});

function yamlPage(text: string) {
  const page = useSecretPage();
  page.yamlFormRef.value = { validate: vi.fn(async () => ({})) } as any;
  page.currentOperationSecret.value = { ...RECORD };
  page.yamlFormModel.value.yaml = text;
  return page;
}
function createYamlPage(text: string) {
  const page = useSecretPage();
  page.createYamlFormRef.value = { validate: vi.fn(async () => ({})) } as any;
  page.filterClusterId.value = 1;
  page.createYamlFormModel.value.yaml = text;
  return page;
}

/** 发出去的 YAML 解析后的 data：任何值都不能是明文标记、也不能解码成占位符 */
function expectSafeSentData(text: string) {
  const data = ((yaml.load(text) as any)?.data ?? {}) as Record<
    string,
    unknown
  >;
  for (const value of Object.values(data)) {
    if (value === null || value === REDACTED_PLACEHOLDER) continue;
    expect(typeof value).toBe('string');
    const raw = (value as string).replaceAll(/[\r\n]/g, '');
    expect(raw).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    expect(atob(raw).trim()).not.toBe(REDACTED_PLACEHOLDER);
  }
  expect(text).not.toContain(FAKE);
  expect(text).not.toContain(PH_B64);
}

describe('incr7 P2-A：YAML 更新 `token:|`（无空格）不再被编码成占位符 base64 发出去', () => {
  it.each(['|', '>', '|-', '|+', '>-', '>+', '|2', '|2-'])(
    'data 下 token:%s + 下一行 <redacted>：拦截（块标量占位符文案），不发请求',
    async (indicator) => {
      const page = yamlPage(
        `${HEAD}data:\n  token:${indicator}\n    ${REDACTED_PLACEHOLDER}\n`,
      );
      await page.submitYamlForm();
      expect(api.updateByYaml).not.toHaveBeenCalled();
      expect(message.warning).toHaveBeenCalledTimes(1);
      expect(message.warning).toHaveBeenCalledWith(YAML_BLOCK_REDACTED_MESSAGE);
    },
  );

  it('data 下 token:| + 下一行明文：提示冒号后缺空格，不发请求', async () => {
    const page = yamlPage(`${HEAD}data:\n  token:|\n    ${FAKE}\n`);
    await page.submitYamlForm();
    expect(api.updateByYaml).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith(
      msg.yamlDataMissingSpaceMessage!('token'),
    );
  });
});

describe('incr7 兜底：编码后 data 里任何值解码为占位符 → 拦截（YAML 更新 / YAML 创建 / 表单创建）', () => {
  it.each([
    ['直接写占位符的 base64', `  token: ${PH_B64}\n`],
    [
      '带空白的变体',
      `  token: ${encodeUtf8ToBase64(` ${REDACTED_PLACEHOLDER}\n`)}\n`,
    ],
    ['!!binary', `  token: !!binary ${PH_B64}\n`],
  ])('YAML 更新：%s → 拦截，不发请求', async (_, body) => {
    const page = yamlPage(`${HEAD}data:\n${body}`);
    await page.submitYamlForm();
    expect(api.updateByYaml).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledTimes(1);
    const text = (message.warning as any).mock.calls[0][0] as string;
    expect(text).toContain('data.token');
  });

  it('YAML 创建：data 值是占位符 base64 → 拦截，不发请求', async () => {
    const page = createYamlPage(`${HEAD}data:\n  token: ${PH_B64}\n`);
    await page.submitCreateYamlForm();
    expect(api.createByYaml).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith(
      msg.yamlDataEncodedRedactedMessage!('token'),
    );
  });

  it('YAML 创建：data 值是明文（非 base64）→ 拦截，不发明文', async () => {
    const page = createYamlPage(`${HEAD}data:\n  token: "${FAKE}"\n`);
    await page.submitCreateYamlForm();
    expect(api.createByYaml).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith(
      msg.yamlDataNotBase64Message!('token'),
    );
  });

  it('YAML 创建反例：正常 base64（带引号也行）与 stringData 明文照常提交', async () => {
    const text = `${HEAD}data:\n  a: "${encodeUtf8ToBase64('fake-a')}"\n  b: ${encodeUtf8ToBase64('fake-b')}\nstringData:\n  s: fake-s\n`;
    const page = createYamlPage(text);
    await page.submitCreateYamlForm();
    expect(message.warning).not.toHaveBeenCalled();
    expect(api.createByYaml).toHaveBeenCalledWith({
      cluster_id: 1,
      yaml: text,
    });
  });

  it.each([
    ['data', { data: { token: PH_B64 }, string_data: {} }],
    [
      'data（原文占位符）',
      { data: { token: REDACTED_PLACEHOLDER }, string_data: {} },
    ],
    ['string_data', { data: {}, string_data: { token: REDACTED_PLACEHOLDER } }],
  ])('表单创建：%s 里有占位符 → 拦截，不发请求', async (_, fields) => {
    const page = useSecretPage();
    page.formRef.value = { validate: vi.fn(async () => ({})) } as any;
    page.filterClusterId.value = 1;
    page.createFormModel.value = {
      ...page.createFormModel.value,
      name: 'secret-new',
      namespace: 'ns-a',
      // 新建表单 data 的类型声明为 Uint8Array，这里用字符串模拟可能出现的值
      ...(fields as any),
    };
    await page.submitCreateForm();
    expect(api.create).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith(REDACTED_VALUE_MESSAGE);
  });

  it('表单创建反例：正常值照常提交', async () => {
    const page = useSecretPage();
    page.formRef.value = { validate: vi.fn(async () => ({})) } as any;
    page.filterClusterId.value = 1;
    page.createFormModel.value = {
      ...page.createFormModel.value,
      name: 'secret-new',
      namespace: 'ns-a',
      string_data: { s: 'fake-s' },
    };
    await page.submitCreateForm();
    expect(message.warning).not.toHaveBeenCalled();
    expect(api.create).toHaveBeenCalledTimes(1);
  });
});

describe('incr7 P3-C：YAML 更新 data 下值写在下一行 → 提示写在同一行，明文不发给后端', () => {
  it.each([
    ['双引号（看起来像 base64）', '"fakeabcd"'],
    ['双引号', `"${FAKE}"`],
    ['普通明文', FAKE],
  ])('`token:` 换行后%s → 拦截', async (_, next) => {
    const page = yamlPage(`${HEAD}data:\n  token:\n    ${next}\n`);
    await page.submitYamlForm();
    expect(api.updateByYaml).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledTimes(1);
    expect(message.warning).toHaveBeenCalledWith(
      msg.yamlDataNextLineMessage!('token'),
    );
  });
});

describe('incr7 总兜底：各种写法的明文都不会出现在发出的 YAML 里', () => {
  const cases: Array<[string, string]> = [
    ['同行双引号', `  k: "${FAKE}"\n`],
    ['| 块', `  k: |\n    ${FAKE}\n`],
    ['| 块后同级键', `  k: |\n    ${FAKE}\n  o: "${FAKE}-o"\n`],
    ['下一行双引号', `  k:\n    "${FAKE}"\n`],
    ['下一行明文', `  k:\n    ${FAKE}\n`],
    ['单引号', `  k: '${FAKE}'\n`],
    ['无空格双引号', `  k:"${FAKE}"\n`],
    ['无空格块', `  k:|\n    ${FAKE}\n`],
    ['|- 块', `  k: |-\n    ${FAKE}\n`],
    ['> 块', `  k: >\n    ${FAKE}\n`],
    ['标签', `  k: !!str "${FAKE}"\n`],
    ['同行未加引号', `  k: ${FAKE}\n`],
    ['多行双引号', `  k: "${FAKE}\n    more"\n`],
    ['带引号的键', `  "k": "${FAKE}"\n`],
  ];
  it.each(cases)(
    '%s：要么拦截不发，要么发出的 data 全是 base64 且不含明文 / 占位符',
    async (_, body) => {
      const page = yamlPage(`${HEAD}data:\n${body}stringData:\n  s: x\n`);
      await page.submitYamlForm();
      if (api.updateByYaml.mock.calls.length === 0) {
        expect(message.warning).toHaveBeenCalledTimes(1);
        return;
      }
      expectSafeSentData(api.updateByYaml.mock.calls[0]![0].yaml as string);
    },
  );

  it('JSON 写法（整份流式）：data 明文拦截', async () => {
    const page = yamlPage(
      JSON.stringify({ apiVersion: 'v1', kind: 'Secret', data: { k: FAKE } }),
    );
    await page.submitYamlForm();
    expect(api.updateByYaml).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith(
      msg.yamlDataNotBase64Message!('k'),
    );
  });

  it('对照：展示 → 不改直接保存，照常提交且 data 与原 base64 一致', async () => {
    const original = `${HEAD}data:\n  a: ${encodeUtf8ToBase64('fake-a')}\n  b: ${encodeUtf8ToBase64('fake-l1\nfake-l2')}\n  c: ${encodeUtf8ToBase64('fa"ke\\c')}\n  r: ${REDACTED_PLACEHOLDER}\ntype: Opaque\n`;
    const page = yamlPage(sd.processSecretYaml(original));
    await page.submitYamlForm();
    expect(message.warning).not.toHaveBeenCalled();
    expect(api.updateByYaml).toHaveBeenCalledTimes(1);
    expect(api.updateByYaml.mock.calls[0]![0].yaml).toBe(original);
  });
});

describe('incr7 P3-B：编辑提交 validate 返回后再核对打开序号；参数取自提交开始时的快照', () => {
  async function openEdit() {
    const page = useSecretPage();
    const validate = deferred<unknown>();
    page.formRef.value = { validate: vi.fn(() => validate.promise) } as any;
    await page.openEditModal(RECORD);
    page.setEditDataValue(page.editDataRows.value[0]!, FAKE);
    return { page, validate };
  }

  it('validate 期间关闭弹窗：静默放弃，不发请求、不弹「Secret 更新失败」', async () => {
    const { page, validate } = await openEdit();
    const submitting = page.submitEditForm();
    await flush();
    page.closeEditModal();
    validate.resolve({});
    await submitting;
    expect(api.update).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    expect(message.success).not.toHaveBeenCalled();
    expect(message.warning).not.toHaveBeenCalled();
  });

  it('validate 期间关掉 A 打开 B：不把 A 的提交发成 secret-b（data null）也不提示成功', async () => {
    const { page, validate } = await openEdit();
    const submitting = page.submitEditForm();
    await flush();
    page.closeEditModal();
    api.detail.mockResolvedValueOnce({ ...RECORD, name: 'secret-b' });
    await page.openEditModal({ ...RECORD, name: 'secret-b' });
    validate.resolve({});
    await submitting;
    expect(api.update).not.toHaveBeenCalled();
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    // B 的弹窗与状态不受影响
    expect(page.isEditModalVisible.value).toBe(true);
    expect(page.currentOperationSecret.value?.name).toBe('secret-b');
  });

  it('对照：validate 正常返回、没切换：照常提交 secret-a', async () => {
    const { page, validate } = await openEdit();
    const submitting = page.submitEditForm();
    validate.resolve({});
    await submitting;
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.update.mock.calls[0]![0]).toMatchObject({
      cluster_id: 1,
      namespace: 'ns-a',
      name: 'secret-a',
    });
    expect(message.success).toHaveBeenCalledTimes(1);
  });

  it('快照：请求参数取自提交开始时的对象（提交期间 currentOperationSecret 被换掉也不串）', async () => {
    const { page, validate } = await openEdit();
    const submitting = page.submitEditForm();
    // 同一次打开期间（序号不变）有人改了 currentOperationSecret（如 showYamlModal 共用这个 ref）
    page.currentOperationSecret.value = { ...RECORD, name: 'secret-other' };
    validate.resolve({});
    await submitting;
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.update.mock.calls[0]![0].name).toBe('secret-a');
  });
});
