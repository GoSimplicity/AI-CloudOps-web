import { describe, expect, it } from 'vitest';

import { formatCommentContent } from './comment-content';

function render(content: string): HTMLDivElement {
  const root = document.createElement('div');
  root.innerHTML = formatCommentContent(content);
  return root;
}

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

  it("renders it's as an apostrophe instead of a split character reference", () => {
    const html = formatCommentContent("it's ok");
    expect(render("it's ok").textContent).toBe("it's ok");
    expect(html).not.toContain('<span class="hashtag">#39</span>');
    expect(html.includes("'")).toBe(false);

    const multiline = render("it's\nok");
    expect(multiline.textContent).toBe("it'sok");
    expect(multiline.querySelector('br')).not.toBeNull();
  });

  it('renders quotes and ampersands as typed', () => {
    expect(render('say "hi"').textContent).toBe('say "hi"');
    expect(formatCommentContent('say "hi"')).toContain('&quot;');
    expect(render('a & b').textContent).toBe('a & b');
    expect(formatCommentContent('a & b')).toContain('&amp;');
    expect(render('&amp;').textContent).toBe('&amp;');
    expect(formatCommentContent('&amp;')).toBe('&amp;amp;');
  });

  it('highlights #tag and a hash glued to a letter', () => {
    const glued = render('a#b');
    expect(glued.textContent).toBe('a#b');
    expect(glued.querySelector('.hashtag')?.textContent).toBe('#b');

    const tag = render('#tag');
    expect(tag.textContent).toBe('#tag');
    expect(tag.querySelector('.hashtag')?.textContent).toBe('#tag');

    expect(render('#39').querySelector('.hashtag')?.textContent).toBe('#39');
  });

  it('escapes script and image markup', () => {
    const payload = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    const html = formatCommentContent(payload);
    const view = render(payload);
    expect(view.textContent).toBe(payload);
    expect(view.querySelectorAll('script, img, iframe')).toHaveLength(0);
    expect(html.includes('<script')).toBe(false);
    expect(html.includes('<img')).toBe(false);
  });

  it('highlights a mention and a hashtag in the same escaped comment', () => {
    const input = `@ops it's #incident & "ok" <b>`;
    const view = render(input);
    expect(view.textContent).toBe(input);
    expect(view.querySelector('.mention')?.textContent).toBe('@ops');
    expect(view.querySelector('.hashtag')?.textContent).toBe('#incident');
    expect(view.querySelectorAll('.hashtag')).toHaveLength(1);
    expect(view.querySelectorAll('b, script, img')).toHaveLength(0);
  });
});
