/**
 * HTTP 错误的通用提示文案（FE-02b incr3 P2-1：409 / 429 文案收口为一个常量）
 * - 请求层（api/request.ts resolveHttpErrorMessage）与页面（如 SEC-26 autofix 的 409「状态已变」）共用，
 *   避免同一个 409 在不同位置出现两种说法；
 * - 现行文案为暂定，最终措辞由面包拍板（见 pr-notes-fe02b.md 面包早间待批清单）。
 */
export const HTTP_CONFLICT_MESSAGE = '数据已变化，请刷新后重试';
export const HTTP_TOO_MANY_REQUESTS_MESSAGE = '请求过于频繁，请稍后重试';
