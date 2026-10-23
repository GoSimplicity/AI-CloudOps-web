import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

function password() {
  if (process.env.CLOUDOPS_TEST_PASSWORD)
    return process.env.CLOUDOPS_TEST_PASSWORD;
  if (!process.env.CLOUDOPS_TEST_ENV_FILE) return undefined;
  return readFileSync(process.env.CLOUDOPS_TEST_ENV_FILE, 'utf8')
    .match(/^BOOTSTRAP_ADMIN_PASSWORD=(.*)$/m)?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, '');
}
const route = (path: string) =>
  process.env.CLOUDOPS_ROUTER_HISTORY === 'hash' ? `/#${path}` : path;

test('cloud account local CRUD preserves regions and never auto-verifies', async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  const privatePassword = password();
  test.skip(
    !privatePassword,
    'Requires isolated local administrator configuration',
  );
  const nonce = `cmdb-ui-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const forbidden: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (
      path.startsWith('/api/tree/') &&
      /\/verify$|\/sync$|available-regions/.test(path)
    )
      forbidden.push(path);
  });
  let token = '';
  let id = 0;
  const api = async (path: string, data?: unknown, method = 'GET') => {
    const response = await fetch(`http://localhost:18080/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json();
    if (response.status !== 200 || result.code !== 0)
      throw new Error('Owned local fixture API failed; private body omitted');
    return result.data;
  };
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(route('/auth/login'));
    await page.getByLabel('账号', { exact: true }).fill('admin');
    try {
      await page.getByLabel('密码', { exact: true }).fill(privatePassword!);
    } catch {
      throw new Error(
        'Private login input unavailable; sensitive detail omitted',
      );
    }
    const login = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/user/login',
    );
    await page.getByRole('button', { name: '登录', exact: true }).click();
    const authentication = await (await login).json();
    if (authentication.code !== 0)
      throw new Error('Private local authentication failed');
    token = authentication.data.accessToken;
    await expect(page).not.toHaveURL(/auth\/login/);
    await page.goto(route('/cloud_account_management'));
    await expect(page.locator('.ops-page h1')).toHaveText('云账户');
    await page.getByRole('button', { name: '添加账户', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('请输入云账户名称').fill(nonce);
    const codes = dialog.locator('#account-region-codes');
    await codes.fill('cn-hangzhou');
    await codes.press('Enter');
    await codes.fill('cn-shanghai');
    await codes.press('Enter');
    await expect(dialog.locator('.account-regions-editor')).toContainText(
      'cn-hangzhou',
    );
    await expect(dialog.locator('.account-regions-editor')).toContainText(
      'cn-shanghai',
    );
    await codes.press('Tab');
    await expect(dialog.locator('.ant-modal-body')).toHaveJSProperty(
      'scrollLeft',
      0,
    );
    await page.screenshot({
      path: '.cache/ui-verification/cloud-account-form-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });
    await dialog
      .getByPlaceholder('请输入 Access Key')
      .fill(`fake-access-${nonce}`);
    await dialog
      .getByPlaceholder('请输入 Secret Key')
      .fill(`fake-secret-${nonce}`);
    const created = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/tree/cloud/account/create',
    );
    await dialog.getByRole('button', { name: /^添\s*加$/ }).click();
    expect((await (await created).json()).code).toBe(0);
    await expect(dialog).not.toBeVisible();
    const rows = (
      await api(`/tree/cloud/account/list?page=1&size=10&search=${nonce}`)
    ).items;
    const account = rows.find((row: { name: string }) => row.name === nonce);
    expect(account).toBeDefined();
    id = account.id;
    const identities = account.regions
      .map((region: { id: number }) => region.id)
      .sort();
    await page.getByPlaceholder('搜索账户名称').fill(nonce);
    await page.getByPlaceholder('搜索账户名称').press('Enter');
    const row = page.locator('.ant-table-tbody tr').filter({ hasText: nonce });
    await expect(row).toHaveCount(1);
    await row
      .locator('button')
      .filter({ has: page.locator('[aria-label="edit"]') })
      .click();
    await expect(dialog.getByPlaceholder('请输入云账户名称')).toHaveValue(
      nonce,
    );
    await dialog.getByPlaceholder('请输入云账户名称').fill(`${nonce}-updated`);
    const updated = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
        `/api/tree/cloud/account/${id}/update`,
    );
    await dialog.getByRole('button', { name: /^更\s*新$/ }).click();
    const updateResponse = await updated;
    expect(updateResponse.request().postDataJSON()).not.toHaveProperty(
      'regions',
    );
    expect((await updateResponse.json()).code).toBe(0);
    const detail = await api(`/tree/cloud/account/${id}/detail`);
    expect(
      detail.regions.map((region: { id: number }) => region.id).sort(),
    ).toEqual(identities);
    await expect(page.locator('.ant-message-notice')).toHaveCount(0, {
      timeout: 10_000,
    });
    await page.getByLabel('深色', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '添加账户', exact: true }).click();
    await expect(dialog.locator('#account-region-codes')).toBeVisible();
    const cancel = dialog.getByRole('button', { name: /^取\s*消$/ });
    expect(
      await cancel.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        );
        return (
          rect.top >= 0 &&
          rect.bottom <= innerHeight &&
          !!hit &&
          element.contains(hit)
        );
      }),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: '.cache/ui-verification/cloud-account-form-mobile.png',
      fullPage: true,
      animations: 'disabled',
    });
    await dialog.getByRole('button', { name: /^取\s*消$/ }).click();
    expect(forbidden).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    if (token) {
      const owned = (
        await api(`/tree/cloud/account/list?page=1&size=100&search=${nonce}`)
      ).items.filter(
        (row: { id: number; name: string }) =>
          (id === 0 || row.id === id) &&
          [nonce, `${nonce}-updated`].includes(row.name),
      );
      for (const account of owned) {
        const detail = await api(`/tree/cloud/account/${account.id}/detail`);
        for (const region of detail.regions ?? []) {
          if (region.cloud_account_id !== account.id)
            throw new Error('Refusing foreign region cleanup');
          await api(
            `/tree/cloud/account/region/${region.id}/delete`,
            undefined,
            'DELETE',
          );
        }
        await api(
          `/tree/cloud/account/${account.id}/delete`,
          undefined,
          'DELETE',
        );
      }
      await api('/user/logout', {}, 'POST');
    }
  }
});
