import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('测试前置条件缺失');
  }
  return value;
}

/**
 * 复审 P3-5：注释要紧挨着它描述的声明（第二轮插入 SECRET_DETAIL_PERMISSION_CODE 时把
 * 「全部按钮 key → 权限码」的注释挤到了别的声明上面）。
 */
const source = readFileSync(
  resolve(import.meta.dirname, 'permission-codes.ts'),
  'utf8',
);
const lines = source.split('\n');

function lineBefore(declaration: string) {
  const index = lines.findIndex((line) => line.startsWith(declaration));
  expect(index).toBeGreaterThan(0);
  return required(lines[index - 1]).trim();
}

describe('permission-codes.ts 注释位置（复审 P3-5）', () => {
  it('「全部按钮 key → 权限码」注释紧贴 ALL_PERMISSION_CODES', () => {
    expect(lineBefore('export const ALL_PERMISSION_CODES')).toBe(
      '/** 全部按钮 key → 权限码（S1 ∪ S1b ∪ S2 ∪ S3） */',
    );
  });

  it('sECRET_DETAIL_PERMISSION_CODE 的说明块只有一个，上面不再叠着别的注释', () => {
    const index = lines.findIndex((line) =>
      line.startsWith('export const SECRET_DETAIL_PERMISSION_CODE'),
    );
    let start = index - 1;
    while (start > 0 && !required(lines[start]).trim().startsWith('/**'))
      start -= 1;
    expect(required(lines[start]).trim()).toBe('/**');
    expect(required(lines[start - 1]).trim()).toBe('');
  });
});
