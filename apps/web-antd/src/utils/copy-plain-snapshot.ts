import { toRaw } from 'vue';

/**
 * 工单表单和流程定义的纯数据快照。
 *
 * 不用 JSON.parse(JSON.stringify)：它会删掉显式的 undefined，
 * 文本字段的 options/default 哨兵会丢。
 * 不用 structuredClone：响应式代理和函数会抛错，而且现有流程在
 * structuredClone 不存在时仍要能保存。
 * Date 以及 dayjs 这类 toJSON 值收成字符串，和提交 JSON 一致。
 * 函数和 symbol 不复制。数组里的空位保持 undefined。
 * 自有 __proto__ 用数据属性定义，避免赋值走原型 setter。
 */
export function copyPlainSnapshot<T>(value: T): T {
  return walk(value, new WeakSet()) as T;
}

function walk(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null) return null;
  const kind = typeof value;
  if (
    kind === 'boolean' ||
    kind === 'number' ||
    kind === 'string' ||
    kind === 'undefined'
  ) {
    return value;
  }
  if (kind === 'bigint') throw new TypeError('不能复制 bigint');
  if (kind === 'function' || kind === 'symbol') return value;
  const raw = toRaw(value as object);
  if (seen.has(raw)) throw new TypeError('不能复制循环引用');
  seen.add(raw);
  try {
    if (typeof (raw as { toJSON?: unknown }).toJSON === 'function') {
      return walk((raw as { toJSON: () => unknown }).toJSON(), seen);
    }
    if (Array.isArray(raw)) {
      return raw.map((item) => {
        if (typeof item === 'function' || typeof item === 'symbol') return null;
        return walk(item, seen);
      });
    }
    const snapshot: Record<string, unknown> = {};
    for (const key of Object.keys(raw)) {
      const current = (raw as Record<string, unknown>)[key];
      if (typeof current === 'function' || typeof current === 'symbol')
        continue;
      Object.defineProperty(snapshot, key, {
        configurable: true,
        enumerable: true,
        value: walk(current, seen),
        writable: true,
      });
    }
    return snapshot;
  } finally {
    seen.delete(raw);
  }
}
