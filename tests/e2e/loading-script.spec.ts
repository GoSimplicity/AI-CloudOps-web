import process from 'node:process';

import { expect, test } from '@playwright/test';

test.skip(
  process.env.CLOUDOPS_PREVIEW !== 'true',
  '只检查生产 preview；开发服务器仍内联主题脚本',
);

test('生产预览的 HTML 没有内联脚本，script-src self 不拦截主题脚本', async ({
  page,
}) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (
      text.includes('Content Security Policy') ||
      text.includes('Refused to execute')
    ) {
      violations.push(text);
    }
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.resourceType() !== 'document') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const headers = response.headers();
    headers['content-security-policy'] = "script-src 'self'";
    await route.fulfill({
      body: await response.body(),
      headers,
      status: response.status(),
    });
    expect(url.pathname).toBe('/');
  });

  const source = await page.request.get('/');
  const html = await source.text();
  const scripts = html.match(/<script\b[^>]*>/g) ?? [];
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((tag) => tag.includes(' src="'))).toBe(true);
  expect(html).toContain('/jse/app-loading-theme-');

  await page.goto('/');
  await expect(page.locator('#__app-loading__, #app').first()).toBeVisible();
  expect(violations).toEqual([]);
});
