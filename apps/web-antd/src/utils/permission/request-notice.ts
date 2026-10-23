/**
 * 页面 catch 的统一提示口径（FE-02b）
 *
 * 请求层（api/request.ts）已负责的提示：
 * - 403：统一「没有权限」提示（forbidden.ts）；
 * - 业务错误（HTTP 200 + code≠0）：弹后端原文一条（business-error.ts）；
 * - 带 response 的 HTTP 错误（4xx/5xx）：通用错误拦截器按固定 key 弹一条；
 * - 发出了请求但没有响应的 axios 错误（网络错误 / 超时，含 ECONNABORTED、ETIMEDOUT）：同上。
 * 取消类（axios 取消、账户切换取消旧请求 RequestOwnerChangedError）请求层不提示，页面也静默。
 *
 * 页面 catch 写法：`if (shouldNotifyPageError(error)) message.error('xxx失败')`
 */
import { RequestOwnerChangedError } from '@vben/request';

import axios from 'axios';

import { isPermissionDeniedError } from './forbidden';

/** 取消的请求：axios 取消（CanceledError / isCancel）与 RequestOwnerChangedError（继承 CanceledError） */
export const isCanceledRequest = (error: any): boolean =>
  axios.isCancel(error) || error instanceof RequestOwnerChangedError;

/**
 * 请求层已提示过的错误：403 / 已提示的业务错误（isPermissionDeniedError）、带 response 的 HTTP 错误、
 * 发出了请求但没有响应的 axios 错误（复审 v4 P3-3）。取消的请求不算已提示（见 isCanceledRequest）
 */
export const isNotifiedByRequestLayer = (error: any): boolean =>
  isPermissionDeniedError(error) ||
  !!error?.response ||
  (axios.isAxiosError(error) && !!error.request && !axios.isCancel(error));

/** 页面 catch 是否还要自己弹提示：取消类静默，请求层已提示的不再叠加 */
export const shouldNotifyPageError = (error: any): boolean =>
  !isCanceledRequest(error) && !isNotifiedByRequestLayer(error);
