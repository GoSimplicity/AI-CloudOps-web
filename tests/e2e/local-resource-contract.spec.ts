import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

test('local resource metadata preserves credentials and persists structured tags', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(15_000);
  expect(['localhost', '127.0.0.1']).toContain(new URL(baseURL!).hostname);
  const password =
    process.env.CLOUDOPS_TEST_PASSWORD ||
    (process.env.CLOUDOPS_TEST_ENV_FILE
      ? readFileSync(process.env.CLOUDOPS_TEST_ENV_FILE, 'utf8')
          .match(/^BOOTSTRAP_ADMIN_PASSWORD=(.*)$/m)?.[1]
          ?.trim()
          .replace(/^['"]|['"]$/g, '')
      : undefined);
  test.skip(!password, 'Requires isolated local administrator configuration');
  const route = (path: string) =>
    process.env.CLOUDOPS_ROUTER_HISTORY === 'hash' ? `/#${path}` : path;
  const nonce = `local-ui-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  let token = '',
    id = 0;
  const errors: string[] = [];
  const sshConnections: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('websocket', (socket) => {
    if (socket.url().includes('/tree/'))
      sshConnections.push(new URL(socket.url()).pathname);
  });
  async function api(path: string, data?: unknown, method = 'GET') {
    const response = await fetch(`http://127.0.0.1:18080/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json();
    if (response.status !== 200 || result.code !== 0)
      throw new Error('Owned local fixture API failed; private body omitted');
    return result.data;
  }
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(route('/auth/login'));
    await page.getByLabel('账号', { exact: true }).fill('admin');
    await page.getByLabel('密码', { exact: true }).fill(password!);
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
      '/tree/local/create',
      {
        name: nonce,
        ip_addr: `198.51.100.${1 + Math.floor(Math.random() * 254)}`,
        port: 22,
        username: 'root',
        os_type: 'linux',
        auth_mode: 2,
        key: `fake-private-key-${nonce}`,
        tags: [{ key: 'owner', value: nonce }],
        description: nonce,
      },
      'POST',
    );
    const rows = (await api(`/tree/local/list?page=1&size=10&search=${nonce}`))
      .items;
    const owned = rows.filter((row: { name: string }) => row.name === nonce);
    expect(owned).toHaveLength(1);
    id = owned[0].id;
    expect(owned[0]).not.toHaveProperty('key');
    await page.goto(route('/local_resource_management'));
    const row = page.locator('.ant-table-tbody tr').filter({ hasText: nonce });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(`owner=${nonce}`);
    await row.getByRole('button', { name: /编\s*辑/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByPlaceholder('留空保留原私钥')).toBeEmpty();
    await dialog.getByPlaceholder('root', { exact: true }).fill('operator');
    await dialog
      .getByPlaceholder('服务器用途描述')
      .fill('updated-local-description');
    await dialog
      .getByPlaceholder('输入标签（如 team=ops），按回车添加')
      .fill('team=ops');
    await dialog.getByRole('button', { name: /添加标签/ }).click();
    const update = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/tree/local/update/${id}`,
    );
    await dialog.getByRole('button', { name: /^更\s*新$/ }).click();
    const updated = await update;
    expect(updated.request().postDataJSON()).not.toHaveProperty('key');
    expect((await updated.json()).code).toBe(0);
    await expect(dialog).not.toBeVisible();
    const detail = await api(`/tree/local/detail/${id}`);
    expect(detail.username).toBe('operator');
    expect(detail.description).toBe('updated-local-description');
    expect(detail.tags).toEqual([
      { key: 'owner', value: nonce },
      { key: 'team', value: 'ops' },
    ]);
    expect(detail.auth_mode).toBe(2);
    expect(detail.status).toBe(owned[0].status);
    expect(detail).not.toHaveProperty('key');
    await row.getByRole('button', { name: /编\s*辑/ }).click();
    await dialog.getByPlaceholder('服务器用途描述').fill('');
    while (await dialog.locator('.current-tags .ant-tag-close-icon').count())
      await dialog.locator('.current-tags .ant-tag-close-icon').first().click();
    const clear = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/tree/local/update/${id}`,
    );
    await dialog.getByRole('button', { name: /^更\s*新$/ }).click();
    expect((await (await clear).json()).code).toBe(0);
    const cleared = await api(`/tree/local/detail/${id}`);
    expect(cleared.description).toBe('');
    expect(cleared.tags).toEqual([]);
    await expect(dialog).not.toBeVisible();
    await page.getByLabel('深色', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: '.cache/ui-verification/local-contract-mobile-dark.png',
      fullPage: true,
      animations: 'disabled',
    });
    expect(sshConnections).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    if (id && token) {
      const owned = await api(`/tree/local/detail/${id}`);
      if (owned.name !== nonce)
        throw new Error(
          'Owned local resource identity changed; refusing cleanup',
        );
      await api(`/tree/local/delete/${id}`, { id }, 'DELETE');
      expect(
        (await api(`/tree/local/list?page=1&size=10&search=${nonce}`)).items,
      ).toEqual([]);
    }
    if (token) await api('/user/logout', {}, 'POST');
  }
});
