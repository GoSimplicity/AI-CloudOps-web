import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * FE-02b 静态扫描（incr3 P3-7 加固）
 *
 * 扫描范围：views 下的 .ts / .vue（不含 views/k8s/cluster/**、测试文件）；.vue 只扫 <script> 部分。
 * 扫描前先去掉注释（保留行号），注释里的守卫 / 旧写法不算数。
 *
 * 规则 1：页面 catch 统一用 shouldNotifyPageError 判断是否自己提示，不允许旧写法 `!isPermissionDeniedError(x)`
 *   （incr3 起 Notification.vue 两处基线遗留也已收口，白名单清空）。
 * 规则 2（FE-02b 拍板 3）：引入了 request-notice 的页面里，catch 块与 `.catch(...)` 回调中给错误状态
 *   （名字含 Error / error / Err 的 ref / 字段）赋非空值的语句，必须是
 *   `if (shouldRecordPageError(<catch 变量>)) <错误状态> = ...` 结构（条件可用 && 叠加其他判断，不允许 ||）。
 *   - 已守卫写入按文件计数快照（GUARDED_SNAPSHOT），逐文件精确相等，防止「总数不变、分布挪动」；
 *   - 未守卫写入只允许白名单（NOT_REQUEST_CATCH，逐条说明），计数精确相等。
 */
const VIEWS_DIR = resolve(__dirname, '../../views');
const NOTICE_IMPORT = "from '#/utils/permission/request-notice'";

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

/** .vue 只保留 <script> 内容，其余替换为空行（保留行号）；.ts 原样 */
export function scriptOf(file: string, text: string): string {
  if (!file.endsWith('.vue')) return text;
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  let out = '';
  let last = 0;
  for (const m of text.matchAll(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g)) {
    out += blank(text.slice(last, m.index! + m[1]!.length));
    out += m[2];
    last = m.index! + m[1]!.length + m[2]!.length;
  }
  return out + blank(text.slice(last));
}

/** 去掉 // 与 /* *\/ 注释（替换为空格，保留换行与列号），跳过字符串与模板字符串 */
export function stripComments(text: string): string {
  const chars = [...text];
  let quote = '';
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && chars[i + 1] === '/') {
      while (i < chars.length && chars[i] !== '\n') chars[i++] = ' ';
      continue;
    }
    if (c === '/' && chars[i + 1] === '*') {
      while (i < chars.length && !(chars[i] === '*' && chars[i + 1] === '/')) {
        if (chars[i] !== '\n') chars[i] = ' ';
        i++;
      }
      if (i < chars.length) chars[i] = chars[i + 1] = ' ';
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
  }
  return chars.join('');
}

/** 从 open（指向开括号）找配对的闭括号，跳过字符串（注释已去掉） */
function matchClose(text: string, open: number, pair: '()' | '{}'): number {
  const [l, r] = pair;
  let depth = 0;
  let quote = '';
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === l) depth++;
    else if (c === r && --depth === 0) return i;
  }
  return -1;
}

interface CatchBody {
  /** catch 变量；`catch {` / 无参回调为 '' */
  param: string;
  /** 正文在全文中的起始偏移 */
  start: number;
  end: number;
  kind: '.catch' | 'catch';
}

/** 找出 try/catch 的 catch 块与 promise `.catch(...)` 回调正文 */
export function findCatchBodies(text: string): CatchBody[] {
  const bodies: CatchBody[] = [];
  for (const m of text.matchAll(
    /(?<![.\w$])catch\s*(?:\(\s*(\w+)[^)]*\))?\s*\{/g,
  )) {
    const open = m.index! + m[0].length - 1;
    bodies.push({
      param: m[1] ?? '',
      start: open + 1,
      end: matchClose(text, open, '{}'),
      kind: 'catch',
    });
  }
  for (const m of text.matchAll(/\.catch\s*\(/g)) {
    const open = m.index! + m[0].length - 1;
    const close = matchClose(text, open, '()');
    const arg = text.slice(open + 1, close);
    const fn =
      /^\s*(?:async\s+)?(?:\(\s*(\w*)\s*(?::[^)]*)?\)|(\w+))\s*=>\s*/.exec(
        arg,
      ) ?? /^\s*(?:async\s+)?function\s*\w*\s*\(\s*(\w*)[^)]*\)\s*/.exec(arg);
    if (!fn) continue; // `.catch(handler)` 这类引用：正文在别处（handler 自身的 catch 写法另行扫描）
    const param = fn[1] || fn[2] || '';
    let start = open + 1 + fn[0].length;
    let end = close;
    if (text[start] === '{') {
      end = matchClose(text, start, '{}');
      start += 1;
    }
    bodies.push({ param, start, end, kind: '.catch' });
  }
  return bodies;
}

const LOCAL_MESSAGE_VARS = new Set([
  'errMsg',
  'errorMessage',
  'errorMsg',
  'msg',
]);
const EMPTY_VALUE = /^(?:''|""|null|undefined|false|\[\])\s*[;)]*\s*$/;

/** 写入是否为 `if (… && shouldRecordPageError(param) && …) lhs = …` 结构（不允许 ||、不允许取反） */
export function isGuardedWrite(
  source: string,
  lhs: string,
  param: string,
): boolean {
  if (!param) return false;
  const head = /^\s*if\s*\(/.exec(source);
  if (!head) return false;
  const open = head[0].length - 1;
  const close = matchClose(source, open, '()');
  if (close < 0) return false;
  const cond = source.slice(open + 1, close);
  if (cond.includes('||') || cond.includes('?')) return false;
  const rest = source.slice(close + 1).trimStart();
  if (!rest.startsWith(lhs) || !/^\s*=(?!=)/.test(rest.slice(lhs.length)))
    return false;
  return cond
    .split('&&')
    .map((term) => term.trim())
    .includes(`shouldRecordPageError(${param})`);
}

export interface ErrorStateWrite {
  file: string;
  functionName: string;
  guarded: boolean;
  kind: CatchBody['kind'];
  lhs: string;
  line: number;
}

/** 扫描一个文件（相对路径 + 原文），返回 catch 中的错误状态写入 */
export function scanErrorStateWrites(
  file: string,
  raw: string,
): ErrorStateWrite[] {
  const text = stripComments(scriptOf(file, raw));
  const fileSource = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const functionNameAt = (position: number): string => {
    let name = '';
    const visit = (node: ts.Node) => {
      if (position < node.pos || position >= node.end) return;
      if (ts.isFunctionDeclaration(node)) name = node.name?.text ?? '';
      ts.forEachChild(node, visit);
    };
    visit(fileSource);
    return name;
  };
  const writes: ErrorStateWrite[] = [];
  for (const body of findCatchBodies(text)) {
    if (body.end < body.start)
      throw new Error(`${file}: catch 正文配对失败（偏移 ${body.start}）`);
    const source = ts.createSourceFile(
      file,
      text.slice(body.start, body.end),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const isGuard = (condition: ts.Expression): boolean => {
      if (ts.isParenthesizedExpression(condition))
        return isGuard(condition.expression);
      if (ts.isBinaryExpression(condition)) {
        return (
          condition.operatorToken.kind ===
            ts.SyntaxKind.AmpersandAmpersandToken &&
          (isGuard(condition.left) || isGuard(condition.right))
        );
      }
      if (!ts.isCallExpression(condition)) return false;
      const argument = condition.arguments[0];
      return (
        !!body.param &&
        ts.isIdentifier(condition.expression) &&
        condition.expression.text === 'shouldRecordPageError' &&
        condition.arguments.length === 1 &&
        argument !== undefined &&
        ts.isIdentifier(argument) &&
        argument.text === body.param
      );
    };
    const guardedByIf = (node: ts.Node): boolean => {
      for (
        let child = node, parent = node.parent;
        parent;
        child = parent, parent = parent.parent
      ) {
        if (ts.isFunctionLike(parent)) return false;
        if (ts.isIfStatement(parent) && parent.thenStatement === child) {
          // Any disjunction or ternary can bypass the guard, matching the original contract.
          const conditionText = parent.expression.getText(source);
          if (
            !conditionText.includes('||') &&
            !conditionText.includes('?') &&
            isGuard(parent.expression)
          )
            return true;
        }
      }
      return false;
    };
    const visit = (node: ts.Node) => {
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        const lhs = node.left.getText(source).replace(/\s+/g, '');
        const value = node.right.getText(source);
        if (
          /^(?:state\.|\w+\.)?\w*(?:[Ee]rror|Err)\w*(?:\.value)?$/.test(lhs) &&
          lhs !== body.param &&
          !LOCAL_MESSAGE_VARS.has(lhs) &&
          !EMPTY_VALUE.test(value)
        ) {
          writes.push({
            file,
            functionName: functionNameAt(body.start),
            guarded: guardedByIf(node),
            kind: body.kind,
            lhs,
            line: text.slice(0, body.start + node.getStart(source)).split('\n')
              .length,
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return writes;
}

export interface ScanSummary {
  guardedPerFile: Record<string, number>;
  unguarded: Record<string, number>;
  managedFailClosed: Record<string, number>;
}

export function summarize(
  writes: ErrorStateWrite[],
  managedExceptions: Record<string, number> = {},
): ScanSummary {
  const guardedPerFile: Record<string, number> = {};
  const unguarded: Record<string, number> = {};
  const managedFailClosed: Record<string, number> = {};
  for (const w of writes) {
    if (w.guarded) guardedPerFile[w.file] = (guardedPerFile[w.file] ?? 0) + 1;
    else {
      const scoped = `${w.file}|${w.functionName}|${w.lhs}`;
      if (Object.hasOwn(managedExceptions, scoped))
        managedFailClosed[scoped] = (managedFailClosed[scoped] ?? 0) + 1;
      else
        unguarded[`${w.file}|${w.lhs}`] =
          (unguarded[`${w.file}|${w.lhs}`] ?? 0) + 1;
    }
  }
  return { guardedPerFile, unguarded, managedFailClosed };
}

/** 对照快照与白名单，返回问题列表（空 = 通过）；计数都要求精确相等 */
export function checkSummary(
  summary: ScanSummary,
  snapshot: Record<string, number>,
  whitelist: Record<string, number>,
  managedExceptions: Record<string, number> = {},
): string[] {
  const problems: string[] = [];
  const keys = (a: object, b: object) =>
    [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const key of keys(summary.unguarded, whitelist)) {
    const got = summary.unguarded[key] ?? 0;
    const want = whitelist[key] ?? 0;
    if (got !== want)
      problems.push(`未守卫写入 ${key}：实际 ${got}，白名单 ${want}`);
  }
  for (const key of keys(summary.managedFailClosed, managedExceptions)) {
    const got = summary.managedFailClosed[key] ?? 0;
    const want = managedExceptions[key] ?? 0;
    if (got !== want)
      problems.push(`托管资源阻塞写入 ${key}：实际 ${got}，例外 ${want}`);
  }
  for (const key of keys(summary.guardedPerFile, snapshot)) {
    const got = summary.guardedPerFile[key] ?? 0;
    const want = snapshot[key] ?? 0;
    if (got !== want)
      problems.push(`已守卫写入 ${key}：实际 ${got}，快照 ${want}`);
  }
  return problems;
}

const OLD_GUARD =
  /!\s*isPermissionDeniedError\s*\(|if\s*\(\s*isPermissionDeniedError\s*\([^)]*\)\s*\)\s*return/g;

export function countOldGuards(file: string, raw: string): number {
  return stripComments(scriptOf(file, raw)).match(OLD_GUARD)?.length ?? 0;
}

/**
 * 白名单：catch 里未经 shouldRecordPageError 的错误状态写入（不是请求错误，不会是取消）
 * - 本地 JSON / YAML 解析校验的 catch：FormManagement.vue、Instance.vue 的 JSON 校验，MonitorScrapeJob.vue 的 YAML 校验；
 * - cron/management/Management.ts 列表：state.error = handleListFailure(...)，取消时返回 null（同一口径，已由用例覆盖）。
 */
const NOT_REQUEST_CATCH: Record<string, number> = {
  'cron/management/Management.ts|state.error': 1,
  'prometheus/MonitorScrapeJob.vue|yamlError.value': 1,
  'workorder/FormManagement.vue|jsonValidationError.value': 2,
  'workorder/Instance.vue|formDataValidationError.value': 2,
};

/**
 * 托管资源的失败关闭状态不等同于普通请求错误提示，必须持续阻塞不明确结果。
 * 仅允许以下六个既有函数的单次写入；同字段的新 catch 或移动到其他函数仍会失败。
 * refreshPermissions/loadAccounts/loadRecords：权限或分页/范围完整性无法确认，清空旧数据并拒绝继续。
 * loadHistory：历史不完整不能判定操作可重试；sync/submitReview：取消或断线仍是 unknown，不能解除阻塞。
 * 行为回归见 CloudManagedResources.test.ts 的未知历史、存储不可用、同步未确认与核对失败用例。
 */
const MANAGED_FAIL_CLOSED_EXCEPTIONS: Record<string, number> = {
  'servicetree/CloudManagedResources.vue|refreshPermissions|error.value': 1,
  'servicetree/CloudManagedResources.vue|loadAccounts|error.value': 1,
  'servicetree/CloudManagedResources.vue|loadRecords|error.value': 1,
  'servicetree/CloudManagedResources.vue|loadHistory|historyError.value': 1,
  'servicetree/CloudManagedResources.vue|sync|error.value': 1,
  'servicetree/CloudManagedResources.vue|submitReview|reviewError.value': 1,
};

/** 已守卫写入的逐文件快照（incr3 P3-7：取代原先的总数 71；新增 / 删除守卫需同步改这里并在评审说明） */
const GUARDED_SNAPSHOT: Record<string, number> = {
  'assistant/AssistantInfo.vue': 2,
  'assistant/AssistantKnowledge.vue': 1,
  'k8s/clusterrolebinding/ClusterRoleBinding.ts': 2,
  'k8s/configmap/ConfigMap.ts': 3,
  'k8s/daemonset/DaemonSet.ts': 3,
  'k8s/deployment/Deployment.ts': 3,
  'k8s/ingress/Ingress.ts': 3,
  'k8s/namespace/Namespace.ts': 2,
  'k8s/node/Node.ts': 2,
  'k8s/pod/Pod.ts': 3,
  'k8s/pv/PV.ts': 2,
  'k8s/pvc/PVC.ts': 3,
  'k8s/role/Role.ts': 3,
  'k8s/rolebinding/RoleBinding.ts': 3,
  'k8s/secret/Secret.ts': 3,
  'k8s/service/Service.ts': 3,
  'k8s/statefulset/StatefulSet.ts': 3,
  'k8s/task/Task.ts': 3,
  'k8s/template/Template.ts': 2,
  'servicetree/CloudAccountManagement.vue': 1,
  'servicetree/CloudManagedResources.vue': 2,
  'servicetree/CloudResourceManager.vue': 3,
  'servicetree/LocalResourceManagement.vue': 1,
  'servicetree/TreeNodeManager.vue': 1,
  'workorder/FormDesign.vue': 2,
  'workorder/FormManagement.vue': 1,
  'workorder/Instance.vue': 5,
  'workorder/Notification.vue': 3,
  'workorder/Process.vue': 1,
  'workorder/ProcessDesign.vue': 4,
  'workorder/Template.vue': 1,
};

function realFiles(): [string, string][] {
  return walk(VIEWS_DIR).map((full) => [
    relative(VIEWS_DIR, full),
    readFileSync(full, 'utf8'),
  ]);
}

describe('FE-02b：views 页面 catch 不再使用旧守卫', () => {
  it('旧守卫 !isPermissionDeniedError(...) 零残留（incr3：Notification.vue 基线两处已收口，白名单清空）', () => {
    const offenders: Record<string, number> = {};
    for (const [rel, text] of realFiles()) {
      const count = countOldGuards(rel, text);
      if (count) offenders[rel] = count;
    }
    expect(offenders).toEqual({});
  });

  it('Notification.vue 删除 / 手动发送两处 catch 已改为 shouldNotifyPageError', () => {
    const file = 'workorder/Notification.vue';
    const text = stripComments(
      scriptOf(file, readFileSync(join(VIEWS_DIR, file), 'utf8')),
    );
    for (const prefix of [
      '删除失败: ${error.message}',
      '发送失败: ${error.message}',
    ]) {
      const start = text.indexOf(prefix);
      expect(start).toBeGreaterThan(-1);
      const block = text.slice(start, start + 400);
      expect(block).toMatch(
        /if \(shouldNotifyPageError\(error\)\) message\.error\(errorMessage\)/,
      );
      expect(block).not.toMatch(/isPermissionDeniedError/);
    }
  });
});

describe('FE-02b 拍板 3：取消类不写页面错误状态（静态扫描）', () => {
  it('已改页面里 catch / .catch 写错误状态都经过 if (shouldRecordPageError(x))：逐文件快照 + 白名单精确相等', () => {
    const writes = realFiles()
      .filter(([, text]) => text.includes(NOTICE_IMPORT))
      .flatMap(([rel, text]) => scanErrorStateWrites(rel, text));
    const summary = summarize(writes, MANAGED_FAIL_CLOSED_EXCEPTIONS);
    expect(
      checkSummary(
        summary,
        GUARDED_SNAPSHOT,
        NOT_REQUEST_CATCH,
        MANAGED_FAIL_CLOSED_EXCEPTIONS,
      ),
    ).toEqual([]);
    // 快照本身不为空（防止扫描器失效变成空跑）
    expect(Object.values(GUARDED_SNAPSHOT).reduce((a, b) => a + b, 0)).toBe(74);
  });
});

/**
 * 变异夹具：扫描器必须抓住的写法（标签沿用复审单 B1/B2/S1/S2/S4/S5/T3，含义按本文件解释，见 pr-notes）
 */
const BASE = `import { shouldRecordPageError } from '#/utils/permission/request-notice';
async function load() {
  try {
    await api();
  } catch (err) {
    if (shouldRecordPageError(err)) loadError.value = '加载失败';
  }
}
`;
const BASE_SNAPSHOT = { 'demo/Demo.ts': 1 };
const problemsOf = (
  files: Record<string, string>,
  snapshot: Record<string, number> = BASE_SNAPSHOT,
  whitelist: Record<string, number> = {},
) =>
  checkSummary(
    summarize(
      Object.entries(files).flatMap(([rel, text]) =>
        scanErrorStateWrites(rel, text),
      ),
    ),
    snapshot,
    whitelist,
  );
const mutate = (from: string, to: string) => {
  expect(BASE).toContain(from);
  return { 'demo/Demo.ts': BASE.replace(from, to) };
};

describe('incr3 P3-7：扫描器变异夹具', () => {
  it('托管资源例外只接受精确函数单次写入，同字段的新 catch 仍拒绝', () => {
    const file = 'servicetree/CloudManagedResources.vue';
    const key = `${file}|loadRecords|error.value`;
    const exceptions = { [key]: 1 };
    const good = `<script setup>async function loadRecords() { try { await api(); } catch { error.value = '不可确认'; } }</script>`;
    const check = (raw: string) =>
      checkSummary(
        summarize(scanErrorStateWrites(file, raw), exceptions),
        {},
        {},
        exceptions,
      );
    expect(check(good)).toEqual([]);
    expect(check(good.replace('loadRecords', 'anotherFunction'))).not.toEqual(
      [],
    );
    expect(
      check(
        good.replace(
          '</script>',
          "async function anotherFunction() { try { await api(); } catch { error.value = '新增'; } }</script>",
        ),
      ),
    ).not.toEqual([]);
    expect(
      check(
        good.replace(
          "error.value = '不可确认';",
          "error.value = '不可确认'; try { await api(); } catch { error.value = '新增'; }",
        ),
      ),
    ).not.toEqual([]);
  });

  it('基线夹具通过（对照组）', () => {
    expect(problemsOf({ 'demo/Demo.ts': BASE })).toEqual([]);
    expect(
      problemsOf({
        'demo/Demo.ts': BASE.replace(
          'if (shouldRecordPageError(err)) loadError.value',
          'if (ticket === current && shouldRecordPageError(err)) loadError.value',
        ),
      }),
    ).toEqual([]);
  });

  it('跨行条件与赋值保持守卫识别，跨行绕过仍拒绝', () => {
    const multiline = BASE.replace(
      "if (shouldRecordPageError(err)) loadError.value = '加载失败';",
      "if (\n shouldRecordPageError(err)\n)\n loadError.value =\n '加载失败';",
    );
    expect(problemsOf({ 'demo/Demo.ts': multiline })).toEqual([]);
    expect(
      problemsOf({
        'demo/Demo.ts': multiline.replace(
          'shouldRecordPageError(err)',
          'shouldRecordPageError(err) || force',
        ),
      }),
    ).not.toEqual([]);
  });

  it('else 分支和延后执行的回调不能借用外层守卫', () => {
    for (const statement of [
      "if (shouldRecordPageError(err)) {} else { loadError.value = '加载失败'; }",
      "if (shouldRecordPageError(err)) { defer(() => { loadError.value = '加载失败'; }); }",
    ]) {
      expect(
        problemsOf({
          'demo/Demo.ts': BASE.replace(
            "if (shouldRecordPageError(err)) loadError.value = '加载失败';",
            statement,
          ),
        }),
      ).not.toEqual([]);
    }
  });

  it.each([
    [
      'B1 守卫只写在注释里（行尾注释）',
      mutate(
        "if (shouldRecordPageError(err)) loadError.value = '加载失败';",
        "loadError.value = '加载失败'; // if (shouldRecordPageError(err))",
      ),
    ],
    [
      'B1 守卫只写在注释里（块注释包住 if）',
      mutate(
        'if (shouldRecordPageError(err)) loadError.value',
        '/* if (shouldRecordPageError(err)) */ loadError.value',
      ),
    ],
    [
      'B2 守卫用 || 组合',
      mutate(
        'shouldRecordPageError(err))',
        'shouldRecordPageError(err) || force)',
      ),
    ],
    [
      'B2 守卫取反',
      mutate(
        'if (shouldRecordPageError(err))',
        'if (!shouldRecordPageError(err))',
      ),
    ],
    [
      'S1 守卫的不是 catch 变量',
      mutate(
        'if (shouldRecordPageError(err))',
        'if (shouldRecordPageError(error))',
      ),
    ],
    [
      'S1 catch 不带变量',
      mutate(
        'catch (err) {\n    if (shouldRecordPageError(err))',
        'catch {\n    if (shouldRecordPageError(err))',
      ),
    ],
    [
      'S2 守卫不是 if 结构（三元 / 字符串里）',
      mutate(
        "if (shouldRecordPageError(err)) loadError.value = '加载失败';",
        "loadError.value = shouldRecordPageError(err) ? '加载失败' : '';",
      ),
    ],
    [
      'S2 守卫文本出现在字符串里',
      mutate(
        "if (shouldRecordPageError(err)) loadError.value = '加载失败';",
        "loadError.value = 'if (shouldRecordPageError(err))';",
      ),
    ],
  ])('%s：被抓住', (_label, files) => {
    expect(
      problemsOf(files).some((p) =>
        p.startsWith('未守卫写入 demo/Demo.ts|loadError.value'),
      ),
    ).toBe(true);
  });

  it.each([
    [
      'S4 .catch 箭头回调（块体）',
      "api().catch((e) => {\n    loadError.value = '加载失败';\n  });",
    ],
    [
      'S4 .catch 箭头回调（单参无括号）',
      "api().catch(e => {\n    loadError.value = '加载失败';\n  });",
    ],
    [
      'S4 .catch 箭头回调（表达式体）',
      "api().catch((e) =>\n    (loadError.value = '加载失败'));",
    ],
    [
      'S4 .catch function 回调',
      "api().catch(function (e) {\n    loadError.value = '加载失败';\n  });",
    ],
  ])('%s：未守卫写入被抓住；按结构守卫后通过', (_label, snippet) => {
    const bad = {
      'demo/Demo.ts': `${BASE}\nfunction other() {\n  ${snippet}\n}\n`,
    };
    expect(problemsOf(bad)).toEqual([
      '未守卫写入 demo/Demo.ts|loadError.value：实际 1，白名单 0',
    ]);
    if (!snippet.includes('function') && !snippet.includes('=>\n')) {
      const fixed = snippet.replace(
        "loadError.value = '加载失败'",
        "if (shouldRecordPageError(e)) loadError.value = '加载失败'",
      );
      expect(
        problemsOf(
          { 'demo/Demo.ts': `${BASE}\nfunction other() {\n  ${fixed}\n}\n` },
          { 'demo/Demo.ts': 2 },
        ),
      ).toEqual([]);
    }
  });

  it('S5 白名单计数精确：多一条、少一条都报', () => {
    const whitelisted = { 'demo/Demo.ts|jsonError.value': 1 };
    const one = `${BASE}\nfunction parse() {\n  try {\n    JSON.parse(x);\n  } catch {\n    jsonError.value = 'JSON 格式错误';\n  }\n}\n`;
    expect(
      problemsOf({ 'demo/Demo.ts': one }, BASE_SNAPSHOT, whitelisted),
    ).toEqual([]);
    const two = one.replace(
      "jsonError.value = 'JSON 格式错误';",
      "jsonError.value = 'JSON 格式错误';\n    jsonError.value = '再写一次';",
    );
    expect(
      problemsOf({ 'demo/Demo.ts': two }, BASE_SNAPSHOT, whitelisted),
    ).toEqual(['未守卫写入 demo/Demo.ts|jsonError.value：实际 2，白名单 1']);
    expect(
      problemsOf({ 'demo/Demo.ts': BASE }, BASE_SNAPSHOT, whitelisted),
    ).toEqual(['未守卫写入 demo/Demo.ts|jsonError.value：实际 0，白名单 1']);
  });

  it('T3 总数不变、分布挪动：逐文件快照报出（原总数断言抓不到）', () => {
    const snapshot = { 'demo/A.ts': 1, 'demo/B.ts': 1 };
    // A 的守卫被删掉（写入改成未守卫且被 A 自己吞到白名单里），B 多加一条守卫写入：总数仍是 2
    const a = BASE.replace(
      "if (shouldRecordPageError(err)) loadError.value = '加载失败';",
      "jsonError.value = 'x';",
    );
    const b = BASE.replace(
      "if (shouldRecordPageError(err)) loadError.value = '加载失败';",
      "if (shouldRecordPageError(err)) loadError.value = '加载失败';\n    if (shouldRecordPageError(err)) listError.value = '列表失败';",
    );
    const problems = problemsOf({ 'demo/A.ts': a, 'demo/B.ts': b }, snapshot, {
      'demo/A.ts|jsonError.value': 1,
    });
    expect(problems).toEqual([
      '已守卫写入 demo/A.ts：实际 0，快照 1',
      '已守卫写入 demo/B.ts：实际 2，快照 1',
    ]);
  });

  it('注释先剥离：注释里的旧守卫不计数，代码里的照常计数；字符串里的 // 不当注释', () => {
    expect(
      countOldGuards(
        'demo/Demo.ts',
        '// if (!isPermissionDeniedError(e)) message.error(x)\n/* !isPermissionDeniedError( */',
      ),
    ).toBe(0);
    expect(
      countOldGuards(
        'demo/Demo.ts',
        "const u = 'http://x'; if (!isPermissionDeniedError(e)) message.error(x);",
      ),
    ).toBe(1);
    expect(stripComments("const u = 'a//b'; // tail\nnext")).toBe(
      "const u = 'a//b';        \nnext",
    );
  });

  it('.vue 只扫 <script>：模板里的文字（含撇号）不干扰', () => {
    const vue = `<template>\n  <p>don't catch (x) { loadError.value = 'y' }</p>\n</template>\n<script setup lang="ts">\n${BASE}</script>\n`;
    const writes = scanErrorStateWrites('demo/Demo.vue', vue);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ guarded: true, line: 10 });
  });
});
