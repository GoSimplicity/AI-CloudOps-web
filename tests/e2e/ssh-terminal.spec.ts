import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

function administratorPassword() {
  if (process.env.CLOUDOPS_TEST_PASSWORD) return process.env.CLOUDOPS_TEST_PASSWORD;
  const path = process.env.CLOUDOPS_TEST_ENV_FILE;
  if (!path) return undefined;
  return readFileSync(path, 'utf8').match(/^BOOTSTRAP_ADMIN_PASSWORD=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
}
function route(path: string) { return process.env.CLOUDOPS_ROUTER_HISTORY === 'hash' ? `/#${path}` : path; }

test('isolated OpenSSH terminal executes, interrupts and resizes from the browser', async ({ page, baseURL }) => {
  const resourceId = process.env.CLOUDOPS_TEST_SSH_RESOURCE_ID;
  const password = administratorPassword();
  test.skip(!resourceId || !password, 'Requires an owned local OpenSSH fixture and isolated administrator credentials');
  expect(['127.0.0.1', 'localhost']).toContain(new URL(baseURL!).hostname);
  expect(resourceId).toMatch(/^[1-9]\d*$/);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(route('/auth/login'));
  await page.getByLabel('账号', { exact: true }).fill('admin');
  await page.getByLabel('密码', { exact: true }).fill(password!);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).not.toHaveURL(/auth\/login/);
  let terminalConnections = 0;
  page.on('websocket', socket => { if (new URL(socket.url()).pathname.includes('/tree/local/terminal/')) terminalConnections++; });
  const opened = page.waitForEvent('websocket', { predicate: ws => new URL(ws.url()).pathname === `/api/tree/local/terminal/${resourceId}` });
  await page.goto(route(`/web-terminal/${resourceId}`));
  const ws = await opened;
  const url = new URL(ws.url());
  expect(url.searchParams.has('token')).toBe(false);
  expect(url.searchParams.get('terminal_mode')).toBe('pty-v1');
  const frames: string[] = [];
  let controlC = false;
  ws.on('framesent', frame => {
    if (typeof frame.payload === 'string') frames.push(frame.payload);
    else if (frame.payload.includes(3)) controlC = true;
  });
  await expect(page.getByText('连接已建立', { exact: true })).toBeVisible({ timeout: 20_000 });
  const terminal = page.locator('.ssh-terminal__viewport');
  await terminal.click();
  await page.keyboard.type('echo SSH_UI_RESULT_$((17*29))');
  await page.keyboard.press('Enter');
  await expect(terminal).toContainText('SSH_UI_RESULT_493', { timeout: 5000 });
  await page.keyboard.type('sleep 15');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);
  await page.keyboard.press('Control+C');
  await page.keyboard.type('echo SSH_UI_CANCEL_$((11*31))');
  await page.keyboard.press('Enter');
  await expect(terminal).toContainText('SSH_UI_CANCEL_341', { timeout: 5000 });
  expect(controlC).toBe(true);
  await page.getByLabel('浅色', { exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(terminal).toContainText('SSH_UI_RESULT_493');
  expect(terminalConnections).toBe(1);
  await page.screenshot({ path: '.cache/ui-verification/ssh-desktop-light.png', fullPage: true, animations: 'disabled' });
  const initialCols = Number(url.searchParams.get('cols'));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => frames.some(frame => {
    const control = JSON.parse(frame);
    return control.op === 'resize' && control.col_size > 0 && control.col_size < initialCols;
  })).toBe(true);
  await page.getByLabel('深色', { exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(terminal).toContainText('SSH_UI_CANCEL_341');
  expect(terminalConnections).toBe(1);
  await page.screenshot({ path: '.cache/ui-verification/ssh-mobile-dark.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: '关闭连接', exact: true }).click();
  await expect(page.getByText('连接已关闭', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
