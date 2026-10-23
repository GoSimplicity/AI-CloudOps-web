import { mount } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { createPinia, setActivePinia } from 'pinia';
import { useAccessStore, useUserStore } from '@vben/stores';
import { defineComponent, nextTick } from 'vue';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  PERMISSION_CODES,
  type PermissionKey,
} from '#/constants/permission-codes';
import { getPermissionCode, usePermission } from '#/utils/permission';
import ApprovalPanel from '#/views/autofix/ApprovalPanel.vue';

const ALL_KEYS = Object.keys(PERMISSION_CODES) as PermissionKey[];

function mountPanel() {
  return mount(ApprovalPanel, {
    props: {
      actions: [],
      selected: [],
      busy: false,
      canConfirm: true,
      issue: '',
    },
    global: { plugins: [Antd] },
  });
}

function confirmButton(wrapper: ReturnType<typeof mountPanel>) {
  return wrapper
    .findAll('button')
    .find((button) => button.text().includes('确认并继续执行'));
}

/** 与页面相同的写法：每个按钮 key 一个 v-if="can(key)" 的按钮 */
const AllDangerButtons = defineComponent({
  setup() {
    const { can } = usePermission();
    return { can, keys: ALL_KEYS };
  },
  template: `<div>
    <template v-for="key in keys" :key="key">
      <a-button v-if="can(key)" :data-key="key">{{ key }}</a-button>
    </template>
  </div>`,
});

function mountAll() {
  return mount(AllDangerButtons, { global: { plugins: [Antd] } });
}

describe('危险按钮按权限渲染', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useUserStore().setUserInfo({ roles: ['ops'], username: 'ops' } as any);
  });

  it('普通账号无权限码时按钮不渲染', () => {
    useAccessStore().setAccessCodes([]);
    expect(confirmButton(mountPanel())).toBeUndefined();
    expect(mountAll().findAll('button')).toHaveLength(0);
  });

  it('有对应权限码时只渲染对应按钮，且可触发事件', async () => {
    useAccessStore().setAccessCodes([
      getPermissionCode('aiops.autofix.confirm'),
    ]);
    const wrapper = mountPanel();
    const button = confirmButton(wrapper);
    expect(button).toBeDefined();
    await button!.trigger('click');
    expect(wrapper.emitted('confirm')).toHaveLength(1);

    const keys = mountAll()
      .findAll('button')
      .map((item) => item.attributes('data-key'));
    expect(keys).toEqual(['aiops.autofix.confirm']);
  });

  it('同一权限码的多个按钮（单删/批量删）一起出现', () => {
    useAccessStore().setAccessCodes([getPermissionCode('k8s.pod.delete')]);
    const keys = mountAll()
      .findAll('button')
      .map((item) => item.attributes('data-key'));
    expect(keys).toEqual(['k8s.pod.delete', 'k8s.pod.batchDelete']);
  });

  it.each([
    ['admin 角色', { roles: ['admin'], username: 'zhangsan' }],
    ['admin 用户名', { username: 'admin' }],
  ])('%s + codes 为空时按钮全部显示', (_, userInfo) => {
    useAccessStore().setAccessCodes([]);
    useUserStore().setUserInfo(userInfo as any);
    expect(confirmButton(mountPanel())).toBeDefined();
    expect(mountAll().findAll('button')).toHaveLength(ALL_KEYS.length);
  });

  it('权限码变化后按钮随之出现', async () => {
    useAccessStore().setAccessCodes([]);
    const wrapper = mountPanel();
    expect(confirmButton(wrapper)).toBeUndefined();
    useAccessStore().setAccessCodes([
      getPermissionCode('aiops.autofix.confirm'),
    ]);
    await nextTick();
    expect(confirmButton(wrapper)).toBeDefined();
  });
});
