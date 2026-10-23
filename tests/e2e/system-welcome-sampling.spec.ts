import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

function password() {
  if (process.env.CLOUDOPS_TEST_PASSWORD)
    return process.env.CLOUDOPS_TEST_PASSWORD;
  return process.env.CLOUDOPS_TEST_ENV_FILE
    ? readFileSync(process.env.CLOUDOPS_TEST_ENV_FILE, 'utf8')
        .match(/^BOOTSTRAP_ADMIN_PASSWORD=(.*)$/m)?.[1]
        ?.trim()
        .replace(/^['"]|['"]$/g, '')
    : undefined;
}
const route = (path: string) =>
  process.env.CLOUDOPS_ROUTER_HISTORY === 'hash' ? `/#${path}` : path;

test('welcome displays local metrics, read-only refresh and compact themed mobile charts', async ({
  page,
}) => {
  test.setTimeout(60_000);
  page.setDefaultTimeout(12_000);
  const privatePassword = password();
  test.skip(
    !privatePassword,
    'Requires an explicitly configured isolated local administrator',
  );
  const forbidden: string[] = [],
    errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (
      path.startsWith('/api/v1/') ||
      (path.startsWith('/api/system/') && request.method() !== 'GET')
    )
      forbidden.push(`${request.method()} ${path}`);
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(route('/auth/login'));
  await page.getByLabel('账号', { exact: true }).fill('admin');
  try {
    await page.getByLabel('密码', { exact: true }).fill(privatePassword!);
  } catch {
    throw new Error('Private login field unavailable; credential omitted');
  }
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).not.toHaveURL(/auth\/login/, { timeout: 30_000 });
  const measured = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/system/metrics' &&
      response.request().method() === 'GET',
  );
  await page.goto(route('/system_welcome'));
  const response = await measured;
  expect(response.status()).toBe(200);
  const snapshot = (await response.json()).data;
  expect(typeof snapshot.cpu_usage).toBe('number');
  expect(typeof snapshot.network_in).toBe('number');
  await expect(page.locator('.sample-status')).not.toHaveText('正在读取采样');
  await expect(page.locator('.ops-page h1')).toHaveText('系统欢迎页');
  await expect(page.locator('.metric-card')).toHaveCount(4);
  await expect(
    page.getByText(snapshot.hostname, { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.metric-card').first().locator('.metric-value'),
  ).toHaveText(snapshot.cpu_usage.toFixed(1));
  await expect(
    page.getByRole('heading', { name: '累计网络流量', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.chart-container canvas')).toHaveCount(1);
  await expect(page.locator('.chart-container-small canvas')).toHaveCount(1);
  const refresh = page.waitForResponse(
    (result) =>
      new URL(result.url()).pathname === '/api/system/metrics' &&
      result.request().method() === 'GET',
  );
  await page.getByRole('button', { name: '刷新采样', exact: true }).click();
  expect((await refresh).status()).toBe(200);
  await expect(page.locator('.sample-status')).not.toHaveText('正在读取采样');
  if (
    await page
      .locator('html')
      .evaluate((element) => element.classList.contains('dark'))
  )
    await page.getByLabel('浅色', { exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.screenshot({
    path: '.cache/ui-verification/system-welcome-desktop-light.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('深色', { exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.waitForTimeout(180);
  const boxes = await page.locator('.metric-card').evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect();
      return { width: box.width, height: box.height, top: box.top };
    }),
  );
  expect(
    boxes.every(
      (box) => box.width > 100 && box.width < 200 && box.height < 160,
    ),
  ).toBe(true);
  expect(Math.abs(boxes[0]!.top - boxes[1]!.top)).toBeLessThan(2);
  expect(boxes[2]!.top).toBeGreaterThan(boxes[0]!.top);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const theme = page.getByLabel('深色', { exact: true });
  await theme.scrollIntoViewIfNeeded();
  expect(
    await theme.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2,
      );
      return hit === element || element.contains(hit);
    }),
  ).toBe(true);
  await page.screenshot({
    path: '.cache/ui-verification/system-welcome-mobile-dark.png',
    fullPage: true,
    animations: 'disabled',
  });
  // 仅浏览器隔离故障注入，不改变后端采样或业务数据
  await page.route('**/api/system/metrics', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 503,
        message: '隔离验收：采样不可用',
        data: null,
      }),
    }),
  );
  await page.getByRole('button', { name: '刷新采样', exact: true }).click();
  await expect(page.locator('.metric-value')).toHaveText([
    '未知',
    '未知',
    '未知',
    '未知',
  ]);
  await expect(page.locator('.sample-status')).toHaveText('采样不可用或不完整');
  await expect(page.locator('.chart-container')).not.toBeVisible();
  await page.unroute('**/api/system/metrics');
  await page.route('**/api/system/metrics', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, data: null }),
    }),
  );
  await page.getByRole('button', { name: '刷新采样', exact: true }).click();
  await expect(page.locator('.metric-value')).toHaveText([
    '未知',
    '未知',
    '未知',
    '未知',
  ]);
  await expect(page.getByText('暂无性能采样', { exact: true })).toBeVisible();
  await page.unroute('**/api/system/metrics');
  expect(forbidden).toEqual([]);
  expect(errors).toEqual([]);
});
