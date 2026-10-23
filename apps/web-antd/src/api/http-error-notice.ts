/**
 * 请求层「已按 http-error key 提示过」的标记（SEC-25/26 规则 3 / 第 6 条）。
 *
 * 通用错误拦截器对非 2xx 响应弹出 fallback 文案（key = `http-error:<文案>`），并把这个 key
 * 记在错误对象上（不可枚举 Symbol，RequestClient 包装失败对象时会保留）。页面需要更具体的文案时，
 * 用同一个 key 调 message.error 替换那一条，而不是再弹第二条。
 *
 * key 按文案共用（FE-02：同类并发错误只弹一条），所以同一时刻可能有多个错误对象共用一条提示。
 * 每个错误对象另有一个唯一 token，按 key 记录「当前这条提示是哪些错误弹的」：只有这条提示
 * 确实是当前错误弹出的、且没有被别的未处理错误共用时，页面才可以替换它。
 */
const HTTP_ERROR_NOTICE_KEY = Symbol.for('ai-cloudops.httpErrorNoticeKey');
const HTTP_ERROR_NOTICE_TOKEN = Symbol.for('ai-cloudops.httpErrorNoticeToken');

/** onClose 没回调时的兜底：超过这个时长视为提示已关闭（ant message 默认 3s） */
const NOTICE_STALE_MS = 10_000;

interface NoticeEntry {
  /** token → 是否已由页面换成具体文案 */
  owners: Map<number, boolean>;
  updatedAt: number;
  version: number;
}

const visibleNotices = new Map<string, NoticeEntry>();
let tokenSeq = 0;

function liveEntry(key: string): NoticeEntry | undefined {
  const entry = visibleNotices.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.updatedAt > NOTICE_STALE_MS) {
    visibleNotices.delete(key);
    return undefined;
  }
  return entry;
}

/** message.error 返回的 thenable 在这条提示关闭时 resolve；同 key 后续再写过则不释放 */
function releaseOnClose(key: string, entry: NoticeEntry, handle: unknown) {
  const version = entry.version;
  const then = (handle as undefined | { then?: unknown })?.then;
  if (typeof then !== 'function') return;
  then.call(handle, () => {
    if (visibleNotices.get(key) === entry && entry.version === version) {
      visibleNotices.delete(key);
    }
  });
}

function tokenOf(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const token = (error as Record<symbol, unknown>)[HTTP_ERROR_NOTICE_TOKEN];
  return typeof token === 'number' ? token : undefined;
}

function defineHidden(target: object, symbol: symbol, value: unknown) {
  Object.defineProperty(target, symbol, {
    configurable: true,
    enumerable: false,
    value,
  });
}

/**
 * 请求层弹出 http-error 提示后调用。handle 传 message.error 的返回值，用来感知关闭。
 */
export function markHttpErrorNotified(
  error: unknown,
  key: string,
  handle?: unknown,
) {
  if (!error || typeof error !== 'object') return;
  const token = tokenOf(error) ?? ++tokenSeq;
  defineHidden(error, HTTP_ERROR_NOTICE_KEY, key);
  defineHidden(error, HTTP_ERROR_NOTICE_TOKEN, token);
  let entry = liveEntry(key);
  if (entry) {
    entry.version += 1;
  } else {
    entry = { owners: new Map(), updatedAt: 0, version: 0 };
    visibleNotices.set(key, entry);
  }
  // 已被页面换成具体文案的错误保持「已处理」：它们的页面不会再来认领，不应挡住后来的错误
  if (!entry.owners.has(token)) entry.owners.set(token, false);
  entry.updatedAt = Date.now();
  releaseOnClose(key, entry, handle);
}

/** 请求层提示时用的 message key；没有提示过返回 undefined */
export function getHttpErrorNoticeKey(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const key = (error as Record<symbol, unknown>)[HTTP_ERROR_NOTICE_KEY];
  return typeof key === 'string' ? key : undefined;
}

/**
 * 当前错误能否用同一个 key 替换请求层那条提示：
 * 提示仍可见、当前错误是它的弹出者之一、其余共用者都已被页面换成具体文案。
 * 返回可替换的 key；不能替换返回 undefined（提示已关闭、或被别的未处理错误共用）。
 */
export function claimHttpErrorNotice(error: unknown): string | undefined {
  const key = getHttpErrorNoticeKey(error);
  const token = tokenOf(error);
  if (key === undefined || token === undefined) return undefined;
  const entry = liveEntry(key);
  if (!entry || !entry.owners.has(token)) return undefined;
  for (const [owner, handled] of entry.owners) {
    if (owner !== token && !handled) return undefined;
  }
  return key;
}

/** 页面已用 claim 到的 key 替换了提示 */
export function markHttpErrorNoticeReplaced(error: unknown, handle?: unknown) {
  const key = getHttpErrorNoticeKey(error);
  const token = tokenOf(error);
  if (key === undefined || token === undefined) return;
  const entry = liveEntry(key);
  if (!entry || !entry.owners.has(token)) return;
  entry.owners.set(token, true);
  entry.version += 1;
  entry.updatedAt = Date.now();
  releaseOnClose(key, entry, handle);
}

/** 仅测试用：清空可见提示记录 */
export function resetHttpErrorNoticeTracking() {
  visibleNotices.clear();
}
