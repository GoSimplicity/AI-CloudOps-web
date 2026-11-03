// @vitest-environment node

import { expect, it } from 'vitest';

import { isBasicNotificationEmail } from './notification-email';

it.each([
  ['alice@example.com', true],
  [' user+tag@example.co.uk ', true],
  ['\tuser@example.com\n', true],
  ['用户@例子.测试', true],
  ['user@a..', true],
  ['user@..a', true],
  ['', false],
  ['user', false],
  ['@example.com', false],
  ['user@.a', false],
  ['user@a.', false],
  ['user@@example.com', false],
  ['user@a.b c', false],
  ['first last@example.com', false],
  ['user@a.\u00A0b', false],
])('keeps the existing basic result for %s', (value, valid) => {
  expect(isBasicNotificationEmail(value)).toBe(valid);
});
