import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

function routePath(path: string) {
  return process.env.CLOUDOPS_ROUTER_HISTORY === 'hash' ? `/#${path}` : path;
}

function adminPassword() {
  if (process.env.CLOUDOPS_TEST_PASSWORD)
    return process.env.CLOUDOPS_TEST_PASSWORD;
  if (!process.env.CLOUDOPS_TEST_ENV_FILE) return undefined;
  const content = readFileSync(process.env.CLOUDOPS_TEST_ENV_FILE, 'utf8');
  return content
    .match(/^BOOTSTRAP_ADMIN_PASSWORD=(.*)$/m)?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, '');
}

async function expectUncovered(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      control.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const target = document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        );
        return target !== null &&
          (target === element || element.contains(target))
          ? 'uncovered'
          : `blocked by ${target?.tagName}.${target?.className}; x=${Math.round(rect.x)} y=${Math.round(rect.y)} w=${Math.round(rect.width)}`;
      }),
    )
    .toBe('uncovered');
}

async function acceptanceLogin(page: Page) {
  const password = adminPassword();
  test.skip(
    !password,
    'Set an isolated administrator password for acceptance.',
  );
  await page.goto(routePath('/auth/login'));
  await page
    .getByLabel('账号', { exact: true })
    .fill(process.env.CLOUDOPS_TEST_USER || 'admin');
  await page.getByLabel('密码', { exact: true }).fill(password!);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#password');
    if (input) input.value = '';
  });
  await expect(page).not.toHaveURL(/auth\/login/, { timeout: 30_000 });
}

async function selectAcceptanceNamespace(page: Page, namespace: string) {
  await page.locator('.k8s-namespace-selector').click();
  await page
    .locator('.ant-select-dropdown:visible .ant-select-item-option')
    .filter({ hasText: namespace })
    .click();
}

test('login is usable on mobile and supports both themes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(routePath('/auth/login'));
  await expect(
    page.getByRole('heading', { name: '登录运维工作台' }),
  ).toBeVisible();
  await expect(page.getByLabel('账号', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '手机号登录' })).toHaveCount(0);
  await page.getByRole('button', { name: '切换深色' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.waitForTimeout(200);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: '切换浅色' }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors, 'production bootstrap runtime errors').toEqual([]);
});

test('authenticated navigation renders every standalone business route', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const password = adminPassword();
  test.skip(
    !password,
    'Set CLOUDOPS_TEST_PASSWORD or CLOUDOPS_TEST_ENV_FILE for isolated test administrator.',
  );
  const errors: string[] = [];
  const apiFailures: string[] = [];
  const responses: string[] = [];
  page.on('response', async (response) => {
    if (response.url().includes('/api/')) {
      try {
        const body = await response.json();
        responses.push(
          `${new URL(response.url()).pathname} status=${response.status()} code=${body.code} message=${body.message || ''}`,
        );
      } catch {
        /* non-JSON response */
      }
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      apiFailures.push(
        `${response.status()} ${new URL(response.url()).pathname}`,
      );
    }
  });
  await page.goto(routePath('/auth/login'));
  await page
    .getByLabel('账号', { exact: true })
    .fill(process.env.CLOUDOPS_TEST_USER || 'admin');
  await page.getByLabel('密码', { exact: true }).fill(password!);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#password');
    if (input) input.value = '';
  });
  await page.waitForTimeout(1200);
  expect(errors, `login runtime errors; ${responses.join('; ')}`).toEqual([]);
  expect(apiFailures, 'login API errors').toEqual([]);
  await expect(page).not.toHaveURL(/auth\/login/);
  const dir = resolve('apps/web-antd/src/router/routes/modules');
  const routes: string[] = [];
  for (const file of readdirSync(dir)) {
    const source = ts.createSourceFile(
      file,
      readFileSync(resolve(dir, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node) => {
      if (ts.isObjectLiteralExpression(node)) {
        const properties = node.properties.filter(ts.isPropertyAssignment);
        const path = properties.find(
          (property) => property.name.getText(source) === 'path',
        );
        const component = properties.find(
          (property) => property.name.getText(source) === 'component',
        );
        if (
          path &&
          component &&
          ts.isStringLiteral(path.initializer) &&
          ts.isArrowFunction(component.initializer)
        ) {
          const value = path.initializer.text;
          if (!value.includes(':') && !value.includes('terminal'))
            routes.push(value);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const routeExpect = expect.configure({ soft: true });
  for (const route of [...new Set(routes)]) {
    await page.goto(routePath(route));
    await page.waitForTimeout(700);
    if (route === '/system_welcome') {
      await expect(page.locator('.metric-value').first()).not.toHaveText(
        '待采集',
        { timeout: 15_000 },
      );
      await expect(page.locator('.chart-container canvas')).toBeVisible();
      await expect(page.locator('.chart-container-small canvas')).toBeVisible();
    }
    await routeExpect(page.locator('body')).not.toBeEmpty();
    await routeExpect
      .poll(() => {
        const url = new URL(page.url());
        return url.hash.startsWith('#/')
          ? url.hash.slice(1).split('?')[0]
          : url.pathname;
      })
      .toBe(route);
    if (route === '/monitor_onduty_group_table')
      await routeExpect(
        page.getByText('缺少值班组ID参数，请返回值班组列表重新选择', {
          exact: true,
        }),
      ).toBeVisible();
    await routeExpect(page).not.toHaveURL(/auth\/login/);
  }
  expect(errors, 'browser runtime errors').toEqual([]);
  const expectedUnavailable = new Set(
    (process.env.CLOUDOPS_EXPECT_UNAVAILABLE || '').split(',').filter(Boolean),
  );
  const observedFailures = [...new Set(apiFailures)];
  const unexpected = observedFailures.filter((failure) => {
    const [status, path] = failure.split(' ');
    if (status === '503' && expectedUnavailable.has(path!)) {
      test
        .info()
        .annotations.push({ type: 'expected-unavailable', description: path! });
      return false;
    }
    return true;
  });
  expect(unexpected, 'authenticated API failures').toEqual([]);
});

test('system list layouts preserve responsive filters and role creation controls', async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  const password = adminPassword();
  test.skip(
    !password,
    'Set an isolated administrator password for system list acceptance.',
  );
  const errors: string[] = [];
  const apiFailures: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400)
      apiFailures.push(
        `${response.status()} ${new URL(response.url()).pathname}`,
      );
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(routePath('/auth/login'));
  await page
    .getByLabel('账号', { exact: true })
    .fill(process.env.CLOUDOPS_TEST_USER || 'admin');
  await page.getByLabel('密码', { exact: true }).fill(password!);
  const loginResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/user/login' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#password');
    if (input) input.value = '';
  });
  expect((await (await loginResponse).json()).code, 'login API code').toBe(0);
  await expect(page).not.toHaveURL(/auth\/login/, { timeout: 30_000 });

  const routes = [
    ['/system_user', '用户管理'],
    ['/system_role', '角色管理'],
    ['/system_api', 'API管理'],
    ['/system_audit', '审计日志'],
  ];
  for (const [route, title] of routes) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(routePath(route!));
    await expect(page.locator('.ops-page h1')).toHaveText(title!);
    await expect(
      page.locator('.ops-page__filters input').first(),
    ).toBeVisible();
    await expect(page.locator('.ops-page__content .ant-table')).toBeVisible();
    await expect(page.locator('.ops-page__actions button').first()).toHaveCSS(
      'display',
      'flex',
    );
    const toggle = page.getByLabel('深色', { exact: true });
    if (
      await page
        .locator('html')
        .evaluate((element) => element.classList.contains('dark'))
    )
      await page.getByLabel('浅色', { exact: true }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    if (route === '/system_role') {
      await page.screenshot({
        path: '.cache/ui-verification/system-role-desktop-light.png',
        fullPage: true,
        animations: 'disabled',
      });
      await page.getByRole('button', { name: '新建角色' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByLabel('角色名称', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: /^取\s*消$/ }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
    await toggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page
          .locator('aside')
          .first()
          .evaluate((element) => element.getBoundingClientRect().right),
      )
      .toBeLessThanOrEqual(1);
    await expect(page.locator('.ops-page h1')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
    await expect(page.locator('.assistant-float-button')).not.toBeVisible();
    await expect(
      page.locator('.layout-floating-preferences').first(),
    ).not.toBeVisible();
    const cards = page.locator('.ops-page__summary .stat-card');
    const cardRects = await cards.evaluateAll((elements) =>
      elements.map((element) => ({
        top: element.getBoundingClientRect().top,
        height: element.getBoundingClientRect().height,
      })),
    );
    expect(cardRects[0]!.top).toBe(cardRects[1]!.top);
    expect(cardRects.every((card) => card.height <= 100)).toBe(true);
    for (const name of [/^搜\s*索$/, /^重\s*置$/]) {
      const control = page
        .locator('.ops-page__filters')
        .getByRole('button', { name });
      await expectUncovered(control);
      await control.click();
    }
    await expectUncovered(
      page.locator('.ops-page__content .ant-table-thead th').first(),
    );
    if (route === '/system_user')
      await page.screenshot({
        path: '.cache/ui-verification/system-user-mobile-dark.png',
        fullPage: true,
        animations: 'disabled',
      });
  }
  expect(errors, 'system list browser runtime errors').toEqual([]);
  expect(apiFailures, 'system list API errors').toEqual([]);
});

test('workorder list layouts preserve mobile actions and cancellation', async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  const password = adminPassword();
  test.skip(
    !password,
    'Set an isolated administrator password for workorder list acceptance.',
  );
  const errors: string[] = [];
  const apiFailures: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (
      new URL(response.url()).pathname.startsWith('/api/') &&
      response.status() >= 400
    )
      apiFailures.push(
        `${response.status()} ${new URL(response.url()).pathname}`,
      );
  });
  await page.goto(routePath('/auth/login'));
  await page
    .getByLabel('账号', { exact: true })
    .fill(process.env.CLOUDOPS_TEST_USER || 'admin');
  await page.getByLabel('密码', { exact: true }).fill(password!);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#password');
    if (input) input.value = '';
  });
  await expect(page).not.toHaveURL(/auth\/login/, { timeout: 30_000 });
  for (const [route, title] of [
    ['/process', '流程管理'],
    ['/template', '模板管理'],
    ['/form_management', '表单管理'],
  ]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(routePath(route!));
    await expect(page.locator('.ops-page h1')).toHaveText(title!);
    const action = page.locator('.ops-page__actions button').first();
    await expectUncovered(action);
    await action.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^取\s*消$/ })
      .click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page
          .locator('aside')
          .first()
          .evaluate((element) => element.getBoundingClientRect().right),
      )
      .toBeLessThanOrEqual(1);
    const search = page.locator('.ops-page__filters .ant-input-search button');
    await expectUncovered(search);
    await search.click();
    await expectUncovered(
      page.locator('.ops-page__content .ant-table-thead th').first(),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
    await expect(page.locator('.assistant-float-button')).not.toBeVisible();
    if (route === '/process')
      await page.screenshot({
        path: '.cache/ui-verification/workorder-process-mobile.png',
        fullPage: true,
        animations: 'disabled',
      });
  }
  expect(errors).toEqual([]);
  expect(apiFailures).toEqual([]);
});

test('account menu reflects profile API and notifications have an honest empty state', async ({
  page,
}) => {
  const password = adminPassword();
  test.skip(
    !password,
    'Set an isolated administrator password for account acceptance.',
  );
  const profileResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/user/profile',
  );
  await page.goto(routePath('/auth/login'));
  await page
    .getByLabel('账号', { exact: true })
    .fill(process.env.CLOUDOPS_TEST_USER || 'admin');
  await page.getByLabel('密码', { exact: true }).fill(password!);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#password');
    if (input) input.value = '';
  });
  await expect(page).not.toHaveURL(/auth\/login/, { timeout: 30_000 });
  const profile = (await (await profileResponse).json()).data;
  await page.getByRole('button', { name: '账户菜单', exact: true }).click();
  const menu = page.locator('[role="menu"][data-state="open"]');
  await expect(menu).toBeVisible();
  const content = await menu.textContent();
  expect(
    content?.includes(profile.real_name || profile.username),
    'account name matches profile',
  ).toBe(true);
  expect(
    content?.includes(profile.email || profile.username),
    'account description matches profile',
  ).toBe(true);
  await expect(menu.getByText('Pro', { exact: true })).toHaveCount(0);
  await expect(
    menu.getByText('ann.vben@gmail.com', { exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '通知', exact: true }).click();
  await expect(page.getByText('通知源尚未接入', { exact: true })).toBeVisible();
  await expect(page.locator('.bell-button .bg-primary')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '查看所有', exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: '.cache/ui-verification/notification-empty.png',
    fullPage: true,
    animations: 'disabled',
  });
});

test('kubernetes cluster and namespace lists use real isolated resources', async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  const password = adminPassword();
  const clusterName = process.env.CLOUDOPS_TEST_CLUSTER_NAME;
  const namespace = process.env.CLOUDOPS_TEST_NAMESPACE;
  test.skip(
    !password || !clusterName || !namespace,
    'Set isolated Kubernetes acceptance resource names.',
  );
  const errors: string[] = [];
  const apiFailures: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (
      new URL(response.url()).pathname.startsWith('/api/') &&
      response.status() >= 400
    )
      apiFailures.push(
        `${response.status()} ${new URL(response.url()).pathname}`,
      );
  });
  await page.goto(routePath('/auth/login'));
  await page
    .getByLabel('账号', { exact: true })
    .fill(process.env.CLOUDOPS_TEST_USER || 'admin');
  await page.getByLabel('密码', { exact: true }).fill(password!);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#password');
    if (input) input.value = '';
  });
  await expect(page).not.toHaveURL(/auth\/login/, { timeout: 30_000 });
  await page.goto(routePath('/k8s_cluster'));
  await expect(page.locator('.ops-page h1')).toHaveText('集群管理');
  await expect(
    page.locator('.ant-table-tbody').getByText(clusterName!, { exact: true }),
  ).toBeVisible();
  await page
    .locator('.ops-page__actions')
    .getByRole('button', { name: '新建集群', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^取\s*消$/ })
    .click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.screenshot({
    path: '.cache/ui-verification/k8s-cluster-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto(routePath('/k8s_namespace'));
  await expect(page.locator('.ops-page h1')).toHaveText('命名空间管理');
  await expect(
    page
      .locator('.ant-table-tbody td:nth-child(2)')
      .getByText(namespace!, { exact: true }),
  ).toBeVisible();
  const selector = page.locator('.k8s-cluster-selector');
  await selector.hover();
  await selector.locator('.ant-select-clear').click();
  await expect(
    page
      .locator('.ops-page__actions')
      .getByRole('button', { name: '创建命名空间', exact: true }),
  ).toBeDisabled();
  await expect(page.getByText('请先选择集群', { exact: true })).toBeVisible();
  await selector.click();
  await page
    .locator('.ant-select-dropdown:visible .ant-select-item-option')
    .filter({ hasText: clusterName! })
    .click();
  await expect(
    page
      .locator('.ant-table-tbody td:nth-child(2)')
      .getByText(namespace!, { exact: true }),
  ).toBeVisible();
  await page.getByLabel('深色', { exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator('aside')
        .first()
        .evaluate((element) => element.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(1);
  const accountBounds = await page
    .getByRole('button', { name: '账户菜单', exact: true })
    .boundingBox();
  expect(accountBounds!.x).toBeGreaterThanOrEqual(0);
  expect(accountBounds!.x + accountBounds!.width).toBeLessThanOrEqual(390);
  await expectUncovered(
    page
      .locator('.ops-page__actions')
      .getByRole('button', { name: '刷新数据', exact: true }),
  );
  await expectUncovered(page.locator('.k8s-search-input'));
  await expectUncovered(page.locator('.ant-table-thead th:visible').first());
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.cache/ui-verification/k8s-namespace-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
  expect(apiFailures).toEqual([]);
});

test('kubernetes workloads display real Deployment and Pod resources', async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  const namespace = process.env.CLOUDOPS_TEST_NAMESPACE;
  const clusterName = process.env.CLOUDOPS_TEST_CLUSTER_NAME;
  test.skip(
    !namespace || !clusterName,
    'Set isolated Kubernetes acceptance resource names.',
  );
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (
      new URL(response.url()).pathname.startsWith('/api/') &&
      response.status() >= 400
    )
      failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await acceptanceLogin(page);
  for (const [route, title] of [
    ['/k8s_deployment', 'Deployment 管理'],
    ['/k8s_pod', 'Pod 管理'],
  ]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(routePath(route!));
    await expect(page.locator('.ops-page h1')).toHaveText(title!);
    await expect(page.locator('.k8s-cluster-selector')).toContainText(
      clusterName!,
    );
    await selectAcceptanceNamespace(page, namespace!);
    const rows =
      route === '/k8s_deployment'
        ? page.locator('.ant-table-tbody tr[data-row-key$="/web"]')
        : page.locator('.ant-table-tbody tr[data-row-key*="/web-"]');
    await expect(rows).toHaveCount(route === '/k8s_deployment' ? 1 : 2);
    await page.locator('.ops-page__actions button').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^取\s*消$/ })
      .click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByLabel('深色', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page
          .locator('aside')
          .first()
          .evaluate((element) => element.getBoundingClientRect().right),
      )
      .toBeLessThanOrEqual(1);
    await expectUncovered(
      page
        .locator('.ops-page__actions')
        .getByRole('button', { name: '刷新数据', exact: true }),
    );
    await expectUncovered(page.locator('.k8s-search-input'));
    await expectUncovered(page.locator('.ant-table-thead th:visible').first());
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (route === '/k8s_pod')
      await page.screenshot({
        path: '.cache/ui-verification/k8s-pod-mobile.png',
        fullPage: true,
        animations: 'disabled',
      });
  }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('pod terminal negotiates credential subprotocol and returns real output', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const namespace = process.env.CLOUDOPS_TEST_NAMESPACE;
  test.skip(
    !namespace || process.env.CLOUDOPS_TEST_WS_READY !== 'true',
    'Set a ready isolated Pod terminal environment.',
  );
  await page.addInitScript(() => {
    const check = {
      tokenInUrl: false,
      offeredAuth: false,
      offeredApp: false,
      negotiatedApp: false,
      echoedCredential: false,
    };
    Reflect.set(window, '__cloudopsWsCheck', check);
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        const address = new URL(String(url), location.origin);
        if (address.pathname.endsWith('/exec')) {
          const offered = Array.isArray(protocols) ? protocols : [protocols];
          check.tokenInUrl = address.searchParams.has('token');
          check.offeredAuth = offered.some(
            (protocol) =>
              typeof protocol === 'string' &&
              protocol.startsWith('cloudops-auth.'),
          );
          check.offeredApp = offered.includes('cloudops-v1');
          this.addEventListener('open', () => {
            check.negotiatedApp = this.protocol === 'cloudops-v1';
            check.echoedCredential = this.protocol.startsWith('cloudops-auth.');
          });
        }
      }
    };
  });
  const output: string[] = [];
  page.on('websocket', (socket) => {
    if (new URL(socket.url()).pathname.endsWith('/exec'))
      socket.on('framereceived', (event) => {
        if (typeof event.payload === 'string') {
          try {
            output.push(JSON.parse(event.payload).data || '');
          } catch {
            output.push(event.payload);
          }
        }
      });
  });
  await acceptanceLogin(page);
  await page.goto(routePath('/k8s_pod'));
  await selectAcceptanceNamespace(page, namespace!);
  const pod = page
    .locator('.ant-table-tbody tr[data-row-key*="/web-"]')
    .first();
  await pod.getByRole('button', { name: '执行命令', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '连接终端', exact: true }).click();
  await expect(page.getByText('已连接', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page
    .locator('#terminal-container textarea.xterm-helper-textarea')
    .focus();
  await page.keyboard.type("printf 'ui-%s-end\\n' ws");
  await page.keyboard.press('Enter');
  await expect
    .poll(() => output.join('').includes('ui-ws-end'), { timeout: 30_000 })
    .toBe(true);
  expect(
    await page.evaluate(() => Reflect.get(window, '__cloudopsWsCheck')),
  ).toEqual({
    tokenInUrl: false,
    offeredAuth: true,
    offeredApp: true,
    negotiatedApp: true,
    echoedCredential: false,
  });
  await page.getByRole('button', { name: '断开连接', exact: true }).click();
  await page.getByRole('dialog').locator('button.ant-modal-close').click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('assistant rejects unowned legacy cache and uses the profile UID', async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(routePath('/auth/login'));
  await page.evaluate(() => {
    localStorage.setItem(
      'aiAssistantChatState',
      JSON.stringify({
        sessionId: 'legacy-private-session',
        chatMessages: [
          { content: 'LEGACY_PRIVATE_CACHE_SENTINEL', type: 'user' },
        ],
      }),
    );
    localStorage.setItem(
      'aiAssistantSessions',
      JSON.stringify({
        sessions: [
          { localId: 'legacy', name: 'LEGACY_PRIVATE_CACHE_SENTINEL' },
        ],
      }),
    );
    localStorage.setItem(
      'assistant-session-history',
      JSON.stringify([{ session_id: 'LEGACY_PRIVATE_CACHE_SENTINEL' }]),
    );
  });
  const profileResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/user/profile',
  );
  await acceptanceLogin(page);
  const profile = (await (await profileResponse).json()).data;
  expect(Number.isSafeInteger(profile.id) && profile.id > 0).toBe(true);
  await page.locator('.assistant-float-button').click();
  await expect(page.locator('.ai-float-window')).not.toContainText(
    'LEGACY_PRIVATE_CACHE_SENTINEL',
  );
  expect(
    await page.evaluate(() =>
      [
        'aiAssistantChatState',
        'aiAssistantSessions',
        'assistant-session-history',
      ].every((key) => localStorage.getItem(key) === null),
    ),
  ).toBe(true);
  await page.locator('.ai-float-window button[title="关闭"]').click();
  await page.goto(routePath('/assistant/session'));
  await expect(page.locator('.session-container')).not.toContainText(
    'LEGACY_PRIVATE_CACHE_SENTINEL',
  );
  expect(
    await page.evaluate((owner) => {
      const chat = JSON.parse(
        localStorage.getItem(`cloudops-assistant:v1:${owner}:chat`) || '{}',
      );
      return chat.owner === owner;
    }, String(profile.id)),
  ).toBe(true);
  await page.getByRole('button', { name: '账户菜单', exact: true }).click();
  await page.getByRole('menuitem', { name: /^退出登录/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '确认', exact: true })
    .click();
  await expect(page).toHaveURL(/auth\/login/);
  await expect(page.locator('.ai-float-window')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('assistant clears an invalid owned session and permits a fresh question', async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  test.skip(
    process.env.CLOUDOPS_TEST_ASSISTANT_OWNER_READY !== 'true',
    'Requires isolated assistant owner validation.',
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const profileResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/user/profile',
  );
  await acceptanceLogin(page);
  const profile = (await (await profileResponse).json()).data;
  const invalidSid = 'cloudops-ui-unknown-owner-session';
  await page.evaluate(
    ({ owner, invalidSid }) => {
      const write = (name: string, value: unknown) =>
        localStorage.setItem(
          `cloudops-assistant:v1:${encodeURIComponent(owner)}:${name}`,
          JSON.stringify({ owner, value }),
        );
      write('chat', {
        sessionId: invalidSid,
        chatHistory: [],
        chatMessages: [
          { content: 'INVALID_OWNED_CACHE_SENTINEL', type: 'user' },
        ],
      });
      write('sessions', {
        sessions: [{ localId: 'local-validation', name: 'Validation' }],
        currentLocalSessionId: 'local-validation',
      });
    },
    { owner: String(profile.id), invalidSid },
  );
  await page.reload();
  await page.locator('.assistant-float-button').click();
  await expect(page.locator('.ai-float-window')).toContainText(
    'INVALID_OWNED_CACHE_SENTINEL',
  );
  const invalidResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname.endsWith('/assistant/query'),
    { timeout: 15_000 },
  );
  await page.locator('.ai-float-window textarea').fill('检查失效会话');
  await page.locator('.ai-float-window .send-button').click();
  expect((await invalidResponse).status()).toBe(404);
  await expect(page.locator('.ai-float-window')).toContainText('会话已失效');
  await expect(page.locator('.ai-float-window')).not.toContainText(
    'INVALID_OWNED_CACHE_SENTINEL',
  );
  await expect(page.locator('.ai-float-window textarea')).toBeEnabled();
  expect(
    await page.evaluate((owner) => {
      const chat = JSON.parse(
        localStorage.getItem(`cloudops-assistant:v1:${owner}:chat`) || '{}',
      );
      return (
        chat.owner === owner &&
        chat.value?.sessionId === '' &&
        chat.value?.chatHistory?.length === 0
      );
    }, String(profile.id)),
  ).toBe(true);
  await page.locator('.ai-float-window button[title="关闭"]').click();
  await page.getByRole('button', { name: '账户菜单', exact: true }).click();
  const menu = page.locator('[role="menu"][data-state="open"]');
  await menu.getByRole('menuitem', { name: /^退出登录/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '确认', exact: true })
    .click();
  await expect(page).toHaveURL(/auth\/login/);
  await expect(page.locator('.ai-float-window')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('kubernetes Service and ConfigMap preserve real queries and responsive actions', async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  const namespace = process.env.CLOUDOPS_TEST_NAMESPACE;
  const clusterName = process.env.CLOUDOPS_TEST_CLUSTER_NAME;
  test.skip(
    !namespace || !clusterName,
    'Requires isolated Kubernetes resources.',
  );
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (
      new URL(response.url()).pathname.startsWith('/api/') &&
      response.status() >= 400
    )
      failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await acceptanceLogin(page);
  for (const [route, title, resourceName] of [
    ['/k8s_service', 'Service 管理', 'web'],
    ['/k8s_configmap', 'ConfigMap 管理', 'web-content'],
  ]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(routePath(route!));
    await expect(page.locator('.ops-page h1')).toHaveText(title!);
    await expect(page.locator('.k8s-cluster-selector')).toContainText(
      clusterName!,
    );
    await selectAcceptanceNamespace(page, namespace!);
    const row = page.locator(
      `.ant-table-tbody tr[data-row-key$="/${resourceName}"]`,
    );
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: '查看详情', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText(resourceName!);
    await page.getByRole('dialog').locator('button.ant-modal-close').click();
    await page.locator('.ops-page__actions button').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^取\s*消$/ })
      .click();
    const search = page.getByPlaceholder(
      `搜索 ${route === '/k8s_service' ? 'Service' : 'ConfigMap'} 名称`,
    );
    await search.fill('no-such-ui-resource');
    await search.press('Enter');
    await expect(row).toHaveCount(0);
    await search.fill(resourceName!);
    await search.press('Enter');
    await expect(row).toHaveCount(1);
    if (process.env.CLOUDOPS_TEST_K8S_FILTER_READY === 'true') {
      if (route === '/k8s_configmap') {
        const key = page.getByPlaceholder('数据键过滤');
        await key.fill('no-such-data-key');
        await key.press('Enter');
        await expect(row).toHaveCount(0);
        await key.fill('INDEX');
        await key.press('Enter');
        await expect(row).toHaveCount(1);
        await key.fill('');
        await key.press('Enter');
        await expect(row).toHaveCount(1);
      } else {
        await page
          .locator('.ops-page__filters .ant-select')
          .filter({ hasText: '状态筛选' })
          .click();
        await page
          .locator('.ant-select-dropdown:visible')
          .getByText('已停止', { exact: true })
          .click();
        await expect(row).toHaveCount(0);
        await page
          .locator('.ops-page__filters .ant-select')
          .filter({ hasText: '已停止' })
          .click();
        await page
          .locator('.ant-select-dropdown:visible')
          .getByText('运行中', { exact: true })
          .click();
        await expect(row).toHaveCount(1);
      }
    }
    if (route === '/k8s_service')
      await page.screenshot({
        path: '.cache/ui-verification/k8s-service-desktop.png',
        fullPage: true,
        animations: 'disabled',
      });
    await page.getByLabel('深色', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectUncovered(
      page
        .locator('.ops-page__actions')
        .getByRole('button', { name: '刷新数据', exact: true }),
    );
    await expectUncovered(search);
    expect(
      await row.evaluate((element) => element.getBoundingClientRect().height),
    ).toBeLessThan(160);
    await expectUncovered(
      row.getByRole('button', { name: '查看详情', exact: true }),
    );
    await row.getByRole('button', { name: '查看详情', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').locator('button.ant-modal-close').click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (route === '/k8s_configmap') {
      await page.locator('.ant-table-content').evaluate((element) => {
        element.scrollLeft = 0;
      });
      await page.screenshot({
        path: '.cache/ui-verification/k8s-configmap-mobile.png',
        fullPage: true,
        animations: 'disabled',
      });
    }
  }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('Prometheus lists preserve real empty queries, cancellation and mobile controls', async ({
  page,
}) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  const failures: string[] = [];
  const writes: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (
      new URL(response.url()).pathname.startsWith('/api/') &&
      response.status() >= 400
    )
      failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await acceptanceLogin(page);
  page.on('request', (request) => {
    if (
      new URL(request.url()).pathname.startsWith('/api/monitor/') &&
      request.method() !== 'GET'
    )
      writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  for (const [route, title, listPath] of [
    ['/monitor_pool', '采集池', '/api/monitor/scrape_pools/list'],
    ['/monitor_job', '采集任务', '/api/monitor/scrape_jobs/list'],
    ['/monitor_send', '发送组', '/api/monitor/send_groups/list'],
    [
      '/monitor_alert_pool',
      '告警实例池',
      '/api/monitor/alert_manager_pools/list',
    ],
    ['/monitor_alert_record', '记录规则', '/api/monitor/record_rules/list'],
    ['/monitor_alert_event', '告警事件', '/api/monitor/alert_events/list'],
    ['/monitor_config', '监控配置', '/api/monitor/configs/list'],
    ['/monitor_alert_rule', '告警规则', '/api/monitor/alert_rules/list'],
    ['/monitor_onduty_group', '值班组', '/api/monitor/onduty_groups/list'],
  ]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const initial = page.waitForResponse(
      (response) => new URL(response.url()).pathname === listPath,
    );
    await page.goto(routePath(route!));
    await expect(page.locator('.ops-page h1')).toHaveText(title!);
    expect((await initial).status()).toBe(200);
    const search = page.locator('.ops-page__filters input').first();
    const searched = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === listPath &&
        new URL(response.url()).searchParams.get('search') === 'ui-no-match',
    );
    await search.fill('ui-no-match');
    await search.press('Enter');
    expect((await searched).status()).toBe(200);
    const reset = page
      .locator('.ops-page__filters')
      .getByRole('button', { name: /^重\s*置$/ });
    const resetResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === listPath &&
        !new URL(response.url()).searchParams.get('search'),
    );
    await reset.click();
    expect((await resetResponse).status()).toBe(200);
    await expect(search).toHaveValue('');
    const create = page.locator('.ops-page__actions .btn-create');
    if (await create.count()) {
      await create.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /^取\s*消$/ })
        .click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
    if (route === '/monitor_pool')
      await page.screenshot({
        path: '.cache/ui-verification/prometheus-pool-desktop.png',
        fullPage: true,
        animations: 'disabled',
      });
    await page.getByLabel('深色', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectUncovered(search);
    await expectUncovered(reset);
    await expectUncovered(page.getByLabel('深色', { exact: true }));
    if (await create.count()) await expectUncovered(create);
    const cardWidths = await page
      .locator('.ops-page__summary .ant-card')
      .evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().width),
      );
    if (cardWidths.length > 1)
      expect(Math.max(...cardWidths)).toBeLessThan(200);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (route === '/monitor_send')
      await page.screenshot({
        path: '.cache/ui-verification/prometheus-send-mobile.png',
        fullPage: true,
        animations: 'disabled',
      });
  }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  expect(writes).toEqual([]);
});

test('cron default retry budget and responsive cancellation use real API', async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  const writes: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await acceptanceLogin(page);
  page.on('request', (request) => {
    if (
      new URL(request.url()).pathname.startsWith('/api/cron/') &&
      request.method() !== 'GET'
    )
      writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  const list = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/cron/job/list',
  );
  await page.goto(routePath('/cron/management'));
  await expect(page.locator('.ops-page h1')).toHaveText('定时任务管理');
  expect((await list).status()).toBe(200);
  const create = page
    .locator('.ops-page__actions')
    .getByRole('button', { name: /创建任务/ });
  await create.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('spinbutton', { name: /^自动重投次数/ }),
  ).toHaveValue('3');
  await dialog.getByRole('button', { name: /^取\s*消$/ }).click();
  await expect(dialog).not.toBeVisible();
  await page.screenshot({
    path: '.cache/ui-verification/cron-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByLabel('深色', { exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectUncovered(create);
  await expectUncovered(page.getByPlaceholder('搜索任务名称或描述...'));
  await expectUncovered(
    page
      .locator('.ops-page__actions')
      .getByRole('button', { name: /刷新数据/ }),
  );
  await create.click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('spinbutton', { name: /^自动重投次数/ }),
  ).toHaveValue('3');
  await dialog.getByRole('button', { name: /^取\s*消$/ }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.cache/ui-verification/cron-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

test('on-duty calendar reads an isolated real group and supports month navigation', async ({
  page,
}) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const login = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/user/login',
  );
  const profileResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/user/profile',
  );
  await acceptanceLogin(page);
  const token = (await (await login).json()).data.accessToken;
  const profile = (await (await profileResponse).json()).data;
  const headers = { Authorization: `Bearer ${token}` };
  const name = `ui-calendar-${Date.now()}`;
  let groupId = 0;
  try {
    const created = await page.request.post(
      '/api/monitor/onduty_groups/create',
      {
        headers,
        data: {
          name,
          user_ids: [profile.id],
          shift_days: 1,
          description: 'Isolated UI acceptance fixture',
        },
      },
    );
    expect(created.status()).toBe(200);
    expect((await created.json()).code).toBe(0);
    const listed = await page.request.get('/api/monitor/onduty_groups/list', {
      headers,
      params: { page: 1, size: 10, search: name },
    });
    const matches = (await listed.json()).data.items.filter(
      (item: { name: string }) => item.name === name,
    );
    expect(matches.length).toBe(1);
    groupId = matches[0].id;
    const future = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
        `/api/monitor/onduty_groups/future_plan/${groupId}`,
    );
    await page.goto(routePath(`/monitor_onduty_group_table?id=${groupId}`));
    await expect(page.locator('.ops-page h1')).toHaveText(name);
    expect((await future).status()).toBe(200);
    await expect(page.locator('.calendar-day').first()).toBeVisible();
    const title = page.locator('.calendar-title h2');
    const initial = await title.textContent();
    await page.getByRole('button', { name: '下个月', exact: true }).click();
    await expect(title).not.toHaveText(initial!);
    await expect(
      page.getByRole('button', { name: '上个月', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: '上个月', exact: true }).click();
    await expect(title).toHaveText(initial!);
    const history = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/monitor/onduty_groups/history/${groupId}` &&
        new URL(response.url()).searchParams.get('search') === 'ui-no-history',
    );
    await page.getByPlaceholder('搜索值班历史...').fill('ui-no-history');
    await page.getByPlaceholder('搜索值班历史...').press('Enter');
    expect((await history).status()).toBe(200);
    await page.getByLabel('深色', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectUncovered(
      page.getByRole('button', { name: '返回值班组', exact: true }),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: '.cache/ui-verification/prometheus-calendar-mobile.png',
      fullPage: true,
      animations: 'disabled',
    });
    expect(errors).toEqual([]);
  } finally {
    if (groupId > 0) {
      const deleted = await page.request.delete(
        `/api/monitor/onduty_groups/delete/${groupId}`,
        { headers },
      );
      expect(deleted.status()).toBe(200);
      expect((await deleted.json()).code).toBe(0);
    }
  }
});

test('remaining Kubernetes resource lists preserve real kind scopes and safe cancellation', async ({
  page,
}) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const namespace = process.env.CLOUDOPS_TEST_NAMESPACE;
  const clusterName = process.env.CLOUDOPS_TEST_CLUSTER_NAME;
  test.skip(!namespace || !clusterName, 'Requires isolated kind resources.');
  const errors: string[] = [];
  const failures: string[] = [];
  const writes: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (
      new URL(response.url()).pathname.startsWith('/api/k8s/') &&
      response.status() >= 400
    )
      failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await acceptanceLogin(page);
  page.on('request', (request) => {
    if (
      new URL(request.url()).pathname.startsWith('/api/k8s/') &&
      request.method() !== 'GET'
    )
      writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  for (const [kind, title, namespaced] of [
    ['node', '节点管理', false],
    ['statefulset', 'StatefulSet 管理', true],
    ['daemonset', 'DaemonSet 管理', true],
    ['ingress', 'Ingress 管理', true],
    ['secret', 'Secret 管理', true],
    ['pvc', 'PVC 管理', true],
    ['role', 'Role 管理', true],
    ['rolebinding', 'RoleBinding 管理', true],
    ['pv', 'PV 管理', false],
    ['clusterrolebinding', 'ClusterRoleBinding 管理', false],
  ] as const) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const initial = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/k8s/${kind}/1/list`,
    );
    await page.goto(routePath(`/k8s_${kind}`));
    await expect(page.locator('.ops-page h1')).toHaveText(title);
    await expect(page.locator('.k8s-cluster-selector')).toContainText(
      clusterName!,
    );
    expect((await initial).status()).toBe(200);
    if (namespaced) await selectAcceptanceNamespace(page, namespace!);
    await expect(page.locator('.ops-page .ant-alert-error')).toHaveCount(0);
    const create = page
      .locator('.ops-page__actions')
      .getByRole('button', { name: /创建/ });
    if (await create.count()) {
      await create.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /^取\s*消$/ })
        .click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
    if (kind === 'node') {
      await expect(
        page.locator('.ant-table-tbody tr[data-row-key]').first(),
      ).toBeVisible();
      await page.screenshot({
        path: '.cache/ui-verification/k8s-node-desktop.png',
        fullPage: true,
        animations: 'disabled',
      });
    }
    await page.getByLabel('深色', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectUncovered(
      page
        .locator('.ops-page__actions')
        .getByRole('button', { name: '刷新数据', exact: true }),
    );
    await expectUncovered(page.locator('.k8s-cluster-selector'));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (kind === 'rolebinding')
      await page.screenshot({
        path: '.cache/ui-verification/k8s-rolebinding-mobile.png',
        fullPage: true,
        animations: 'disabled',
      });
  }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  expect(writes).toEqual([]);
});

test('YAML templates and tasks complete a real isolated dry-run without creating a resource', async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  const namespace = process.env.CLOUDOPS_TEST_NAMESPACE;
  const clusterName = process.env.CLOUDOPS_TEST_CLUSTER_NAME;
  test.skip(!namespace || !clusterName, 'Requires isolated kind resources.');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const login = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/user/login',
  );
  await acceptanceLogin(page);
  const token = (await (await login).json()).data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  const resourceName = `ui-yaml-${Date.now()}`;
  const templateName = `${resourceName}-template`;
  const taskName = `${resourceName}-task`;
  const content = `apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: ${resourceName}\n  namespace: ${namespace}\ndata:\n  validation: safe-dry-run\n`;
  let templateId = 0;
  let taskId = 0;
  let templateCreated = false;
  let taskCreated = false;
  const ownId = async (kind: string, name: string) => {
    const response = await page.request.get(`/api/k8s/${kind}/1/list`, {
      headers,
      params: {
        page: 1,
        size: 10,
        cluster_id: 1,
        ...(kind === 'yaml_task' ? { name } : { search: name }),
      },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.code).toBe(0);
    const matches = data.data.items.filter(
      (item: { name: string }) => item.name === name,
    );
    return matches[0]?.id || 0;
  };
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(routePath('/k8s_yaml_template'));
    await expect(page.locator('.ops-page h1')).toHaveText('YAML 模板管理');
    await expect(page.locator('.k8s-cluster-selector')).toContainText(
      clusterName!,
    );
    await page
      .locator('.ops-page__actions')
      .getByRole('button', { name: /创建/ })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: /模板名称/ }).fill(templateName);
    await dialog.getByRole('textbox', { name: /YAML 内容/ }).fill(content);
    const createdTemplate = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/k8s/yaml_template/1/create',
    );
    await dialog.getByRole('button', { name: /^创\s*建$/ }).click();
    const templateResponse = await createdTemplate;
    expect(templateResponse.status()).toBe(200);
    templateCreated = (await templateResponse.json()).code === 0;
    expect(templateCreated).toBe(true);
    await expect(dialog).not.toBeVisible();
    templateId = await ownId('yaml_template', templateName);
    expect(templateId).toBeGreaterThan(0);
    await expect(
      page.locator(`tr[data-row-key="${templateId}"]`),
    ).toContainText(templateName);
    await page.goto(routePath('/k8s_yaml_task'));
    await expect(page.locator('.ops-page h1')).toHaveText('YAML 任务管理');
    await page
      .locator('.ops-page__actions')
      .getByRole('button', { name: /创建/ })
      .click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: /任务名称/ }).fill(taskName);
    await dialog.locator('.ant-select').first().click();
    await page
      .locator('.ant-select-dropdown:visible')
      .getByText(templateName, { exact: true })
      .click();
    const createdTask = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/k8s/yaml_task/1/create',
    );
    await dialog.getByRole('button', { name: /^创\s*建$/ }).click();
    const taskResponse = await createdTask;
    expect(taskResponse.status()).toBe(200);
    taskCreated = (await taskResponse.json()).code === 0;
    expect(taskCreated).toBe(true);
    await expect(dialog).not.toBeVisible();
    taskId = await ownId('yaml_task', taskName);
    expect(taskId).toBeGreaterThan(0);
    const row = page.locator(`tr[data-row-key="${taskId}"]`);
    await expect(row).toContainText(taskName);
    await row.getByRole('button', { name: '执行任务', exact: true }).click();
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole('checkbox', { name: '预检查模式 (Dry Run)', exact: true })
      .check();
    const applyRequest = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname ===
        `/api/k8s/yaml_task/1/${taskId}/apply`,
    );
    const applyResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
        `/api/k8s/yaml_task/1/${taskId}/apply`,
    );
    await dialog.getByRole('button', { name: /^执\s*行$/ }).click();
    expect((await applyRequest).postDataJSON().dry_run).toBe(true);
    expect((await applyResponse).status()).toBe(200);
    await expect(dialog).not.toBeVisible();
    const objects = await page.request.get('/api/k8s/configmap/1/list', {
      headers,
      params: { namespace, search: resourceName, page: 1, size: 10 },
    });
    expect(objects.status()).toBe(200);
    expect(
      (await objects.json()).data.items.filter(
        (item: { name: string }) => item.name === resourceName,
      ),
    ).toHaveLength(0);
    await page.getByLabel('深色', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectUncovered(
      page
        .locator('.ops-page__actions')
        .getByRole('button', { name: '刷新数据', exact: true }),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: '.cache/ui-verification/k8s-yaml-task-mobile.png',
      fullPage: true,
      animations: 'disabled',
    });
    expect(errors).toEqual([]);
  } finally {
    if (taskCreated) taskId ||= await ownId('yaml_task', taskName);
    if (templateCreated)
      templateId ||= await ownId('yaml_template', templateName);
    if (taskId > 0)
      expect(
        (
          await page.request.delete(`/api/k8s/yaml_task/1/${taskId}/delete`, {
            headers,
          })
        ).status(),
      ).toBe(200);
    if (templateId > 0)
      expect(
        (
          await page.request.delete(
            `/api/k8s/yaml_template/1/${templateId}/delete`,
            { headers },
          )
        ).status(),
      ).toBe(200);
    const objects = await page.request.get('/api/k8s/configmap/1/list', {
      headers,
      params: { namespace, search: resourceName, page: 1, size: 10 },
    });
    if (objects.ok())
      for (const item of (await objects.json()).data.items)
        if (item.name === resourceName && item.namespace === namespace)
          expect(
            (
              await page.request.delete(
                `/api/k8s/configmap/1/${namespace}/${resourceName}/delete`,
                { headers },
              )
            ).status(),
          ).toBe(200);
  }
});

test('expired login preserves its dialog and rebuilds current route permissions', async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await acceptanceLogin(page);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some((key) => key.endsWith('preferences')),
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) =>
      key.endsWith('preferences'),
    )!;
    const cached = JSON.parse(localStorage.getItem(key)!);
    cached.value.app.loginExpiredMode = 'modal';
    localStorage.setItem(key, JSON.stringify(cached));
  });
  await page.goto(routePath('/system_user'));
  // Hash 导航不重启应用，重新加载后才能应用刚写入缓存的过期登录策略
  await page.reload();
  await expect(page.locator('.ops-page h1')).toHaveText('用户管理');
  // 仅注入一次过期响应，重新登录与资料、权限及列表均使用真实本地服务
  await page.route(
    '**/api/user/list?*',
    (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 401, message: 'acceptance-expired' }),
      }),
    { times: 1 },
  );
  await page.route(
    '**/api/user/refresh_token',
    (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 401, message: 'acceptance-expired' }),
      }),
    { times: 1 },
  );
  await page
    .locator('.ops-page__filters')
    .getByRole('button', { name: /^搜\s*索$/ })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('.ops-page')).toHaveCount(0);
  await dialog
    .getByLabel('账号', { exact: true })
    .fill(process.env.CLOUDOPS_TEST_USER || 'admin');
  await dialog.getByLabel('密码', { exact: true }).fill(adminPassword()!);
  const profile = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/user/profile',
  );
  const list = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/user/list' &&
      response.status() === 200,
  );
  await dialog.getByRole('button', { name: '登录', exact: true }).click();
  await page.evaluate(() => {
    for (const input of document.querySelectorAll<HTMLInputElement>(
      'input[type="password"]',
    ))
      input.value = '';
  });
  expect((await profile).status()).toBe(200);
  expect((await list).status()).toBe(200);
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/system_user/);
  await expect(page.locator('.ops-page h1')).toHaveText('用户管理');
  expect(errors).toEqual([]);
});

test('notification configuration uses real pagination, logs and safe responsive forms', async ({
  page,
}) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(15_000);
  const login = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/user/login' &&
      response.request().method() === 'POST',
  );
  await acceptanceLogin(page);
  const token = (await (await login).json()).data.accessToken;
  expect(typeof token === 'string' && token.length > 0).toBe(true);
  const nonce = `cloudops-ui-notification-${Date.now()}`;
  const names = [`${nonce}-email`, `${nonce}-feishu`];
  const ids: number[] = [];
  const api = async (path: string, method = 'GET', data?: unknown) => {
    const response = await page.request.fetch(
      `/api/workorder/notification${path}`,
      { method, data, headers: { Authorization: `Bearer ${token}` } },
    );
    const result = await response.json();
    expect(response.status()).toBe(200);
    expect(result.code).toBe(0);
    return result.data;
  };
  const uiWrites: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (
      request.url().includes('/api/workorder/notification/') &&
      request.method() !== 'GET'
    )
      uiWrites.push(new URL(request.url()).pathname);
  });
  try {
    for (const [index, channel] of ['email', 'feishu'].entries()) {
      await api('/create', 'POST', {
        name: names[index],
        description: 'isolated UI acceptance, never send',
        channels: [channel],
        event_types: ['instance_created'],
        trigger_type: 'immediate',
        recipient_types: ['creator'],
        message_template: 'Acceptance {title}',
        status: 2,
        priority: 2,
        max_retries: 1,
        retry_interval: 1,
        is_default: 2,
      });
    }
    const fixture = await api(`/list?page=1&page_size=100&name=${nonce}`);
    ids.push(
      ...fixture.items
        .filter((item: { name: string }) => names.includes(item.name))
        .map((item: { id: number }) => item.id),
    );
    expect(ids).toHaveLength(2);
    const paged = await api(`/list?page=2&page_size=1&name=${nonce}`);
    expect(paged.items).toHaveLength(1);
    expect(paged.total).toBe(2);
    await page.goto(routePath('/notification'));
    await expect(page.locator('.ops-page h1')).toHaveText('通知配置');
    const search = page.getByLabel('搜索通知配置', { exact: true });
    const searched = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          '/api/workorder/notification/list' &&
        new URL(response.url()).searchParams.get('name') === nonce,
    );
    await search.fill(nonce);
    await search.press('Enter');
    const requestURL = new URL((await searched).url());
    expect(requestURL.searchParams.get('page_size')).toBe('10');
    expect(requestURL.searchParams.has('size')).toBe(false);
    await expect(page.locator('.name-text')).toHaveCount(2);
    await expect(page.locator('.ops-page__summary')).toContainText('本页禁用');
    await expect(page.locator('.ops-page__summary')).not.toContainText(
      '今日发送',
    );
    if (process.env.CLOUDOPS_TEST_NOTIFICATION_CHANNEL_READY === 'true') {
      await page.getByLabel('通知渠道筛选', { exact: true }).click();
      const filtered = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            '/api/workorder/notification/list' &&
          new URL(response.url()).searchParams.get('channel') === 'email',
      );
      await page
        .locator('.ant-select-dropdown:visible')
        .getByText('邮件', { exact: true })
        .click();
      expect((await filtered).status()).toBe(200);
      await expect(page.locator('.name-text')).toHaveCount(1);
      await expect(page.locator('.name-text')).toHaveText(names[0]!);
    }
    const row = page
      .locator('.ant-table-tbody tr[data-row-key]')
      .filter({ hasText: names[0] })
      .first();
    await row
      .getByRole('button', { name: '通知更多操作', exact: true })
      .click();
    const logsRead: string[] = [];
    page.on('response', (response) => {
      if (
        new URL(response.url()).pathname === '/api/workorder/notification/logs'
      )
        logsRead.push(response.url());
    });
    await page
      .getByRole('menuitem')
      .filter({ hasText: '发送记录' })
      .click({ timeout: 5000 });
    expect(errors).toEqual([]);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect.poll(() => logsRead.length).toBe(1);
    const logsURL = new URL(logsRead[0]!);
    expect(logsURL.searchParams.get('notification_id')).toBe(
      String(
        fixture.items.find((item: { name: string }) => item.name === names[0])
          .id,
      ),
    );
    expect(logsURL.searchParams.get('page_size')).toBe('10');
    expect(logsURL.searchParams.has('notificationId')).toBe(false);
    await expect(page.getByRole('dialog').locator('.ant-empty')).toBeVisible();
    await page.getByRole('dialog').locator('button.ant-modal-close').click();
    await page
      .getByRole('button', { name: '创建通知配置', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toContainText('创建通知配置');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^取\s*消$/ })
      .click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectUncovered(
      page.getByRole('button', { name: '创建通知配置', exact: true }),
    );
    await expectUncovered(
      page.getByRole('button', { name: '重置通知筛选', exact: true }),
    );
    const summary = page.locator('.stats-grid');
    expect(
      await summary.evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(' ').length,
      ),
    ).toBe(2);
    await page.getByLabel('深色', { exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.waitForTimeout(300);
    await page.screenshot({
      path: '.cache/ui-verification/notification-mobile-dark.png',
      fullPage: true,
    });
    expect(uiWrites).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    const remaining = await api(`/list?page=1&page_size=100&name=${nonce}`);
    for (const item of remaining.items.filter((item: { name: string }) =>
      names.includes(item.name),
    ))
      await api(`/delete/${item.id}`, 'DELETE');
  }
});

test('assistant and autofix pages preserve responsive read-only interactions without model calls', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const forbidden: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (
      path.startsWith('/api/v1/') &&
      (request.method() !== 'GET' || /\/ready$|\/assistant\/query$/.test(path))
    )
      forbidden.push(`${request.method()} ${path}`);
  });
  await acceptanceLogin(page);
  const routes = [
    ['/assistant/info', '服务信息'],
    ['/assistant/knowledge', '知识库管理'],
    ['/assistant/query', '智能问答'],
    ['/assistant/session', '会话管理'],
    ['/autofix/workflow', '自动修复工作流'],
  ];
  for (const [path, title] of routes) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(routePath(path!));
    await expect(page.locator('.ops-page h1')).toHaveText(title!);
    if (path === '/assistant/query') {
      await expect(page.getByText('助手模式', { exact: true })).toBeVisible();
      await expect(page.locator('.quick-question-btn').first()).toBeVisible();
      await expect(page.getByPlaceholder('请输入您的问题...')).toHaveValue('');
    }
    if (path === '/autofix/workflow') {
      const run = page.getByRole('button', { name: /^执行工作流$/ });
      await expect(run).toBeDisabled();
      await expect(
        page.getByRole('button', { name: /^原始结果$/ }),
      ).toBeDisabled();
      const originalNamespace = await page
        .getByPlaceholder('default', { exact: true })
        .inputValue();
      await page
        .getByPlaceholder('default', { exact: true })
        .fill('owned-acceptance-no-execution');
      await page
        .getByPlaceholder('描述当前故障现象、涉及资源和期望处理方式')
        .fill('只读验收，不提交执行');
      await expect(run).toBeEnabled();
      await page.getByRole('button', { name: /^重\s*置$/ }).click();
      await expect(run).toBeDisabled();
      await expect(
        page.getByPlaceholder('default', { exact: true }),
      ).toHaveValue(originalNamespace);
    }
    if (
      await page
        .locator('html')
        .evaluate((element) => element.classList.contains('dark'))
    )
      await page.getByLabel('浅色', { exact: true }).click();
    await page.getByLabel('深色', { exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      path,
    ).toBe(true);
  }
  await page.waitForTimeout(300);
  await page.locator('.ops-page h1').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: '.cache/ui-verification/autofix-mobile-dark.png',
    fullPage: true,
  });
  expect(forbidden).toEqual([]);
  expect(errors).toEqual([]);
});

test('workorder instance completes a real template draft submit and approval lifecycle', async ({
  page,
}) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  test.skip(
    process.env.CLOUDOPS_TEST_WORKORDER_FLOW_READY !== 'true',
    'Requires an isolated database with notifications disabled.',
  );
  const login = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/user/login' &&
      response.request().method() === 'POST',
  );
  await acceptanceLogin(page);
  const account = (await (await login).json()).data;
  const token = account.accessToken;
  const uid = Number(account.id);
  expect(
    typeof token === 'string' && Number.isSafeInteger(uid) && uid > 0,
  ).toBe(true);
  const nonce = `cloudops-ui-flow-${Date.now()}`;
  const owned: Array<{ kind: string; id: number }> = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const api = async (path: string, method = 'GET', data?: unknown) => {
    const response = await page.request.fetch(`/api/workorder/${path}`, {
      method,
      data,
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    expect(response.status(), path.split('?')[0]).toBe(200);
    expect(result.code, path.split('?')[0]).toBe(0);
    return result.data;
  };
  const find = async (kind: string) => {
    const data = await api(`${kind}/list?page=1&size=100&search=${nonce}`);
    return data.items.find(
      (item: { name?: string; title?: string }) =>
        (kind === 'instance' ? item.title : item.name) === nonce,
    );
  };
  const create = async (kind: string, fields: object) => {
    await api(`${kind}/create`, 'POST', { name: nonce, ...fields });
    const item = await find(kind);
    expect(!!item?.id).toBe(true);
    owned.push({ kind, id: item.id });
    return item.id as number;
  };
  try {
    // 工作流会产生业务事件；隔离库必须没有启用中的通知配置
    const active = await api('notification/list?page=1&page_size=100&status=1');
    expect(active.total).toBe(0);
    const category = await create('category', { status: 1 });
    const form = await create('form-design', {
      status: 2,
      category_id: category,
      is_template: 1,
      schema: {
        fields: [
          {
            id: 'reason',
            name: 'reason',
            label: '变更说明',
            type: 'text',
            required: 1,
          },
        ],
      },
    });
    const process = await create('process', {
      status: 2,
      category_id: category,
      form_design_id: form,
      is_default: 2,
      definition: {
        steps: [
          {
            id: 'start',
            type: 'start',
            name: '开始',
            sort_order: 1,
            actions: ['start'],
          },
          {
            id: 'approval',
            type: 'approval',
            name: '审批',
            sort_order: 2,
            assignee_type: 'user',
            assignee_ids: [uid],
            actions: ['approve', 'reject'],
          },
          { id: 'end', type: 'end', name: '完成', sort_order: 3 },
        ],
        connections: [
          { from: 'start', to: 'approval' },
          { from: 'approval', to: 'end' },
        ],
      },
    });
    await create('template', {
      status: 1,
      process_id: process,
      category_id: category,
      form_design_id: form,
      default_values: { reason: '仅本机浏览器验收' },
    });
    await page.goto(routePath('/instance'));
    await expect(page.locator('.ops-page h1')).toHaveText('工单实例');
    await page
      .getByRole('button', { name: '从模板创建工单', exact: true })
      .click();
    let dialog = page.getByRole('dialog');
    await dialog.locator('.ant-select').first().click();
    await page
      .locator('.ant-select-dropdown:visible .ant-select-item-option')
      .filter({ hasText: nonce })
      .click();
    await dialog
      .getByPlaceholder('请输入工单标题', { exact: true })
      .fill(nonce);
    await dialog.locator('.ant-modal-footer .ant-btn-primary').click();
    dialog = page.getByRole('dialog', { name: '创建工单', exact: true });
    await expect(
      dialog.locator('.visual-form-fields input').first(),
    ).toHaveValue('仅本机浏览器验收');
    const [created] = await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            '/api/workorder/instance/create' &&
          response.request().method() === 'POST',
      ),
      dialog.locator('.ant-modal-footer .ant-btn-primary').click(),
    ]);
    expect(created.status()).toBe(200);
    await expect(dialog).not.toBeVisible();
    const instance = await find('instance');
    expect(instance.status).toBe(1);
    owned.push({ kind: 'instance', id: instance.id });
    await page.getByLabel('搜索工单', { exact: true }).fill(nonce);
    await page.getByLabel('搜索工单', { exact: true }).press('Enter');
    const row = page.locator(
      `.ant-table-tbody tr[data-row-key="${instance.id}"]`,
    );
    await expect(row).toContainText('草稿');
    await row
      .getByRole('button', { name: '工单更多操作', exact: true })
      .click();
    await page.getByRole('menuitem').filter({ hasText: '提交工单' }).click();
    dialog = page.getByRole('dialog').filter({ hasText: '提交确认' });
    const [submitted] = await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
          `/api/workorder/instance/submit/${instance.id}`,
      ),
      dialog.getByRole('button', { name: /^提\s*交$/ }).click(),
    ]);
    expect(submitted.status()).toBe(200);
    await expect(row).toContainText('待处理');
    await row.getByRole('button', { name: /^查\s*看$/ }).click();
    dialog = page.getByRole('dialog').filter({ hasText: '工单详情' });
    await expect(dialog.locator('h2')).toHaveText(nonce);
    await expect(dialog).toContainText('审批');
    await dialog.getByRole('button', { name: /^审批通过$/ }).click();
    const approval = page
      .getByRole('dialog')
      .filter({ hasText: '审批意见' })
      .last();
    await approval.getByRole('textbox').fill('仅本机验收通过');
    const [approved] = await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
          `/api/workorder/instance/approve/${instance.id}`,
      ),
      approval.locator('.ant-modal-footer .ant-btn-primary').click(),
    ]);
    expect(approved.status()).toBe(200);
    await expect(row).toContainText('已完成');
    expect((await api(`instance/detail/${instance.id}`)).status).toBe(4);
    await page
      .getByRole('dialog')
      .filter({ hasText: '工单详情' })
      .getByRole('button', { name: /^关\s*闭$/ })
      .click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectUncovered(
      page.getByRole('button', { name: '创建工单', exact: true }),
    );
    await expectUncovered(
      page.getByRole('button', { name: '重置工单筛选', exact: true }),
    );
    expect(
      await page
        .locator('.stats-grid')
        .evaluate(
          (element) =>
            getComputedStyle(element).gridTemplateColumns.split(' ').length,
        ),
    ).toBe(2);
    await page.getByLabel('深色', { exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.waitForTimeout(300);
    await page.locator('.ops-page h1').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: '.cache/ui-verification/instance-mobile-dark.png',
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    // 创建响应后页面失败也按唯一名称发现本轮草稿；只删除本轮记录
    const discovered = await find('instance');
    if (
      discovered &&
      !owned.some(
        (item) => item.kind === 'instance' && item.id === discovered.id,
      )
    )
      owned.push({ kind: 'instance', id: discovered.id });
    for (const item of [...owned].reverse()) {
      if (item.kind === 'instance') {
        const current = await api(`instance/detail/${item.id}`);
        if ([2, 3].includes(current.status))
          await api(`instance/reject/${item.id}`, 'POST', {
            comment: `${nonce} cleanup`,
          });
      }
      if (item.kind === 'process')
        await api(`process/update/${item.id}`, 'PUT', { status: 3 });
      await api(`${item.kind}/delete/${item.id}`, 'DELETE', { id: item.id });
    }
  }
});

test('RCA and prediction pages keep initial controls local and cache cancellation read-only', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const unsafe: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (
      path.startsWith('/api/v1/') &&
      (request.method() !== 'GET' ||
        /\/ready$|\/analy[sz]e|\/diagnos|\/predict\//.test(path))
    )
      unsafe.push(`${request.method()} ${path}`);
  });
  await acceptanceLogin(page);
  const routes = [
    ['/rca/analysis', '根因分析'],
    ['/rca/diagnosis', '快速诊断'],
    ['/rca/cache', 'RCA 缓存管理'],
    ['/predict/dashboard', '预测看板'],
    ['/predict/analysis', '预测分析'],
  ];
  for (const [path, title] of routes) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(routePath(path!));
    await expect(page.locator('.ops-page h1')).toHaveText(title!);
    if (path === '/rca/diagnosis')
      await expect(page.getByRole('switch')).not.toBeChecked();
    if (path === '/rca/cache') {
      await page
        .getByRole('button')
        .filter({ hasText: '清除所有缓存' })
        .click();
      const dialog = page.getByRole('dialog', {
        name: '确认清除所有缓存',
        exact: true,
      });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: /^取\s*消$/ }).click();
      await expect(dialog).not.toBeVisible();
    }
    if (path?.startsWith('/predict/')) {
      const input = page.locator('.ant-input-number input').first();
      await input.fill('120');
      await input.press('Tab');
      if (path === '/predict/dashboard')
        await page.getByRole('switch').first().click();
      await page
        .locator('.ops-page__actions')
        .getByRole('button', { name: /^重\s*置$/ })
        .click();
    }
    if (
      await page
        .locator('html')
        .evaluate((element) => element.classList.contains('dark'))
    )
      await page.getByLabel('浅色', { exact: true }).click();
    await page.getByLabel('深色', { exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      path,
    ).toBe(true);
  }
  expect(unsafe).toEqual([]);
  expect(errors).toEqual([]);
});
