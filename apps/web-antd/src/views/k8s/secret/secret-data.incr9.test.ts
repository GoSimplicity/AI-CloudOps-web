import { describe, expect, it } from 'vitest';

import * as sd from './secret-data';
import {
  encodeSecretYamlForSubmission,
  findRedactedPlaceholder,
  getDataRowError,
  getYamlDataFormatError,
  getYamlDataPayloadError,
  getYamlRedactedError,
  REDACTED_PLACEHOLDER,
  REDACTED_VALUE_MESSAGE,
} from './secret-data';

/**
 * SEC-26 incr9（窝窝头 review-incr8）：P2-1' ReDoS、P3-A（<< 合并键）、P3-B（stringData 的 !!binary）、
 * P3-C（按 Go TrimSpace 去首尾空白、base64 按 UTF-8 解码）。用例编号（p09、w10、f08 …）沿用 review-incr8 报告。
 * 只用明显的假值（fake-*）；`<redacted>` 是占位符本身，`PHJlZGFjdGVkPg==` 是它的 base64，都不是凭据。
 * 新导出经 `sd.xxx` 访问：实现前这些用例逐条红，而不是整个文件加载失败。
 */
const api = sd as unknown as Record<string, any>;
const PH = REDACTED_PLACEHOLDER;
const b64 = (text: string) => sd.encodeUtf8ToBase64(text);
const PH_B64 = b64(PH);
/** 双引号里的 \x50 转义：解析后是 PH_B64，但原文里没有连续的 PH_B64 */
const PH_B64_ESCAPED = `\\x50${PH_B64.slice(1)}`;
const HEAD = 'apiVersion: v1\nkind: Secret\nmetadata:\n  name: fake-s\n';
const FAKE_B64 = b64('fake-value');
/** 每行 7 个字符折行：避开 ≥8 字符的 token 扫描 */
const fold7 = (text: string, indent: string) =>
  text
    .match(/.{1,7}/g)!
    .map((part) => `${indent}${part}`)
    .join('\n');

/** 用当前 realm 的 Uint8Array 包一层（jsdom 下 TextEncoder 的结果与全局 Uint8Array 不同 realm） */
const utf8Bytes = (text: string) =>
  Uint8Array.from(new TextEncoder().encode(text));

function elapsed(fn: () => unknown) {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

/** YAML 更新路径（与 Secret.ts submitYamlForm 同序）：占位符检查 → data 格式 → 编码 → 兜底 */
function updateError(text: string) {
  return (
    getYamlRedactedError(text) ??
    getYamlDataFormatError(text) ??
    getYamlDataPayloadError(encodeSecretYamlForSubmission(text))
  );
}
/** YAML 创建路径（submitCreateYamlForm）：只有兜底 */
function createError(text: string) {
  return getYamlDataPayloadError(text);
}

describe("incr9 P2-1'：TOP_LEVEL_KEY_PATTERN 线性时间", () => {
  const cases: Array<[string, string]> = [
    ['200KB 单行：a + 空格，无冒号', `a${' '.repeat(200_000)}`],
    ['200KB 单行：a + 空格 / Tab 交替，无冒号', `a${' \t'.repeat(100_000)}`],
    ['200KB 单行：a + 空格 + 非冒号结尾', `a${' '.repeat(200_000)}x`],
    ['200KB 单行：a 空格 a 空格 …，无冒号', `${'a '.repeat(100_000)}`],
  ];
  it.each(cases)(
    'getYamlDataFormatError：%s < 500ms（原正则约 26–28s）',
    (_, line) => {
      const input = `${HEAD}${line}\ndata:\n  k: ${FAKE_B64}\n`;
      let out: null | string = 'unset';
      expect(elapsed(() => (out = getYamlDataFormatError(input)))).toBeLessThan(
        500,
      );
      expect(out).toBeNull();
    },
  );

  it('多行：每行 a + 80 个空格 × 2500 行 < 500ms', () => {
    const input = `${HEAD}${`a${' '.repeat(80)}\n`.repeat(2500)}data:\n  k: ${FAKE_B64}\n`;
    expect(elapsed(() => getYamlDataFormatError(input))).toBeLessThan(500);
  });

  it.each([
    ['Data   :', 'Data'],
    ['StringData\t: {k: fake-v}', 'StringData'],
    ['Data \t \t:', 'Data'],
    ['stringdata:', 'stringdata'],
  ])('改写后键名照样取到（不含冒号前的空白）：%s', (line, key) => {
    expect(getYamlDataFormatError(`${HEAD}${line}\n`)).toBe(
      api.yamlNonCanonicalFieldMessage(key),
    );
  });

  it('键名中间有空白、冒号前有空白的普通键不误拦', () => {
    expect(
      getYamlDataFormatError(`${HEAD}fake key  : v\ndata:\n  k: ${FAKE_B64}\n`),
    ).toBeNull();
  });
});

describe('incr9 P3-A：<< 合并键在任意深度都拦（js-yaml 显式键优先，Go yaml.v2 后写的 << 覆盖）', () => {
  const MERGE: Array<[string, string]> = [
    [
      'p09 stringData：<< 写在显式键之后',
      `${HEAD}stringData:\n  k: fake-v\n  <<: {k: "${PH} "}\n`,
    ],
    [
      'p10 data flow：<< 写在显式键之后',
      `${HEAD}data: {k: ${FAKE_B64}, <<: {k: "${PH_B64_ESCAPED}"}}\n`,
    ],
    [
      'p11 data 块：<< 写在显式键之后',
      `${HEAD}data:\n  k: ${FAKE_B64}\n  <<: {k: "${PH_B64_ESCAPED}"}\n`,
    ],
    [
      'x01 stringData：块写法的 <<',
      `${HEAD}stringData:\n  k: fake-v\n  <<:\n    k: "${PH}\\t"\n`,
    ],
    [
      'x04 锚点 + <<',
      `${HEAD}fake-anchor: &m {k: "${PH} "}\nstringData:\n  k: fake-v\n  <<: *m\n`,
    ],
    [
      'p13 << 列表',
      `${HEAD}stringData:\n  k: fake-v\n  <<: [{k: "\\t${PH}"}, {j: fake-j}]\n`,
    ],
    [
      'x10 两层嵌套 <<',
      `${HEAD}stringData:\n  k: fake-v\n  <<: {<<: {k: "${PH} "}}\n`,
    ],
    ['顶层 <<', `fake-anchor: &m {stringData: {k: fake-v}}\n${HEAD}<<: *m\n`],
    [
      'metadata 里的 <<（p12，无关键也拦）',
      `${HEAD.replace('  name: fake-s\n', '  name: fake-s\n  <<: {namespace: fake-ns}\n')}data:\n  k: ${FAKE_B64}\n`,
    ],
    ['列表里的 <<', `${HEAD}fake-list:\n  - <<: {k: fake-v}\n`],
    ['带引号的 "<<" 键', `${HEAD}stringData:\n  "<<": {k: fake-v}\n`],
  ];

  it.each(MERGE)('%s：两条路径都拦，提示合并键', (_, text) => {
    expect(createError(text)).toBe(api.YAML_MERGE_KEY_MESSAGE);
    expect(updateError(text)).not.toBeNull();
  });

  it('提示文案只说合并键，不含值', () => {
    expect(api.YAML_MERGE_KEY_MESSAGE).toEqual(expect.stringContaining('<<'));
    expect(api.YAML_MERGE_KEY_MESSAGE).not.toContain(PH_B64);
  });

  it('不含 << 的普通映射不受影响；!!binary / 时间戳照常解析', () => {
    expect(createError(`${HEAD}data:\n  k: ${FAKE_B64}\n`)).toBeNull();
    expect(createError(`${HEAD}data:\n  k: !!binary ${FAKE_B64}\n`)).toBeNull();
    expect(
      createError(
        `${HEAD.replace('  name: fake-s\n', '  name: fake-s\n  creationTimestamp: 2026-10-24T00:00:00Z\n')}data:\n  k: ${FAKE_B64}\n`,
      ),
    ).toBeNull();
    expect(
      createError(`${HEAD}stringData:\n  k: "a << b"\n  "<<x": y\n`),
    ).toBeNull();
  });

  it('!!binary 仍按二进制检查（解码为占位符的照样拦）', () => {
    expect(createError(`${HEAD}data:\n  k: !!binary ${PH_B64}\n`)).toBe(
      api.yamlDataEncodedRedactedMessage('k'),
    );
  });
});

describe('incr9 P3-B：stringData 里 !!binary 的值解码后（去首尾空白）是占位符 → 拦', () => {
  const BINARY: Array<[string, string]> = [
    [
      'f08 折行，占位符 + \\n',
      `${HEAD}stringData:\n  k: !!binary |\n${fold7(b64(`${PH}\n`), '    ')}\n`,
    ],
    [
      'f09 折行，恰好是占位符',
      `${HEAD}stringData:\n  k: !!binary |\n${fold7(PH_B64, '    ')}\n`,
    ],
    [
      'f10 转义，占位符 + 空格',
      `${HEAD}stringData:\n  k: !!binary "\\x50${b64(`${PH} `).slice(1)}"\n`,
    ],
    [
      'f12 flow，占位符 + \\n',
      `${HEAD}stringData: {k: !!binary "\\x50${b64(`${PH}\n`).slice(1)}"}\n`,
    ],
    [
      'x09 折行，占位符 + NBSP（UTF-8）',
      `${HEAD}stringData:\n  k: !!binary |\n${fold7(b64(`${PH}\u00A0`), '    ')}\n`,
    ],
  ];
  it.each(BINARY)('%s：两条路径都拦', (_, text) => {
    expect(createError(text)).toBe(
      api.yamlStringDataBinaryRedactedMessage('k'),
    );
    expect(updateError(text)).toBe(
      api.yamlStringDataBinaryRedactedMessage('k'),
    );
  });

  it('f11 正常的 !!binary 值放行', () => {
    expect(
      createError(`${HEAD}stringData:\n  k: !!binary ${b64('fake-value')}\n`),
    ).toBeNull();
  });

  it('提示文案只含键名', () => {
    const text = api.yamlStringDataBinaryRedactedMessage('fake-key');
    expect(text).toContain('stringData.fake-key');
    expect(text).toContain('!!binary');
  });
});

describe('incr9 P3-C：按 Go TrimSpace（含 U+0085 / NBSP / U+3000）比较；base64 按 UTF-8 解码', () => {
  const STRING_DATA: Array<[string, string]> = [
    ['w10 \\N（U+0085）在前', `"\\N${PH}"`],
    ['w11 \\N 在后', `"${PH}\\N"`],
    ['w19 \\N\\N 在前、\\t 在后', `"\\N\\N${PH}\\t"`],
    ['\\N 与空格混合', `" \\N ${PH} \\N "`],
    ['NBSP（\\_）', `"\\_${PH}"`],
    ['U+3000', `"${PH}\\u3000"`],
    ['U+2003', `"\\u2003${PH}"`],
  ];
  it.each(STRING_DATA)('stringData %s：两条路径都拦', (_, value) => {
    const text = `${HEAD}stringData:\n  k: ${value}\n`;
    expect(createError(text)).toBe(api.yamlStringDataRedactedMessage('k'));
    expect(updateError(text)).toBe(api.yamlStringDataRedactedMessage('k'));
  });

  const DATA: Array<[string, string]> = [
    ['w20 占位符 + NBSP（UTF-8：C2 A0）', `${PH}\u00A0`],
    ['x07 占位符 + U+3000（UTF-8：E3 80 80）', `${PH}\u3000`],
    ['U+0085（UTF-8：C2 85）在前', `\u0085${PH}`],
    ['U+2003 在后', `${PH}\u2003`],
  ];
  it.each(DATA)('data 的 base64 解码为 %s：两条路径都拦', (_, decoded) => {
    const text = `${HEAD}data:\n  k: ${b64(decoded)}\n`;
    expect(createError(text)).toBe(api.yamlDataEncodedRedactedMessage('k'));
    expect(updateError(text)).toBe(api.yamlDataEncodedRedactedMessage('k'));
  });

  it.each(DATA)('data !!binary 解码为 %s：拦', (_, decoded) => {
    const text = `${HEAD}data:\n  k: !!binary |\n${fold7(b64(decoded), '    ')}\n`;
    expect(createError(text)).toBe(api.yamlDataEncodedRedactedMessage('k'));
  });

  it('token 扫描同样按 UTF-8 + goTrim（data 写在注释里也算）', () => {
    const token = b64(`${PH}\u3000`);
    expect(createError(`${HEAD}# ${token}\n`)).toBe(
      api.yamlDataEncodedRedactedMessage('第 5 行'),
    );
  });

  it('不是空白的字符（U+200B、x）不算：含占位符但不等于它，后端按字面保存，不拦', () => {
    for (const value of [`"\\u200B${PH}"`, `"${PH}x"`]) {
      expect(createError(`${HEAD}stringData:\n  k: ${value}\n`)).toBeNull();
    }
    expect(
      createError(`${HEAD}data:\n  k: ${b64(`\u200B${PH}`)}\n`),
    ).toBeNull();
  });

  it('非法 UTF-8（单字节 0xA0）按 Go 不算空白：不拦', () => {
    const bytes = `${PH}\u00A0`; // atob/btoa 按 Latin-1：单字节 A0
    expect(createError(`${HEAD}data:\n  k: ${btoa(bytes)}\n`)).toBeNull();
  });

  it('表单：string_data / data 字符串 / data 的 Uint8Array 都按 goTrim + UTF-8', () => {
    expect(findRedactedPlaceholder({ string_data: { k: `\u0085${PH}` } })).toBe(
      'string_data.k',
    );
    expect(findRedactedPlaceholder({ data: { k: b64(`${PH}\u00A0`) } })).toBe(
      'data.k',
    );
    expect(
      findRedactedPlaceholder({
        data: { k: utf8Bytes(`${PH}\u3000`) },
      }),
    ).toBe('data.k');
    expect(
      findRedactedPlaceholder({ data: { k: utf8Bytes(`\u0085${PH}`) } }),
    ).toBe('data.k');
    expect(
      findRedactedPlaceholder({ data: { k: b64(`\u200B${PH}`) } }),
    ).toBeNull();
  });

  it('表单单行：值为占位符 + U+0085 → REDACTED_VALUE_MESSAGE', () => {
    expect(
      getDataRowError({
        key: 'k',
        value: `${PH}\u0085`,
        original: false,
      } as any),
    ).toBe(REDACTED_VALUE_MESSAGE);
  });
});
