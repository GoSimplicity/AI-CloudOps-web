import { expect, type Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

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

test('notification department and explicit addresses persist disabled and preserve optional fields', async ({
  page,
}) => {
  test.setTimeout(150_000);
  page.setDefaultTimeout(15_000);
  const credential = password();
  test.skip(!credential, 'Requires isolated administrator credentials.');
  const presenceReady =
    process.env.CLOUDOPS_TEST_NOTIFICATION_PRESENCE_READY === 'true';
  const nonce = `cloudops-ui-recipients-${Date.now()}`;
  const names = [`${nonce}-dept`, `${nonce}-custom`];
  const sends: string[] = [];
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (/^\/api\/workorder\/notification\/(test\/send|send)$/.test(path))
      sends.push(path);
  });
  // A regression must not create an enabled rule during acceptance
  await page.route('**/api/workorder/notification/create', (route) =>
    route.request().postDataJSON()?.status === 2
      ? route.continue()
      : route.abort(),
  );
  await page.goto(routePath('/auth/login'));
  await page.getByLabel('账号', { exact: true }).fill('admin');
  await page.getByLabel('密码', { exact: true }).fill(credential!);
  const login = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/user/login' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.evaluate(() => {
    for (const input of document.querySelectorAll<HTMLInputElement>(
      'input[type="password"]',
    ))
      input.value = '';
  });
  const token = (await (await login).json()).data.accessToken;
  const api = async (path: string, method = 'GET', data?: unknown) => {
    const response = await page.request.fetch(`/api/${path}`, {
      method,
      data,
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    expect(response.status(), path.split('?')[0]).toBe(200);
    expect(result.code, path.split('?')[0]).toBe(0);
    return result.data;
  };
  const findNotifications = async () =>
    (
      await api(
        `workorder/notification/list?page=1&page_size=100&name=${nonce}`,
      )
    ).items.filter((item: { name: string }) => names.includes(item.name));
  const save = async (page: Page, method: string, endpoint: string) => {
    const dialog = page.getByRole('dialog', {
      name: method === 'POST' ? '创建通知配置' : '编辑通知配置',
      exact: true,
    });
    const [response] = await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === endpoint &&
          response.request().method() === method,
      ),
      dialog.locator('.ant-modal-footer .ant-btn-primary').click(),
    ]);
    expect(response.request().postDataJSON().status).toBe(2);
    expect(response.status()).toBe(200);
    expect((await response.json()).code).toBe(0);
    await expect(dialog).not.toBeVisible();
  };
  let departmentId: number | undefined;
  try {
    const department = await api('department/create', 'POST', {
      name: nonce,
      parent_id: 0,
      description: 'owned disabled notification acceptance',
    });
    departmentId = department.id;
    expect(Number.isSafeInteger(departmentId) && departmentId! > 0).toBe(true);
    await page.goto(routePath('/notification'));
    await expect(page.locator('.ops-page h1')).toHaveText('通知配置');
    for (const kind of ['dept', 'custom']) {
      await page
        .getByRole('button', { name: '创建通知配置', exact: true })
        .click();
      const dialog = page.getByRole('dialog', {
        name: '创建通知配置',
        exact: true,
      });
      await dialog
        .getByPlaceholder('请输入通知配置名称', { exact: true })
        .fill(names[kind === 'dept' ? 0 : 1]!);
      await dialog
        .getByPlaceholder('请输入通知配置描述', { exact: true })
        .fill('初始描述');
      await dialog
        .getByPlaceholder('请输入主题模板（可选）', { exact: true })
        .fill('初始主题');
      await expect(
        dialog.getByRole('switch', { name: '通知启用状态', exact: true }),
      ).not.toBeChecked();
      await dialog.getByRole('checkbox', { name: /邮件/ }).check();
      await dialog
        .getByRole('checkbox', { name: '工单创建人', exact: true })
        .uncheck();
      if (kind === 'dept') {
        await dialog
          .getByRole('checkbox', { name: '部门用户', exact: true })
          .check();
        const ids = dialog.getByRole('combobox', {
          name: '接收人部门ID',
          exact: true,
        });
        await ids.fill(String(departmentId));
        await ids.press('Enter');
      } else {
        await dialog
          .getByRole('checkbox', { name: '自定义地址', exact: true })
          .check();
        await dialog.getByRole('checkbox', { name: /飞书/ }).check();
        await dialog.getByRole('button', { name: /^添加接收地址$/ }).click();
        await dialog
          .getByLabel('自定义接收地址1', { exact: true })
          .fill('OWNER@EXAMPLE.TEST');
        await dialog
          .getByLabel('自定义接收人名称1', { exact: true })
          .fill('负责人');
        await dialog.getByRole('button', { name: /^添加接收地址$/ }).click();
        await dialog.getByLabel('自定义接收渠道2', { exact: true }).click();
        await page
          .locator('.ant-select-dropdown:visible .ant-select-item-option')
          .filter({ hasText: '飞书' })
          .click();
        await dialog
          .getByLabel('自定义接收地址2', { exact: true })
          .fill('ou_cloudopsAcceptance42');
        await dialog
          .getByLabel('自定义接收人名称2', { exact: true })
          .fill('飞书接收人');
      }
      if (presenceReady) {
        const retries = dialog.getByRole('spinbutton', {
          name: /最大重试次数/,
        });
        await retries.fill('0');
        await retries.press('Tab');
      }
      await save(page, 'POST', '/api/workorder/notification/create');
    }
    const created = await findNotifications();
    expect(created).toHaveLength(2);
    const dept = created.find(
      (item: { name: string }) => item.name === names[0],
    );
    const custom = created.find(
      (item: { name: string }) => item.name === names[1],
    );
    expect(dept.status).toBe(2);
    expect(dept.recipient_depts).toEqual([String(departmentId)]);
    expect(custom.status).toBe(2);
    expect(custom.recipient_addresses).toEqual([
      { channel: 'email', address: 'owner@example.test', name: '负责人' },
      {
        channel: 'feishu',
        address: 'ou_cloudopsAcceptance42',
        name: '飞书接收人',
      },
    ]);
    if (presenceReady) {
      expect(dept.max_retries).toBe(0);
      expect(custom.max_retries).toBe(0);
    }
    await page.getByLabel('搜索通知配置', { exact: true }).fill(names[1]!);
    await page.getByLabel('搜索通知配置', { exact: true }).press('Enter');
    const row = page.locator(
      `.ant-table-tbody tr[data-row-key="${custom.id}"]`,
    );
    await row.getByRole('button', { name: /^编\s*辑$/ }).click();
    const dialog = page.getByRole('dialog', {
      name: '编辑通知配置',
      exact: true,
    });
    await expect(
      dialog.getByLabel('自定义接收地址1', { exact: true }),
    ).toHaveValue('owner@example.test');
    await dialog
      .getByLabel('自定义接收地址1', { exact: true })
      .fill('updated@example.test');
    await dialog
      .getByPlaceholder('请输入通知配置描述', { exact: true })
      .fill(presenceReady ? '' : '更新描述');
    await dialog
      .getByPlaceholder('请输入主题模板（可选）', { exact: true })
      .fill(presenceReady ? '' : '更新主题');
    await page.screenshot({
      path: '/tmp/cloudops-notification-recipients-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const addressLayout = await dialog
      .locator('.recipient-address-row')
      .first()
      .evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          grid: getComputedStyle(element).gridTemplateColumns,
          width: bounds.width,
          controls: Array.from(element.children)
            .filter((child) => child.tagName !== 'LEGEND')
            .map((child) => {
              const rect = child.getBoundingClientRect();
              return {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                width: rect.width,
              };
            }),
        };
      });
    expect(addressLayout.controls).toHaveLength(4);
    for (const control of addressLayout.controls) {
      expect(control.right).toBeLessThanOrEqual(390);
      expect(control.left).toBeGreaterThanOrEqual(0);
    }
    expect(addressLayout.controls[1]!.top).toBeGreaterThan(
      addressLayout.controls[0]!.top,
    );
    expect(addressLayout.controls[2]!.top).toBeGreaterThan(
      addressLayout.controls[1]!.top,
    );
    await page.screenshot({
      path: '/tmp/cloudops-notification-recipients-mobile.png',
      fullPage: true,
    });
    await save(page, 'PUT', `/api/workorder/notification/update/${custom.id}`);
    const updated = await api(`workorder/notification/detail/${custom.id}`);
    expect(updated.status).toBe(2);
    expect(updated.recipient_addresses[0].address).toBe('updated@example.test');
    if (presenceReady) {
      expect(updated.max_retries).toBe(0);
      expect(updated.description).toBe('');
      expect(updated.subject_template).toBe('');
      await api(`workorder/notification/update/${custom.id}`, 'PUT', {
        status: 2,
      });
      const partial = await api(`workorder/notification/detail/${custom.id}`);
      expect(partial.is_default).toBe(updated.is_default);
      expect(partial.max_retries).toBe(0);
      const unsupported = await page.request.put(
        `/api/workorder/notification/update/${custom.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: { status: 2, trigger_type: 'scheduled' },
        },
      );
      expect((await unsupported.json()).code).not.toBe(0);
      const unchanged = await api(`workorder/notification/detail/${custom.id}`);
      expect(unchanged.trigger_type).toBe('immediate');
      expect(unchanged.status).toBe(2);
    }
    await page.getByLabel('深色', { exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await row.getByRole('button', { name: /^编\s*辑$/ }).click();
    await dialog
      .getByLabel('自定义接收地址1', { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: '/tmp/cloudops-notification-recipients-mobile-dark.png',
      fullPage: true,
      animations: 'disabled',
    });
    await dialog.locator('.ant-modal-footer .ant-btn-default').click();
    expect(sends).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  } finally {
    for (const item of await findNotifications())
      await api(`workorder/notification/delete/${item.id}`, 'DELETE', {
        id: item.id,
      });
    if (departmentId) await api(`department/${departmentId}/delete`, 'DELETE');
    expect(await findNotifications()).toHaveLength(0);
  }
});
