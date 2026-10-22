import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

function routePath(path: string) {
  return process.env.CLOUDOPS_ROUTER_HISTORY === 'hash' ? `/#${path}` : path;
}

function adminPassword() {
  if (process.env.CLOUDOPS_TEST_PASSWORD) return process.env.CLOUDOPS_TEST_PASSWORD;
  if (!process.env.CLOUDOPS_TEST_ENV_FILE) return undefined;
  const content = readFileSync(process.env.CLOUDOPS_TEST_ENV_FILE, 'utf8');
  return content.match(/^BOOTSTRAP_ADMIN_PASSWORD=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
}

test('login is usable on mobile and supports both themes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(routePath('/auth/login'));
  await expect(page.getByRole('heading', { name: '登录运维工作台' })).toBeVisible();
  await expect(page.getByLabel('账号', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '手机号登录' })).toHaveCount(0);
  await page.getByRole('button', { name: '切换深色' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.waitForTimeout(200);
  await page.reload();
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
  await page.goto(routePath('/auth/login'));
  await page.getByLabel('账号', { exact: true }).fill(process.env.CLOUDOPS_TEST_USER || 'admin');
  await page.getByLabel('密码', { exact: true }).fill(password!);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.evaluate(() => { const input = document.querySelector<HTMLInputElement>('#password'); if (input) input.value = ''; });
  await page.waitForTimeout(1200);
  expect(errors, `login runtime errors; ${responses.join('; ')}`).toEqual([]);
  expect(apiFailures, 'login API errors').toEqual([]);
  await expect(page).not.toHaveURL(/auth\/login/);
  const dir = resolve('apps/web-antd/src/router/routes/modules');
  const routes: string[] = [];
  for (const file of readdirSync(dir)) {
    const source = ts.createSourceFile(file, readFileSync(resolve(dir, file), 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (ts.isObjectLiteralExpression(node)) {
        const properties = node.properties.filter(ts.isPropertyAssignment);
        const path = properties.find(property => property.name.getText(source) === 'path');
        const component = properties.find(property => property.name.getText(source) === 'component');
        if (path && component && ts.isStringLiteral(path.initializer) && ts.isArrowFunction(component.initializer)) {
          const value = path.initializer.text;
          if (!value.includes(':') && !value.includes('terminal')) routes.push(value);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const route of [...new Set(routes)]) {
    await page.goto(routePath(route));
    await page.waitForTimeout(700);
    if (route === '/system_welcome') {
      await expect(page.locator('.metric-value').first()).not.toHaveText('待采集', { timeout: 15_000 });
      await expect(page.locator('.chart-container canvas')).toBeVisible();
      await expect(page.locator('.chart-container-small canvas')).toBeVisible();
    }
    await expect(page.locator('body')).not.toBeEmpty();
    await expect.poll(() => { const url = new URL(page.url()); return url.hash.startsWith('#/') ? url.hash.slice(1).split('?')[0] : url.pathname; }).toBe(route);
    await expect(page).not.toHaveURL(/auth\/login/);
  }
  expect(errors, 'browser runtime errors').toEqual([]);
  const expectedUnavailable = new Set((process.env.CLOUDOPS_EXPECT_UNAVAILABLE || '').split(',').filter(Boolean));
  const observedFailures = [...new Set(apiFailures)];
  const unexpected = observedFailures.filter(failure => {
    const [status, path] = failure.split(' ');
    if (status === '503' && expectedUnavailable.has(path!)) {
      test.info().annotations.push({ type: 'expected-unavailable', description: path! });
      return false;
    }
    return true;
  });
  expect(unexpected, 'authenticated API failures').toEqual([]);
});
