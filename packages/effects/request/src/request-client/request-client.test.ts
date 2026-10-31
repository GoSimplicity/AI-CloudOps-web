import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RequestClient } from './request-client';

describe('requestClient', () => {
  let mock: MockAdapter;
  let requestClient: RequestClient;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    requestClient = new RequestClient();
  });

  afterEach(() => {
    mock.reset();
  });

  it('should successfully make a GET request', async () => {
    mock.onGet('test/url').reply(200, { data: 'response' });

    const response = await requestClient.get('test/url');

    expect(response.data).toEqual({ data: 'response' });
  });

  it('should successfully make a POST request', async () => {
    const postData = { key: 'value' };
    const mockData = { data: 'response' };
    mock.onPost('/test/post', postData).reply(200, mockData);
    const response = await requestClient.post('/test/post', postData);
    expect(response.data).toEqual(mockData);
  });

  it('should successfully make a PUT request', async () => {
    const putData = { key: 'updatedValue' };
    const mockData = { data: 'updated response' };
    mock.onPut('/test/put', putData).reply(200, mockData);
    const response = await requestClient.put('/test/put', putData);
    expect(response.data).toEqual(mockData);
  });

  it('should successfully make a DELETE request', async () => {
    const mockData = { data: 'delete response' };
    mock.onDelete('/test/delete').reply(200, mockData);
    const response = await requestClient.delete('/test/delete');
    expect(response.data).toEqual(mockData);
  });

  it.each([403, 404])(
    'preserves HTTP %s and business payload without request credentials',
    async (status) => {
      const payload = { code: status, message: 'session denied' };
      mock.onPost('/assistant/query').reply(status, payload);
      const error = await requestClient
        .post(
          '/assistant/query',
          {},
          { headers: { Authorization: 'credential fixture' } },
        )
        .catch((error) => error);
      expect(error).toEqual(payload);
      expect(error.response).toEqual({
        data: payload,
        status,
        statusText: undefined,
      });
      expect(error.response).not.toHaveProperty('config');
      expect(JSON.stringify(error)).not.toContain('credential fixture');
    },
  );

  it('retains status for a text HTTP failure', async () => {
    mock.onGet('/plain-error').reply(503, 'temporarily unavailable');
    const error = await requestClient
      .get('/plain-error')
      .catch((error) => error);
    expect(error.message).toBe('temporarily unavailable');
    expect(error.response.status).toBe(503);
  });

  it('should handle network errors', async () => {
    mock.onGet('/test/error').networkError();
    try {
      await requestClient.get('/test/error');
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.isAxiosError).toBe(true);
      expect(error.message).toBe('Network Error');
    }
  });

  it('should handle timeout', async () => {
    mock.onGet('/test/timeout').timeout();
    try {
      await requestClient.get('/test/timeout');
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.isAxiosError).toBe(true);
      expect(error.code).toBe('ECONNABORTED');
    }
  });

  it('should successfully upload a file', async () => {
    const fileData = new Blob(['file contents'], { type: 'text/plain' });

    mock.onPost('/test/upload').reply((config) => {
      return config.data instanceof FormData && config.data.has('file')
        ? [200, { data: 'file uploaded' }]
        : [400, { error: 'Bad Request' }];
    });

    const response = await requestClient.upload('/test/upload', fileData);
    expect(response.data).toEqual({ data: 'file uploaded' });
  });

  it('should successfully download a file as a blob', async () => {
    const mockFileContent = new Blob(['mock file content'], {
      type: 'text/plain',
    });

    mock.onGet('/test/download').reply(200, mockFileContent);

    const res = await requestClient.download('/test/download');

    expect(res.data).toBeInstanceOf(Blob);
  });
});

describe('请求错误标记保留', () => {
  it('已确认的Symbol描述符保持，不附带请求凭据', async () => {
    const marker = Symbol('notice-fixture');
    const failure = { response: { data: { code: 403 }, status: 403 } };
    Object.defineProperty(failure, marker, { value: true });
    const client = new RequestClient();
    client.addResponseInterceptor({
      rejected() {
        throw failure;
      },
    });
    const adapter = new MockAdapter(axios);
    try {
      adapter.onGet('/notice-fixture').reply(403);
      const error: unknown = await client
        .get('/notice-fixture')
        .catch((error: unknown) => error);
      if (error === null || typeof error !== 'object')
        throw new Error('Expected request failure');
      expect(Object.getOwnPropertyDescriptor(error, marker)).toMatchObject({
        enumerable: false,
        value: true,
      });
      expect(error).toMatchObject({ response: { status: 403 } });
    } finally {
      adapter.restore();
    }
  });

  it('无法确认的Symbol描述符以静态错误拒绝，不返回原始请求或响应内容', async () => {
    const marker = Symbol('notice-fixture');
    const privateMarker = 'fixture-private-response';
    const failure = new Proxy(
      { response: { data: { privateMarker }, status: 403 } },
      {
        getOwnPropertyDescriptor(): undefined {
          // 模拟枚举后无法确认属性描述符。
        },
        ownKeys: () => [marker],
      },
    );
    const client = new RequestClient();
    client.addResponseInterceptor({
      rejected() {
        throw failure;
      },
    });
    const adapter = new MockAdapter(axios);
    try {
      adapter.onGet('/notice-fixture').reply(403);
      const error: unknown = await client
        .get('/notice-fixture')
        .catch((error: unknown) => error);
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error))
        throw new Error('Expected static request error');
      expect(error.message).toBe('请求错误标记不可确认');
      expect(error.message).not.toContain(privateMarker);
    } finally {
      adapter.restore();
    }
  });
});
