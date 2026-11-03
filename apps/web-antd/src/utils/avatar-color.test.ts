import { expect, it } from 'vitest';

import { getAvatarColor } from './avatar-color';

it.each([
  ['', '#1890ff'],
  ['Alice', '#1890ff'],
  ['Bob', '#13c2c2'],
  ['张三', '#52c41a'],
  ['🧑🏽‍💻', '#52c41a'],
  ['ação', '#faad14'],
  ['same-name', '#faad14'],
  ['A'.repeat(4096), '#1890ff'],
  ['\u0000', '#1890ff'],
])('preserves the existing color for %s', (name, color) => {
  expect(getAvatarColor(name)).toBe(color);
});
