function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Comment bodies are plain text. Only application-owned formatting becomes HTML.
 * Mentions and hashtags are taken from the raw text, then every segment is
 * escaped. Scanning escaped text would treat &#39; as a hashtag.
 */
export function formatCommentContent(content: string): string {
  const pattern = /(@\w+|#\w+|\n)/g;
  let html = '';
  let cursor = 0;
  for (const match of content.matchAll(pattern)) {
    const index = match.index ?? 0;
    html += escapeHtml(content.slice(cursor, index));
    const token = match[0];
    if (token === '\n') {
      html += '<br>';
    } else {
      const kind = token.startsWith('@') ? 'mention' : 'hashtag';
      html += `<span class="${kind}">${escapeHtml(token)}</span>`;
    }
    cursor = index + token.length;
  }
  return html + escapeHtml(content.slice(cursor));
}
