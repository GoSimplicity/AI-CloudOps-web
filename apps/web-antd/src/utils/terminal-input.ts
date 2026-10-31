/** 按 UTF-8 字节预算切分输入，不拆开码点或丢弃控制字符 */
export function utf8Chunks(input: string, maxBytes = 64 * 1024): string[] {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError('输入分片大小必须为正整数');
  }
  const chunks: string[] = [];
  let start = 0;
  let offset = 0;
  let bytes = 0;
  for (const character of input) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) throw new RangeError('无法确定输入码点');
    const length =
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;
    if (length > maxBytes) throw new RangeError('单个码点超过输入分片大小');
    if (bytes + length > maxBytes) {
      chunks.push(input.slice(start, offset));
      start = offset;
      bytes = 0;
    }
    bytes += length;
    offset += character.length;
  }
  if (offset > start) chunks.push(input.slice(start));
  return chunks;
}
