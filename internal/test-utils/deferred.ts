/** Control a native promise in tests without requiring Promise.withResolvers. */
export function createDeferred<T>() {
  let resolve: (value: PromiseLike<T> | T) => void = () => {
    throw new Error('Promise executor did not initialize resolve');
  };
  let reject: (reason?: unknown) => void = () => {
    throw new Error('Promise executor did not initialize reject');
  };
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}
