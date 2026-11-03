/** Fail before an incomplete fixture can be used; never include its value. */
export function requireFixtureValue<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Required fixture value is unavailable');
  }
  return value;
}
