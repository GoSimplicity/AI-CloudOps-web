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
    await expect(page.locator('body')).not.toBeEmpty();
    await expect
      .poll(() => {
        const url = new URL(page.url());
        return url.hash.startsWith('#/')
          ? url.hash.slice(1).split('?')[0]
          : url.pathname;
      })
      .toBe(
        route === '/monitor_onduty_group_table'
          ? '/monitor_onduty_group'
          : route,
      );
    await expect(page).not.toHaveURL(/auth\/login/);
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
        ? page.locator('.ant-table-tbody tr[data-row-key="web"]')
        : page.locator('.ant-table-tbody tr[data-row-key^="web-"]');
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
  const pod = page.locator('.ant-table-tbody tr[data-row-key^="web-"]').first();
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

test('assistant rejects unowned legacy cache and uses the profile UID', async ({ page }) => {
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(routePath('/auth/login'));
  await page.evaluate(() => {
    localStorage.setItem('aiAssistantChatState', JSON.stringify({ sessionId: 'legacy-private-session', chatMessages: [{ content: 'LEGACY_PRIVATE_CACHE_SENTINEL', type: 'user' }] }));
    localStorage.setItem('aiAssistantSessions', JSON.stringify({ sessions: [{ localId: 'legacy', name: 'LEGACY_PRIVATE_CACHE_SENTINEL' }] }));
    localStorage.setItem('assistant-session-history', JSON.stringify([{ session_id: 'LEGACY_PRIVATE_CACHE_SENTINEL' }]));
  });
  const profileResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/user/profile');
  await acceptanceLogin(page);
  const profile = (await (await profileResponse).json()).data;
  expect(Number.isSafeInteger(profile.id) && profile.id > 0).toBe(true);
  await page.locator('.assistant-float-button').click();
  await expect(page.locator('.ai-float-window')).not.toContainText('LEGACY_PRIVATE_CACHE_SENTINEL');
  expect(await page.evaluate(() => ['aiAssistantChatState', 'aiAssistantSessions', 'assistant-session-history'].every(key => localStorage.getItem(key) === null))).toBe(true);
  await page.locator('.ai-float-window button[title="关闭"]').click();
  await page.goto(routePath('/assistant/session'));
  await expect(page.locator('.session-container')).not.toContainText('LEGACY_PRIVATE_CACHE_SENTINEL');
  expect(await page.evaluate(owner => {
    const chat = JSON.parse(localStorage.getItem(`cloudops-assistant:v1:${owner}:chat`) || '{}');
    return chat.owner === owner;
  }, String(profile.id))).toBe(true);
  await page.getByRole('button', { name: '账户菜单', exact: true }).click();
  await page.getByRole('menuitem', { name: /^退出登录/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page).toHaveURL(/auth\/login/);
  await expect(page.locator('.ai-float-window')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('assistant clears an invalid owned session and permits a fresh question', async ({ page }) => {
  page.setDefaultTimeout(15_000);
  test.skip(process.env.CLOUDOPS_TEST_ASSISTANT_OWNER_READY !== 'true', 'Requires isolated assistant owner validation.');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const profileResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/user/profile');
  await acceptanceLogin(page);
  const profile = (await (await profileResponse).json()).data;
  const invalidSid = 'cloudops-ui-unknown-owner-session';
  await page.evaluate(({ owner, invalidSid }) => {
    const write = (name: string, value: unknown) => localStorage.setItem(`cloudops-assistant:v1:${encodeURIComponent(owner)}:${name}`, JSON.stringify({ owner, value }));
    write('chat', { sessionId: invalidSid, chatHistory: [], chatMessages: [{ content: 'INVALID_OWNED_CACHE_SENTINEL', type: 'user' }] });
    write('sessions', { sessions: [{ localId: 'local-validation', name: 'Validation' }], currentLocalSessionId: 'local-validation' });
  }, { owner: String(profile.id), invalidSid });
  await page.reload();
  await page.locator('.assistant-float-button').click();
  await expect(page.locator('.ai-float-window')).toContainText('INVALID_OWNED_CACHE_SENTINEL');
  const invalidResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/assistant/query'), { timeout: 15_000 });
  await page.locator('.ai-float-window textarea').fill('检查失效会话');
  await page.locator('.ai-float-window .send-button').click();
  expect((await invalidResponse).status()).toBe(404);
  await expect(page.locator('.ai-float-window')).toContainText('会话已失效');
  await expect(page.locator('.ai-float-window')).not.toContainText('INVALID_OWNED_CACHE_SENTINEL');
  await expect(page.locator('.ai-float-window textarea')).toBeEnabled();
  expect(await page.evaluate(owner => {
    const chat = JSON.parse(localStorage.getItem(`cloudops-assistant:v1:${owner}:chat`) || '{}');
    return chat.owner === owner && chat.value?.sessionId === '' && chat.value?.chatHistory?.length === 0;
  }, String(profile.id))).toBe(true);
  await page.locator('.ai-float-window button[title="关闭"]').click();
  await page.getByRole('button', { name: '账户菜单', exact: true }).click();
  const menu = page.locator('[role="menu"][data-state="open"]');
  await menu.getByRole('menuitem', { name: /^退出登录/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page).toHaveURL(/auth\/login/);
  await expect(page.locator('.ai-float-window')).toHaveCount(0);
  expect(errors).toEqual([]);
});
