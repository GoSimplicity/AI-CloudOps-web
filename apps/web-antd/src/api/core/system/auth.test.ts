import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('#/api/request', () => ({
  baseRequestClient: { post },
  requestClient: { post },
}));

import { refreshTokenApi } from './auth';

describe('刷新令牌响应契约', () => {
  beforeEach(() => vi.clearAllMocks());

  it('返回后端成功响应中的 access token', async () => {
    post.mockResolvedValue({
      data: { code: 0, data: 'fresh-token', message: 'success' },
    });
    await expect(refreshTokenApi({ refreshToken: 'refresh' })).resolves.toBe(
      'fresh-token',
    );
    expect(post).toHaveBeenCalledWith(
      '/user/refresh_token',
      { refreshToken: 'refresh' },
      { withCredentials: true },
    );
  });

  it.each([
    { code: 401, data: 'error-detail', message: 'expired' },
    { code: 0, data: '', message: 'success' },
    { code: 0, data: '  ', message: 'success' },
    { code: 0, data: null, message: 'success' },
  ])('拒绝业务失败和无效令牌 %j', async (data) => {
    post.mockResolvedValue({ data });
    await expect(refreshTokenApi({ refreshToken: 'refresh' })).rejects.toThrow(
      '刷新令牌失败',
    );
  });
});
