import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { marked } from 'marked';
import { describe, expect, it } from 'vitest';

import { sanitizeAiMarkdownHtml } from './ai-markdown';

function anchors(html: string) {
  return [
    ...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('a'),
  ];
}

describe('ai 页新窗口链接', () => {
  it('markdown 渲染和已有 target=_blank 都带 noopener noreferrer', () => {
    const fromMarkdown = sanitizeAiMarkdownHtml(
      String(marked('[文档](https://example.com/docs)')),
    );
    const markdownLink = anchors(fromMarkdown)[0];
    expect(markdownLink?.getAttribute('target')).toBe('_blank');
    expect(markdownLink?.getAttribute('rel')).toBe('noopener noreferrer');

    const raw = sanitizeAiMarkdownHtml(
      '<a href="https://example.com/a" target="_blank">外链</a>',
    );
    const rawLink = anchors(raw)[0];
    expect(rawLink?.getAttribute('target')).toBe('_blank');
    expect(rawLink?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(raw).toContain('外链');
  });

  it('页面模板里的 target=_blank 同时写 rel', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'ai.vue'),
      'utf8',
    );
    const tags = source.match(/<a [^>]*target="_blank"[^>]*>/g) ?? [];
    expect(
      tags.filter((tag) => !tag.includes('rel="noopener noreferrer"')),
    ).toEqual([]);
  });
});
