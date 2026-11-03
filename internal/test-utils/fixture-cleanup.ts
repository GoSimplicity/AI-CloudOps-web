/** Always clean up owned fixtures without replacing a business failure. */
export async function withFixtureCleanup(
  run: () => Promise<void>,
  cleanup: () => Promise<void>,
): Promise<void> {
  let runFailure: { error: unknown } | undefined;
  try {
    await run();
  } catch (error) {
    runFailure = { error };
  }

  try {
    await cleanup();
  } catch (error) {
    if (runFailure) {
      throw new AggregateError(
        [runFailure.error, error],
        'Fixture verification and cleanup both failed',
      );
    }
    throw error;
  }

  if (runFailure) throw runFailure.error;
}
