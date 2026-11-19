import { marked } from 'marked';
import { describe, expect, it } from 'vitest';

import {
  sanitizeAiMarkdownHtml,
  sanitizeAssistantMarkdownHtml,
} from './markdown-html';

function render(sanitize: (html: string) => string, markdown: string) {
  const root = document.createElement('div');
  root.innerHTML = sanitize(String(marked.parse(markdown)));
  return root;
}

const sanitizers = [
  ['ai', sanitizeAiMarkdownHtml],
  ['assistant', sanitizeAssistantMarkdownHtml],
] as const;

describe('markdown html 净化', () => {
  it.each(sanitizers)(
    '%s 去掉能盖住页面的 style，并丢掉 javascript 与事件',
    (_name, sanitize) => {
      const overlay = render(
        sanitize,
        '<div style="position:fixed;inset:0">cover</div>',
      );
      expect(overlay.querySelector('div')?.getAttribute('style')).toBeNull();
      expect(overlay.textContent).toContain('cover');

      const expression = render(
        sanitize,
        '<p style="width:expression(alert(1));background:url(javascript:alert(1))">x</p>',
      );
      expect(expression.querySelector('p')?.getAttribute('style')).toBeNull();

      const link = render(sanitize, '<a href="javascript:alert(1)">go</a>');
      expect(link.querySelector('a')?.getAttribute('href')).toBeNull();
      expect(
        link.querySelectorAll('[onclick], [onerror], script, iframe'),
      ).toHaveLength(0);

      const dataLink = render(
        sanitize,
        '<a href="data:text/html,<script>alert(1)</script>">go</a>',
      );
      expect(dataLink.querySelector('a')?.getAttribute('href')).toBeNull();
    },
  );

  it.each(sanitizers)(
    '%s 仍保留换行、强调、代码和 https 链接',
    (_name, sanitize) => {
      const view = render(
        sanitize,
        '**粗体**\n\n[文档](https://example.com/docs)\n\n`code`',
      );
      expect(view.querySelector('strong')?.textContent).toBe('粗体');
      expect(view.querySelector('a')?.getAttribute('href')).toBe(
        'https://example.com/docs',
      );
      expect(view.querySelector('a')?.textContent).toBe('文档');
      expect(view.querySelector('code')?.textContent).toBe('code');
      expect(view.querySelectorAll('p, br').length).toBeGreaterThan(0);
      const coded = render(sanitize, '<div class="code-header">hdr</div>');
      expect(coded.querySelector('.code-header')?.textContent).toBe('hdr');
    },
  );
});
