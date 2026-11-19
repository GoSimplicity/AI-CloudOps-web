import DOMPurify from 'dompurify';

const aiMarkdownConfig = {
  ALLOW_DATA_ATTR: true,
  ALLOWED_ATTR: [
    'href',
    'target',
    'rel',
    'src',
    'alt',
    'title',
    'class',
    'style',
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
};

function isExternalLink(href: string) {
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    url.origin !== window.location.origin
  );
}

function blankLinkRel(node: Element) {
  if (node.tagName !== 'A') return;
  const href = node.getAttribute('href');
  if (!href) {
    node.removeAttribute('target');
    return;
  }
  if (!isExternalLink(href)) return;
  node.setAttribute('target', '_blank');
  node.setAttribute('rel', 'noopener noreferrer');
}

export function sanitizeAiMarkdownHtml(html: string) {
  const purify = DOMPurify(window);
  purify.addHook('afterSanitizeAttributes', (node) => {
    if (node instanceof Element) blankLinkRel(node);
  });
  return purify.sanitize(html, aiMarkdownConfig);
}
