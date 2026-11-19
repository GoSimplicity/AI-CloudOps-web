import DOMPurify from 'dompurify';

export function sanitizeAssistantMarkdownHtml(html: string) {
  return DOMPurify.sanitize(html, {
    FORBID_ATTR: ['action', 'formaction', 'style'],
    FORBID_TAGS: ['form'],
  });
}
