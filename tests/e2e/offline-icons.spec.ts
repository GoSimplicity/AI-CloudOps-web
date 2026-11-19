import { expect, type Page, type Request, test } from '@playwright/test';

const iconifyHosts = new Set([
  'api.iconify.design',
  'api.simplesvg.com',
  'api.unisvg.com',
]);

function json(data: unknown) {
  return JSON.stringify({ code: 0, data, message: 'ok' });
}

function mockApi(method: string, pathname: string) {
  if (method === 'POST' && pathname === '/api/user/login') {
    return json({
      accessToken: 'local-preview-token',
      refreshToken: 'local-preview-refresh',
    });
  }
  if (method === 'GET' && pathname === '/api/user/profile') {
    return json({
      avatar: '',
      desc: '本地预览',
      homePath: '/system_welcome',
      id: 1,
      real_name: '本地管理员',
      token: 'local-preview-token',
      username: 'admin',
    });
  }
  if (method === 'GET' && pathname === '/api/user/codes') return json([]);
  if (method === 'GET' && pathname === '/api/monitor/configs/list') {
    return json({
      page: 1,
      size: 10,
      total: 1,
      items: [
        {
          config_content: 'scrape_configs: []',
          config_hash: 'local',
          config_type: 1,
          created_at: '2026-11-19T00:00:00Z',
          id: 1,
          instance_ip: '127.0.0.1',
          last_generated_time: 1_763_500_000,
          name: '本地采集配置',
          pool_id: 1,
          status: 1,
          updated_at: '2026-11-19T00:00:00Z',
        },
      ],
    });
  }
  if (method === 'GET' && pathname === '/api/user/list') {
    return json({
      page: 1,
      size: 10,
      total: 1,
      items: [
        {
          account_type: 1,
          avatar: '',
          email: 'admin@example.invalid',
          enable: 1,
          id: 1,
          real_name: '本地管理员',
          username: 'admin',
        },
      ],
    });
  }
  return json({ page: 1, size: 10, total: 0, items: [] });
}

async function installMocks(page: Page, blocked: string[]) {
  page.on('request', (request: Request) => {
    const hostname = new URL(request.url()).hostname;
    if (iconifyHosts.has(hostname)) blocked.push(request.url());
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (iconifyHosts.has(url.hostname)) {
      await route.abort();
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      await route.fulfill({
        body: mockApi(request.method(), url.pathname),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }
    await route.continue();
  });
}

test('生产预览的菜单、按钮和表格操作图标不请求外部图标接口', async ({
  page,
}) => {
  const blocked: string[] = [];
  await installMocks(page, blocked);

  await page.goto('/#/auth/login');
  await expect(page.locator('svg').first()).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: '/opt/cursor/artifacts/csp-login.png',
  });

  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('local-preview');
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL(/system_welcome/);
  await expect(page.locator('aside svg, nav svg').first()).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: '/opt/cursor/artifacts/csp-welcome.png',
  });

  await page.goto('/#/system_user');
  await expect(page.locator('.loading:not(.hidden)')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '刷新' }).locator('svg'),
  ).toBeVisible();
  await expect(page.getByText('本地管理员').first()).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: '/opt/cursor/artifacts/csp-system-user.png',
  });

  await page.goto('/#/monitor_config');
  await expect(page.locator('.loading:not(.hidden)')).toHaveCount(0);
  await expect(page.locator('.stats-card svg').first()).toBeVisible();
  await expect(page.getByText('本地采集配置')).toBeVisible();
  await expect(page.locator('.action-buttons').first()).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: '/opt/cursor/artifacts/csp-monitor-config.png',
  });

  expect(blocked).toEqual([]);
});
