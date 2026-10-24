import { mount } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { createPinia, setActivePinia } from 'pinia';
import { useAccessStore, useUserStore } from '@vben/stores';
import { defineComponent, nextTick } from 'vue';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  PERMISSION_CODES,
  type PermissionKey,
  SECRET_DETAIL_PERMISSION_CODE,
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

  it('admin 角色 + codes 为空时除 Secret 明文（显式授权，SEC-25/26）外按钮全部显示', () => {
    useAccessStore().setAccessCodes([]);
    useUserStore().setUserInfo({
      roles: ['admin'],
      username: 'zhangsan',
    } as any);
    expect(confirmButton(mountPanel())).toBeDefined();
    const keys = mountAll()
      .findAll('button')
      .map((item) => item.attributes('data-key'));
    expect(keys).toHaveLength(ALL_KEYS.length - 2);
    expect(keys).not.toContain('k8s.secret.viewPlain');
    expect(keys).not.toContain('k8s.secret.copyPlain');
  });

  it('admin 用户名 + codes 为空时按钮全部显示', () => {
    useAccessStore().setAccessCodes([]);
    useUserStore().setUserInfo({ username: 'admin' } as any);
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

/** 与 Secret.vue 相同的写法：详情入口 hasPerm(详情码)，详情内明文按钮 can(viewPlain / copyPlain) */
const SecretDetailLayer = defineComponent({
  setup() {
    const { can, hasPerm } = usePermission();
    return { can, hasPerm, detailCode: SECRET_DETAIL_PERMISSION_CODE };
  },
  template: `<div>
    <a-button v-if="hasPerm(detailCode)" data-key="detail">详情</a-button>
    <a-button v-if="can('k8s.secret.viewPlain')" data-key="view">查看</a-button>
    <a-button v-if="can('k8s.secret.copyPlain')" data-key="copy">复制</a-button>
  </div>`,
});

describe('Secret 详情与明文分层渲染（SEC-25/26 第 4 条）', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function rendered(userInfo: Record<string, unknown>, codes: string[]) {
    useUserStore().setUserInfo(userInfo as any);
    useAccessStore().setAccessCodes(codes);
    return mount(SecretDetailLayer, { global: { plugins: [Antd] } })
      .findAll('button')
      .map((item) => item.attributes('data-key'));
  }

  const OPS = { roles: ['ops'], username: 'ops' };
  const REVEAL = PERMISSION_CODES['k8s.secret.viewPlain'];

  it.each([
    ['只有详情码', OPS, [SECRET_DETAIL_PERMISSION_CODE], ['detail']],
    [
      '详情码 + reveal 码',
      OPS,
      [SECRET_DETAIL_PERMISSION_CODE, REVEAL],
      ['detail', 'view', 'copy'],
    ],
    ['只有 reveal 码', OPS, [REVEAL], ['view', 'copy']],
    ['两者都没有', OPS, [], []],
    ['通配码（详情按旧规则放行，reveal 不认通配）', OPS, ['*'], ['detail']],
    [
      'admin 角色 + 空码（详情按旧规则放行）',
      { roles: ['admin'], username: 'zhangsan' },
      [],
      ['detail'],
    ],
    [
      'super 角色 + 空码',
      { roles: ['super'], username: 'lisi' },
      [],
      ['detail'],
    ],
    [
      '用户名 admin + 空码（auth.go:170）',
      { username: 'admin' },
      [],
      ['detail', 'view', 'copy'],
    ],
  ])('%s', (_, userInfo, codes, expected) => {
    expect(rendered(userInfo, codes as string[])).toEqual(expected);
  });
});
