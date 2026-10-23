import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Notification from './notification.vue';

vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('通知真实空态', () => {
  it('未接入通知源时无未读圆点，打开后显示说明并省略空操作', async () => {
    const wrapper = mount(Notification, {
      attachTo: document.body,
      props: { notifications: [], dot: false, emptyText: '通知源尚未接入' },
    });
    expect(wrapper.find('.bell-button .bg-primary').exists()).toBe(false);
    expect(wrapper.findAll('button')).toHaveLength(1);
    expect(wrapper.find('button button').exists()).toBe(false);
    await wrapper.get('[aria-label="widgets.notifications"]').trigger('click');
    await flushPromises();
    expect(document.body.textContent).toContain('通知源尚未接入');
    expect(document.body.textContent).not.toContain('widgets.viewAll');
    expect(document.querySelectorAll('li')).toHaveLength(0);
    wrapper.unmount();
  });
});
