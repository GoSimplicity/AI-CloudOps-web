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
const routePath = (path: string) =>
  process.env.CLOUDOPS_ROUTER_HISTORY === 'hash' ? `/#${path}` : path;

test('cloud account local CRUD preserves regions and never auto-verifies', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  expect(['localhost', '127.0.0.1']).toContain(new URL(baseURL!).hostname);
  const privatePassword = password();
  test.skip(!privatePassword, 'Requires an isolated local administrator');
  const prefix = `cmdb-ui-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const forbidden: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Abort before the backend can reach a cloud SDK, not just observe afterwards.
  await page.route('**/api/tree/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let allowedWrite =
      request.method() === 'DELETE' &&
      /^\/api\/tree\/cloud\/account\/(?:region\/)?\d+\/delete$/.test(path);
    try {
      if (
        request.method() === 'POST' &&
        path === '/api/tree/cloud/account/create'
      ) {
        const body = request.postDataJSON();
        allowedWrite = body?.status === 2 && [1, 2, 3].includes(body.provider);
      } else if (
        request.method() === 'PUT' &&
        /^\/api\/tree\/cloud\/account\/\d+\/update$/.test(path)
      ) {
        allowedWrite = !Object.prototype.hasOwnProperty.call(
          request.postDataJSON(),
          'status',
        );
      }
    } catch {
      allowedWrite = false;
    }
    if (
      /\/verify$|\/sync$|available-regions/.test(path) ||
      (request.method() !== 'GET' && !allowedWrite)
    ) {
      forbidden.push(path);
      await route.abort();
    } else await route.continue();
  });
  let token = '';
  const owned: Array<{
    id: number;
    provider: number;
    name: string;
    updated: string;
  }> = [];
  async function api(path: string, method = 'GET', data?: unknown) {
    if (/\/verify$|\/sync$|available-regions/.test(path))
      throw new Error('Cloud SDK request forbidden in this fixture');
    const response = await page.request.fetch(`/api${path}`, {
      method,
      data,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10_000,
    });
    const result = await response.json();
    if (response.status() !== 200 || result.code !== 0)
      throw new Error('Owned local fixture API failed; private body omitted');
    return result.data;
  }
  try {
    await page.goto(routePath('/auth/login'));
    await page.getByLabel('账号', { exact: true }).fill('admin');
    try {
      await page.getByLabel('密码', { exact: true }).fill(privatePassword!);
    } catch {
      throw new Error(
        'Private login input unavailable; sensitive details omitted',
      );
    }
    const login = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/user/login',
    );
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.evaluate(() => {
      for (const input of document.querySelectorAll<HTMLInputElement>(
        'input[type="password"]',
      ))
        input.value = '';
    });
    const authentication = await (await login).json();
    if (authentication.code !== 0)
      throw new Error('Private local authentication failed');
    token = authentication.data.accessToken;
    await expect(page).not.toHaveURL(/auth\/login/);
    await page.goto(routePath('/cloud_account_management'));
    await expect(page.locator('.ops-page h1')).toHaveText('云账户');

    for (const fixture of [
      { provider: 1, label: '阿里云', regions: ['cn-hangzhou', 'cn-shanghai'] },
      { provider: 3, label: 'AWS', regions: ['us-east-1', 'us-west-2'] },
      {
        provider: 2,
        label: '腾讯云',
        regions: ['ap-guangzhou', 'ap-shanghai'],
      },
    ]) {
      const name = `${prefix}-${fixture.provider}`;
      const item = {
        id: 0,
        provider: fixture.provider,
        name,
        updated: `${name}-updated`,
      };
      owned.push(item); // Discover the same unique name even after a lost create response.
      await page.getByRole('button', { name: '添加账户', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByPlaceholder('请输入云账户名称').fill(name);
      const providerField = dialog
        .locator('.ant-form-item')
        .filter({ has: page.locator('label').filter({ hasText: /^云厂商$/ }) });
      await providerField.locator('.ant-select-selector').click();
      await page
        .locator('.ant-select-dropdown:visible .ant-select-item-option')
        .filter({ hasText: fixture.label })
        .click();
      const statusField = dialog.locator('.ant-form-item').filter({
        has: page.locator('label').filter({ hasText: /^初始状态$/ }),
      });
      await statusField.locator('.ant-select-selector').click();
      await page
        .locator('.ant-select-dropdown:visible .ant-select-item-option')
        .filter({ hasText: '停用（仅保存）' })
        .click();
      for (const region of fixture.regions) {
        await dialog.locator('#account-region-codes').fill(region);
        await dialog.locator('#account-region-codes').press('Enter');
        await expect(dialog.locator('.account-regions-editor')).toContainText(
          region,
        );
      }
      await dialog
        .getByPlaceholder('请输入 Access Key')
        .fill(`fake-access-${name}`);
      await dialog
        .getByPlaceholder('请输入 Secret Key')
        .fill(`fake-secret-${name}`);
      // No screenshot while credential inputs contain values.
      const created = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            '/api/tree/cloud/account/create' &&
          response.request().method() === 'POST',
      );
      await dialog.getByRole('button', { name: /^添\s*加$/ }).click();
      const createResponse = await created;
      expect(createResponse.request().postDataJSON().status).toBe(2);
      expect((await createResponse.json()).code).toBe(0);
      await expect(dialog).not.toBeVisible();
      const rows = (
        await api(`/tree/cloud/account/list?page=1&size=100&search=${name}`)
      ).items;
      const saved = rows.find((row: { name: string }) => row.name === name);
      expect(!!saved?.id).toBe(true);
      item.id = saved.id;
      expect(saved.status).toBe(2);
      expect(saved.provider).toBe(fixture.provider);
      const ids = saved.regions
        .map((region: { id: number }) => region.id)
        .sort();
      await page.getByPlaceholder('搜索账户名称').fill(name);
      await page.getByPlaceholder('搜索账户名称').press('Enter');
      const row = page.locator('.ant-table-tbody tr').filter({ hasText: name });
      await expect(row).toHaveCount(1);
      await row
        .locator('button')
        .filter({ has: page.locator('[aria-label="edit"]') })
        .click();
      await expect(dialog.getByPlaceholder('请输入云账户名称')).toHaveValue(
        name,
      );
      await expect(dialog.getByPlaceholder('请输入 Access Key')).toBeEmpty();
      await expect(dialog.getByPlaceholder('请输入 Secret Key')).toBeEmpty();
      await dialog.getByPlaceholder('请输入云账户名称').fill(item.updated);
      const updated = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
          `/api/tree/cloud/account/${item.id}/update`,
      );
      await dialog.getByRole('button', { name: /^更\s*新$/ }).click();
      const updateResponse = await updated;
      const updateData = updateResponse.request().postDataJSON();
      expect(updateData).not.toHaveProperty('regions');
      expect(updateData).not.toHaveProperty('access_key');
      expect(updateData).not.toHaveProperty('secret_key');
      expect((await updateResponse.json()).code).toBe(0);
      await expect(dialog).not.toBeVisible();
      const detail = await api(`/tree/cloud/account/${item.id}/detail`);
      expect(detail.name).toBe(item.updated);
      expect(detail.status).toBe(2);
      expect(
        detail.regions.map((region: { id: number }) => region.id).sort(),
      ).toEqual(ids);
    }
    expect(forbidden).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    if (token) {
      for (const item of [...owned].reverse()) {
        const rows = (
          await api(
            `/tree/cloud/account/list?page=1&size=100&search=${item.name}`,
          )
        ).items;
        const matches = rows.filter(
          (row: { id: number; name: string; provider: number }) =>
            (item.id === 0 || row.id === item.id) &&
            row.provider === item.provider &&
            [item.name, item.updated].includes(row.name),
        );
        if (matches.length > 1)
          throw new Error('Ambiguous owned account cleanup');
        for (const account of matches) {
          const detail = await api(`/tree/cloud/account/${account.id}/detail`);
          if (detail.status !== 2)
            throw new Error('Owned fixture account unexpectedly enabled');
          for (const region of [...(detail.regions ?? [])].reverse()) {
            if (region.cloud_account_id !== account.id)
              throw new Error('Refusing foreign region cleanup');
            await api(
              `/tree/cloud/account/region/${region.id}/delete`,
              'DELETE',
            );
          }
          await api(`/tree/cloud/account/${account.id}/delete`, 'DELETE');
        }
      }
      expect(
        (await api(`/tree/cloud/account/list?page=1&size=100&search=${prefix}`))
          .items.length,
      ).toBe(0);
      await api('/user/logout', 'POST', {});
    }
  }
});
