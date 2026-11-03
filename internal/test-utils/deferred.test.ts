// @vitest-environment node

import { expect, it, vi } from 'vitest';

import { createDeferred } from './deferred';

it('resolves asynchronously and preserves the first settlement', async () => {
  const deferred = createDeferred<number>();
  const settled = vi.fn();
  deferred.promise.then(settled);
  deferred.resolve(7);
  deferred.reject(new Error('ignored after resolution'));
  expect(settled).not.toHaveBeenCalled();
  await expect(deferred.promise).resolves.toBe(7);
  expect(settled).toHaveBeenCalledTimes(1);
  expect(settled).toHaveBeenCalledWith(7);
});

it('assimilates a promise value', async () => {
  const deferred = createDeferred<string>();
  deferred.resolve(Promise.resolve('ready'));
  await expect(deferred.promise).resolves.toBe('ready');
});

it('preserves rejection identity', async () => {
  const deferred = createDeferred<never>();
  const failure = new Error('owned fixture failure');
  const result = expect(deferred.promise).rejects.toBe(failure);
  deferred.reject(failure);
  await result;
});

it('works when the newer static method is unavailable', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(Promise, 'withResolvers');
  try {
    Object.defineProperty(Promise, 'withResolvers', {
      configurable: true,
      value: undefined,
    });
    const deferred = createDeferred<number>();
    deferred.resolve(11);
    await expect(deferred.promise).resolves.toBe(11);
  } finally {
    if (descriptor) Object.defineProperty(Promise, 'withResolvers', descriptor);
    else Reflect.deleteProperty(Promise, 'withResolvers');
  }
});
