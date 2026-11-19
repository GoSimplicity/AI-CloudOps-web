import { marked } from 'marked';
import { describe, expect, it } from 'vitest';

import { sanitizeAssistantMarkdownHtml } from './assistant-markdown';

describe('助手 markdown 净化', () => {
  it('去掉 form、action、formaction 和 style，保留正文与换行', () => {
    const html = sanitizeAssistantMarkdownHtml(
      [
        '<form action="https://example.com/post"><p>表单正文</p></form>',
        '<button formaction="https://example.com/go">提交</button>',
        '<p style="position:fixed;inset:0">覆盖层</p>',
        String(marked('第一行\n\n第二行')),
      ].join(''),
    );
    expect(html).not.toContain('<form');
    expect(html).not.toContain('action=');
    expect(html).not.toContain('formaction');
    expect(html).not.toContain('style=');
    expect(html).toContain('表单正文');
    expect(html).toContain('提交');
    expect(html).toContain('覆盖层');
    expect(html).toContain('第一行');
    expect(html).toContain('第二行');
  });
});
