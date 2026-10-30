import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const routePath = (path: string) =>
  process.env.CLOUDOPS_ROUTER_HISTORY === 'hash' ? `/#${path}` : path;
function password() {
  return (
    process.env.CLOUDOPS_TEST_PASSWORD ||
    (process.env.CLOUDOPS_TEST_ENV_FILE
      ? readFileSync(process.env.CLOUDOPS_TEST_ENV_FILE, 'utf8')
          .match(/^BOOTSTRAP_ADMIN_PASSWORD=(.*)$/m)?.[1]
          ?.trim()
          .replace(/^['"]|['"]$/g, '')
      : undefined)
  );
}

test('disabled HTTP cron persists create and execution-field edits without running', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  expect(['localhost', '127.0.0.1']).toContain(new URL(baseURL!).hostname);
  const secret = password();
  test.skip(!secret, 'Requires an isolated local administrator');
  const name = `cron-ui-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  let token = '';
  let id = 0;
  const forbidden: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/cron/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let allowedWrite =
      (request.method() === 'POST' && path === '/api/cron/validate-schedule') ||
      (request.method() === 'DELETE' &&
        /^\/api\/cron\/job\/\d+\/delete$/.test(path));
    try {
      if (request.method() === 'POST' && path === '/api/cron/job/create') {
        const body = request.postDataJSON();
        allowedWrite =
          body?.status === 2 &&
          body.job_type === 3 &&
          /^http:\/\/127\.0\.0\.1:9\//.test(body.http_url);
      } else if (
        request.method() === 'PUT' &&
        /^\/api\/cron\/job\/\d+\/update$/.test(path)
      ) {
        const body = request.postDataJSON();
        allowedWrite =
          body?.job_type === 3 &&
          /^http:\/\/127\.0\.0\.1:9\//.test(body.http_url) &&
          !Object.prototype.hasOwnProperty.call(body, 'status');
      }
    } catch {
      allowedWrite = false;
    }
    if (request.method() !== 'GET' && !allowedWrite) {
      forbidden.push(path);
      await route.abort();
    } else await route.continue();
  });
  async function api(path: string, method = 'GET', data?: unknown) {
    if (/\/enable$|\/trigger$|\/run$/.test(path))
      throw new Error('Task execution is forbidden in this fixture');
    const response = await page.request.fetch(`/api${path}`, {
      method,
      data,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10_000,
    });
    const result = await response.json();
    if (response.status() !== 200 || result.code !== 0)
      throw new Error('Owned Cron fixture API failed; private body omitted');
    return result.data;
  }
  async function ownRows() {
    const result = await api(`/cron/job/list?page=1&size=100&search=${name}`);
    return result.items.filter(
      (row: { id: number; name: string }) =>
        row.name === name && (id === 0 || row.id === id),
    );
  }
  try {
    await page.goto(routePath('/auth/login'));
    await page.getByLabel('账号', { exact: true }).fill('admin');
    try {
      await page.getByLabel('密码', { exact: true }).fill(secret!);
    } catch {
      throw new Error(
        'Private login input unavailable; sensitive detail omitted',
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
    await page.goto(routePath('/cron/management'));
    await expect(page.locator('.ops-page h1')).toHaveText('定时任务管理');
    await page
      .locator('.ops-page__actions')
      .getByRole('button', { name: /创建任务/ })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('请输入任务名称').fill(name);
    const status = dialog
      .locator('.ant-form-item')
      .filter({ has: page.locator('label').filter({ hasText: /^初始状态$/ }) });
    await status.locator('.ant-select-selector').click();
    await page
      .locator('.ant-select-dropdown:visible .ant-select-item-option')
      .filter({ hasText: '停用（仅保存）' })
      .click();
    await dialog
      .getByPlaceholder('例：0 0 * * * (每天午夜执行)')
      .fill('@every 1h');
    await dialog
      .getByPlaceholder('https://example.com/api/endpoint')
      .fill('http://127.0.0.1:9/created');
    await dialog.getByRole('spinbutton', { name: /^自动重投次数/ }).fill('0');
    const created = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/cron/job/create' &&
        response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: '创建任务', exact: true }).click();
    const response = await created;
    expect(response.request().postDataJSON().status).toBe(2);
    expect((await response.json()).code).toBe(0);
    await expect(dialog).not.toBeVisible();
    const rows = await ownRows();
    expect(rows.length).toBe(1);
    id = rows[0].id;
    expect(rows[0].status).toBe(2);
    expect(rows[0].run_count).toBe(0);
    await page.getByPlaceholder('搜索任务名称或描述...').fill(name);
    await page.getByPlaceholder('搜索任务名称或描述...').press('Enter');
    const row = page.locator(`.ant-table-tbody tr[data-row-key="${id}"]`);
    await expect(row).toContainText(name);
    await expect(
      row.locator('.k8s-action-column button').nth(3),
    ).toBeDisabled();
    await row
      .locator('button')
      .filter({ has: page.locator('[aria-label="edit"]') })
      .click();
    await expect(dialog.getByPlaceholder('请输入任务名称')).toHaveValue(name);
    await dialog
      .getByPlaceholder('例：0 0 * * * (每天午夜执行)')
      .fill('@every 2h');
    await dialog
      .getByPlaceholder('https://example.com/api/endpoint')
      .fill('http://127.0.0.1:9/updated');
    const method = dialog
      .locator('.ant-form-item')
      .filter({ has: page.locator('label').filter({ hasText: /^请求方法$/ }) });
    await method.locator('.ant-select-selector').click();
    await page
      .locator('.ant-select-dropdown:visible .ant-select-item-option')
      .filter({ hasText: /^POST$/ })
      .click();
    await dialog.getByRole('button', { name: /添加请求头/ }).click();
    await dialog.getByPlaceholder('Header名称').fill('X-Fixture');
    await dialog.getByPlaceholder('Header值').fill('owned-fixture');
    await dialog
      .getByPlaceholder('POST/PUT请求的数据体')
      .fill('{"fixture":true}');
    await dialog
      .getByRole('spinbutton', { name: '超时时间', exact: true })
      .fill('120');
    const updated = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/cron/job/${id}/update`,
    );
    await dialog.getByRole('button', { name: '保存修改', exact: true }).click();
    expect((await (await updated).json()).code).toBe(0);
    await expect(dialog).not.toBeVisible();
    const detail = await api(`/cron/job/${id}/detail`);
    expect(detail).toMatchObject({
      status: 2,
      job_type: 3,
      schedule: '@every 2h',
      http_url: 'http://127.0.0.1:9/updated',
      http_method: 'POST',
      http_headers: [{ key: 'X-Fixture', value: 'owned-fixture' }],
      http_body: '{"fixture":true}',
      timeout: 120,
      max_retry: 0,
      run_count: 0,
      last_run_status: 0,
    });
    await row
      .locator('button')
      .filter({ has: page.locator('[aria-label="delete"]') })
      .click();
    const confirmation = page
      .getByRole('dialog')
      .filter({ hasText: '确定要删除定时任务' });
    const removed = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/cron/job/${id}/delete` &&
        response.request().method() === 'DELETE',
    );
    await confirmation
      .getByRole('button', { name: '确认删除', exact: true })
      .click();
    expect((await (await removed).json()).code).toBe(0);
    await expect(row).toHaveCount(0);
    expect((await ownRows()).length).toBe(0);
    expect(forbidden).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    if (token) {
      const rows = await ownRows();
      if (rows.length > 1) throw new Error('Ambiguous Cron fixture cleanup');
      for (const item of rows) {
        const detail = await api(`/cron/job/${item.id}/detail`);
        if (
          detail.name !== name ||
          detail.status !== 2 ||
          detail.run_count !== 0
        )
          throw new Error('Refusing cleanup of changed or executed fixture');
        await api(`/cron/job/${item.id}/delete`, 'DELETE');
      }
      await api('/user/logout', 'POST', {});
    }
  }
});
