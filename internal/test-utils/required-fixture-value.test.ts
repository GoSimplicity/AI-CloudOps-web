import { describe, expect, it } from 'vitest';

import { requireFixtureValue } from './required-fixture-value';

describe('required fixture value', () => {
  it.each([null, undefined])('rejects absent values: %s', (value) => {
    expect(() => requireFixtureValue(value)).toThrow(
      'Required fixture value is unavailable',
    );
  });

  it.each([0, false, '', Number.NaN])(
    'preserves present falsy values: %s',
    (value) => {
      expect(requireFixtureValue(value)).toBe(value);
    },
  );

  it('preserves object identity without inspecting fixture fields', () => {
    const value = Object.defineProperty({}, 'privateValue', {
      get() {
        throw new Error('Fixture properties must not be read');
      },
    });
    expect(requireFixtureValue(value)).toBe(value);
  });
});
