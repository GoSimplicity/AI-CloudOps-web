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

/**
 * FE-02b 拍板 3：取消类不写页面错误状态（与 cron 列表一致）。
 * 范围：本分支已改过的页面（即引入了 request-notice 的 views 文件，不含 k8s/cluster、测试）。
 * 规则：catch 里给错误状态（名字含 Error / error 的 ref / 字段）赋非空值的语句，必须由 shouldRecordPageError 守卫。
 * 例外（逐条说明，不是请求错误，不会是取消）：
 * - 本地 JSON / YAML 解析校验的 catch：FormManagement.vue、Instance.vue 的 JSON 校验，MonitorScrapeJob.vue 的 YAML 校验；
 * - cron/management/Management.ts 列表：state.error = handleListFailure(...)，取消时返回 null（同一口径，已由用例覆盖）。
 */
const NOTICE_IMPORT = "from '#/utils/permission/request-notice'";
const LOCAL_MESSAGE_VARS = new Set(['errMsg', 'errorMessage', 'errorMsg', 'msg']);
const ERROR_STATE_WRITE =
  /^\s*(?:if\s*\(.*\)\s*)?((?:state\.|\w+\.)?\w*(?:[Ee]rror|Err)\w*(?:\.value)?)\s*=(?!=)\s*(.+)$/;
const EMPTY_VALUE = /^(?:''|""|null|undefined|false|\[\])\s*;?\s*$/;
const NOT_REQUEST_CATCH: Record<string, number> = {
  'prometheus/MonitorScrapeJob.vue|yamlError.value': 1,
  'workorder/FormManagement.vue|jsonValidationError.value': 2,
  'workorder/Instance.vue|formDataValidationError.value': 2,
  'cron/management/Management.ts|state.error': 1,
};

/** 从 open（指向 '{'）开始找配对的 '}'，跳过字符串、模板字符串与注释 */
function matchBrace(text: string, open: number): number {
  let depth = 0;
  let quote = '';
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      i = text.indexOf('\n', i);
      if (i < 0) return -1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i) + 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

function catchErrorStateWrites() {
  const writes: { file: string; guarded: boolean; lhs: string; line: number }[] = [];
  for (const file of walk(VIEWS_DIR)) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes(NOTICE_IMPORT)) continue;
    const rel = relative(VIEWS_DIR, file);
    for (const m of text.matchAll(/\bcatch\s*(?:\((\w+)[^)]*\))?\s*\{/g)) {
      const open = m.index! + m[0].length - 1;
      const close = matchBrace(text, open);
      expect(close, `${rel}: catch 块配对失败`).toBeGreaterThan(open);
      const startLine = text.slice(0, open).split('\n').length;
      text
        .slice(open + 1, close)
        .split('\n')
        .forEach((source, index) => {
          const hit = ERROR_STATE_WRITE.exec(source);
          if (!hit) return;
          const [, lhs, value] = hit as unknown as [string, string, string];
          if (lhs === m[1] || LOCAL_MESSAGE_VARS.has(lhs) || EMPTY_VALUE.test(value)) return;
          writes.push({
            file: rel,
            guarded: source.includes('shouldRecordPageError('),
            lhs,
            line: startLine + index,
          });
        });
    }
  }
  return writes;
}

describe('FE-02b 拍板 3：取消类不写页面错误状态', () => {
  it('已改页面里 catch 写错误状态都经过 shouldRecordPageError（例外逐条列出）', () => {
    const writes = catchErrorStateWrites();
    const unguarded: Record<string, number> = {};
    for (const write of writes.filter((w) => !w.guarded)) {
      const key = `${write.file}|${write.lhs}`;
      unguarded[key] = (unguarded[key] ?? 0) + 1;
    }
    expect(unguarded).toEqual(NOT_REQUEST_CATCH);
    // 防止扫描器失效变成空跑：已守卫的写入数量与本次改动一致
    expect(writes.filter((w) => w.guarded)).toHaveLength(71);
  });
});
