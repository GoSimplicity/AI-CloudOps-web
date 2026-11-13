import { reactive } from 'vue';

import { describe, expect, it } from 'vitest';

import { copyPlainSnapshot } from './copy-plain-snapshot';

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('测试前置条件缺失');
  }
  return value;
}

describe('工单快照复制', () => {
  it('保留无选项字段的 undefined，并与源对象断开', () => {
    const source = {
      default: undefined,
      label: '文本框1',
      name: 'text_field_1',
      options: undefined,
      required: 0,
      type: 'text',
    };
    const snapshot = copyPlainSnapshot(source);
    source.label = '已改';

    expect(snapshot).not.toBe(source);
    expect('options' in snapshot).toBe(true);
    expect(snapshot.options).toBeUndefined();
    expect(snapshot.default).toBeUndefined();
    expect(snapshot.label).toBe('文本框1');
  });

  it('解开响应式代理，后续修改不影响快照', () => {
    const source = reactive({
      steps: [{ id: 's', name: '开始', when: undefined }],
    });
    const snapshot = copyPlainSnapshot(source);
    const sourceStep = required(source.steps[0]);
    sourceStep.name = '改过';
    const snapshotStep = required(snapshot.steps[0]);

    expect(snapshotStep).not.toBe(sourceStep);
    expect(snapshotStep.name).toBe('开始');
    expect(snapshotStep.when).toBeUndefined();
  });

  it('日期和带 toJSON 的值收成字符串，函数不进入快照', () => {
    const when = new Date('2020-01-02T03:04:05.000Z');
    const mark = () => 'secret';
    const snapshot = copyPlainSnapshot({
      mark,
      note: {
        toJSON: () => '2020-01-02T03:04:05.000Z',
      },
      when,
    });

    expect(snapshot.when).toBe('2020-01-02T03:04:05.000Z');
    expect(snapshot.note).toBe('2020-01-02T03:04:05.000Z');
    expect('mark' in snapshot).toBe(false);
  });

  it('数组空位保持 undefined，不用 null 顶上', () => {
    expect(copyPlainSnapshot([undefined, '选项1'])).toEqual([
      undefined,
      '选项1',
    ]);
  });

  it('自有 __proto__ 仍是数据属性，不改变快照继承', () => {
    const source = JSON.parse('{"type":"text","__proto__":{"required":1}}') as {
      required?: number;
      type: string;
    };
    const snapshot = copyPlainSnapshot(source);
    const ownProto = Object.getOwnPropertyDescriptor(snapshot, '__proto__');

    expect(Object.hasOwn(source, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
    expect(ownProto).toMatchObject({
      configurable: true,
      enumerable: true,
      writable: true,
    });
    expect(ownProto?.value).toEqual({ required: 1 });
    expect(Object.hasOwn(snapshot, 'required')).toBe(false);
    expect(snapshot.required).toBeUndefined();
    expect(JSON.stringify(snapshot)).toContain('"__proto__":{"required":1}');
    expect(Object.prototype).not.toHaveProperty('required');
  });

  it('循环引用拒绝复制，而不是无限展开', () => {
    const source: { self?: unknown } = {};
    source.self = source;
    expect(() => copyPlainSnapshot(source)).toThrow('不能复制循环引用');
  });
});
