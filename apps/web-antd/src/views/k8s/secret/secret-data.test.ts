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
  getYamlRedactedError,
  validateDataRows,
  YAML_BLOCK_REDACTED_MESSAGE,
  YAML_QUOTED_REDACTED_MESSAGE,
  yamlHasBlockScalarRedacted,
  yamlHasQuotedRedacted,
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

  it('P2-1：裸 <redacted> 合法（后端 RestoreRedactedSecretYAML 还原原值），不拦截', () => {
    expect(yamlHasQuotedRedacted('data:\n  a: <redacted>\n')).toBe(false);
    expect(
      yamlHasQuotedRedacted(
        'data:\n  a: <redacted>\nstringData:\n  s: <redacted>\n',
      ),
    ).toBe(false);
    expect(yamlHasQuotedRedacted(`data:\n  a: ${FAKE_B64}\n`)).toBe(false);
    // 值里只是包含这段文本（不是整个值）不算占位符
    expect(yamlHasQuotedRedacted('data:\n  a: "x <redacted> y"\n')).toBe(false);
  });

  it('P2-1：带引号的占位符（双引号 / 单引号，data 与 stringData）拦截', () => {
    expect(yamlHasQuotedRedacted('data:\n  a: "<redacted>"\n')).toBe(true);
    expect(yamlHasQuotedRedacted("data:\n  a: '<redacted>'\n")).toBe(true);
    expect(
      yamlHasQuotedRedacted('stringData:\n  s: "<redacted>"  # 注释\n'),
    ).toBe(true);
    expect(yamlHasQuotedRedacted('data:\n  a: "<redacted>"')).toBe(true);
  });

  it('P2-1：拦截文案准确，不再让用户删除不改的键（YAML 更新是整体覆盖）', () => {
    expect(YAML_QUOTED_REDACTED_MESSAGE).toContain('去掉引号');
    expect(YAML_QUOTED_REDACTED_MESSAGE).not.toContain('删除');
  });
});

describe('第四轮：块标量（| / >）里的 <redacted> 拦截', () => {
  // 后端 RestoreRedactedSecretYAML 只认解析后整值等于 `<redacted>` 的字符串；
  // 块标量按字面保存（`|` 还带行尾换行），不会还原。规则：块内任一行去掉首尾空白后恰好等于 `<redacted>` 即拦截。
  it.each(['|', '|-', '|+', '>', '>-', '>+'])(
    '%s 块里单独一行 <redacted>：拦截',
    (indicator) => {
      const text = `data:\n  a: ${indicator}\n    <redacted>\n`;
      expect(yamlHasBlockScalarRedacted(text)).toBe(true);
      expect(getYamlRedactedError(text)).toBe(YAML_BLOCK_REDACTED_MESSAGE);
    },
  );

  it.each(['|2', '|2-', '|-2', '>1+', '>+1', '|9'])(
    '带缩进指示符 %s：同样拦截',
    (indicator) => {
      expect(
        yamlHasBlockScalarRedacted(
          `stringData:\n  s: ${indicator}\n    <redacted>\n`,
        ),
      ).toBe(true);
    },
  );

  it('占位符在块中间、前后还有其它行：拦截', () => {
    expect(
      yamlHasBlockScalarRedacted(
        'stringData:\n  conf: |\n    line-one\n\n    <redacted>\n    line-three\n  other: plain\n',
      ),
    ).toBe(true);
  });

  it('占位符前后带空白（空格 / 制表符）：去掉首尾空白后比较，拦截', () => {
    expect(
      yamlHasBlockScalarRedacted('data:\n  a: |-\n      <redacted> \t \n'),
    ).toBe(true);
    expect(
      yamlHasBlockScalarRedacted('data:\n  a: >\n    \t<redacted>\n'),
    ).toBe(true);
  });

  it('块头带行尾注释、标签，或在列表项里：拦截', () => {
    expect(
      yamlHasBlockScalarRedacted('data:\n  a: | # 注释\n    <redacted>\n'),
    ).toBe(true);
    expect(
      yamlHasBlockScalarRedacted('stringData:\n  a: !!str |\n    <redacted>\n'),
    ).toBe(true);
    expect(yamlHasBlockScalarRedacted('items:\n  - |\n    <redacted>\n')).toBe(
      true,
    );
  });

  it('反例：裸 key: <redacted> 仍放行', () => {
    const text = 'data:\n  a: <redacted>\nstringData:\n  s: <redacted>\n';
    expect(yamlHasBlockScalarRedacted(text)).toBe(false);
    expect(getYamlRedactedError(text)).toBeNull();
  });

  it('反例：块内只是包含 <redacted> 的长行（如 foo <redacted>）不拦截（规则：去空白后恰好等于）', () => {
    expect(
      yamlHasBlockScalarRedacted(
        'stringData:\n  conf: |\n    foo <redacted>\n    <redacted>bar\n    <redacted> # 块里 # 是正文\n',
      ),
    ).toBe(false);
  });

  it('反例：块结束、缩进回落后的普通键不误判', () => {
    const text =
      'stringData:\n  conf: |\n    line-one\n  b: <redacted>\ndata:\n  c: <redacted>\n';
    expect(yamlHasBlockScalarRedacted(text)).toBe(false);
    expect(getYamlRedactedError(text)).toBeNull();
  });

  it('反例：值里普通出现的 | / > 不当作块头', () => {
    expect(
      yamlHasBlockScalarRedacted(
        'data:\n  a: "x |"\n    <redacted>\n  b: x>\n    <redacted>\n',
      ),
    ).toBe(false);
  });

  it('带引号仍走原拦截；文案说明块标量不会还原、怎么改', () => {
    expect(getYamlRedactedError('data:\n  a: "<redacted>"\n')).toBe(
      YAML_QUOTED_REDACTED_MESSAGE,
    );
    expect(YAML_BLOCK_REDACTED_MESSAGE).toContain('|');
    expect(YAML_BLOCK_REDACTED_MESSAGE).toContain('>');
    expect(YAML_BLOCK_REDACTED_MESSAGE).toContain('<redacted>');
    expect(YAML_BLOCK_REDACTED_MESSAGE).not.toContain('删除');
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
