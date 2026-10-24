import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

import * as sd from './secret-data';
import {
  encodeSecretYamlForSubmission,
  getYamlRedactedError,
  processSecretYaml,
  REDACTED_PLACEHOLDER,
  YAML_BLOCK_REDACTED_MESSAGE,
} from './secret-data';

/**
 * SEC-26 incr7（窝窝头 review-incr6）：YAML 编辑路径的编码器 / 展示 / 格式检查 / 提交前兜底。
 * 只用明显的假值（fake-*）；`<redacted>` 是占位符本身，不是凭据。
 * 新导出通过 `sd.xxx` 访问：实现前这些用例逐条红（xxx 为 undefined），而不是整个文件加载失败。
 */
const api = sd as unknown as Record<string, (...args: any[]) => any>;
const b64 = (text: string) => sd.encodeUtf8ToBase64(text);
const PH_B64 = b64(REDACTED_PLACEHOLDER);

function elapsed(run: () => unknown) {
  const start = performance.now();
  run();
  return performance.now() - start;
}

/** 解析发送的 YAML，取 data（不存在时为 {}） */
function sentData(text: string): Record<string, unknown> {
  const doc = yaml.load(text) as null | Record<string, unknown>;
  return (doc?.data ?? {}) as Record<string, unknown>;
}

const BLOCK_INDICATORS = [
  '|',
  '>',
  '|-',
  '|+',
  '>-',
  '>+',
  '|2',
  '|2-',
  '|-2',
  '>2+',
];

describe('incr7 P2-A：`token:|`（冒号后无空格）不是块标量，编码器与检查器口径一致', () => {
  it.each(
    BLOCK_INDICATORS.flatMap((ind) => [
      [ind, ' '],
      [ind, ''],
    ]),
  )(
    '检查器：data 下 token:%s（冒号后%j）+ 下一行 <redacted> → 块标量占位符拦截',
    (indicator, space) => {
      expect(
        getYamlRedactedError(
          `apiVersion: v1\nkind: Secret\ndata:\n  token:${space}${indicator}\n    ${REDACTED_PLACEHOLDER}\n`,
        ),
      ).toBe(YAML_BLOCK_REDACTED_MESSAGE);
    },
  );

  it.each(BLOCK_INDICATORS)(
    '编码器：data 下 token:%s（无空格）按 YAML 是普通标量，原样不动，不会把占位符编码成 base64',
    (indicator) => {
      const input = `data:\n  token:${indicator}\n    ${REDACTED_PLACEHOLDER}\n  other: ${b64('fake-o')}\n`;
      const out = encodeSecretYamlForSubmission(input);
      expect(out).toBe(input);
      expect(out).not.toContain(PH_B64);
    },
  );

  it.each(BLOCK_INDICATORS)(
    '格式检查：data 下 token:%s（无空格）→ 提示冒号后缺空格，文案只含键名',
    (indicator) => {
      const error = api.getYamlDataFormatError!(
        `data:\n  token:${indicator}\n    fake-line\n`,
      );
      expect(error).toBe(api.yamlDataMissingSpaceMessage!('token'));
      expect(error).not.toContain('fake-line');
    },
  );

  it.each([
    ['token:"fake-q"', 'token'],
    ["token:'fake-q'", 'token'],
    ['token:fake-q', 'token'],
    [`token:${b64('fake-q')}`, 'token'],
  ])('格式检查：data 下 %s（冒号后无空格）→ 缺空格提示', (line, key) => {
    expect(api.getYamlDataFormatError!(`data:\n  ${line}\n`)).toBe(
      api.yamlDataMissingSpaceMessage!(key),
    );
  });

  it('编码器：`token: |`（有空格）仍是块标量，照常编码', () => {
    expect(
      encodeSecretYamlForSubmission(`data:\n  token: |\n    fake-line\n`),
    ).toBe(`data:\n  token: ${b64('fake-line')}\n`);
  });
});

describe('incr7 P2-A 兜底：编码后、发请求前 data 里任何值 base64 解出来是占位符 → 拦截', () => {
  it.each([
    ['标准', PH_B64],
    ['前导空格', b64(` ${REDACTED_PLACEHOLDER}`)],
    ['尾随换行', b64(`${REDACTED_PLACEHOLDER}\n`)],
    ['CRLF', b64(`${REDACTED_PLACEHOLDER}\r\n`)],
    ['制表符', b64(`\t${REDACTED_PLACEHOLDER}\t`)],
    ['带双引号的 base64', `"${PH_B64}"`],
  ])(
    '%s：data.token 的值解码为占位符 → 返回兜底文案（只含键名）',
    (_, value) => {
      const error = api.getYamlDataPayloadError!(`data:\n  token: ${value}\n`);
      expect(error).toBe(api.yamlDataEncodedRedactedMessage!('token'));
    },
  );

  it('base64 被拆成多行（| 块里 Go 会忽略换行）也能识别', () => {
    const half = PH_B64.length / 2;
    expect(
      api.getYamlDataPayloadError!(
        `data:\n  token: |\n    ${PH_B64.slice(0, half)}\n    ${PH_B64.slice(half)}\n`,
      ),
    ).toBe(api.yamlDataEncodedRedactedMessage!('token'));
  });

  it('!!binary 标签的值解出来是占位符 → 拦截', () => {
    expect(
      api.getYamlDataPayloadError!(`data:\n  token: !!binary ${PH_B64}\n`),
    ).toBe(api.yamlDataEncodedRedactedMessage!('token'));
  });

  it('YAML 解析失败时仍按 token 扫描兜底（不依赖解析成功）', () => {
    expect(
      api.getYamlDataPayloadError!(
        `data:\n  token: ${PH_B64}\n  bad: [unclosed\n`,
      ),
    ).toBe(api.yamlDataEncodedRedactedMessage!('token'));
  });

  it('JSON 写法（流式映射）里的明文：不是 base64 → 拦截，文案不含值', () => {
    const error = api.getYamlDataPayloadError!(
      `{"apiVersion": "v1", "kind": "Secret", "data": {"token": "fake-plain-json"}}`,
    );
    expect(error).toBe(api.yamlDataNotBase64Message!('token'));
    expect(error).not.toContain('fake-plain-json');
  });

  it('数字等非字符串值（明文 PIN 之类）→ 不是 base64 拦截', () => {
    expect(api.getYamlDataPayloadError!(`data:\n  pin: 1234\n`)).toBe(
      api.yamlDataNotBase64Message!('pin'),
    );
  });

  it('反例：裸 <redacted>、正常 base64、空值、stringData 明文 → 放行', () => {
    expect(
      api.getYamlDataPayloadError!(
        `data:\n  a: ${REDACTED_PLACEHOLDER}\n  b: ${b64('fake-b')}\n  c: "${b64('fake-c')}"\n  d:\nstringData:\n  s: fake-plain-string-data\n`,
      ),
    ).toBeNull();
  });

  it('反例：没有 data 的 YAML 放行；data 为空映射放行', () => {
    expect(
      api.getYamlDataPayloadError!(`kind: Secret\nstringData:\n  s: x\n`),
    ).toBeNull();
    expect(api.getYamlDataPayloadError!(`kind: Secret\ndata: {}\n`)).toBeNull();
  });
});

describe('incr7 P3-C：data 下值写在下一行 / 编码器不支持的写法 → 提交前提示，不发明文', () => {
  it.each([
    ['双引号', `"fakeabcd"`],
    ['单引号', `'fakeabcd'`],
    ['普通明文', 'fake-plain'],
    ['看起来像 base64 的明文', 'fakeabcd'],
    ['块标量', '|\n      fake-line'],
  ])('`token:` 换行后%s → 请写在同一行', (_, next) => {
    const error = api.getYamlDataFormatError!(`data:\n  token:\n    ${next}\n`);
    expect(error).toBe(api.yamlDataNextLineMessage!('token'));
    expect(error).not.toContain('fake');
  });

  it('中间夹空行与注释也一样', () => {
    expect(
      api.getYamlDataFormatError!(
        `data:\n  token:\n\n    # c\n    "fakeabcd"\n`,
      ),
    ).toBe(api.yamlDataNextLineMessage!('token'));
  });

  it.each([
    ['单引号值', `  token: 'fake-q'`, 'token'],
    ['带引号的键', `  "token": "fake-q"`, '第 2 行'],
    ['标签', `  token: !!str "fake-q"`, 'token'],
    ['锚点', `  token: &a "fake-q"`, 'token'],
    ['流式值', `  token: ["fake-q"]`, 'token'],
    ['多行双引号', `  token: "fake-q\n    more"`, 'token'],
    ['YAML 转义（\\n）', `  token: "fake\\nq"`, 'token'],
    ['引号后还有内容', `  token: "fake-q" x`, 'token'],
    ['|- 块', `  token: |-\n    fake-q`, 'token'],
    ['> 块', `  token: >\n    fake-q`, 'token'],
    ['| 带注释', `  token: | # c\n    fake-q`, 'token'],
    ['同行值后的续行', `  token: ${b64('fake-q')}\n    more`, 'token'],
  ])('不支持的写法（%s）→ 提示改写', (_, line, where) => {
    expect(api.getYamlDataFormatError!(`data:\n${line}\n`)).toBe(
      api.yamlDataUnsupportedMessage!(where),
    );
  });

  it('data 写成同行流式映射（非 {}）→ 不支持', () => {
    expect(
      api.getYamlDataFormatError!(`kind: Secret\ndata: {token: "fake-q"}\n`),
    ).toBe(api.yamlDataUnsupportedMessage!('data'));
    expect(api.getYamlDataFormatError!(`kind: Secret\ndata: {}\n`)).toBeNull();
  });

  it('同行未加引号、又不是 base64 的明文 → 提示加双引号，文案不含值', () => {
    const error = api.getYamlDataFormatError!(
      `data:\n  token: fake-plain-value\n`,
    );
    expect(error).toBe(api.yamlDataNotBase64Message!('token'));
    expect(error).not.toContain('fake-plain-value');
  });

  it('反例：展示路径生成的写法全部放行（双引号明文、| 多行、裸占位符、base64、行尾注释、空行）', () => {
    expect(
      api.getYamlDataFormatError!(
        `apiVersion: v1\nkind: Secret\ndata:\n  a: "fake-a"  # c\n  b: |\n    fake-b1\n\n    fake-b2\n  c: ${REDACTED_PLACEHOLDER}\n\n  # 注释\n  d: ${b64('fake-d')}\n  e: "fa\\"ke\\\\e"\nmetadata:\n  name: x\n  annotations:\n    "fake.io/k": 'v'\nstringData:\n  s: 'fake-s'\n  t:\n    "fake-t"\n`,
      ),
    ).toBeNull();
  });

  it('反例：展示函数的输出本身能通过格式检查（含多行值、引号与反斜杠）', () => {
    const shown = processSecretYaml(
      `apiVersion: v1\nkind: Secret\ndata:\n  a: ${b64('fake-a')}\n  b: ${b64('fake-l1\nfake-l2')}\n  c: ${b64('fa"ke\\c')}\n  r: ${REDACTED_PLACEHOLDER}\n`,
    );
    expect(api.getYamlDataFormatError!(shown)).toBeNull();
  });
});

describe('incr7：块标量内容只吞更深缩进的行（原来 (?:\\s{2,}.*\\n?)* 会吞掉同级的键）', () => {
  it('块后的同级键保留，不被并进块内容', () => {
    expect(
      encodeSecretYamlForSubmission(
        `data:\n  k: |\n    fake-x\n  other: ${b64('fake-o')}\n`,
      ),
    ).toBe(`data:\n  k: ${b64('fake-x')}\n  other: ${b64('fake-o')}\n`);
  });

  it('块后隔两个空行的 stringData 保留', () => {
    const out = encodeSecretYamlForSubmission(
      `data:\n  k: |\n    fake-x\n\n\nstringData:\n  s: fake-s\n`,
    );
    expect(sentData(out)).toEqual({ k: b64('fake-x') });
    expect((yaml.load(out) as any).stringData).toEqual({ s: 'fake-s' });
  });

  it('块后紧跟顶层键：换行保留，不粘到下一行', () => {
    const out = encodeSecretYamlForSubmission(
      `data:\n  k: |\n    fake-x\nkind: Secret\n`,
    );
    expect(out).toBe(`data:\n  k: ${b64('fake-x')}\nkind: Secret\n`);
  });

  it('块内容缩进按首行算（YAML 语义），多缩进几格也不带进值里', () => {
    expect(
      encodeSecretYamlForSubmission(
        `data:\n  k: |\n      fake-x\n        fake-y\n`,
      ),
    ).toBe(`data:\n  k: ${b64('fake-x\n  fake-y')}\n`);
  });
});

describe('incr7：「是否在 data 下」按位置判断（原来 indexOf(match) 找的是第一处相同文本）', () => {
  it('编码器：stringData 里有一行与 data 里完全相同的 `k: "…"`，data 的那一行照样编码、stringData 的不动', () => {
    const out = encodeSecretYamlForSubmission(
      `stringData:\n  k: "fake-same"\ndata:\n  k: "fake-same"\n`,
    );
    expect(out).toBe(
      `stringData:\n  k: "fake-same"\ndata:\n  k: ${b64('fake-same')}\n`,
    );
  });

  it('展示：data 与其后的 stringData 有完全相同的一行，stringData 的不被解码（否则保存时值被改）', () => {
    const v = b64('fake-same');
    expect(
      processSecretYaml(`data:\n  k: ${v}\nstringData:\n  k: ${v}\n`),
    ).toBe(`data:\n  k: "fake-same"\nstringData:\n  k: ${v}\n`);
  });

  it('data 在第一行、data 头带行尾注释：同样识别', () => {
    const v = b64('fake-a');
    expect(processSecretYaml(`data:\n  a: ${v}\n`)).toBe(
      `data:\n  a: "fake-a"\n`,
    );
    expect(processSecretYaml(`kind: Secret\ndata: # c\n  a: ${v}\n`)).toBe(
      `kind: Secret\ndata: # c\n  a: "fake-a"\n`,
    );
    expect(encodeSecretYamlForSubmission(`data: # c\n  a: "fake-a"\n`)).toBe(
      `data: # c\n  a: ${v}\n`,
    );
  });

  it('locator：data 段从头行之后到下一个顶格非空、非注释行为止', () => {
    const text = `kind: Secret\ndata:\n  a: x\n# 顶格注释\n\n  b: y\nstringData:\n  c: z\n`;
    const inData = api.createDataSectionLocator!(text);
    expect(inData(text.indexOf('  a:'))).toBe(true);
    expect(inData(text.indexOf('  b:'))).toBe(true);
    expect(inData(text.indexOf('  c:'))).toBe(false);
    expect(inData(text.indexOf('kind'))).toBe(false);
  });
});

describe('incr7 P3-A：引号正则线性、展示 / 编码转义对称', () => {
  it.each([
    ['反斜杠结尾', 'fake\\'],
    ['双引号', 'fa"ke'],
    ['反斜杠 + 引号', 'fa\\"ke'],
    ['两个反斜杠', 'fa\\\\ke'],
    ['字面 \\n', 'fake\\nx'],
  ])(
    '%s：展示 → 编码往返后 base64 与原值相同；展示结果本身是合法 YAML 且值不变',
    (_, value) => {
      const original = `data:\n  k: ${b64(value)}\n`;
      const shown = processSecretYaml(original);
      expect((yaml.load(shown) as any).data.k).toBe(value);
      expect(encodeSecretYamlForSubmission(shown)).toBe(original);
    },
  );

  it('编码器：\\\\ 还原为一个反斜杠，\\" 还原为引号', () => {
    expect(encodeSecretYamlForSubmission(`data:\n  k: "a\\\\b\\"c"\n`)).toBe(
      `data:\n  k: ${b64('a\\b"c')}\n`,
    );
  });

  it('未闭合引号 + 27 组 `\\a`：< 500ms（原正则约 2.2s，k 每 +1 翻倍）', () => {
    const input = `data:\n  k: "${'\\a'.repeat(27)}\n`;
    let out = '';
    const ms = elapsed(() => (out = encodeSecretYamlForSubmission(input)));
    expect(ms).toBeLessThan(500);
    expect(out).toBe(input);
  });
});

describe('incr7：大输入线性时间（展示 :622 的 ^(\\s*)、m07、逐条 indexOf）', () => {
  it('展示：60k 空行后一个非 base64 值 < 500ms（原 ^(\\s*) 约 3.4s）', () => {
    const input = `data:\n${'\n'.repeat(60_000)}  k: fake-not-b64\n`;
    expect(elapsed(() => processSecretYaml(input))).toBeLessThan(500);
  });

  it('m07：编码器 60k 空行后一个未闭合引号 < 500ms（引号正则缩进若退回 ^(\\s*) 为平方级）', () => {
    const input = `data:\n${'\n'.repeat(60_000)}  k: "fake\n`;
    expect(elapsed(() => encodeSecretYamlForSubmission(input))).toBeLessThan(
      500,
    );
  });

  it('m07 同类：编码器 60k 空行后一个块标量头 < 500ms', () => {
    const input = `data:\n${'\n'.repeat(60_000)}  k: |x\n`;
    expect(elapsed(() => encodeSecretYamlForSubmission(input))).toBeLessThan(
      500,
    );
  });

  it('展示 / 编码各 20k 条 data < 500ms（原来每条都 indexOf + substring，平方级约 1.7–4s）', () => {
    const entries = Array.from({ length: 20_000 }, (_, i) => i);
    const shown = processSecretYaml(
      `data:\n${entries.map((i) => `  k${i}: ${b64(`fake-${i}`)}`).join('\n')}\n`,
    );
    expect(shown).toContain('  k19999: "fake-19999"');
    let out = '';
    const ms = elapsed(() => (out = encodeSecretYamlForSubmission(shown)));
    expect(ms).toBeLessThan(500);
    expect(out).toContain(`  k19999: ${b64('fake-19999')}`);
  });
});

describe('incr7 m09：块标量头只认同一行（`:[ \\t]+\\|`），不跨行', () => {
  it('`token:` 换行后的 `|` 编码器不处理（交给格式检查拦截）', () => {
    const input = `data:\n  token:\n    |\n      fake-line\n`;
    expect(encodeSecretYamlForSubmission(input)).toBe(input);
  });

  it('引号值同理：`token:` 换行后的 "…" 编码器不处理', () => {
    const input = `data:\n  token:\n    "fake-q"\n`;
    expect(encodeSecretYamlForSubmission(input)).toBe(input);
  });
});

describe('incr7：「打开 YAML、不改直接保存」不改动任何 data 值（展示结果必须能被编码器原样还原）', () => {
  /** 原值 → 展示 → 编码，base64 必须与原来逐字相同 */
  function roundTrip(encoded: string) {
    const original = `apiVersion: v1\nkind: Secret\ndata:\n  k: ${encoded}\n  z: ${b64('fake-z')}\n`;
    return {
      original,
      shown: processSecretYaml(original),
      saved: encodeSecretYamlForSubmission(processSecretYaml(original)),
    };
  }

  it('中间有空行的多行值：| 块展示，往返不丢空行（原来编码时把空行过滤掉）', () => {
    const { original, saved, shown } = roundTrip(b64('fake-a\n\nfake-b'));
    expect(shown).toContain('  k: |\n');
    expect(saved).toBe(original);
  });

  it('末尾带换行的值（如 PEM）：| 块无法原样表达，保留 base64 不解码，往返不变', () => {
    const value = b64('fake-pem-line1\nfake-pem-line2\n');
    const { original, saved, shown } = roundTrip(value);
    expect(shown).toContain(`  k: ${value}\n`);
    expect(saved).toBe(original);
  });

  it('首行以空白开头的多行值：保留 base64，往返不变', () => {
    const value = b64('  fake-indented\nfake-next');
    const { original, saved, shown } = roundTrip(value);
    expect(shown).toContain(`  k: ${value}\n`);
    expect(saved).toBe(original);
  });

  it('非 UTF-8 的二进制值：保留 base64（原来解成 U+FFFD，保存即改坏原值）', () => {
    const value = btoa(String.fromCharCode(0xff, 0xfe, 0x00, 0x80, 0x41));
    const { original, saved, shown } = roundTrip(value);
    expect(shown).toContain(`  k: ${value}\n`);
    expect(saved).toBe(original);
  });

  it('含控制字符（如 \\r、\\x1b）的值：保留 base64，往返不变', () => {
    for (const text of ['fake\rcr', 'fake\u001Besc']) {
      const value = b64(text);
      const { original, saved, shown } = roundTrip(value);
      expect(shown).toContain(`  k: ${value}\n`);
      expect(saved).toBe(original);
    }
  });

  it('非规范 base64（缺 padding）：保留原样，往返不变', () => {
    const { original, saved, shown } = roundTrip('ZmFrZS14');
    expect(shown).toContain('  k: "fake-x"\n');
    expect(saved).toBe(original);
    const unpadded = roundTrip('ZmFrZQ');
    expect(unpadded.shown).toContain('  k: ZmFrZQ\n');
    expect(unpadded.saved).toBe(unpadded.original);
  });

  it('块后空行与下一个键：编码后空行保留，下一个键不受影响', () => {
    expect(
      encodeSecretYamlForSubmission(
        `data:\n  k: |\n    fake-a\n\n\n  z: "fake-z"\n`,
      ),
    ).toBe(`data:\n  k: ${b64('fake-a')}\n\n\n  z: ${b64('fake-z')}\n`);
  });
});
