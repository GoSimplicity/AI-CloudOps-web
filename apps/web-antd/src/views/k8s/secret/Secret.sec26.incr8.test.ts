import { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetHttpErrorNoticeTracking } from '#/api/http-error-notice';

import * as sd from './secret-data';
import { encodeUtf8ToBase64, REDACTED_PLACEHOLDER } from './secret-data';
import { useSecretPage } from './Secret';

/**
 * SEC-26 incr8（窝窝头 review-incr7）——页面组合函数层：
 * - P2-1 / P3-1 / P3-2 / P3-3 在 YAML 更新、YAML 创建两条路径上都拦截、不发请求；
 * - P3-5：YAML 更新与编辑表单一致，validate 前取快照 + 打开序号，validate 期间关闭 / 换成别的 Secret 静默放弃。
 * 只用明显的假值；新导出经 `sd.xxx` 访问，实现前逐条红。
 */
const msg = sd as unknown as Record<string, any>;
const api = vi.hoisted(() => ({
  create: vi.fn(),
  createByYaml: vi.fn(),
  detail: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  updateByYaml: vi.fn(),
  yaml: vi.fn(),
}));
vi.mock('#/api/core/k8s/k8s_secret', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_secret')>()),
  createSecretApi: api.create,
  createSecretByYamlApi: api.createByYaml,
  getSecretDetailsApi: api.detail,
  getSecretListApi: api.list,
  getSecretYamlApi: api.yaml,
  updateSecretApi: api.update,
  updateSecretByYamlApi: api.updateByYaml,
}));

const PH = REDACTED_PLACEHOLDER;
const PH_B64 = encodeUtf8ToBase64(PH);
const PH_B64_ESCAPED = `\\x50${PH_B64.slice(1)}`;
const RECORD = {
  cluster_id: 1,
  namespace: 'ns-a',
  name: 'secret-a',
  type: 'Opaque',
  data: { alpha: '' },
  data_keys: [{ key: 'alpha', size: 11 }],
  string_data: {},
  labels: {},
  annotations: {},
  redacted: true,
} as any;
const HEAD = 'apiVersion: v1\nkind: Secret\nmetadata:\n  name: secret-a\n';
const OK_YAML = `${HEAD}data:\n  alpha: ${encodeUtf8ToBase64('fake-alpha')}\n`;

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(message, 'error').mockImplementation((() => {}) as any);
  vi.spyOn(message, 'success').mockImplementation((() => {}) as any);
  vi.spyOn(message, 'warning').mockImplementation((() => {}) as any);
  api.detail.mockResolvedValue({ ...RECORD });
  api.list.mockResolvedValue({ items: [], total: 0 });
  api.updateByYaml.mockResolvedValue({});
  api.createByYaml.mockResolvedValue({});
  api.yaml.mockResolvedValue({ data: OK_YAML });
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

const BLOCKED: Array<[string, string, () => string]> = [
  [
    'P2-1 e01 StringData + 裸占位符',
    `${HEAD}StringData:\n  k: ${PH}\n`,
    () => msg.yamlNonCanonicalFieldMessage('StringData'),
  ],
  [
    'P2-1 e05 Data + | 块里折成两行的占位符 base64',
    `${HEAD}Data:\n  k: |\n    ${PH_B64.slice(0, 8)}\n    ${PH_B64.slice(8)}\n`,
    () => msg.yamlNonCanonicalFieldMessage('Data'),
  ],
  [
    'P3-1 p02 多文档',
    `${HEAD}---\nkind: Secret\ndata: {k: "${PH_B64_ESCAPED}"}\n`,
    () => msg.YAML_MULTI_DOCUMENT_MESSAGE,
  ],
  [
    'P3-1 解析失败（未闭合双引号）',
    `${HEAD}stringData:\n  s: "fake-unterminated\n`,
    () => msg.yamlInvalidMessage(7),
  ],
  [
    'P3-2 d06 注释里的 U+2028',
    `${HEAD}# c\u2028data: {k: "${PH_B64_ESCAPED}"}\n`,
    () => msg.YAML_LINE_BREAK_CHAR_MESSAGE,
  ],
  [
    'P3-3 d09 stringData "<redacted> "',
    `${HEAD}stringData:\n  k: "${PH} "\n`,
    () => msg.yamlStringDataRedactedMessage('k'),
  ],
];

describe('incr8：YAML 更新路径拦截，不发请求', () => {
  it.each(BLOCKED)('%s', async (_, text, expected) => {
    const page = yamlPage(text);
    await page.submitYamlForm();
    expect(api.updateByYaml).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledTimes(1);
    expect(message.warning).toHaveBeenCalledWith(expected());
    expect(message.error).not.toHaveBeenCalled();
  });
});

describe('incr8：YAML 创建路径拦截，不发请求', () => {
  it.each(BLOCKED)('%s', async (_, text, expected) => {
    const page = createYamlPage(text);
    await page.submitCreateYamlForm();
    expect(api.createByYaml).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledTimes(1);
    expect(message.warning).toHaveBeenCalledWith(expected());
  });

  it('对照：规范 data / stringData 照常创建', async () => {
    const text = `${HEAD}data:\n  a: ${encodeUtf8ToBase64('fake-a')}\nstringData:\n  s: fake-s\n`;
    const page = createYamlPage(text);
    await page.submitCreateYamlForm();
    expect(message.warning).not.toHaveBeenCalled();
    expect(api.createByYaml).toHaveBeenCalledWith({
      cluster_id: 1,
      yaml: text,
    });
  });
});

describe('incr8 P3-5：YAML 更新 validate 前取快照 + 打开序号（与编辑表单一致）', () => {
  async function openYaml(record = RECORD) {
    const page = useSecretPage();
    const validate = deferred<unknown>();
    page.yamlFormRef.value = { validate: vi.fn(() => validate.promise) } as any;
    await page.showYamlModal(record);
    return { page, validate };
  }

  it('validate 期间关闭弹窗：静默放弃，不发请求、不提示', async () => {
    const { page, validate } = await openYaml();
    const submitting = page.submitYamlForm();
    await flush();
    page.closeYamlModal();
    validate.resolve({});
    await submitting;
    expect(api.updateByYaml).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    expect(message.success).not.toHaveBeenCalled();
    expect(message.warning).not.toHaveBeenCalled();
  });

  it('validate 期间关掉 A 打开 B：A 的提交不发（不会把 B 的 YAML 发给 A，也不会发成 secret-b）', async () => {
    const { page, validate } = await openYaml();
    const submitting = page.submitYamlForm();
    await flush();
    page.closeYamlModal();
    api.yaml.mockResolvedValueOnce({
      data: OK_YAML.replace('secret-a', 'secret-b'),
    });
    await page.showYamlModal({ ...RECORD, name: 'secret-b' });
    validate.resolve({});
    await submitting;
    expect(api.updateByYaml).not.toHaveBeenCalled();
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    expect(page.isYamlModalVisible.value).toBe(true);
    expect(page.currentOperationSecret.value?.name).toBe('secret-b');
  });

  it('validate 期间直接打开 B（没先关闭）：同样放弃 A 的提交', async () => {
    const { page, validate } = await openYaml();
    const submitting = page.submitYamlForm();
    await flush();
    await page.showYamlModal({ ...RECORD, name: 'secret-b' });
    validate.resolve({});
    await submitting;
    expect(api.updateByYaml).not.toHaveBeenCalled();
    expect(message.success).not.toHaveBeenCalled();
  });

  it('快照：同一次打开期间 currentOperationSecret 被换掉，参数仍取提交开始时的 secret-a', async () => {
    const { page, validate } = await openYaml();
    const submitting = page.submitYamlForm();
    page.currentOperationSecret.value = { ...RECORD, name: 'secret-other' };
    validate.resolve({});
    await submitting;
    expect(api.updateByYaml).toHaveBeenCalledTimes(1);
    expect(api.updateByYaml.mock.calls[0]![0]).toMatchObject({
      cluster_id: 1,
      namespace: 'ns-a',
      name: 'secret-a',
    });
  });

  it('请求期间关掉 A 打开 B：A 成功后不去关 B 的弹窗', async () => {
    const { page, validate } = await openYaml();
    const request = deferred<unknown>();
    api.updateByYaml.mockReturnValueOnce(request.promise);
    validate.resolve({});
    const submitting = page.submitYamlForm();
    await flush();
    expect(api.updateByYaml).toHaveBeenCalledTimes(1);
    page.closeYamlModal();
    await page.showYamlModal({ ...RECORD, name: 'secret-b' });
    request.resolve({});
    await submitting;
    expect(page.isYamlModalVisible.value).toBe(true);
    expect(page.currentOperationSecret.value?.name).toBe('secret-b');
  });

  it('对照：没切换，照常提交 secret-a 并关闭弹窗', async () => {
    const { page, validate } = await openYaml();
    const submitting = page.submitYamlForm();
    validate.resolve({});
    await submitting;
    expect(api.updateByYaml).toHaveBeenCalledTimes(1);
    expect(api.updateByYaml.mock.calls[0]![0]).toMatchObject({
      name: 'secret-a',
      yaml: OK_YAML,
    });
    expect(message.success).toHaveBeenCalledTimes(1);
    expect(page.isYamlModalVisible.value).toBe(false);
  });
});
