import { describe, expect, it } from 'vitest';
import { formatCommentContent } from './comment-content';

describe('comment rendering', () => {
  it('escapes attacker HTML before adding text formatting', () => {
    const html = formatCommentContent(
      '<img src=x onerror=alert(1)>\n@ops #incident',
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('<br><span class="mention">@ops</span>');
    expect(html).toContain('<span class="hashtag">#incident</span>');
  });
});
