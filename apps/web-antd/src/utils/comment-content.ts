/** Comment bodies are plain text. Only application-owned formatting becomes HTML. */
export function formatCommentContent(content: string): string {
  return content
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replace(/\n/g, '<br>')
    .replaceAll(/@(\w+)/g, '<span class="mention">@$1</span>')
    .replaceAll(/#(\w+)/g, '<span class="hashtag">#$1</span>');
}
