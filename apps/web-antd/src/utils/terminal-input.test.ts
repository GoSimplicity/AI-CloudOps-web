import { describe, expect, it } from 'vitest';
import { utf8Chunks } from './terminal-input';

const encoder = new TextEncoder();
const limit = 64 * 1024;

describe('终端 UTF-8 输入分片', () => {
  it.each([
    ['ASCII等于上限', 'a'.repeat(limit), 1],
    ['ASCII超出上限', 'a'.repeat(limit + 1), 2],
    ['中文跨边界', 'a'.repeat(limit - 1) + '中', 2],
    ['emoji跨边界', 'a'.repeat(limit - 2) + '😀', 2],
    ['完整emoji恰好上限', '😀'.repeat(limit / 4), 1],
    ['中文emoji与NUL混合', '中文😀\0\r\n'.repeat(10_000), 2],
    ['NUL最坏JSON转义', '\0'.repeat(limit + 1), 2],
  ] as const)('%s保留完整输入且每片不超过64KiB', (_name, input, expected) => {
    const chunks = utf8Chunks(input);
    expect(chunks.length).toBe(expected);
    expect(chunks.join('')).toBe(input);
    for (const chunk of chunks) {
      expect(encoder.encode(chunk).byteLength).toBeLessThanOrEqual(limit);
      expect(
        encoder.encode(JSON.stringify({ op: 'stdin', data: chunk })).byteLength,
      ).toBeLessThan(512 * 1024);
      expect(chunk).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
    }
  });
  it('空输入不产生空帧，极小有效预算仍支持ASCII', () => {
    expect(utf8Chunks('')).toEqual([]);
    expect(utf8Chunks('abc\0', 1)).toEqual(['a', 'b', 'c', '\0']);
    expect(utf8Chunks('中中', 3)).toEqual(['中', '中']);
  });
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    '拒绝无效预算 %s',
    (value) => {
      expect(() => utf8Chunks('text', value)).toThrow(RangeError);
    },
  );
  it('预算容不下完整码点时拒绝拆坏emoji', () => {
    expect(() => utf8Chunks('😀', 3)).toThrow(RangeError);
  });
});
