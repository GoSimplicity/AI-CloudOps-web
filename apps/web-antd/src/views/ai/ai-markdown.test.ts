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

  it('锚点、相对路径和同源绝对地址不加 _blank，外部链接加 _blank 和 rel', () => {
    const origin = window.location.origin;
    const html = sanitizeAiMarkdownHtml(
      [
        '<a href="#section">锚点</a>',
        '<a href="/docs">相对</a>',
        `<a href="${origin}/docs">同源</a>`,
        '<a href="https://example.com/docs">外部</a>',
      ].join(''),
    );
    const [anchor, relative, sameOrigin, external] = anchors(html);
    expect(anchor?.getAttribute('target')).toBeNull();
    expect(relative?.getAttribute('target')).toBeNull();
    expect(sameOrigin?.getAttribute('target')).toBeNull();
    expect(external?.getAttribute('target')).toBe('_blank');
    expect(external?.getAttribute('rel')).toBe('noopener noreferrer');
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
