import { nextTick } from 'vue';

import { mount } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FieldConfig from './FieldConfig.vue';

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('测试前置条件缺失');
  }
  return value;
}

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addListener: vi.fn(),
      matches: false,
      removeListener: vi.fn(),
    })),
  );
});

describe('字段配置快照', () => {
  it('改成文本字段后仍保留 options 和 default 的 undefined，且不与源字段共用', async () => {
    const wrapper = mount(FieldConfig, {
      global: { plugins: [Antd] },
      props: {
        field: {
          default: '',
          label: '下拉1',
          name: 'select_field_1',
          options: ['选项1', '选项2'],
          required: 0,
          type: 'select',
        },
      },
    });
    const state = (
      wrapper.vm as unknown as { $: { setupState: Record<string, any> } }
    ).$.setupState;
    state.handleTypeChange('text');
    await nextTick();
    const textField = required(wrapper.emitted('update')?.at(-1)?.[0]) as {
      default?: unknown;
      label: string;
      options?: unknown;
    };
    expect('options' in textField).toBe(true);
    expect(textField.options).toBeUndefined();
    expect(textField.default).toBe('');

    state.handleTypeChange('date');
    await nextTick();
    const dateField = required(wrapper.emitted('update')?.at(-1)?.[0]) as {
      default?: unknown;
      label: string;
    };
    expect('default' in dateField).toBe(true);
    expect(dateField.default).toBeUndefined();
    const live = state.localField.value ?? state.localField;
    live.label = '泄漏';
    expect(dateField.label).toBe('下拉1');
  });
});
