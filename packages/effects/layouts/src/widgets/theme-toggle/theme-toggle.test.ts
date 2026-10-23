import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ThemeToggle from './theme-toggle.vue';

const updatePreferences = vi.hoisted(() => vi.fn());
vi.mock('@vben/preferences', () => ({
  preferences: { theme: { mode: 'light' } },
  updatePreferences,
}));
vi.mock('@vben/locales', () => ({
  $t: (key: string) =>
    ({
      'preferences.theme.light': '浅色',
      'preferences.theme.dark': '深色',
      'preferences.followSystem': '跟随系统',
    })[key] || key,
}));

describe('主题控件可见性和交互', () => {
  beforeEach(() => vi.clearAllMocks());

  it('直接渲染三种带名称的主题控件，点击深色保存偏好', async () => {
    const wrapper = mount(ThemeToggle);
    expect(wrapper.findAll('button')).toHaveLength(3);
    expect(wrapper.get('[aria-label="浅色"]').isVisible()).toBe(true);
    await wrapper.get('[aria-label="深色"]').trigger('click');
    expect(updatePreferences).toHaveBeenCalledWith({ theme: { mode: 'dark' } });
    wrapper.unmount();
  });
});
