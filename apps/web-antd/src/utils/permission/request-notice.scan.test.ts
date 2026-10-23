import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * FE-02b：页面 catch 统一用 shouldNotifyPageError 判断是否自己提示。
 * 旧写法 `!isPermissionDeniedError(x)` 只跳过 403 / 业务错误，HTTP 错误、网络错误会和请求层重复提示，
 * 取消类也会弹页面失败文案。这里静态扫描 views（不含 views/k8s/cluster/**、测试文件），不允许旧写法残留。
 *
 * 例外（逐条说明）：
 * - workorder/Notification.vue 删除通知配置、手动发送两处 catch：基线遗留（按 error.message 拼 403/409/500 文案），
 *   本次按要求不改，保留 2 处；
 * - k8s/node/Node.ts 批量调度的「全部失败且都已统一提示」判断（正向用法，不是 catch 守卫）。
 */
const VIEWS_DIR = resolve(__dirname, '../../views');
const OLD_GUARD = /!\s*isPermissionDeniedError\s*\(|if\s*\(\s*isPermissionDeniedError\s*\([^)]*\)\s*\)\s*return/g;
const ALLOWED: Record<string, number> = {
  'workorder/Notification.vue': 2,
};

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (relative(VIEWS_DIR, full) === join('k8s', 'cluster')) continue;
      files.push(...walk(full));
    } else if (/\.(ts|vue)$/.test(name) && !/\.test\.ts$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

describe('FE-02b：views 页面 catch 不再使用旧守卫', () => {
  it('旧守卫 !isPermissionDeniedError(...) 只剩 Notification.vue 基线遗留 2 处', () => {
    const offenders: Record<string, number> = {};
    for (const file of walk(VIEWS_DIR)) {
      const count = readFileSync(file, 'utf8').match(OLD_GUARD)?.length ?? 0;
      if (count) offenders[relative(VIEWS_DIR, file)] = count;
    }
    expect(offenders).toEqual(ALLOWED);
  });

  it('Notification.vue 保留的 2 处正是基线遗留的删除 / 手动发送 catch', () => {
    const text = readFileSync(join(VIEWS_DIR, 'workorder/Notification.vue'), 'utf8');
    for (const prefix of ['删除失败: ${error.message}', '发送失败: ${error.message}']) {
      const start = text.indexOf(prefix);
      expect(start).toBeGreaterThan(-1);
      const block = text.slice(start, start + 400);
      expect(block).toMatch(/!isPermissionDeniedError\(error\)\) message\.error\(errorMessage\)/);
    }
  });
});
