/**
 * SEC-25/26 Secret 数据（data）脱敏后的前端处理：reveal 明文读取、编辑提交 payload。
 *
 * 后端契约（AI-CloudOps@ed683ef，只读核对）：
 * - list / detail 默认脱敏：data 的值为 ""，另给 data_keys / string_data_keys（[{key,size}]）与 redacted=true；
 *   YAML 里值为占位符 `<redacted>`。明文只能经 GET .../reveal 获取（每次写审计）。
 * - PUT .../update（internal/k8s/service/secret_service.go preserveRedactedData）：
 *   data 为 null → 不修改；非空 map → 整体替换，缺的键被删除；值为 "" → 保留该键原值；
 *   值不是合法 base64（如 `<redacted>`）→ 400。业务失败（含冲突）为 HTTP 200 + code=1。
 *
 * 前端规则（sec26-decisions.md 规则 2）：data 没动发 null；改了就发全部键，未改的发 ""，删掉的键不发；
 * 用户把值改成空串时在表单拦截（「不支持设为空值，请删除该键」）；任何情况下都不发 `<redacted>`。
 *
 * 待决策（见 PR 说明）：把全部键删掉时按字面规则会发 `{}`（后端语义 = 清空 data），这里保持字面规则。
 */
import type { K8sSecretRevealRes } from '#/api/core/k8s/k8s_secret';

export const REDACTED_PLACEHOLDER = '<redacted>';
export const EMPTY_VALUE_MESSAGE = '不支持设为空值，请删除该键';
export const REDACTED_VALUE_MESSAGE = `不能提交脱敏占位符 ${REDACTED_PLACEHOLDER}，请填写真实值或删除该键`;
/**
 * YAML 里带引号的占位符（P2-1，契约 a.4 / F7）。裸 `<redacted>` 由后端 RestoreRedactedSecretYAML 还原原值；
 * 带双引号时 encodeSecretYamlForSubmission 会把 data 下的值当明文 base64 编码，后端不再识别为占位符，
 * 字面值 `<redacted>` 会被写进集群。单引号按约定同样拦截。
 */
export const YAML_QUOTED_REDACTED_MESSAGE = `YAML 中有带引号的脱敏占位符（"${REDACTED_PLACEHOLDER}" 或 '${REDACTED_PLACEHOLDER}'），保存时会被当作普通文本写入 Secret。要保留原值请去掉引号写成 ${REDACTED_PLACEHOLDER}，要修改请填写真实值`;
export const BINARY_VALUE_NOTICE = '（二进制内容，无法以文本显示或复制）';

/** K8s Secret 键名规则：字母数字、-、_、. */
const SECRET_KEY_PATTERN = /^[-._a-zA-Z0-9]+$/;

export interface SecretDataRow {
  id: number;
  key: string;
  /** 用户是否改过该行的值（原有键未改 = 保留原值） */
  modified: boolean;
  /** 是否为 Secret 中已有的键 */
  original: boolean;
  /** 用户输入的新明文；原有键未改时为空串 */
  value: string;
}

interface SecretKeysSource {
  data?: unknown;
  data_keys?: Array<{ key: string; size?: number }> | null;
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** 脱敏后的键名列表：优先 data_keys，没有时退回 data 的键（值不使用） */
export function getSecretDataKeys(source: null | SecretKeysSource | undefined) {
  if (!source) return [];
  if (Array.isArray(source.data_keys)) {
    return source.data_keys.map((item) => item.key);
  }
  return Object.keys(parseRecord(source.data));
}

let rowSeed = 0;
export function createDataRows(keys: readonly string[]): SecretDataRow[] {
  return keys.map((key) => ({
    id: ++rowSeed,
    key,
    modified: false,
    original: true,
    value: '',
  }));
}

export function createNewDataRow(key = ''): SecretDataRow {
  return { id: ++rowSeed, key, modified: true, original: false, value: '' };
}

/** data 是否被改动：任一行改过值、有新增键、或有原有键被删除 */
export function isDataEdited(
  originalKeys: readonly string[],
  rows: readonly SecretDataRow[],
) {
  if (rows.some((row) => row.modified || !row.original)) return true;
  const kept = new Set(rows.map((row) => row.key));
  return originalKeys.some((key) => !kept.has(key));
}

function isRedactedText(value: string) {
  return value.trim() === REDACTED_PLACEHOLDER;
}

/** 单行错误（用于表单 help） */
export function getDataRowError(row: SecretDataRow): null | string {
  if (!row.original || row.modified) {
    if (row.value === '') return EMPTY_VALUE_MESSAGE;
    if (isRedactedText(row.value)) return REDACTED_VALUE_MESSAGE;
  }
  return null;
}

/** 提交前校验；返回第一条错误，没有错误返回 null */
export function validateDataRows(rows: readonly SecretDataRow[]): null | string {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) return '键名不能为空';
    if (!SECRET_KEY_PATTERN.test(key)) {
      return `键名只能包含字母、数字、-、_、.：${key}`;
    }
    if (seen.has(key)) return `键名重复：${key}`;
    seen.add(key);
    const error = getDataRowError(row);
    if (error) return error;
  }
  return null;
}

export function encodeUtf8ToBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * 生成 update 请求的 data 字段：
 * - 没改动 → null（后端保留全部原值）；
 * - 改动过 → 剩余全部键：未改的原有键为 ""（后端保留原值），改过 / 新增的为新值的 base64；删除的键不出现。
 * 校验不通过时抛错，调用方应先 validateDataRows 在表单里提示。
 */
export function buildSecretDataPayload(
  originalKeys: readonly string[],
  rows: readonly SecretDataRow[],
): null | Record<string, string> {
  if (!isDataEdited(originalKeys, rows)) return null;
  const error = validateDataRows(rows);
  if (error) throw new Error(error);
  const payload: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    payload[key] =
      row.original && !row.modified ? '' : encodeUtf8ToBase64(row.value);
  }
  return payload;
}

function decodeBase64Text(value: string): string | undefined {
  try {
    return atob(value);
  } catch {
    return undefined;
  }
}

/** 最终防线：payload 里出现 `<redacted>`（原文或其 base64）时返回字段路径，否则 null */
export function findRedactedPlaceholder(payload: {
  data?: null | Record<string, string>;
  string_data?: null | Record<string, string>;
}): null | string {
  for (const [key, value] of Object.entries(payload.data ?? {})) {
    if (typeof value !== 'string' || value === '') continue;
    if (isRedactedText(value)) return `data.${key}`;
    const decoded = decodeBase64Text(value);
    if (decoded !== undefined && isRedactedText(decoded)) return `data.${key}`;
  }
  for (const [key, value] of Object.entries(payload.string_data ?? {})) {
    if (typeof value === 'string' && isRedactedText(value)) {
      return `string_data.${key}`;
    }
  }
  return null;
}

/** 某个键的整个值是带引号（单 / 双）的占位符，允许行尾注释 */
const QUOTED_REDACTED_VALUE_PATTERN =
  /^[ \t]*[^\s#:][^:\n]*:[ \t]*(["'])<redacted>\1[ \t]*(?:#.*)?$/m;

/** YAML 文本里是否有带引号的占位符（裸 `<redacted>` 合法，不算） */
export function yamlHasQuotedRedacted(yamlText: string) {
  return QUOTED_REDACTED_VALUE_PATTERN.test(yamlText);
}

/**
 * 从 reveal 响应里取单个键的明文：data 为 base64（解为 UTF-8），string_data 为明文。
 * 非 UTF-8 的二进制返回 BINARY_VALUE_NOTICE，不显示乱码；没有返回该键时为 undefined。
 */
export function readRevealedValue(
  res: null | Partial<K8sSecretRevealRes> | undefined,
  key: string,
): string | undefined {
  if (!res) return undefined;
  const data = parseRecord(res.data);
  const encoded = data[key];
  if (typeof encoded === 'string') {
    const binary = decodeBase64Text(encoded);
    if (binary === undefined) return BINARY_VALUE_NOTICE;
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return BINARY_VALUE_NOTICE;
    }
  }
  const plain = parseRecord(res.string_data)[key];
  return typeof plain === 'string' ? plain : undefined;
}
