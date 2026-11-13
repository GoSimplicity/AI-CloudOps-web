import { describe, expect, it } from 'vitest';

import {
  encodeSecretYamlForSubmission,
  encodeUtf8ToBase64,
  yamlHasQuotedRedacted,
} from './secret-data';

function elapsed(run: () => unknown) {
  const start = performance.now();
  run();
  return performance.now() - start;
}

describe('yaml 回溯边界', () => {
  it('换行占位符仍识别标签、锚点和行尾注释', () => {
    expect(
      yamlHasQuotedRedacted(
        'data:\n  token: &anchor !tag # keep\n    "<redacted>"\n',
      ),
    ).toBe(true);
    expect(
      yamlHasQuotedRedacted('data:\n  token: &foo#bar baz\n    "<redacted>"\n'),
    ).toBe(true);
    expect(
      yamlHasQuotedRedacted('data:\n  token: value\n    "<redacted>"\n'),
    ).toBe(false);
  });

  it('键行里的 U+2028 不把后续占位符算成该键的值，8 万个 # 低于 500ms', () => {
    const line = `  token: &${'#'.repeat(80_000)}\u2028`;
    let matched = true;
    expect(
      elapsed(() => {
        matched = yamlHasQuotedRedacted(`data:\n${line}\n    "<redacted>"\n`);
      }),
    ).toBeLessThan(500);
    expect(matched).toBe(false);
    expect(
      yamlHasQuotedRedacted('data:\n  token: &#\u2028\n    "<redacted>"\n'),
    ).toBe(false);
  });

  it('块标量仍只编码更深缩进的行，长空白行低于 500ms', () => {
    const plain = 'fake-x';
    const input = `data:\n  k: |\n    ${plain}\n${' '.repeat(80_000)}\n  other: ${encodeUtf8ToBase64('fake-o')}\n`;
    let out = '';
    expect(
      elapsed(() => {
        out = encodeSecretYamlForSubmission(input);
      }),
    ).toBeLessThan(500);
    // 纯空白行属于块内空行，编码时不把这 8 万个空格原样带回；同级 other 仍留在块外。
    expect(out).toBe(
      `data:\n  k: ${encodeUtf8ToBase64(plain)}\n\n  other: ${encodeUtf8ToBase64('fake-o')}\n`,
    );
    expect(
      encodeSecretYamlForSubmission(
        'data:\n  k: |\n    ab\u2028cd\n  next: "n"\n',
      ),
    ).toBe(
      `data:\n  k: ${encodeUtf8ToBase64('ab')}\u2028cd\n  next: ${encodeUtf8ToBase64('n')}\n`,
    );
  });
});
