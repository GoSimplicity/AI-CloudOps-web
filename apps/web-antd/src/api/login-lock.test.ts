import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { i18n } from '@vben/locales';

import { AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  formatLoginLockCountdown,
  isLoginJsonBody,
  parseRetryAfterSeconds,
  readBackendMessage,
  readLoginLockState,
  rememberLoginRetryAfter,
  resolveLoginHttpErrorMessage,
} from './login-lock';

function useLocale(lang: 'en-US' | 'zh-CN') {
  const shared = JSON.parse(
    readFileSync(
      resolve(process.cwd(), `packages/locales/src/langs/${lang}.json`),
      'utf8',
    ),
  );
  const app = JSON.parse(
    readFileSync(
      resolve(process.cwd(), `apps/web-antd/src/locales/langs/${lang}.json`),
      'utf8',
    ),
  );
  i18n.global.setLocaleMessage(lang, shared);
  i18n.global.mergeLocaleMessage(lang, app);
  i18n.global.locale.value = lang;
  i18n.global.fallbackLocale.value = lang;
}

/** 读取 data 即失败，用来锁住「不看信封 data 字段」 */
function envelope(
  message: string,
  data: 'throw' | null | Record<string, never>,
) {
  const body: Record<string, unknown> = { code: 1, message };
  if (data === 'throw') {
    Object.defineProperty(body, 'data', {
      configurable: true,
      enumerable: true,
      get() {
        throw new Error('login handling read data');
      },
    });
  } else {
    body.data = data;
  }
  return body;
}

function loginError(options: {
  body?: unknown;
  headers?: unknown;
  status?: number;
  url?: string;
}) {
  return {
    config: { url: options.url ?? '/user/login' },
    response: {
      data: options.body,
      headers: options.headers ?? {},
      status: options.status ?? 429,
    },
  };
}

describe('登录锁定文案与 Retry-After', () => {
  beforeEach(() => {
    useLocale('zh-CN');
  });

  it('秒数换成分钟和秒，不足一分钟只显示秒', () => {
    expect(formatLoginLockCountdown(90)).toBe('请 1 分 30 秒后再试');
    expect(formatLoginLockCountdown(61)).toBe('请 1 分 1 秒后再试');
    expect(formatLoginLockCountdown(60)).toBe('请 1 分 0 秒后再试');
    expect(formatLoginLockCountdown(45)).toBe('请 45 秒后再试');
    expect(formatLoginLockCountdown(1)).toBe('请 1 秒后再试');
    expect(formatLoginLockCountdown(1)).not.toMatch(/分钟/);
  });

  it('英文按秒换算，不足一分钟不出现 minute', () => {
    useLocale('en-US');
    expect(formatLoginLockCountdown(90)).toBe('Try again in 1 min 30 sec');
    expect(formatLoginLockCountdown(1)).toBe('Try again in 1 sec');
    expect(formatLoginLockCountdown(1)).not.toMatch(/min/);
  });

  it.each([
    ['90', 90],
    [' 1 ', 1],
    [1, 1],
    ['0', 0],
  ])('retry-After %j 是整数秒', (value, seconds) => {
    expect(parseRetryAfterSeconds(value)).toBe(seconds);
  });

  it.each([
    undefined,
    '',
    '   ',
    'abc',
    '-1',
    '1.5',
    '90s',
    'Wed, 21 Oct 2015 07:28:00 GMT',
  ])('retry-After %j 不能当秒数', (value) => {
    expect(parseRetryAfterSeconds(value)).not.toEqual(expect.any(Number));
  });

  it.each([null, {}] as const)(
    '账号锁定不读 data=%j，倒计时用秒而不是 message 里的分钟',
    (data) => {
      const error = loginError({
        body: envelope('登录失败次数过多，请 2 分钟后再试', data),
        headers: { 'retry-after': '90' },
      });
      rememberLoginRetryAfter(error);
      expect(resolveLoginHttpErrorMessage(error)).toBe(
        '登录失败次数过多，请 2 分钟后再试',
      );
      expect(readLoginLockState(error)).toEqual({ hint: '', seconds: 90 });
      expect(formatLoginLockCountdown(90)).not.toBe('请 2 分钟后再试');
    },
  );

  it('不足一分钟时不展示向上取整的分钟，只显示秒', () => {
    const error = loginError({
      body: envelope('登录失败次数过多，请 1 分钟后再试', {}),
      headers: new AxiosHeaders({ 'Retry-After': '1' }),
    });
    expect(resolveLoginHttpErrorMessage(error)).toBe('请 1 秒后再试');
    expect(resolveLoginHttpErrorMessage(error)).not.toMatch(/分钟/);
    expect(readLoginLockState(error).seconds).toBe(1);
  });

  it.each([{}, null] as const)(
    'nginx JSON 429（Retry-After 1，data=%j）只禁用 1 秒，不显示分钟',
    (data) => {
      const error = loginError({
        body: { code: 1, data, message: '请求过于频繁，请稍后再试' },
        headers: { 'Retry-After': '1' },
      });
      expect(readBackendMessage(error.response.data)).toBe(
        '请求过于频繁，请稍后再试',
      );
      expect(resolveLoginHttpErrorMessage(error)).toBe(
        '请求过于频繁，请稍后再试',
      );
      expect(readLoginLockState(error).seconds).toBe(1);
      expect(formatLoginLockCountdown(1)).toBe('请 1 秒后再试');
    },
  );

  it('429 没有 Retry-After 时用频率限制文案，并默认倒计时 1 秒', () => {
    const error = loginError({
      body: envelope('登录失败次数过多，请 3 分钟后再试', null),
      headers: {},
    });
    expect(resolveLoginHttpErrorMessage(error)).toBe(
      '请求过于频繁，请稍后再试',
    );
    expect(readLoginLockState(error).seconds).toBe(1);
  });

  it('429 正文是 HTML 时不解析正文，默认倒计时 1 秒', () => {
    const html = '<html><body>429 Too Many Requests</body></html>';
    const error = loginError({ body: html });
    expect(() => resolveLoginHttpErrorMessage(error)).not.toThrow();
    expect(resolveLoginHttpErrorMessage(error)).toBe(
      '请求过于频繁，请稍后再试',
    );
    expect(resolveLoginHttpErrorMessage(error)).not.toContain('<html');
    expect(isLoginJsonBody(html)).toBe(false);
    expect(readLoginLockState(error).seconds).toBe(1);
  });

  it.each([{}, null] as const)(
    'redis 不可用的 JSON 503（data=%j）只提示服务暂不可用，不倒计时',
    (data) => {
      const error = loginError({
        body: { code: 1, data, message: '登录服务暂不可用，请稍后重试' },
        status: 503,
      });
      expect(resolveLoginHttpErrorMessage(error)).toBe(
        '登录服务暂不可用，请稍后重试',
      );
      expect(readLoginLockState(error).seconds).toBe(0);
    },
  );

  it('503 的 HTML 按频率限制兜底，不把正文当错误抛出', () => {
    const error = loginError({
      body: '<html><body>503 Service Unavailable</body></html>',
      status: 503,
    });
    expect(() => readLoginLockState(error)).not.toThrow();
    expect(resolveLoginHttpErrorMessage(error)).toBe(
      '请求过于频繁，请稍后再试',
    );
    expect(readLoginLockState(error).seconds).toBe(1);
  });

  it('其它接口的 429 不进入登录倒计时', () => {
    const error = loginError({
      body: { code: 1, data: {}, message: '请求过于频繁，请稍后再试' },
      headers: { 'Retry-After': '90' },
      url: '/k8s/nodes',
    });
    expect(resolveLoginHttpErrorMessage(error)).toBeUndefined();
    expect(readLoginLockState(error)).toEqual({ hint: '', seconds: 0 });
  });

  it('普通密码错误不是锁定', () => {
    const error = {
      message: 'Error 200: 用户名或密码错误',
      response: {
        data: { code: 1, data: null, message: '用户名或密码错误' },
        status: 200,
      },
    };
    expect(readLoginLockState(error).seconds).toBe(0);
    expect(resolveLoginHttpErrorMessage(error)).toBeUndefined();
  });

  it('登录页不按「用户不存在」或「密码错误」分支', () => {
    const root = process.cwd();
    for (const path of [
      'apps/web-antd/src/views/_core/authentication/login.vue',
      'apps/web-antd/src/store/auth.ts',
      'apps/web-antd/src/api/core/system/auth.ts',
      'apps/web-antd/src/api/login-lock.ts',
      'packages/effects/common-ui/src/ui/authentication/login.vue',
    ]) {
      const source = readFileSync(`${root}/${path}`, 'utf8');
      expect(source, path).not.toContain('用户不存在');
      expect(source, path).not.toContain('密码错误');
    }
  });
});
