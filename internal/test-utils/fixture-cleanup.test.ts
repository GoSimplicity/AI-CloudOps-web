import { describe, expect, it, vi } from 'vitest';

import { withFixtureCleanup } from './fixture-cleanup';

describe('owned fixture cleanup', () => {
  it('waits for verification before cleanup and resolves after cleanup', async () => {
    const events: string[] = [];
    await withFixtureCleanup(
      async () => {
        events.push('verification');
        await Promise.resolve();
        events.push('verified');
      },
      async () => {
        events.push('cleanup');
        await Promise.resolve();
        events.push('cleaned');
      },
    );
    expect(events).toEqual(['verification', 'verified', 'cleanup', 'cleaned']);
  });

  it('cleans partial setup and preserves the original verification failure', async () => {
    const original = new Error('Verification failed');
    const cleanup = vi.fn(async () => {});
    await expect(
      withFixtureCleanup(async () => {
        throw original;
      }, cleanup),
    ).rejects.toBe(original);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledWith();
  });

  it('reports cleanup failure after successful verification', async () => {
    const failure = new Error('Cleanup failed');
    await expect(
      withFixtureCleanup(
        async () => {},
        async () => {
          throw failure;
        },
      ),
    ).rejects.toBe(failure);
  });

  it('preserves both failures in verification then cleanup order', async () => {
    const original = new Error('Verification failed');
    const cleanupFailure = new Error('Cleanup failed');
    const result = withFixtureCleanup(
      async () => {
        throw original;
      },
      async () => {
        throw cleanupFailure;
      },
    );
    await expect(result).rejects.toBeInstanceOf(AggregateError);
    await expect(result).rejects.toHaveProperty('errors', [
      original,
      cleanupFailure,
    ]);
  });

  it.each([undefined, null, false, 0, ''])(
    'preserves falsy thrown values: %s',
    async (value) => {
      const cleanup = vi.fn(async () => {});
      await expect(
        withFixtureCleanup(async () => {
          throw value;
        }, cleanup),
      ).rejects.toBe(value);
      expect(cleanup).toHaveBeenCalledOnce();
    },
  );

  it.each([undefined, null])(
    'keeps a nullish verification failure when cleanup also fails: %s',
    async (value) => {
      const cleanupFailure = new Error('Cleanup failed');
      await expect(
        withFixtureCleanup(
          async () => {
            throw value;
          },
          async () => {
            throw cleanupFailure;
          },
        ),
      ).rejects.toHaveProperty('errors', [value, cleanupFailure]);
    },
  );
});
