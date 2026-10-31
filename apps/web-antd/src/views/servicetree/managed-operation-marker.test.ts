import { beforeEach, expect, it } from 'vitest';
import {
  parseManagedMarker,
  removeManagedMarker,
  saveManagedMarker,
} from './managed-operation-marker';

const marker = {
  version: 2 as const,
  operation_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  resource_ids: ['rm-one'],
};
beforeEach(() => localStorage.clear());
it('只保存并恢复有界合法操作指针', () => {
  expect(saveManagedMarker(localStorage, 'scope', marker)).toBe(true);
  expect(parseManagedMarker(localStorage.getItem('scope'))).toEqual(marker);
  expect(parseManagedMarker('pending')).toBeNull();
  expect(
    parseManagedMarker(
      JSON.stringify({ ...marker, resource_ids: ['rm-one', 'rm-one'] }),
    ),
  ).toBeNull();
});
it('不覆盖旧标记，不移除其他操作', () => {
  localStorage.setItem('scope', 'pending');
  expect(saveManagedMarker(localStorage, 'scope', marker)).toBe(false);
  localStorage.setItem('scope', JSON.stringify(marker));
  expect(
    removeManagedMarker(
      localStorage,
      'scope',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ),
  ).toBe(false);
  expect(localStorage.getItem('scope')).not.toBeNull();
  expect(removeManagedMarker(localStorage, 'scope', marker.operation_id)).toBe(
    true,
  );
});
