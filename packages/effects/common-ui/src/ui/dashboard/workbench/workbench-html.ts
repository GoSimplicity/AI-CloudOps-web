import DOMPurify from 'dompurify';

export function sanitizeWorkbenchHtml(content: string) {
  const clean = DOMPurify.sanitize(content, {
    FORBID_ATTR: ['style'],
  });
  return clean.replaceAll('\n', '<br>');
}
