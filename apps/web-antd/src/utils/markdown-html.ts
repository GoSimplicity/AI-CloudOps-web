import DOMPurify from 'dompurify';

/**
 * AI 聊天把 marked 的结果交给这份白名单。
 * style 不在名单里：DOMPurify 把 style 当作不检查值的属性，
 * position:fixed 会盖住页面，expression() 和 url(javascript:) 也会原样留下。
 * 旧配置里的 ALLOWED_CLASSES 不是 DOMPurify 3.4 的选项，运行时没有生效。
 */
export function sanitizeAiMarkdownHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOW_DATA_ATTR: true,
    ALLOWED_ATTR: [
      'href',
      'target',
      'rel',
      'src',
      'alt',
      'title',
      'class',
      'data-code',
      'width',
      'height',
      'viewBox',
      'fill',
      'stroke',
      'stroke-width',
      'x',
      'y',
      'rx',
      'ry',
      'd',
      'points',
    ],
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'del',
      's',
      'code',
      'pre',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'hr',
      'div',
      'span',
      'button',
      'svg',
      'rect',
      'path',
      'polyline',
    ],
  });
}

/**
 * 助手回答和文档摘要。默认配置允许 style 且不检查值，这里明确去掉。
 * 其余默认标签和 https 链接保持不变。
 */
export function sanitizeAssistantMarkdownHtml(html: string): string {
  return DOMPurify.sanitize(html, { FORBID_ATTR: ['style'] });
}
