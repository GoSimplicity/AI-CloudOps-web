import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import OpsPage from './OpsPage.vue';

describe('运维列表页面骨架', () => {
  it('提供唯一标题和按任务顺序排列的操作、摘要、筛选、正文', () => {
    const wrapper = mount(OpsPage, {
      props: { title: '角色管理', description: '维护角色权限' },
      slots: {
        actions: '<button>新建角色</button>',
        summary: '<p>本页角色数 2</p>',
        filters: '<input aria-label="搜索角色" />',
        default: '<table aria-label="角色列表" />',
      },
    });
    expect(wrapper.get('section').attributes('aria-label')).toBe('角色管理');
    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.get('h1').text()).toBe('角色管理');
    expect(
      [...wrapper.element.children].map((child) => child.className),
    ).toEqual([
      'ops-page__header',
      'ops-page__summary',
      'ops-page__filters',
      'ops-page__content',
    ]);
  });

  it('没有可选插槽时省略空的操作和面板', () => {
    const wrapper = mount(OpsPage, {
      props: { title: '列表' },
      slots: { default: '暂无数据' },
    });
    expect(wrapper.find('.ops-page__actions').exists()).toBe(false);
    expect(wrapper.find('.ops-page__summary').exists()).toBe(false);
    expect(wrapper.find('.ops-page__filters').exists()).toBe(false);
    expect(wrapper.get('.ops-page__content').text()).toBe('暂无数据');
  });
});
