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

test('workorder local form and process design save round-trip and cancel', async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  const privatePassword = password();
  test.skip(
    !privatePassword,
    'Requires isolated local administrator configuration',
  );
  const nonce = `designer-ui-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const forbidden: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (
      path.startsWith('/api/') &&
      (/\/notification\//.test(path) ||
        /\/instance\/create$|\/verify$|\/sync$|available-regions/.test(path))
    )
      forbidden.push(path);
  });
  let token = '';
  let formId = 0;
  let processId = 0;
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
    const capture = async (name: string) => {
      if (process.env.CLOUDOPS_CAPTURE_DESIGNS === '1')
        await page.screenshot({
          path: `.cache/ui-verification/${name}.png`,
          fullPage: true,
          animations: 'disabled',
        });
    };
    const noOverflow = async () =>
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    await page.goto(route('/form_design'));
    await expect(page.locator('.ops-page h1')).toHaveText('表单设计');
    await page.getByPlaceholder('请输入表单名称', { exact: true }).fill(nonce);
    await page.getByRole('button', { name: /文本框/ }).click();
    await page.locator('.field-panel .ant-collapse-header').click();
    await page.getByPlaceholder('请输入字段标签').fill('申请说明');
    await page.getByPlaceholder('英文、数字、下划线').fill('request_summary');
    await page
      .locator('.ant-select')
      .filter({ has: page.locator('#form-design-status') })
      .locator('.ant-select-selector')
      .click();
    await page
      .locator(
        '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
      )
      .filter({ hasText: '已发布' })
      .click();
    await page.getByRole('button', { name: /预览表单/ }).click();
    await expect(page.locator('.preview-notice')).toContainText('不会创建');
    await page.locator('.form-preview input').fill('仅验证本地设计');
    await page.getByRole('button', { name: '校验预览', exact: true }).click();
    await expect(
      page.locator('.ant-message-success').filter({ hasText: '未创建工单' }),
    ).toBeVisible();
    await page.getByRole('button', { name: /返回设计/ }).click();
    await noOverflow();
    await capture('form-designer-desktop');
    const savedForm = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
        '/api/workorder/form-design/create',
    );
    await page.getByRole('button', { name: '保存设计', exact: true }).click();
    expect((await (await savedForm).json()).code).toBe(0);
    const forms = (
      await api(`/workorder/form-design/list?page=1&size=10&search=${nonce}`)
    ).items.filter((item: { name: string }) => item.name === nonce);
    expect(forms).toHaveLength(1);
    formId = forms[0].id;
    const form = await api(`/workorder/form-design/detail/${formId}`);
    expect(form.status).toBe(2);
    expect(form.schema.fields).toEqual([
      expect.objectContaining({
        name: 'request_summary',
        label: '申请说明',
        type: 'text',
      }),
    ]);
    await page.getByLabel('深色', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow();
    await page.locator('.field-panel .ant-collapse-header').click();
    await expect(page.getByPlaceholder('请输入字段标签')).toHaveValue(
      '申请说明',
    );
    await noOverflow();
    await capture('form-designer-mobile');
    await page.getByRole('button', { name: /清空表单/ }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^取\s*消$/ })
      .click();
    await expect(page.locator('.field-panel')).toHaveCount(1);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(route('/process_design'));
    await expect(page.locator('.ops-page h1')).toHaveText('流程设计');
    await page.getByLabel('浅色', { exact: true }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.getByPlaceholder('请输入流程名称', { exact: true }).fill(nonce);
    await page
      .locator('.ant-select')
      .filter({ has: page.locator('#process-design-form') })
      .locator('.ant-select-selector')
      .click();
    await page
      .locator(
        '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
      )
      .filter({ hasText: nonce })
      .click();
    await page
      .locator('.ant-select')
      .filter({ has: page.locator('#process-design-status') })
      .locator('.ant-select-selector')
      .click();
    await page
      .locator(
        '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
      )
      .filter({ hasText: '已发布' })
      .click();
    const definition = {
      steps: [
        {
          id: 'owned_start',
          type: 'start',
          name: '开始',
          sort_order: 1,
          actions: ['submit'],
        },
        {
          id: 'owned_end',
          type: 'end',
          name: '结束',
          sort_order: 2,
          actions: [],
        },
      ],
      connections: [{ from: 'owned_start', to: 'owned_end' }],
    };
    await page.getByRole('tab', { name: 'JSON编辑', exact: true }).click();
    await page
      .getByPlaceholder('请输入或粘贴流程定义JSON')
      .fill(JSON.stringify(definition));
    await page.getByRole('button', { name: /应用到可视化/ }).click();
    await page.getByRole('tab', { name: '可视化设计', exact: true }).click();
    await expect(page.locator('.process-step')).toHaveCount(2);
    await page.getByRole('button', { name: /预览流程/ }).click();
    await expect(page.getByRole('dialog')).toContainText('结束');
    await page.getByRole('dialog').getByLabel('Close', { exact: true }).click();
    await noOverflow();
    await capture('process-designer-desktop');
    await page.getByLabel('深色', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow();
    await capture('process-designer-mobile');
    const savedProcess = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/workorder/process/create',
    );
    await page.getByRole('button', { name: '保存流程', exact: true }).click();
    expect((await (await savedProcess).json()).code).toBe(0);
    const processes = (
      await api(`/workorder/process/list?page=1&size=10&search=${nonce}`)
    ).items.filter((item: { name: string }) => item.name === nonce);
    expect(processes).toHaveLength(1);
    processId = processes[0].id;
    const processDetail = await api(`/workorder/process/detail/${processId}`);
    expect(processDetail.form_design_id).toBe(formId);
    expect(processDetail.status).toBe(2);
    expect(processDetail.definition.steps).toEqual(
      definition.steps.map(({ actions, ...step }) =>
        expect.objectContaining(step),
      ),
    );
    expect(processDetail.definition.steps[0].actions).toEqual(['submit']);
    expect(processDetail.definition.steps[1].actions).toBeUndefined();
    expect(processDetail.definition.connections).toEqual(
      definition.connections,
    );
    expect(forbidden).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    if (token) {
      const processes = (
        await api(`/workorder/process/list?page=1&size=100&search=${nonce}`)
      ).items.filter(
        (item: { id: number; name: string }) =>
          item.name === nonce && (processId === 0 || item.id === processId),
      );
      for (const item of processes) {
        await api(`/workorder/process/update/${item.id}`, { status: 3 }, 'PUT');
        await api(`/workorder/process/delete/${item.id}`, undefined, 'DELETE');
      }
      const forms = (
        await api(`/workorder/form-design/list?page=1&size=100&search=${nonce}`)
      ).items.filter(
        (item: { id: number; name: string }) =>
          item.name === nonce && (formId === 0 || item.id === formId),
      );
      for (const item of forms)
        await api(
          `/workorder/form-design/delete/${item.id}`,
          undefined,
          'DELETE',
        );
      expect(
        (
          await api(`/workorder/process/list?page=1&size=100&search=${nonce}`)
        ).items.some((item: { name: string }) => item.name === nonce),
      ).toBe(false);
      expect(
        (
          await api(
            `/workorder/form-design/list?page=1&size=100&search=${nonce}`,
          )
        ).items.some((item: { name: string }) => item.name === nonce),
      ).toBe(false);
      await api('/user/logout', {}, 'POST');
    }
  }
});
