import { describe, expect, it } from 'vitest';

import * as sd from './secret-data';
import { findRedactedPlaceholder, REDACTED_PLACEHOLDER } from './secret-data';

/**
 * SEC-26 incr8（窝窝头 review-incr7）：YAML 提交前兜底的 P2-1 / P3-1 ~ P3-4 与取舍 5。
 * 用例编号（e01、p01、d06 …）沿用 review-incr7 报告。只用明显的假值（fake-*）；
 * `<redacted>` 是占位符本身，`PHJlZGFjdGVkPg==` 是它的 base64，都不是凭据。
 * 直接访问已实现的类型化导出；函数缺失时由类型检查和对应回归明确失败。
 */
const PH = REDACTED_PLACEHOLDER;
const PH_B64 = sd.encodeUtf8ToBase64(PH);
/** 双引号里的 \x50 转义：解析后是 PH_B64，但原文里没有连续的 PH_B64 */
const PH_B64_ESCAPED = `\\x50${PH_B64.slice(1)}`;

function constant(name: string): string {
  const value = (sd as unknown as Record<string, unknown>)[name];
  expect(typeof value).toBe('string');
  return value as string;
}

describe('incr8 P2-1：顶层键不区分大小写等于 data / stringData 但不是规范写法 → 拦截', () => {
  it.each([
    ['e01 StringData + 裸占位符', 'StringData', `StringData:\n  k: ${PH}\n`],
    ['e02 stringdata', 'stringdata', `stringdata:\n  k: ${PH}\n`],
    ['e03 STRINGDATA', 'STRINGDATA', `STRINGDATA:\n  k: ${PH}\n`],
    ['e04 Data + 裸占位符', 'Data', `Data:\n  k: ${PH}\n`],
    [
      'e10 与规范 stringData 并存',
      'StringData',
      `stringData:\n  a: fake-a\nStringData:\n  k: ${PH}\n`,
    ],
    [
      'd13 StringData + 带引号占位符',
      'StringData',
      `StringData:\n  k: "${PH}"\n`,
    ],
    ['d14 StringData flow 写法', 'StringData', `StringData: {k: ${PH}}\n`],
    ['带引号的键 "Data"', 'Data', `"Data":\n  k: ${PH_B64}\n`],
    [
      'DATA + 正常 base64 也拦（键名本身不被接受）',
      'DATA',
      `DATA:\n  k: ZmFrZQ==\n`,
    ],
    [
      'ſtringData（U+017F，Go encoding/json 折叠为 s）',
      '\u017FtringData',
      `\u017FtringData:\n  k: ${PH}\n`,
    ],
  ])('%s', (_, key, text) => {
    const error = sd.getYamlDataPayloadError(`kind: Secret\n${text}`);
    expect(error).toBe(sd.yamlNonCanonicalFieldMessage(key));
  });

  it('e05 `Data:` 下 `k: |` 块里是占位符的 base64，且折成两行（每段都短于 token 扫描下限）→ 拦截', () => {
    const text = `kind: Secret\nData:\n  k: |\n    ${PH_B64.slice(0, 8)}\n    ${PH_B64.slice(8)}\n`;
    expect(PH_B64.slice(0, 8)).toBe('PHJlZGFj');
    expect(PH_B64.slice(8)).toBe('dGVkPg==');
    expect(sd.getYamlDataPayloadError(text)).toBe(
      sd.yamlNonCanonicalFieldMessage('Data'),
    );
  });

  it('e05 变体：`Data: |`（顶层值本身是块）同样拦截', () => {
    const text = `kind: Secret\nData: |\n  ${PH_B64.slice(0, 8)}\n  ${PH_B64.slice(8)}\n`;
    expect(sd.getYamlDataPayloadError(text)).toBe(
      sd.yamlNonCanonicalFieldMessage('Data'),
    );
  });

  it('e08 e05 再加尾部 `---` → 拦截', () => {
    const text = `kind: Secret\nData:\n  k: |\n    ${PH_B64.slice(0, 8)}\n    ${PH_B64.slice(8)}\n---\n`;
    expect(sd.getYamlDataPayloadError(text)).not.toBeNull();
  });

  it('文案只含键名，提示改成规范的 data / stringData', () => {
    const message = sd.yamlNonCanonicalFieldMessage('StringData');
    expect(message).toContain('StringData');
    expect(message).toContain('stringData');
    expect(message).toContain('data');
  });

  it('反例：规范 data / stringData、嵌套位置的 Data、相近但不相等的键 → 放行', () => {
    expect(
      sd.getYamlDataPayloadError(
        `kind: Secret\nmetadata:\n  labels:\n    Data: fake-label\n    StringData: fake-label\ndata:\n  a: ${PH}\nstringData:\n  s: fake-s\nDataX: fake\nstringDatas: fake\n`,
      ),
    ).toBeNull();
  });

  it.each([
    ['Data', `Data:\n  k: "fake-plain"\n`],
    ['StringData', `StringData:\n  k: fake-plain\n`],
    ['stringdata', `stringdata:\n  k: fake-plain\n`],
    ['Data', `"Data":\n  k: "fake-plain"\n`],
    ['Data', `'Data':\n  k: "fake-plain"\n`],
    ['DATA', `DATA: {k: fake-plain}\n`],
    ['\u017FtringData', `\u017FtringData:\n  k: fake-plain\n`],
  ])('格式检查同口径：%s → 非规范键名提示', (key, text) => {
    expect(sd.getYamlDataFormatError(`kind: Secret\n${text}`)).toBe(
      sd.yamlNonCanonicalFieldMessage(key),
    );
  });

  it('格式检查：`data :`（冒号前有空格）编码器不认 → 不支持的写法', () => {
    expect(
      sd.getYamlDataFormatError(`kind: Secret\ndata :\n  k: "fake-plain"\n`),
    ).toBe(sd.yamlDataUnsupportedMessage('data'));
  });

  it('格式检查反例：规范 data / stringData 照常通过', () => {
    expect(
      sd.getYamlDataFormatError(
        `kind: Secret\ndata:\n  k: "fake-plain"\nstringData:\n  s: fake-s\nmetadata:\n  name: x\n`,
      ),
    ).toBeNull();
  });
});

describe('incr8 P3-1：loadAll + json:true；多文档拦截；其他解析失败一律拦截（取舍 8 作废）', () => {
  it('p01 重复键（kind 两次）+ \\x50 转义：json:true 后者生效，结构检查拦下', () => {
    const text = `{apiVersion: v1, kind: Secret, kind: Secret, metadata: {name: s1}, data: {k: "${PH_B64_ESCAPED}"}}`;
    expect(sd.getYamlDataPayloadError(text)).toBe(
      sd.yamlDataEncodedRedactedMessage('k'),
    );
  });

  it('重复的 data 键：与 Go 一致取后一个，后一个里的转义占位符 base64 → 拦截', () => {
    const text = `kind: Secret\ndata:\n  a: ${sd.encodeUtf8ToBase64('fake-a')}\ndata:\n  k: "${PH_B64_ESCAPED}"\n`;
    expect(sd.getYamlDataPayloadError(text)).toBe(
      sd.yamlDataEncodedRedactedMessage('k'),
    );
  });

  it('p02 多文档 → 只支持单个文档', () => {
    const text = `kind: Secret\n---\nkind: Secret\ndata:\n  k: "${PH_B64_ESCAPED}"\n`;
    expect(sd.getYamlDataPayloadError(text)).toBe(
      constant('YAML_MULTI_DOCUMENT_MESSAGE'),
    );
  });

  it('尾部多一个 `---`（第二个文档为空）也按多文档拦截', () => {
    expect(
      sd.getYamlDataPayloadError(`kind: Secret\ndata:\n  a: ZmFrZQ==\n---\n`),
    ).toBe(constant('YAML_MULTI_DOCUMENT_MESSAGE'));
  });

  it('开头的 `---` / 结尾的 `...` 仍是单个文档 → 放行', () => {
    expect(
      sd.getYamlDataPayloadError(`---\nkind: Secret\ndata:\n  a: ZmFrZQ==\n`),
    ).toBeNull();
    expect(
      sd.getYamlDataPayloadError(`kind: Secret\ndata:\n  a: ZmFrZQ==\n...\n`),
    ).toBeNull();
  });

  it('解析失败且没有占位符 token → 拦截（fail-closed），文案带行号、不含原文', () => {
    const text = `kind: Secret\ndata:\n  k: "fake-unterminated-value\n`;
    const error = sd.getYamlDataPayloadError(text);
    expect(error).toBe(sd.yamlInvalidMessage(4));
    expect(error).not.toContain('fake-unterminated-value');
    expect(error).not.toContain('kind');
  });

  it('解析失败：未闭合的流式集合 → 拦截', () => {
    expect(sd.getYamlDataPayloadError(`data:\n  k: [fake-unclosed\n`)).toBe(
      sd.yamlInvalidMessage(3),
    );
  });

  it('yamlInvalidMessage 文案：说明无法确认内容、需修正', () => {
    const message = sd.yamlInvalidMessage(7);
    expect(message).toContain('第 7 行');
    expect(message).toContain('YAML');
  });
});

describe('incr8 P3-2：U+2028 / U+2029 / U+0085，或首字符以外的 U+FEFF → 拦截', () => {
  it.each([
    ['d06 注释里的 U+2028', '\u2028'],
    ['d07 注释里的 U+0085 (NEL)', '\u0085'],
    ['d08 注释里的 U+2029', '\u2029'],
  ])('%s', (_, ch) => {
    const text = `kind: Secret\n# c${ch}data: {k: "${PH_B64_ESCAPED}"}\n`;
    expect(sd.getYamlDataPayloadError(text)).toBe(
      constant('YAML_LINE_BREAK_CHAR_MESSAGE'),
    );
  });

  it('值里出现 U+2028 也拦（与位置无关）', () => {
    expect(
      sd.getYamlDataPayloadError(
        `kind: Secret\nstringData:\n  s: "fake\u2028x"\n`,
      ),
    ).toBe(constant('YAML_LINE_BREAK_CHAR_MESSAGE'));
  });

  it('首字符以外的 U+FEFF → 拦截', () => {
    expect(
      sd.getYamlDataPayloadError(`kind: Secret\n\uFEFFdata:\n  a: ZmFrZQ==\n`),
    ).toBe(constant('YAML_LINE_BREAK_CHAR_MESSAGE'));
  });

  it('反例：只有首字符是 U+FEFF（BOM）→ 放行', () => {
    expect(
      sd.getYamlDataPayloadError(`\uFEFFkind: Secret\ndata:\n  a: ZmFrZQ==\n`),
    ).toBeNull();
  });

  it('文案不含值，点名这几种字符', () => {
    const message = constant('YAML_LINE_BREAK_CHAR_MESSAGE');
    expect(message).toContain('U+2028');
    expect(message).toContain('U+FEFF');
  });
});

describe('incr8 P3-3：stringData 的值去掉首尾空白后等于占位符（但不完全相等）→ 拦截', () => {
  it.each([
    ['d09 尾随空格', `"${PH} "`],
    ['d10 尾随换行', `"${PH}\\n"`],
    ['前导制表符', `"\\t${PH}"`],
    ['| 块（值带换行）', `|\n    ${PH}`],
  ])('%s', (_, value) => {
    expect(
      sd.getYamlDataPayloadError(`kind: Secret\nstringData:\n  k: ${value}\n`),
    ).toBe(sd.yamlStringDataRedactedMessage('k'));
  });

  it('文案只含键名，告诉用户写成裸占位符或真实值', () => {
    const message = sd.yamlStringDataRedactedMessage('k');
    expect(message).toContain('stringData.k');
    expect(message).toContain(PH);
  });

  it('反例：stringData 精确占位符（块写法 / flow d11）、普通明文 → 放行', () => {
    expect(
      sd.getYamlDataPayloadError(
        `kind: Secret\nstringData:\n  k: ${PH}\n  s: fake-s\n`,
      ),
    ).toBeNull();
    expect(
      sd.getYamlDataPayloadError(`{kind: Secret, stringData: {k: ${PH}}}`),
    ).toBeNull();
  });
});

describe('incr8 取舍 5：data 值为 null / ~ → 提示「空值请删除该键」', () => {
  it.each(['null', 'Null', 'NULL', '~', 'null # fake comment'])(
    '`k: %s`',
    (value) => {
      const error = sd.getYamlDataFormatError(
        `kind: Secret\ndata:\n  k: ${value}\n`,
      );
      expect(error).toBe(sd.yamlDataEmptyValueMessage('k'));
      expect(error).toContain('空值请删除该键');
      expect(error).toContain('data.k');
    },
  );

  it('反例：值是字符串 "null" 的 base64 不受影响', () => {
    expect(
      sd.getYamlDataFormatError(`kind: Secret\ndata:\n  k: bnVsbA==\n`),
    ).toBeNull();
  });
});

describe('incr8 P3-4：杀掉存活变异体', () => {
  it('M02（:575）`"data":` / `\'data\':` 引号头 → 精确返回 data 不支持的写法', () => {
    expect(
      sd.getYamlDataFormatError(`kind: Secret\n"data":\n  k: "fake-plain"\n`),
    ).toBe(sd.yamlDataUnsupportedMessage('data'));
    expect(
      sd.getYamlDataFormatError(`kind: Secret\n'data':\n  k: "fake-plain"\n`),
    ).toBe(sd.yamlDataUnsupportedMessage('data'));
  });

  it('m08（:589）| 块内后续行缩进比首行浅（但仍比键深）→ 不支持的写法（键名）', () => {
    expect(
      sd.getYamlDataFormatError(
        `kind: Secret\ndata:\n  k: |\n      fake-l1\n    fake-l2\n`,
      ),
    ).toBe(sd.yamlDataUnsupportedMessage('k'));
  });

  it('m16（:712）`!!binary |` 折成 8 字符一行（token 扫描抓不到）→ 解码后是占位符拦截', () => {
    const text = `kind: Secret\ndata:\n  k: !!binary |\n    ${PH_B64.slice(0, 8)}\n    ${PH_B64.slice(8)}\n`;
    expect(sd.getYamlDataPayloadError(text)).toBe(
      sd.yamlDataEncodedRedactedMessage('k'),
    );
  });

  it('m16 反例：!!binary 正常内容放行', () => {
    expect(
      sd.getYamlDataPayloadError(
        `kind: Secret\ndata:\n  k: !!binary ${sd.encodeUtf8ToBase64('fake-bin')}\n`,
      ),
    ).toBeNull();
  });

  it('m28（:181）findRedactedPlaceholder：data 里的 Uint8Array 字节是占位符（含首尾空白）→ 返回 data.键', () => {
    const bytes = (text: string) =>
      Uint8Array.from(text, (ch) => ch.charCodeAt(0));
    expect(findRedactedPlaceholder({ data: { k: bytes(PH) } })).toBe('data.k');
    expect(findRedactedPlaceholder({ data: { k: bytes(` ${PH}\n`) } })).toBe(
      'data.k',
    );
    expect(
      findRedactedPlaceholder({ data: { k: bytes('fake-bytes') } }),
    ).toBeNull();
  });
});

describe('incr8 P3-1：格式检查（更新路径先跑）对多文档给出同一条提示', () => {
  it('已有内容之后的 --- → 多文档', () => {
    expect(
      sd.getYamlDataFormatError(
        `kind: Secret\n---\nkind: Secret\ndata: {k: fake}\n`,
      ),
    ).toBe(constant('YAML_MULTI_DOCUMENT_MESSAGE'));
    expect(sd.getYamlDataFormatError(`kind: Secret\n---\n`)).toBe(
      constant('YAML_MULTI_DOCUMENT_MESSAGE'),
    );
  });

  it('开头的 ---（前面只有注释 / 空行）不算多文档', () => {
    expect(
      sd.getYamlDataFormatError(`# fake comment\n\n---\nkind: Secret\n`),
    ).toBeNull();
  });
});
