import { describe, expect, it, vi } from 'vitest';

import { getOwnLookupValue } from './own-lookup';

describe('getOwnLookupValue', () => {
  it.each([
    ['online', 'green'],
    ['offline', 'red'],
    ['missing', undefined],
    ['constructor', undefined],
    ['__proto__', undefined],
    ['toString', undefined],
    ['hasOwnProperty', undefined],
  ])('only returns owned dictionary values for %s', (key, expected) => {
    const dictionary = { offline: 'red', online: 'green' };
    expect(getOwnLookupValue(dictionary, key)).toBe(expected);
  });

  it('never executes an inherited getter or reveals key insertion order', () => {
    const getter = vi.fn(function (this: object) {
      return Object.keys(this)[0];
    });
    const prototype = Object.defineProperty({}, 'inherited', { get: getter });
    const before: Record<string, string> = {};
    before.zebra = 'last';
    before.alpha = 'first';
    const after = { alpha: 'first', zebra: 'last' };
    Object.setPrototypeOf(before, prototype);
    Object.setPrototypeOf(after, prototype);

    expect(getOwnLookupValue(before, 'inherited')).toBeUndefined();
    expect(getOwnLookupValue(after, 'inherited')).toBeUndefined();
    expect(getter).not.toHaveBeenCalled();
    expect(getOwnLookupValue(before, 'alpha')).toBe('first');
    expect(getOwnLookupValue(after, 'alpha')).toBe('first');
  });

  it('preserves own zero, false and empty values and keeps caller fallback lazy', () => {
    const dictionary = { empty: '', flag: false, zero: 0 };
    const fallback = vi.fn(() => 'fallback');

    expect(getOwnLookupValue(dictionary, 'zero')).toBe(0);
    expect(getOwnLookupValue(dictionary, 'flag')).toBe(false);
    expect(getOwnLookupValue(dictionary, 'empty')).toBe('');
    expect(getOwnLookupValue(dictionary, 'missing') || fallback()).toBe(
      'fallback',
    );
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(getOwnLookupValue({ ready: 'ready' }, 'ready') || fallback()).toBe(
      'ready',
    );
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(getOwnLookupValue(dictionary, 'zero') || 'fallback').toBe(
      'fallback',
    );
    expect(getOwnLookupValue(dictionary, 'flag') || 'fallback').toBe(
      'fallback',
    );
  });

  it('supports numeric zero and owned names that shadow prototype methods', () => {
    expect(getOwnLookupValue({ 0: 'zero' }, 0)).toBe('zero');
    expect(getOwnLookupValue({ 0: 'zero' }, '0')).toBe('zero');
    expect(getOwnLookupValue({ constructor: 'own' }, 'constructor')).toBe(
      'own',
    );
    expect(getOwnLookupValue({ hasOwnProperty: 'own' }, 'hasOwnProperty')).toBe(
      'own',
    );
  });
});
