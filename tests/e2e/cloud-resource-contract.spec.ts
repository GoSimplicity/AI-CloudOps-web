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

test('cloud resource sync selection uses local regions and cancellation never calls cloud SDK', async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  const privatePassword = password();
  test.skip(
    !privatePassword,
    'Requires isolated local administrator configuration',
  );
  const nonce = `cmdb-sync-ui-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
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
    await api(
      '/tree/cloud/account/create',
      {
        name: nonce,
        provider: 1,
        access_key: `fake-access-${nonce}`,
        secret_key: `fake-secret-${nonce}`,
        regions: [
          { region: 'cn-hangzhou', is_default: true },
          { region: 'cn-beijing', is_default: false },
        ],
      },
      'POST',
    );
    const own = (
      await api(`/tree/cloud/account/list?page=1&size=10&search=${nonce}`)
    ).items.find((item: { name: string }) => item.name === nonce);
    if (!own) throw new Error('Owned fixture missing');
    id = own.id;
    await page.goto(route('/cloud_resource_management'));
    await expect(page.locator('.ops-page h1')).toHaveText('云资源');
    const loaded = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
        `/api/tree/cloud/account/${id}/detail`,
    );
    await page.getByRole('button', { name: '同步资源', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .locator('.ant-select')
      .filter({ has: page.locator('#cloud-sync-account') })
      .locator('.ant-select-selector')
      .click();
    await page
      .locator(
        '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
      )
      .filter({ hasText: nonce })
      .click();
    expect((await (await loaded).json()).code).toBe(0);
    await expect(
      dialog.getByRole('button', { name: '开始同步', exact: true }),
    ).toBeEnabled();
    await dialog
      .locator('.ant-select')
      .filter({ has: page.locator('#cloud-sync-regions') })
      .locator('.ant-select-selector')
      .click();
    await page.locator('.ant-select-item-option[title="cn-beijing"]').click();
    await dialog.getByText('同步说明', { exact: true }).click();
    await expect(dialog.locator('.cloud-sync-form')).toContainText(
      'cn-beijing',
    );
    await expect(
      dialog.locator('input[type="checkbox"][value="1"]'),
    ).toBeChecked();
    await expect(
      dialog.locator('input[type="checkbox"][value="2"]'),
    ).toBeDisabled();
    await expect(
      dialog.locator('input[type="radio"][value="incremental"]'),
    ).toBeChecked();
    await page.screenshot({
      path: '.cache/ui-verification/cloud-resource-sync-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });
    await dialog.getByRole('button', { name: /^取\s*消$/ }).click();
    await page.getByLabel('深色', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '同步资源', exact: true }).click();
    await expect(dialog.locator('#cloud-sync-regions')).toBeVisible();
    const cancel = dialog.getByRole('button', { name: /^取\s*消$/ });
    expect(
      await cancel.evaluate((element) => {
        const r = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        );
        return (
          r.top >= 0 &&
          r.bottom <= innerHeight &&
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
      path: '.cache/ui-verification/cloud-resource-sync-mobile.png',
      fullPage: true,
      animations: 'disabled',
    });
    await cancel.click();
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
      const remaining = await api(
        `/tree/cloud/account/list?page=1&size=100&search=${nonce}`,
      );
      expect(
        remaining.items.some(
          (account: { name: string }) => account.name === nonce,
        ),
      ).toBe(false);
      await api('/user/logout', {}, 'POST');
    }
  }
});
