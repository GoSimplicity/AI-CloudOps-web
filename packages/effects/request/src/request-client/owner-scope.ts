import { type AxiosRequestConfig, CanceledError } from 'axios';
import type { ResponseInterceptorConfig } from './types';

export interface RequestOwnerContext {
  uid: string;
  generation: number;
  authenticated: boolean;
}
type OwnedRequest = AxiosRequestConfig & {
  __requestOwner?: RequestOwnerContext;
};

export class RequestOwnerChangedError extends CanceledError<unknown> {
  constructor() {
    super('账户已变化，已取消旧请求');
  }
}

/** 只记录 UID 与登录代际，不记录令牌，普通令牌轮换不改变归属 */
export function createRequestOwnerScope(current: () => RequestOwnerContext) {
  const capture = () => ({ ...current() });
  const assert = (expected: RequestOwnerContext) => {
    const actual = current();
    // 登录初始化时资料尚未到达，同一代际允许空 UID 收敛到服务端 UID
    if (
      expected.generation !== actual.generation ||
      expected.authenticated !== actual.authenticated ||
      (expected.uid && expected.uid !== actual.uid)
    ) {
      throw new RequestOwnerChangedError();
    }
  };
  const assertRequest = (config?: AxiosRequestConfig) => {
    const expected = (config as OwnedRequest | undefined)?.__requestOwner;
    if (!expected) throw new RequestOwnerChangedError();
    assert(expected);
  };
  const bindRequest = <T extends AxiosRequestConfig>(config: T): T => {
    const owned = config as OwnedRequest;
    if (owned.__requestOwner) assertRequest(config);
    else owned.__requestOwner = capture();
    return config;
  };
  const response: ResponseInterceptorConfig = {
    fulfilled: (value) => {
      assertRequest(value.config);
      return value;
    },
    rejected: (error) => {
      if (error?.config) assertRequest(error.config);
      throw error;
    },
  };
  return {
    capture,
    assert,
    assertRequest,
    bindRequest,
    response,
    canRefresh(config: AxiosRequestConfig) {
      assertRequest(config);
      return !!(config as OwnedRequest).__requestOwner?.authenticated;
    },
    refreshKey(config: AxiosRequestConfig) {
      assertRequest(config);
      const expected = (config as OwnedRequest).__requestOwner!;
      return JSON.stringify([
        expected.generation,
        expected.uid || current().uid,
        expected.authenticated,
      ]);
    },
  };
}
export type RequestOwnerScope = ReturnType<typeof createRequestOwnerScope>;
