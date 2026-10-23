import { message } from 'ant-design-vue';

import {
  claimHttpErrorNotice,
  getHttpErrorNoticeKey,
  markHttpErrorNoticeReplaced,
} from '#/api/http-error-notice';
import { isBusinessError } from '#/utils/permission/business-error';
import {
  isPermissionDeniedError,
  PERMISSION_DENIED_MESSAGE,
} from '#/utils/permission/forbidden';

/**
 * SEC-25/26 规则 3/4：autofix 错误提示只按 HTTP 状态分类。
 * - 不读 error_code、不透出后端 message，文案里也不写错误码（AUTOFIX_INTERNAL_ERROR / 503 的目标口径在
 *   mantou sec33 线上，现状 aiops 多数异常仍是 409 / 502，见合同草案 c.4/c.5）。
 * - 每个错误只一条提示：请求层已弹过的，复用它的 key 替换为具体文案（http-error:），
 *   403（permission-denied）与业务错误（business-error:）已提示过的不再弹；500 只保留请求层的通用错误。
 */
export const AUTOFIX_ERROR_TEXT = {
  conflict: '状态已变，请刷新',
  expired: '计划已失效，请重新生成',
  generic: '自动修复请求失败，请人工核对实际状态',
  invalid: '请求参数错误，请检查后重试',
  unavailable: '服务暂时不可用，请稍后重试',
} as const;

const FALLBACK_NOTICE_KEY_PREFIX = 'autofix-error:';

export interface AutoFixErrorDescription {
  text: string;
  /** 是否需要用具体文案替换 / 补充提示（false = 已有合适提示或只显示行内文案） */
  toast: boolean;
}

function statusOf(error: any): number | undefined {
  const status = error?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

export function describeAutoFixError(error: unknown): AutoFixErrorDescription {
  const status = statusOf(error);
  // 先判业务错误：isPermissionDeniedError 对「已提示的业务错误」也返回 true
  if (isBusinessError(error)) {
    return { text: AUTOFIX_ERROR_TEXT.generic, toast: false };
  }
  if (status === 403 || isPermissionDeniedError(error)) {
    return { text: PERMISSION_DENIED_MESSAGE, toast: false };
  }
  switch (status) {
    case 400:
    case 422: {
      return { text: AUTOFIX_ERROR_TEXT.invalid, toast: true };
    }
    case 404: {
      // 计划不存在 / 已过期 / 服务重启后内存中的审批丢失
      return { text: AUTOFIX_ERROR_TEXT.expired, toast: true };
    }
    case 409: {
      return { text: AUTOFIX_ERROR_TEXT.conflict, toast: true };
    }
    // 429（并发容量满）决策未列，按「稍后重试」处理（保守，见 PR 说明）
    case 429:
    case 502:
    case 503:
    case 504: {
      return { text: AUTOFIX_ERROR_TEXT.unavailable, toast: true };
    }
    default: {
      // 500 / 其它 / 网络错误：只给通用错误，请求层已弹通用提示
      return { text: AUTOFIX_ERROR_TEXT.generic, toast: false };
    }
  }
}

/** 返回行内文案；必要时以请求层同一个 key 替换提示，保证一个错误只一条 */
export function reportAutoFixError(error: unknown): string {
  const { text, toast } = describeAutoFixError(error);
  if (toast) {
    if (getHttpErrorNoticeKey(error) === undefined) {
      // 请求层没提示过（例如被 mock 的接口）：页面补一条，同文案同 key 合并
      message.error({
        content: text,
        key: `${FALLBACK_NOTICE_KEY_PREFIX}${text}`,
      });
    } else {
      // 请求层已提示：只有这条提示确实归当前错误时才替换；被别的未处理错误共用 / 已关闭时
      // 不替换也不新增，具体文案只出现在行内（第 6 条）
      const key = claimHttpErrorNotice(error);
      if (key !== undefined) {
        markHttpErrorNoticeReplaced(
          error,
          message.error({ content: text, key }),
        );
      }
    }
  }
  return text;
}
