import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetHttpErrorNoticeTracking } from '#/api/http-error-notice';

import * as sd from './secret-data';
import {
  encodeUtf8ToBase64,
  processSecretYaml,
  REDACTED_PLACEHOLDER,
} from './secret-data';
import { useSecretPage } from './Secret';

/**
 * SEC-26 incr9（窝窝头 review-incr8）——页面组合函数层：
 * - P3-A/B/C 的对抗矩阵用例在 YAML 更新、YAML 创建两条路径上都拦截、不发请求；
 * - P3-D：「查看 YAML」await 之后核对打开序号，丢弃迟到的响应；加载中 isYamlLoading 为 true（按钮禁用）。
 * 只用明显的假值；新导出经 `sd.xxx` / `page.xxx` 访问，实现前逐条红。
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

const secretVueSource = readFileSync(resolve(__dirname, 'Secret.vue'), 'utf8');
const fold7 = (text: string, indent: string) =>
  text
    .match(/.{1,7}/g)!
    .map((part) => `${indent}${part}`)
    .join('\n');
const FAKE_B64 = encodeUtf8ToBase64('fake-value');

const BLOCKED: Array<[string, string, () => string]> = [
  [
    'P3-A p09 stringData：<< 写在显式键之后',
    `${HEAD}stringData:\n  k: fake-v\n  <<: {k: "${PH} "}\n`,
    () => msg.YAML_MERGE_KEY_MESSAGE,
  ],
  [
    'P3-A x04 锚点 + <<',
    `${HEAD}fake-anchor: &m {k: "${PH} "}\nstringData:\n  k: fake-v\n  <<: *m\n`,
    () => msg.YAML_MERGE_KEY_MESSAGE,
  ],
  [
    'P3-B f08 stringData !!binary 折行（占位符 + \\n）',
    `${HEAD}stringData:\n  k: !!binary |\n${fold7(encodeUtf8ToBase64(`${PH}\n`), '    ')}\n`,
    () => msg.yamlStringDataBinaryRedactedMessage('k'),
  ],
  [
    'P3-C w10 stringData "\\N<redacted>"',
    `${HEAD}stringData:\n  k: "\\N${PH}"\n`,
    () => msg.yamlStringDataRedactedMessage('k'),
  ],
  [
    'P3-C w20 data base64 → 占位符 + NBSP',
    `${HEAD}data:\n  k: ${encodeUtf8ToBase64(`${PH}\u00A0`)}\n`,
    () => msg.yamlDataEncodedRedactedMessage('k'),
  ],
  [
    'P3-C x07 data base64 → 占位符 + U+3000',
    `${HEAD}data:\n  k: ${encodeUtf8ToBase64(`${PH}\u3000`)}\n`,
    () => msg.yamlDataEncodedRedactedMessage('k'),
  ],
];

describe('incr9：YAML 更新路径拦截，不发请求', () => {
  it.each(BLOCKED)('%s', async (_, text, expected) => {
    const page = yamlPage(text);
    await page.submitYamlForm();
    expect(api.updateByYaml).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledTimes(1);
    expect(message.warning).toHaveBeenCalledWith(expected());
  });
});

describe('incr9：YAML 创建路径拦截，不发请求', () => {
  it.each([
    ...BLOCKED,
    [
      'P3-A p10 data flow：<< 写在显式键之后（原来只在创建路径写入）',
      `${HEAD}data: {k: ${FAKE_B64}, <<: {k: "${PH_B64_ESCAPED}"}}\n`,
      () => msg.YAML_MERGE_KEY_MESSAGE,
    ] as [string, string, () => string],
  ])('%s', async (_, text, expected) => {
    const page = createYamlPage(text);
    await page.submitCreateYamlForm();
    expect(api.createByYaml).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledTimes(1);
    expect(message.warning).toHaveBeenCalledWith(expected());
  });
});

describe('incr9 P3-D：查看 YAML 丢弃迟到的响应；加载中禁用按钮', () => {
  const YAML_A = OK_YAML;
  const YAML_B = OK_YAML.replace('secret-a', 'secret-b');
  /** 弹窗里展示的是 processSecretYaml 处理后的内容 */
  const SHOWN_A = processSecretYaml(YAML_A);
  const SHOWN_B = processSecretYaml(YAML_B);
  const RECORD_B = { ...RECORD, name: 'secret-b' };

  it('先打开 A，快速切到 B，B 先到、A 晚到：弹窗内容与目标都保持 B', async () => {
    const page = useSecretPage();
    const a = deferred<unknown>();
    const b = deferred<unknown>();
    api.yaml.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const openA = page.showYamlModal(RECORD);
    const openB = page.showYamlModal(RECORD_B);
    b.resolve({ data: YAML_B });
    await openB;
    expect(page.yamlFormModel.value.yaml).toBe(SHOWN_B);
    expect(page.currentOperationSecret.value?.name).toBe('secret-b');
    a.resolve({ data: YAML_A });
    await openA;
    expect(page.yamlFormModel.value.yaml).toBe(SHOWN_B);
    expect(page.currentOperationSecret.value?.name).toBe('secret-b');
    expect(page.isYamlModalVisible.value).toBe(true);
  });

  it('A 的响应在 B 之前到（B 仍在加载）：A 的内容不写入，加载状态不提前结束', async () => {
    const page = useSecretPage();
    const a = deferred<unknown>();
    const b = deferred<unknown>();
    api.yaml.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const openA = page.showYamlModal(RECORD);
    const openB = page.showYamlModal(RECORD_B);
    a.resolve({ data: YAML_A });
    await openA;
    expect(page.yamlFormModel.value.yaml).not.toBe(SHOWN_A);
    expect(page.isYamlModalVisible.value).toBe(false);
    expect(page.isYamlLoading.value).toBe(true);
    expect(page.submitLoading.value).toBe(true);
    b.resolve({ data: YAML_B });
    await openB;
    expect(page.yamlFormModel.value.yaml).toBe(SHOWN_B);
    expect(page.currentOperationSecret.value?.name).toBe('secret-b');
    expect(page.isYamlModalVisible.value).toBe(true);
    expect(page.isYamlLoading.value).toBe(false);
    expect(page.submitLoading.value).toBe(false);
  });

  it('A 晚到的是失败：不弹「获取 Secret YAML 失败」', async () => {
    const page = useSecretPage();
    let rejectA!: (error: unknown) => void;
    const aFail = new Promise((_, reject) => {
      rejectA = reject;
    });
    api.yaml.mockReturnValueOnce(aFail).mockResolvedValueOnce({ data: YAML_B });
    const openA = page.showYamlModal(RECORD);
    await page.showYamlModal(RECORD_B);
    rejectA(new Error('fake-late-failure'));
    await openA;
    expect(message.error).not.toHaveBeenCalled();
    expect(page.yamlFormModel.value.yaml).toBe(SHOWN_B);
    expect(page.isYamlModalVisible.value).toBe(true);
  });

  it('加载中关闭（或从未打开成功）：A 晚到不再弹出弹窗，加载状态复位', async () => {
    const page = useSecretPage();
    const a = deferred<unknown>();
    api.yaml.mockReturnValueOnce(a.promise);
    const openA = page.showYamlModal(RECORD);
    expect(page.isYamlLoading.value).toBe(true);
    page.closeYamlModal();
    expect(page.isYamlLoading.value).toBe(false);
    expect(page.submitLoading.value).toBe(false);
    a.resolve({ data: YAML_A });
    await openA;
    expect(page.isYamlModalVisible.value).toBe(false);
    expect(page.yamlFormModel.value.yaml).toBe('');
    expect(page.currentOperationSecret.value).toBeNull();
  });

  it('对照：单次打开照常展示，加载状态先 true 后 false', async () => {
    const page = useSecretPage();
    const a = deferred<unknown>();
    api.yaml.mockReturnValueOnce(a.promise);
    expect(page.isYamlLoading.value).toBe(false);
    const openA = page.showYamlModal(RECORD);
    expect(page.isYamlLoading.value).toBe(true);
    a.resolve({ data: YAML_A });
    await openA;
    expect(page.isYamlLoading.value).toBe(false);
    expect(page.yamlFormModel.value.yaml).toBe(SHOWN_A);
    expect(page.isYamlModalVisible.value).toBe(true);
  });

  it('对照：单次打开失败照常提示，加载状态复位', async () => {
    const page = useSecretPage();
    api.yaml.mockRejectedValueOnce(new Error('fake-failure'));
    await page.showYamlModal(RECORD);
    expect(message.error).toHaveBeenCalledWith('获取 Secret YAML 失败');
    expect(page.isYamlLoading.value).toBe(false);
    expect(page.isYamlModalVisible.value).toBe(false);
  });

  it('Secret.vue：「查看 YAML」按钮绑定 :disabled="isYamlLoading"，且从 useSecretPage 取出 isYamlLoading', () => {
    const button = /<a-button\b[^>]*title="查看 YAML"[^>]*>/.exec(
      secretVueSource,
    )?.[0];
    expect(button).toBeDefined();
    expect(button).toMatch(/:disabled="isYamlLoading"/);
    expect(secretVueSource).toMatch(/^\s+isYamlLoading,$/m);
  });
});
