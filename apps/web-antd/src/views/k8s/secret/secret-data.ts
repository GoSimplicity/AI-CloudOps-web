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

import yaml from 'js-yaml';

export const REDACTED_PLACEHOLDER = '<redacted>';
export const EMPTY_VALUE_MESSAGE = '不支持设为空值，请删除该键';
export const REDACTED_VALUE_MESSAGE = `不能提交脱敏占位符 ${REDACTED_PLACEHOLDER}，请填写真实值或删除该键`;
/**
 * YAML 里带引号的占位符（P2-1，契约 a.4 / F7）。裸 `<redacted>` 由后端 RestoreRedactedSecretYAML 还原原值；
 * 带双引号时 encodeSecretYamlForSubmission 会把 data 下的值当明文 base64 编码，后端不再识别为占位符，
 * 字面值 `<redacted>` 会被写进集群。单引号按约定同样拦截。
 * 第四轮决策 1：单引号（以及 stringData 下的双引号）后端其实会还原，但**有意**一并拦截——
 * 按 YAML 路径精确区分要引入完整解析，增加复杂度和新的失败方式；代价只是用户去掉引号再保存一次，提示里已写明。
 */
export const YAML_QUOTED_REDACTED_MESSAGE = `YAML 中有带引号的脱敏占位符（"${REDACTED_PLACEHOLDER}" 或 '${REDACTED_PLACEHOLDER}'），保存时会被当作普通文本写入 Secret。要保留原值请去掉引号写成 ${REDACTED_PLACEHOLDER}，要修改请填写真实值`;
/**
 * 第四轮：块标量（`|` / `>` 及 `|-` `|+` `>-` `>+`、带缩进指示符如 `|2-`）里单独一行的占位符。
 * 后端 RestoreRedactedSecretYAML 只还原解析后整值恰好为 `<redacted>` 的字符串；块标量按字面保存
 * （`|` 还会带行尾换行，多行时还有别的内容），不会还原。按约定一律拦截，与带引号的走同一条路径。
 */
export const YAML_BLOCK_REDACTED_MESSAGE = `YAML 中有写在块标量（| 或 >）里的脱敏占位符 ${REDACTED_PLACEHOLDER}，不会还原为原值，保存时会被当作普通文本写入 Secret。要保留原值请把该键写成单行的 key: ${REDACTED_PLACEHOLDER}（不用 | 或 >），要修改请填写真实值`;
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

/**
 * incr9 P3-C：按 Go strings.TrimSpace 去首尾空白（unicode.IsSpace：含 U+0085、NBSP、U+3000 等）。
 * JS 的 \s 不含 U+0085、多一个 U+FEFF：这里取并集，只会比 Go 多拦（U+FEFF），不会漏。
 */
function goTrim(value: string) {
  return value.replaceAll(/^[\s\u0085]+|[\s\u0085]+$/g, '');
}

function isRedactedText(value: string) {
  return goTrim(value) === REDACTED_PLACEHOLDER;
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
export function validateDataRows(
  rows: readonly SecretDataRow[],
): null | string {
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

/** incr9 P3-C：字节按 UTF-8 转文本（非法序列为 U+FFFD，与 Go 一致不算空白） */
function utf8Text(bytes: Uint8Array) {
  return new TextDecoder('utf-8').decode(bytes);
}

/** incr9 P3-C：base64 解码后按 UTF-8 转文本（atob 给的是 Latin-1，NBSP / U+3000 的多字节去不掉） */
function decodeBase64Utf8(value: string): string | undefined {
  const binary = decodeBase64Text(value);
  if (binary === undefined) return undefined;
  return utf8Text(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/**
 * 最终防线：payload 里出现 `<redacted>`（原文或其 base64）时返回字段路径，否则 null。
 * incr7：参数放宽为 unknown 值（新建表单的 data 类型声明为 Uint8Array）；Uint8Array 按字节检查。
 */
export function findRedactedPlaceholder(payload: {
  data?: null | Record<string, unknown>;
  string_data?: null | Record<string, unknown>;
}): null | string {
  for (const [key, value] of Object.entries(payload.data ?? {})) {
    if (value instanceof Uint8Array) {
      if (isRedactedText(utf8Text(value))) return `data.${key}`;
      continue;
    }
    if (typeof value !== 'string' || value === '') continue;
    if (isRedactedText(value)) return `data.${key}`;
    const decoded = decodeBase64Utf8(value);
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

function leadingWidth(line: string) {
  return line.length - line.trimStart().length;
}

/**
 * 值写在下一行时的键行：只有 `key:`（可在列表项里、可带引号的键），后面只允许标签 / 锚点和行尾注释。
 * 键分支不能以 `- ` 开头（`- ` 只归列表项前缀），避免与列表项前缀重叠回溯（同 BLOCK_SCALAR_HEADER_PATTERN）。
 */
const VALUE_ON_NEXT_LINE_KEY_PATTERN =
  /^([ \t]*)(?:-[ \t]+)*(?:"[^"\n]*"|'[^'\n]*'|(?:[^\s#'"-]|-(?=\S))[^:\n]*):(?:[ \t]+[!&]\S*)*[ \t]*(?:#.*)?$/;

/** 下一行整行是带引号的占位符（可带标签 / 锚点与行尾注释） */
const NEXT_LINE_QUOTED_REDACTED_PATTERN =
  /^[ \t]*(?:[!&]\S*[ \t]+)*(["'])<redacted>\1[ \t]*(?:#.*)?$/;

/**
 * incr6 P3-1：`key:` 换行后（跳过空行与整行注释）更深缩进的一行恰好是 `"<redacted>"` / `'<redacted>'`，
 * YAML 解析后与同行写法 `key: "<redacted>"` 相同，同样拦截。逐行扫描，线性时间。
 */
function yamlHasNextLineQuotedRedacted(yamlText: string) {
  const lines = yamlText.split(/\r?\n/);
  let keyIndent: null | number = null;
  for (const line of lines) {
    if (keyIndent !== null) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) continue;
      if (
        leadingWidth(line) > keyIndent &&
        NEXT_LINE_QUOTED_REDACTED_PATTERN.test(line)
      ) {
        return true;
      }
      keyIndent = null;
    }
    const key = VALUE_ON_NEXT_LINE_KEY_PATTERN.exec(line);
    if (key) keyIndent = key[1]!.length;
  }
  return false;
}

/** YAML 文本里是否有带引号的占位符（同行或值在下一行；裸 `<redacted>` 合法，不算） */
export function yamlHasQuotedRedacted(yamlText: string) {
  return (
    QUOTED_REDACTED_VALUE_PATTERN.test(yamlText) ||
    yamlHasNextLineQuotedRedacted(yamlText)
  );
}

/**
 * 块标量头：行首缩进，可选若干 `- `（列表项），可选 `key:`（含带引号的键），可选标签 / 锚点，然后是 `|` 或 `>`，
 * 后接可选的块尾指示符（`-` / `+`）与缩进指示符（1-9，两者顺序任意），再可选行尾注释。
 * incr7 P2-A：`key:` 后的空白改为可选（`[ \t]*`）。按 YAML，`token:|`（无空格）不是块标量而是普通标量，
 * 编码器也不把它当块处理（原样不动）；检查器这里宽一档、照样当块头扫描，保证编码器认作块头的行一定是检查器块头的子集，
 * 无空格写法下一行的 `<redacted>` 也拦截。
 * 值里普通出现的 `|` / `>`（如 `"x |"`、`x>`）不匹配。
 * incr6 P3-2：键分支不能以 `- `（`-` 后跟空白）开头，`- ` 只归列表项前缀；否则两者重叠，
 * 60KB 的 `- - - …` 单行要回溯约 1.5s（平方级），改后约 1ms。以 `-` 开头的键（如 `-k:`）仍可匹配。
 */
const BLOCK_SCALAR_HEADER_PATTERN =
  /^([ \t]*)(?:-[ \t]+)*(?:(?:"[^"\n]*"|'[^'\n]*'|(?:[^\s#'"-]|-(?=\S))[^:\n]*):[ \t]*)?(?:[!&]\S*[ \t]+)*[|>](?:[1-9][+-]?|[+-][1-9]?)?[ \t]*(?:#.*)?$/;

/**
 * YAML 文本里是否有块标量里单独一行的占位符：块内任一行去掉首尾空白后**恰好等于** `<redacted>` 即算；
 * 只是包含（如 `foo <redacted>`）不算。块的范围按缩进判断：块头之后、缩进比块头所在行更深的行（含空行），
 * 遇到缩进回落到块头所在行或更浅的非空行即结束，之后的普通键按正常规则处理。
 */
export function yamlHasBlockScalarRedacted(yamlText: string) {
  const lines = yamlText.split(/\r?\n/);
  let blockParentIndent: null | number = null;
  for (const line of lines) {
    if (blockParentIndent !== null) {
      if (line.trim() === '' || leadingWidth(line) > blockParentIndent) {
        if (line.trim() === REDACTED_PLACEHOLDER) return true;
        continue;
      }
      blockParentIndent = null;
    }
    const header = BLOCK_SCALAR_HEADER_PATTERN.exec(line);
    if (header) blockParentIndent = header[1]!.length;
  }
  return false;
}

/** YAML 保存前的占位符检查：返回拦截文案，没有问题返回 null（裸 `<redacted>` 放行） */
export function getYamlRedactedError(yamlText: string): null | string {
  if (yamlHasQuotedRedacted(yamlText)) return YAML_QUOTED_REDACTED_MESSAGE;
  if (yamlHasBlockScalarRedacted(yamlText)) return YAML_BLOCK_REDACTED_MESSAGE;
  return null;
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

// ---- YAML 编辑：展示时把 data 的 base64 解成明文、提交时再编码（incr7 从 Secret.ts 移入并重写，便于与上面的拦截器对照测试） ----

/** data 段头：顶格 `data:`，后面只允许空白与行尾注释 */
const DATA_SECTION_HEADER_PATTERN = /^data:[ \t]*(?:#.*)?$/;

/** 顶格的非空、非注释行（结束当前段） */
function isTopLevelLine(line: string) {
  return line !== '' && !/^[ \t#]/.test(line);
}

/**
 * incr7：「某个位置是否在顶层 data 段里」的统一口径（展示 / 编码共用，格式检查按同一规则逐行扫描）。
 * 段从顶格 `data:` 头的下一行开始，到下一个顶格的非空、非注释行（如 `stringData:`、`kind:`、`---`）之前结束。
 * 原来用 `indexOf(match)` 找「第一处相同文本」再往前找 `\ndata:\n`：同一行文本出现两次（data 与 stringData 里各一处）
 * 会判错，每条都 substring 是平方级，data 在第一行或头带注释时也认不出。
 * 返回的函数按 replace 回调的 offset 判断，二分查找，整体线性。
 */
export function createDataSectionLocator(
  text: string,
): (offset: number) => boolean {
  const ranges: Array<[number, number]> = [];
  let start = -1;
  let lineStart = 0;
  while (lineStart <= text.length) {
    let lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = text.length;
    const line = text.slice(lineStart, lineEnd).replace(/\r$/, '');
    if (isTopLevelLine(line)) {
      if (start !== -1) {
        ranges.push([start, lineStart]);
        start = -1;
      }
      if (DATA_SECTION_HEADER_PATTERN.test(line)) {
        start = Math.min(lineEnd + 1, text.length);
      }
    }
    lineStart = lineEnd + 1;
  }
  if (start !== -1) ranges.push([start, text.length]);
  return (offset: number) => {
    let lo = 0;
    let hi = ranges.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const [from, to] = ranges[mid]!;
      if (offset < from) hi = mid - 1;
      else if (offset >= to) lo = mid + 1;
      else return true;
    }
    return false;
  };
}

/** base64 解成 UTF-8；不是合法 UTF-8（二进制）时返回 undefined（fatal 解码，不产生 U+FFFD） */
const decodeBase64ToUtf8 = (base64Str: string): string | undefined => {
  const binary = decodeBase64Text(base64Str);
  if (binary === undefined) return undefined;
  try {
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
};

/** 不能原样放进单行双引号 / | 块的字符（YAML 会改写或报错）：除 \t、\n 外的控制字符、NEL、行 / 段分隔符、BOM */
const UNSAFE_DISPLAY_CHAR_PATTERN =
  /[\u0000-\u0008\u000B-\u001F\u007F\u0085\u2028\u2029\uFEFF]/;

/** 展示用双引号转义：先 `\` 再 `"`；编码器只还原这两种（`\\` → `\`，`\"` → `"`），两边对称 */
const escapeDisplayQuoted = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

// 处理 Secret YAML 中的 base64 编码数据（展示用：data 下的值解成明文）
export const processSecretYaml = (yamlContent: string): string => {
  if (!yamlContent) return yamlContent;

  try {
    const inData = createDataSectionLocator(yamlContent);
    // incr7：缩进只认 [ \t]*（原来 ^(\s*) 跨行吞空行，60k 空行约 3.4s，平方级）；冒号后至少一个空格（与编码器同口径）
    return yamlContent.replace(
      /^([ \t]*)([\w\-.]+):[ \t]+([A-Za-z0-9+/]+=*)[ \t]*$/gm,
      (match, indent: string, key: string, value: string, offset: number) => {
        if (!inData(offset)) return match;
        const decodedValue = decodeBase64ToUtf8(value);
        // 二进制 / 含不可见控制字符：保留 base64 不解码（原来非 fatal 解码会换成 U+FFFD，保存即改坏原值）
        if (
          decodedValue === undefined ||
          UNSAFE_DISPLAY_CHAR_PATTERN.test(decodedValue)
        ) {
          return match;
        }
        const shown = decodedValue.includes('\n')
          ? `${indent}${key}: |\n${decodedValue
              .split('\n')
              .map((line) => `${indent}  ${line}`)
              .join('\n')}`
          : `${indent}${key}: "${escapeDisplayQuoted(decodedValue)}"`;
        // incr7：展示结果必须能被编码器原样还原成同一个 base64；还原不了（如末尾换行、首行以空白开头、
        // 非规范 base64）就保留 base64 不解码——「打开 YAML、不改直接保存」不会改动任何值
        const roundTrip = encodeSecretYamlForSubmission(`data:\n${shown}\n`);
        return roundTrip === `data:\n${indent}${key}: ${value}\n`
          ? shown
          : match;
      },
    );
  } catch {
    return yamlContent; // 如果处理失败，返回原始内容
  }
};

/**
 * 块标量头：`key: |`（冒号后至少一个空格，按 YAML `key:|` 不是块标量，原样不动交给格式检查）。
 * 内容只收更深缩进的行（`\1[ \t]+\S`）与空行；原来的 `(?:\s{2,}.*\n?)*` 会把块后同级的键（`  other: …`）
 * 并进块内容一起编码掉。
 */
const ENCODER_BLOCK_PATTERN =
  /^([ \t]*)([\w\-.]+):[ \t]+\|[ \t]*\n((?:[ \t]*\n|\1[ \t]+\S.*\n?)*)/gm;

/**
 * 同一行的双引号值：内容为「非引号、非反斜杠、非换行的字符」或「反斜杠 + 任一字符」，两支首字符互斥，线性时间
 * （原 `"([^"]*(?:\\.[^"]*)*)"` 两支都能吃反斜杠，未闭合引号 + k 组 `\a` 回溯 2^k）。
 * 引号后只允许空白与行尾注释（保留原样）。
 */
const ENCODER_QUOTED_PATTERN =
  /^([ \t]*)([\w\-.]+):[ \t]+"((?:[^"\\\n]|\\.)*)"([ \t]+#.*|[ \t]*)$/gm;

/** | 块内容 → 原值：缩进按第一个非空行算（YAML 语义），中间空行保留，末尾空行不计入值（与展示一致） */
function decodeLiteralBlock(content: string) {
  const endsWithNewline = content.endsWith('\n');
  const lines = content.split('\n');
  if (endsWithNewline) lines.pop();
  let last = lines.length;
  while (last > 0 && lines[last - 1]!.trim() === '') last -= 1;
  const body = lines.slice(0, last);
  const first = body.find((line) => line.trim() !== '');
  const width = first ? leadingWidth(first) : 0;
  for (const line of body) {
    // 非空行缩进比首行浅：YAML 本身就不合法，不编码，原样交给格式检查 / 兜底
    if (line.trim() !== '' && leadingWidth(line) < width) return undefined;
  }
  return {
    trailingBlankLines: lines.length - last,
    endsWithNewline,
    value: body.map((line) => line.slice(width)).join('\n'),
  };
}

// 处理提交时的 YAML，将 data 下的明文重新编码为 base64
export const encodeSecretYamlForSubmission = (yamlContent: string): string => {
  if (!yamlContent) return yamlContent;

  try {
    const blockInData = createDataSectionLocator(yamlContent);
    let processedYaml = yamlContent.replace(
      ENCODER_BLOCK_PATTERN,
      (match, indent: string, key: string, content: string, offset: number) => {
        if (!blockInData(offset)) return match;
        const block = decodeLiteralBlock(content);
        if (!block) return match;
        // 末尾空行与换行原样保留，块后的键不会粘到同一行
        const tail =
          content === ''
            ? '\n'
            : '\n'.repeat(block.trailingBlankLines) +
              (block.endsWithNewline ? '\n' : '');
        return `${indent}${key}: ${encodeUtf8ToBase64(block.value)}${tail}`;
      },
    );

    const quotedInData = createDataSectionLocator(processedYaml);
    processedYaml = processedYaml.replace(
      ENCODER_QUOTED_PATTERN,
      (
        match,
        indent: string,
        key: string,
        value: string,
        rest: string,
        offset: number,
      ) => {
        if (!quotedInData(offset)) return match;
        // 只还原 \\ 与 \"（单次扫描），与展示时的转义对称；其他转义原样保留并由格式检查拦截
        const unescapedValue = value.replace(/\\(["\\])/g, '$1');
        return `${indent}${key}: ${encodeUtf8ToBase64(unescapedValue)}${rest}`;
      },
    );

    return processedYaml;
  } catch {
    return yamlContent; // 如果处理失败，返回原始内容
  }
};

// ---- incr7：YAML 更新前的 data 格式检查（P2-A / P3-C）与编码后、发请求前的兜底（P2-A backstop） ----

function dataLocationLabel(where: string) {
  if (where === 'data') return 'data';
  return where.startsWith('第 ') ? `data 下${where}` : `data.${where}`;
}

export const yamlDataMissingSpaceMessage = (key: string) =>
  `YAML 中 data.${key} 的冒号后缺少空格（如 ${key}:| 或 ${key}:"…"），按 YAML 这不是键值写法，保存结果与预期不符。请在冒号后加一个空格`;

export const yamlDataNextLineMessage = (key: string) =>
  `YAML 中 data.${key} 的值写在了下一行，保存时不会被编码为 base64。请写在同一行：${key}: "明文"，多行内容写成 ${key}: | 并换行缩进`;

export const yamlDataUnsupportedMessage = (where: string) =>
  `YAML 中 ${dataLocationLabel(where)} 用了编辑器不支持的写法。data 下每个键请写成同一行的 base64、${REDACTED_PLACEHOLDER}、"明文"（只支持 \\" 与 \\\\ 转义），或 key: | 加换行缩进的多行明文`;

export const yamlDataNotBase64Message = (key: string) =>
  `YAML 中 data.${key} 的值不是合法的 base64。data 里的值必须是 base64；编辑已有 Secret 时也可以写成 ${key}: "明文"（加双引号，保存时自动编码），新建时明文请放到 stringData`;

export const yamlDataEncodedRedactedMessage = (key: string) =>
  `YAML 中 data.${key} 的值解码后是脱敏占位符 ${REDACTED_PLACEHOLDER}，提交会把占位符当作真实内容写入 Secret、覆盖原值。要保留原值请写成 ${key}: ${REDACTED_PLACEHOLDER}，要修改请填写真实值`;

// ---- incr8（review-incr7 P2-1 / P3-1 ~ P3-3 / 取舍 5）的提示文案：只含键名或行号，不含值 ----

export const yamlNonCanonicalFieldMessage = (key: string) =>
  `YAML 顶层键 ${key} 不是规范写法：后端会把它当作 data / stringData 写入 Secret，但脱敏占位符 ${REDACTED_PLACEHOLDER} 的还原与检查只认 data / stringData（区分大小写），占位符会被当作真实内容写入。请改成 data 或 stringData`;

export const YAML_MULTI_DOCUMENT_MESSAGE =
  'YAML 只支持单个文档：请删除 --- 分隔的其他文档（包括末尾单独的 ---）后再保存';

export const yamlInvalidMessage = (line?: number) =>
  `YAML 格式不正确${line === undefined ? '' : `（第 ${line} 行附近）`}，无法确认 data / stringData 的内容，请修正后再保存`;

export const YAML_LINE_BREAK_CHAR_MESSAGE =
  'YAML 中含有 U+2028 / U+2029 / U+0085（Unicode 行分隔符），或文件开头以外的 U+FEFF。不同解析器对它们的处理不一致，保存结果可能与编辑器里看到的不同，请删除后再保存';

export const yamlStringDataRedactedMessage = (key: string) =>
  `YAML 中 stringData.${key} 的值去掉首尾空白后是脱敏占位符 ${REDACTED_PLACEHOLDER}，但不完全等于它，后端不会还原，会被当作真实内容写入 Secret。要保留原值请写成 ${key}: ${REDACTED_PLACEHOLDER}（前后不带空格或换行），要修改请填写真实值`;

/** 取舍 5：data 值为 null / ~；口径与表单的 EMPTY_VALUE_MESSAGE 一致 */
export const YAML_MERGE_KEY_MESSAGE =
  'YAML 中有合并键 <<。后端与编辑器对 << 的处理不一致，可能把脱敏占位符当作真实内容写入 Secret；请把 << 展开成普通键后再保存';
export const yamlStringDataBinaryRedactedMessage = (key: string) =>
  `YAML 中 stringData.${key} 是 !!binary，解码后是脱敏占位符 ${REDACTED_PLACEHOLDER}，后端不会还原，会当作真实内容写入 Secret。要保留原值请删除该键或在 data 下写成 ${REDACTED_PLACEHOLDER}，要修改请填写真实值`;
export const yamlDataEmptyValueMessage = (key: string) =>
  `YAML 中 data.${key} 的值为空（null / ~）。不支持设为空值，空值请删除该键`;

/**
 * incr8 P2-1：Go 的 encoding/json 按字段名不区分大小写匹配（含 Unicode 简单折叠：ſ → s、K → k），
 * `StringData` / `stringdata` / `ſtringData` / `Data` 都会写进 Secret 的 stringData / data；
 * 后端的占位符还原 / 检查只认规范的 `data` / `stringData`。这类非规范键一律拦截。
 */
function isNonCanonicalSecretFieldKey(key: string) {
  if (key === 'data' || key === 'stringData') return false;
  // incr9：去掉了 K（U+212A）→ k 的折叠：data / stringdata 里没有 k，是死代码（M02 等价变体）
  const folded = key.replaceAll('\u017F', 's').toLowerCase();
  return folded === 'data' || folded === 'stringdata';
}

/**
 * 顶格行的键名（裸键或单 / 双引号键，不处理转义）；不是 `键:` 写法返回 null。
 * incr9 P2-1'：裸键原为 `[^:]*?` 后接 `[ \t]*:`，两者都能吃空白，无冒号的长行平方级回溯（200KB 约 26s）；
 * 改为裸键必须以非空白、非冒号结尾，冒号前的空白只归 `[ \t]*`，线性时间。
 */
const TOP_LEVEL_KEY_PATTERN =
  /^(?:"([^"\\]*)"|'([^']*)'|([^\s"'#?:[{\-](?:[^:]*[^ \t:])?))[ \t]*:(?:[ \t]|$)/;

/** incr8 P3-2：js-yaml 当作普通字符、Go（YAML 1.1）当作换行的字符；U+FEFF 只允许出现在开头（BOM） */
const YAML_LINE_BREAK_CHAR_PATTERN = /[\u0085\u2028\u2029]/;

function hasYamlLineBreakChar(text: string) {
  return (
    YAML_LINE_BREAK_CHAR_PATTERN.test(text) || text.indexOf('\uFEFF', 1) !== -1
  );
}

/** 严格 base64（标准字母表、长度为 4 的倍数、末尾最多两个 =） */
const STRICT_BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** 双引号值：只允许 \" 与 \\ 转义，引号后只允许行尾注释（value 已去掉首尾空白） */
const SUPPORTED_QUOTED_VALUE_PATTERN =
  /^"(?:[^"\\\n]|\\["\\])*"(?:[ \t]+#.*)?$/;

/** 顶格 `data:` 头后允许的同行内容：空、行尾注释、空映射 / null */
const DATA_HEADER_INLINE_OK_PATTERN =
  /^(?:[ \t]*(?:#.*)?|[ \t]+(?:\{\}|~|null|Null|NULL)[ \t]*(?:#.*)?)$/;

/**
 * incr7 P2-A / P3-C：YAML **更新**提交前，按编码器能处理的写法检查 data 段（只看 data，stringData 等不管）。
 * 编码器只编码同一行的 `key: "明文"` 与 `key: |` 块；其他写法（值写在下一行、冒号后无空格、单引号、
 * 其他块标量、标签 / 锚点、流式值等）不会被编码，明文会原样发给后端，这里提前拦下。
 * 返回拦截文案（只含键名或行号，不含值），没有问题返回 null。逐行扫描，线性时间。
 */
export function getYamlDataFormatError(yamlText: string): null | string {
  const lines = yamlText.split('\n');
  let inData = false;
  let entryIndent: null | number = null;
  /** none：无当前条目；value：同行已有值；pending：值为空（下一行更深即为「值写在下一行」）；block：`|` 块内容 */
  let state: 'block' | 'none' | 'pending' | 'value' = 'none';
  let currentKey = '';
  let blockWidth: null | number = null;
  let seenTopLevelContent = false;

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.replace(/\r$/, '');
    if (isTopLevelLine(line)) {
      // incr8 P3-1：已有内容之后的 `---` = 第二个文档（与兜底的 loadAll 同口径，提示也一致）
      if (/^---(?:[ \t]|$)/.test(line)) {
        if (seenTopLevelContent) return YAML_MULTI_DOCUMENT_MESSAGE;
        continue;
      }
      seenTopLevelContent = true;
      inData = false;
      state = 'none';
      entryIndent = null;
      if (line.startsWith('data:')) {
        if (!DATA_HEADER_INLINE_OK_PATTERN.test(line.slice('data:'.length))) {
          return yamlDataUnsupportedMessage('data');
        }
        inData = true;
      } else if (/^(["'])data\1[ \t]*:/.test(line)) {
        return yamlDataUnsupportedMessage('data');
      } else {
        // incr8 P2-1：`Data:` / `StringData:` / `"Data":` 等非规范键名
        const keyMatch = TOP_LEVEL_KEY_PATTERN.exec(line);
        const key = keyMatch
          ? (keyMatch[1] ?? keyMatch[2] ?? keyMatch[3]!)
          : '';
        if (isNonCanonicalSecretFieldKey(key)) {
          return yamlNonCanonicalFieldMessage(key);
        }
        // `data :`（冒号前有空格）：编码器不认，值不会被编码
        if (/^data[ \t]+:/.test(line))
          return yamlDataUnsupportedMessage('data');
      }
      continue;
    }
    if (!inData) continue;
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const width = leadingWidth(line);

    if (state === 'block') {
      if (entryIndent !== null && width > entryIndent) {
        if (blockWidth === null) blockWidth = width;
        else if (width < blockWidth)
          return yamlDataUnsupportedMessage(currentKey);
        continue;
      }
      state = 'none';
    }
    if (trimmed.startsWith('#')) continue;
    if (entryIndent === null) entryIndent = width;
    if (width > entryIndent) {
      if (state === 'pending') return yamlDataNextLineMessage(currentKey);
      if (state === 'value') return yamlDataUnsupportedMessage(currentKey);
      return yamlDataUnsupportedMessage(`第 ${index + 1} 行`);
    }
    if (width < entryIndent)
      return yamlDataUnsupportedMessage(`第 ${index + 1} 行`);

    const content = line.slice(width);
    const keyMatch = /^([\w.-]+):/.exec(content);
    if (!keyMatch) return yamlDataUnsupportedMessage(`第 ${index + 1} 行`);
    currentKey = keyMatch[1]!;
    const after = content.slice(keyMatch[0].length);
    if (after !== '' && !/^[ \t]/.test(after)) {
      return yamlDataMissingSpaceMessage(currentKey);
    }
    const value = after.trim();
    if (value === '' || value.startsWith('#')) {
      state = 'pending';
      continue;
    }
    if (value === '|') {
      state = 'block';
      blockWidth = null;
      continue;
    }
    state = 'value';
    const first = value[0]!;
    if (first === '"') {
      if (!SUPPORTED_QUOTED_VALUE_PATTERN.test(value)) {
        return yamlDataUnsupportedMessage(currentKey);
      }
      continue;
    }
    if ("|>'!&*[{%@`?,".includes(first)) {
      return yamlDataUnsupportedMessage(currentKey);
    }
    const commentAt = value.search(/[ \t]#/);
    const plain =
      commentAt === -1 ? value : value.slice(0, commentAt).trimEnd();
    // incr8 取舍 5：null / ~ 是空值，提示删除该键（与表单 EMPTY_VALUE_MESSAGE 同口径）
    if (/^(?:null|Null|NULL|~)$/.test(plain)) {
      return yamlDataEmptyValueMessage(currentKey);
    }
    if (plain !== REDACTED_PLACEHOLDER && !STRICT_BASE64_PATTERN.test(plain)) {
      return yamlDataNotBase64Message(currentKey);
    }
  }
  return null;
}

/** 规范化后（Go 的 base64 解码忽略 \r \n）判断一个 base64 串是否解码为占位符；不是严格 base64 返回 undefined */
function decodesToRedacted(encoded: string): boolean | undefined {
  const compact = encoded.replace(/[\r\n]/g, '');
  if (!STRICT_BASE64_PATTERN.test(compact)) return undefined;
  const decoded = decodeBase64Utf8(compact);
  return decoded !== undefined && isRedactedText(decoded);
}

/** 文本里某个位置所在行的键名（找不到时用行号），用于 token 扫描的提示 */
function keyOfLineAt(text: string, offset: number) {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  const lineEnd = text.indexOf('\n', offset);
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  const key = /^[ \t]*(?:-[ \t]+)*["']?([\w.-]+)["']?[ \t]*:/.exec(line);
  if (key) return key[1]!;
  let lineNumber = 1;
  for (
    let i = text.indexOf('\n');
    i !== -1 && i < lineStart;
    i = text.indexOf('\n', i + 1)
  ) {
    lineNumber += 1;
  }
  return `第 ${lineNumber} 行`;
}

/**
 * incr9 P3-A：不含 merge 的解析 schema。js-yaml 的 `<<` 显式键优先，Go yaml.v2 是后写的 `<<` 覆盖前面的显式键，
 * 两边结果不同；这里把 `<<` 当普通键解析出来，再由 hasMergeKey 拦截。保留 !!binary 与时间戳（CORE_SCHEMA 不含）。
 */
const yamlTypes = (
  yaml as unknown as { types: Record<'binary' | 'timestamp', yaml.Type> }
).types;
const SECRET_YAML_SCHEMA = yaml.CORE_SCHEMA.extend([
  yamlTypes.binary,
  yamlTypes.timestamp,
]);

/** 任意深度（映射 / 列表）有 `<<` 键 */
function hasMergeKey(root: unknown) {
  const seen = new Set<object>();
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    if (node instanceof Uint8Array || node instanceof Date) continue;
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === '<<') return true;
      stack.push(value);
    }
  }
  return false;
}

/** 可能是 base64 的片段（主体 ≥8 个字符；`<redacted>` 的 base64 为 14 个字符 + `==`） */
const BASE64_TOKEN_PATTERN = /[A-Za-z0-9+/]{8,}={0,2}/g;

/**
 * incr7 P2-A 兜底：YAML 编码之后、发请求之前（更新）或直接对原文（新建），检查最终要发出的内容：
 * 0. incr8：全文含 U+2028 / U+2029 / U+0085、或开头以外的 U+FEFF → 拦截（P3-2）；
 *    `yaml.loadAll(…, { json: true })` 解析：多于一个文档 → 拦截；其他解析失败 → 先 token 扫描，
 *    没命中也拦截（P3-1，取舍 8「解析失败只做 token 扫描」作废）；顶层非规范 data / stringData 键 → 拦截（P2-1）；
 *    stringData 的值去掉首尾空白后等于占位符但不完全相等 → 拦截（P3-3）。
 *    incr9：解析用不含 merge 的 schema，任意深度有 `<<` 键 → 拦截（P3-A）；stringData 的 !!binary 值解码后
 *    是占位符 → 拦截（P3-B）；「去首尾空白」一律按 Go TrimSpace（goTrim），base64 / 二进制按 UTF-8 转文本（P3-C）。
 * 1. 按 js-yaml 解析，data 下每个值：null 跳过；裸 `<redacted>` 放行（后端保留原值）；字符串去掉 \r \n 后
 *    必须是严格 base64，且解码（去首尾空白）后不能是占位符；`!!binary`（Uint8Array）同样检查解码内容；
 *    数字 / 布尔等其他类型一律视为「不是 base64」。
 * 2. 再对全文做 token 扫描：任何 ≥16 字符的 base64 片段解码后是占位符就拦截
 *    （写法绕过了上面的结构检查时仍然有效；解析失败时也先做这一步，以便给出更具体的提示）。
 * 返回拦截文案（只含键名或行号，不含值），没有问题返回 null。
 */
export function getYamlDataPayloadError(yamlText: string): null | string {
  // incr8 P3-2：先看全文里有没有 js-yaml 与 Go 理解不一致的换行类字符
  if (hasYamlLineBreakChar(yamlText)) return YAML_LINE_BREAK_CHAR_MESSAGE;
  // incr8 P3-1：json:true 与 Go（yaml v2 非严格）一致，重复键取后一个；多文档 / 其他解析失败一律拦截
  let docs: unknown[];
  try {
    docs = yaml.loadAll(yamlText, undefined, {
      json: true,
      schema: SECRET_YAML_SCHEMA,
    });
  } catch (error) {
    // 解析失败：先按 token 扫描给出更具体的提示，否则提示 YAML 不合法（只给行号，不带解析器原文——里面有值）
    const tokenError = findEncodedRedactedToken(yamlText);
    if (tokenError) return tokenError;
    const line = (error as { mark?: { line?: unknown } })?.mark?.line;
    return yamlInvalidMessage(typeof line === 'number' ? line + 1 : undefined);
  }
  if (docs.length > 1) return YAML_MULTI_DOCUMENT_MESSAGE;
  const doc = docs[0];
  // incr9 P3-A：任意深度的 << 合并键
  if (hasMergeKey(doc)) return YAML_MERGE_KEY_MESSAGE;
  if (doc !== null && typeof doc === 'object' && !Array.isArray(doc)) {
    // incr8 P2-1：顶层非规范的 data / stringData 键
    for (const key of Object.keys(doc)) {
      if (isNonCanonicalSecretFieldKey(key)) {
        return yamlNonCanonicalFieldMessage(key);
      }
    }
    // incr8 P3-3：stringData 的值去掉首尾空白后是占位符、但不完全相等 → 后端不还原
    const stringData = (doc as Record<string, unknown>).stringData;
    if (stringData !== null && typeof stringData === 'object') {
      for (const [key, value] of Object.entries(stringData)) {
        if (
          typeof value === 'string' &&
          value !== REDACTED_PLACEHOLDER &&
          isRedactedText(value)
        ) {
          return yamlStringDataRedactedMessage(key);
        }
        // incr9 P3-B：stringData 里 !!binary 的值，Go 解码成字符串后同样参与 TrimSpace 比较
        if (value instanceof Uint8Array && isRedactedText(utf8Text(value))) {
          return yamlStringDataBinaryRedactedMessage(key);
        }
      }
    }
    const data = (doc as Record<string, unknown>).data;
    if (data !== undefined && data !== null) {
      if (typeof data !== 'object' || Array.isArray(data)) {
        return yamlDataUnsupportedMessage('data');
      }
      for (const [key, value] of Object.entries(
        data as Record<string, unknown>,
      )) {
        if (value === null || value === undefined) continue;
        if (value === REDACTED_PLACEHOLDER) continue;
        let encoded: string;
        if (typeof value === 'string') {
          encoded = value;
        } else if (value instanceof Uint8Array) {
          // incr9 P3-C：按 UTF-8 转文本、goTrim 后比较（原为 Latin-1 + trim）
          if (isRedactedText(utf8Text(value))) {
            return yamlDataEncodedRedactedMessage(key);
          }
          continue;
        } else {
          return yamlDataNotBase64Message(key);
        }
        const redacted = decodesToRedacted(encoded);
        if (redacted === undefined) return yamlDataNotBase64Message(key);
        if (redacted) return yamlDataEncodedRedactedMessage(key);
      }
    }
  }
  return findEncodedRedactedToken(yamlText);
}

/** token 扫描：全文任何 ≥16 字符的 base64 片段解码后是占位符 → 拦截文案（只含键名 / 行号） */
function findEncodedRedactedToken(yamlText: string): null | string {
  for (const token of yamlText.matchAll(BASE64_TOKEN_PATTERN)) {
    if (decodesToRedacted(token[0])) {
      return yamlDataEncodedRedactedMessage(
        keyOfLineAt(yamlText, token.index!),
      );
    }
  }
  return null;
}
