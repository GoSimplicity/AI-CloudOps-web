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
 * 值里普通出现的 `|` / `>`（如 `"x |"`、`x>`）不匹配。
 * incr6 P3-2：键分支不能以 `- `（`-` 后跟空白）开头，`- ` 只归列表项前缀；否则两者重叠，
 * 60KB 的 `- - - …` 单行要回溯约 1.5s（平方级），改后约 1ms。以 `-` 开头的键（如 `-k:`）仍可匹配。
 */
const BLOCK_SCALAR_HEADER_PATTERN =
  /^([ \t]*)(?:-[ \t]+)*(?:(?:"[^"\n]*"|'[^'\n]*'|(?:[^\s#'"-]|-(?=\S))[^:\n]*):[ \t]+)?(?:[!&]\S*[ \t]+)*[|>](?:[1-9][+-]?|[+-][1-9]?)?[ \t]*(?:#.*)?$/;

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

// ---- YAML 编辑：展示时把 data 的 base64 解成明文、提交时再编码（incr7 从 Secret.ts 原样移入，便于与上面的拦截器对照测试） ----

// Base64 解码辅助函数
const decodeBase64ToUtf8 = (base64Str: string): string => {
  try {
    // 使用 atob 解码 base64，然后转换为 UTF-8
    const binaryStr = atob(base64Str);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    // 使用 TextDecoder 正确处理 UTF-8 编码
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  } catch (error) {
    return base64Str; // 如果解码失败，返回原始字符串
  }
};

// 处理 Secret YAML 中的 base64 编码数据
export const processSecretYaml = (yamlContent: string): string => {
  if (!yamlContent) return yamlContent;
  
  try {
    // 使用正则表达式匹配 data 字段下的 base64 编码值
    const processedYaml = yamlContent.replace(
      /^(\s*)([\w\-\.]+):\s*([A-Za-z0-9+/]+=*)$/gm,
      (match, indent, key, value) => {
        // 检查是否在 data 字段下且值看起来像 base64
        if (value && value.length > 0 && /^[A-Za-z0-9+/]+=*$/.test(value)) {
          // 检查前面的内容中是否有 data: 字段
          const beforeMatch = yamlContent.substring(0, yamlContent.indexOf(match));
          const dataFieldPattern = /\ndata:\s*\n/;
          const stringDataFieldPattern = /\nstringData:\s*\n/;
          
          if (dataFieldPattern.test(beforeMatch) && !stringDataFieldPattern.test(beforeMatch.substring(beforeMatch.lastIndexOf('\ndata:')))) {
            const decodedValue = decodeBase64ToUtf8(value);
            // 如果解码后的内容包含换行符，使用多行 YAML 格式
            if (decodedValue.includes('\n')) {
              const indentedContent = decodedValue
                .split('\n')
                .map((line, index) => index === 0 ? line : `${indent}  ${line}`)
                .join('\n');
              return `${indent}${key}: |\n${indent}  ${indentedContent}`;
            } else {
              return `${indent}${key}: "${decodedValue.replace(/"/g, '\\"')}"`;
            }
          }
        }
        return match;
      }
    );
    
    return processedYaml;
  } catch (error) {
    return yamlContent; // 如果处理失败，返回原始内容
  }
};

// 处理提交时的 YAML，将明文数据重新编码为 base64
export const encodeSecretYamlForSubmission = (yamlContent: string): string => {
  if (!yamlContent) return yamlContent;
  
  try {
    // 处理多行字符串（| 格式）
    // incr6 P3-1：缩进与 `key:` 后只认同一行的空格 / 制表符（[ \t]*），不跨行：
    // 原来的 \s* 会把空行并进缩进、把下一行的内容当成本键的值
    let processedYaml = yamlContent.replace(
      /^([ \t]*)([\w\-\.]+):[ \t]*\|\s*\n((?:\s{2,}.*\n?)*)/gm,
      (match, indent, key, content) => {
        // 检查是否在 data 字段下
        const beforeMatch = yamlContent.substring(0, yamlContent.indexOf(match));
        const dataFieldPattern = /\ndata:\s*\n/;
        const stringDataFieldPattern = /\nstringData:\s*\n/;
        
        if (dataFieldPattern.test(beforeMatch) && !stringDataFieldPattern.test(beforeMatch.substring(beforeMatch.lastIndexOf('\ndata:')))) {
          // 移除缩进并合并内容
          const cleanContent = content
            .split('\n')
            .map((line: string) => line.replace(new RegExp(`^${indent}  `), ''))
            .filter((line: string) => line.length > 0)
            .join('\n');
          
          const encodedValue = encodeUtf8ToBase64(cleanContent);
          return `${indent}${key}: ${encodedValue}`;
        }
        return match;
      }
    );
    
    // 处理带引号的字符串
    // incr6 P3-1：只处理同一行的 `key: "..."`。原来 `:\s*"` 跨行，`token:` 换行后的 `"<redacted>"`
    // 会被编码成 PHJlZGFjdGVkPg== 发出去（原值被覆盖），后续带引号的键（如 annotations 里的 "a/b": x）也会被误编码
    processedYaml = processedYaml.replace(
      /^([ \t]*)([\w\-\.]+):[ \t]*"([^"]*(?:\\.[^"]*)*)"/gm,
      (match, indent, key, value) => {
        // 检查是否在 data 字段下
        const beforeMatch = processedYaml.substring(0, processedYaml.indexOf(match));
        const dataFieldPattern = /\ndata:\s*\n/;
        const stringDataFieldPattern = /\nstringData:\s*\n/;
        
        if (dataFieldPattern.test(beforeMatch) && !stringDataFieldPattern.test(beforeMatch.substring(beforeMatch.lastIndexOf('\ndata:')))) {
          // 处理转义字符
          const unescapedValue = value.replace(/\\"/g, '"');
          const encodedValue = encodeUtf8ToBase64(unescapedValue);
          return `${indent}${key}: ${encodedValue}`;
        }
        return match;
      }
    );
    
    return processedYaml;
  } catch (error) {
    return yamlContent; // 如果处理失败，返回原始内容
  }
};
