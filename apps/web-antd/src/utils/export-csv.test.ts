import { describe, expect, it } from 'vitest';
import { encodeCsv } from './export-csv';

describe('CSV exports', () => {
  it('preserves Chinese, commas, quotes and line breaks', () => {
    expect(encodeCsv([['标题', 'a,b', '"hello"', 'a\nb', null]])).toBe(
      '\uFEFF"标题","a,b","""hello""","a\nb",""',
    );
  });
  it('neutralizes spreadsheet formulas including whitespace prefixes', () => {
    expect(encodeCsv([['=1+1', '\t@SUM(1)', '+cmd', '-1']])).toBe(
      '\uFEFF"\'=1+1","\'\t@SUM(1)","\'+cmd","\'-1"',
    );
  });
});
