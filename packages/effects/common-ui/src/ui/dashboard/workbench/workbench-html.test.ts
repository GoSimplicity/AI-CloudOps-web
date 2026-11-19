import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import WorkbenchTodo from './workbench-todo.vue';
import WorkbenchTrends from './workbench-trends.vue';

const attack = [
  '第一行\n第二行',
  '<script>alert(1)</script>',
  '<img src="x" onerror="alert(1)" alt="图">',
  '<a href="javascript:alert(1)" onclick="alert(1)" style="position:fixed;inset:0">待办</a>',
].join('');

function expectSafe(html: string) {
  expect(html).not.toContain('<script');
  expect(html).not.toContain('javascript:');
  expect(html).not.toContain('onerror');
  expect(html).not.toContain('onclick');
  expect(html).not.toContain('style=');
  expect(html).toContain('第一行');
  expect(html).toContain('第二行');
  expect(html).toContain('待办');
  expect(html).toMatch(/第一行<br\s*\/?>\s*第二行/);
}

describe('工作台 html 内容', () => {
  it('待办和动态在接入前也净化脚本、事件、javascript 链接和 style', () => {
    const todo = mount(WorkbenchTodo, {
      props: {
        title: '待办',
        items: [
          {
            completed: false,
            content: attack,
            date: '今天',
            title: '待办标题',
          },
        ],
      },
    });
    const trends = mount(WorkbenchTrends, {
      props: {
        title: '动态',
        items: [
          {
            avatar: 'lucide:user',
            content: attack,
            date: '今天',
            title: '动态标题',
          },
        ],
      },
    });
    expectSafe(todo.get('.min-w-0.flex-auto p.text-xs').html());
    expectSafe(trends.get('.min-w-0.flex-auto p.text-xs').html());
    expect(todo.text()).toContain('待办标题');
    expect(trends.text()).toContain('动态标题');
  });
});
