import { describe, expect, it } from 'vitest';

import {
  buildSecretDataPayload,
  createDataRows,
  EMPTY_VALUE_MESSAGE,
  findRedactedPlaceholder,
  getSecretDataKeys,
  isDataEdited,
  REDACTED_PLACEHOLDER,
  readRevealedValue,
  validateDataRows,
  yamlContainsRedacted,
} from './secret-data';

/**
 * SEC-25/26 规则 2：PUT /k8s/secret/:cluster_id/:namespace/:name/update 的 data 语义
 * （AI-CloudOps@ed683ef internal/k8s/service/secret_service.go preserveRedactedData）：
 * - data 为 null → 不修改；非空 map → 整体替换（缺的键被删除）；值为 "" → 保留该键原值。
 * 测试值全部为明显的假值。
 */
const FAKE = 'fake-value-for-test';
const FAKE_B64 = btoa(FAKE);

function rows(keys: string[]) {
  return createDataRows(keys);
}

describe('getSecretDataKeys', () => {
  it('优先用 data_keys，没有时退回 data 的键', () => {
    expect(
      getSecretDataKeys({
        data_keys: [
          { key: 'b', size: 3 },
          { key: 'a', size: 1 },
        ],
        data: { x: '' },
      } as any),
    ).toEqual(['b', 'a']);
    expect(getSecretDataKeys({ data: { a: '', b: '' } } as any)).toEqual([
      'a',
      'b',
    ]);
    expect(getSecretDataKeys({ data: '{"k":""}' } as any)).toEqual(['k']);
    expect(getSecretDataKeys(null)).toEqual([]);
  });
});

describe('buildSecretDataPayload', () => {
  it('data 没动：发 null', () => {
    const original = ['a', 'b'];
    const current = rows(original);
    expect(isDataEdited(original, current)).toBe(false);
    expect(buildSecretDataPayload(original, current)).toBeNull();
  });

  it('改了某个键：发全部键，未改的为 ""，改的为新值 base64', () => {
    const original = ['a', 'b', 'c'];
    const current = rows(original);
    current[1]!.value = FAKE;
    current[1]!.modified = true;
    expect(isDataEdited(original, current)).toBe(true);
    expect(buildSecretDataPayload(original, current)).toEqual({
      a: '',
      b: FAKE_B64,
      c: '',
    });
  });

  it('删除的键不发；新增的键发 base64', () => {
    const original = ['a', 'b'];
    const current = rows(original).filter((row) => row.key !== 'b');
    current.push({ id: 99, key: 'n', modified: true, original: false, value: FAKE });
    expect(isDataEdited(original, current)).toBe(true);
    expect(buildSecretDataPayload(original, current)).toEqual({
      a: '',
      n: FAKE_B64,
    });
  });

  it('只删除键也算改动', () => {
    const original = ['a', 'b'];
    const current = rows(original).filter((row) => row.key !== 'a');
    expect(isDataEdited(original, current)).toBe(true);
    expect(buildSecretDataPayload(original, current)).toEqual({ b: '' });
  });

  it('UTF-8 值按字节编码', () => {
    const current = rows(['a']);
    current[0]!.value = '测试假值';
    current[0]!.modified = true;
    const payload = buildSecretDataPayload(['a'], current)!;
    const bytes = Uint8Array.from(atob(payload.a!), (c) => c.charCodeAt(0));
    expect(new TextDecoder().decode(bytes)).toBe('测试假值');
  });

  it('改成空值：表单拦截，提示「不支持设为空值，请删除该键」，不生成 payload', () => {
    const current = rows(['a']);
    current[0]!.value = '';
    current[0]!.modified = true;
    expect(EMPTY_VALUE_MESSAGE).toBe('不支持设为空值，请删除该键');
    expect(validateDataRows(current)).toBe(EMPTY_VALUE_MESSAGE);
    expect(() => buildSecretDataPayload(['a'], current)).toThrow(
      EMPTY_VALUE_MESSAGE,
    );
  });

  it('新增键值为空同样拦截', () => {
    const current = [
      { id: 1, key: 'n', modified: true, original: false, value: '' },
    ];
    expect(validateDataRows(current)).toBe(EMPTY_VALUE_MESSAGE);
  });

  it('未改动的原有键（输入框为空 = 保留原值）不拦截', () => {
    expect(validateDataRows(rows(['a', 'b']))).toBeNull();
  });

  it.each([REDACTED_PLACEHOLDER, ` ${REDACTED_PLACEHOLDER} `])(
    '值为脱敏占位符 %j：拦截，不会被编码发出',
    (value) => {
      const current = rows(['a']);
      current[0]!.value = value;
      current[0]!.modified = true;
      expect(validateDataRows(current)).toContain(REDACTED_PLACEHOLDER);
      expect(() => buildSecretDataPayload(['a'], current)).toThrow();
    },
  );

  it('键名为空 / 重复 / 非法：拦截', () => {
    expect(
      validateDataRows([
        { id: 1, key: ' ', modified: true, original: false, value: FAKE },
      ]),
    ).toBe('键名不能为空');
    expect(
      validateDataRows([
        ...rows(['a']),
        { id: 2, key: 'a', modified: true, original: false, value: FAKE },
      ]),
    ).toBe('键名重复：a');
    expect(
      validateDataRows([
        { id: 1, key: 'a/b', modified: true, original: false, value: FAKE },
      ]),
    ).toContain('键名只能包含');
  });
});

describe('findRedactedPlaceholder（最终防线）', () => {
  it('data 原文或 base64 后是 <redacted>、string_data 值是 <redacted> 都能发现', () => {
    expect(findRedactedPlaceholder({ data: { a: REDACTED_PLACEHOLDER } })).toBe(
      'data.a',
    );
    expect(
      findRedactedPlaceholder({ data: { a: btoa(REDACTED_PLACEHOLDER) } }),
    ).toBe('data.a');
    expect(
      findRedactedPlaceholder({ string_data: { s: REDACTED_PLACEHOLDER } }),
    ).toBe('string_data.s');
    expect(
      findRedactedPlaceholder({ data: { a: '', b: FAKE_B64 }, string_data: {} }),
    ).toBeNull();
    expect(findRedactedPlaceholder({ data: null })).toBeNull();
  });

  it('YAML 文本中出现占位符（含引号形式）能发现', () => {
    expect(yamlContainsRedacted('data:\n  a: <redacted>\n')).toBe(true);
    expect(yamlContainsRedacted('data:\n  a: "<redacted>"\n')).toBe(true);
    expect(yamlContainsRedacted(`data:\n  a: ${FAKE_B64}\n`)).toBe(false);
  });
});

describe('readRevealedValue', () => {
  const res = {
    data: { a: FAKE_B64, bin: btoa(String.fromCharCode(0xff, 0xfe)) },
    string_data: { s: FAKE },
    keys: ['a', 's', 'bin'],
  };
  it('data 解 base64 为 UTF-8；string_data 原样；没有返回的键为 undefined', () => {
    expect(readRevealedValue(res, 'a')).toBe(FAKE);
    expect(readRevealedValue(res, 's')).toBe(FAKE);
    expect(readRevealedValue(res, 'missing')).toBeUndefined();
    expect(readRevealedValue(null, 'a')).toBeUndefined();
  });
  it('非 UTF-8 二进制不强行解码，给出提示而不是乱码', () => {
    expect(readRevealedValue(res, 'bin')).toMatch(/二进制/);
  });
});
