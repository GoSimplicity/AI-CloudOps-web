import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

function adminPassword() {
  if (process.env.CLOUDOPS_TEST_PASSWORD) return process.env.CLOUDOPS_TEST_PASSWORD;
  if (!process.env.CLOUDOPS_TEST_ENV_FILE) return undefined;
  const content = readFileSync(process.env.CLOUDOPS_TEST_ENV_FILE, 'utf8');
  return content.match(/^BOOTSTRAP_ADMIN_PASSWORD=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
}

test('login is usable on mobile and supports both themes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/auth/login');
  await expect(page.getByRole('heading', { name: '登录运维工作台' })).toBeVisible();
  await expect(page.getByLabel('账号', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '手机号登录' })).toHaveCount(0);
  await page.getByRole('button', { name: '切换深色' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: '切换浅色' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('authenticated navigation renders every standalone business route', async ({ page }) => {
  test.setTimeout(240_000);
  const password = adminPassword();
  test.skip(!password, 'Set CLOUDOPS_TEST_PASSWORD or CLOUDOPS_TEST_ENV_FILE for isolated test administrator.');
  const errors: string[] = [];
  const apiFailures: string[] = [];
  const responses: string[] = [];
  page.on('response', async response => { if (response.url().includes('/api/')) { try { const body = await response.json(); responses.push(`${new URL(response.url()).pathname} status=${response.status()} code=${body.code} message=${body.message || ''}`); } catch { /* non-JSON response */ } } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      apiFailures.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  await page.goto('/auth/login');
  await page.getByLabel('账号', { exact: true }).fill(process.env.CLOUDOPS_TEST_USER || 'admin');
  await page.getByLabel('密码', { exact: true }).fill(password!);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.evaluate(() => { const input = document.querySelector<HTMLInputElement>('#password'); if (input) input.value = ''; });
  await page.waitForTimeout(1200);
  expect(errors, `login runtime errors; ${responses.join('; ')}`).toEqual([]);
  expect(apiFailures, 'login API errors').toEqual([]);
  await expect(page).not.toHaveURL(/auth\/login/);
  const dir = resolve('apps/web-antd/src/router/routes/modules');
  const routes = readdirSync(dir).flatMap(file => {
    const source = readFileSync(resolve(dir, file), 'utf8');
    return [...source.matchAll(/path:\s*'([^']+)',\s*component:\s*\(\)\s*=>/g)].map(match => match[1]!);
  }).filter(route => !route.includes(':') && !route.includes('terminal'));
  for (const route of [...new Set(routes)]) {
    await page.goto(route);
    await page.waitForTimeout(700);
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page).not.toHaveURL(/auth\/login/);
  }
  expect(errors, 'browser runtime errors').toEqual([]);
  expect([...new Set(apiFailures)], 'authenticated API failures').toEqual([]);
});
