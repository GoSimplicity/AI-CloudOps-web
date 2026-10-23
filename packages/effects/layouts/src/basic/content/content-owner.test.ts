import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import {
  defineComponent,
  h,
  onUnmounted,
  reactive,
  toRefs,
  nextTick,
} from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LayoutContent from './content.vue';

const state = vi.hoisted(() => ({
  user: null as any,
  access: null as any,
  tabs: null as any,
  keepAlive: true,
  mounts: [] as string[],
  unmounts: [] as string[],
}));
vi.mock('@vben/preferences', () => ({
  preferences: {
    tabbar: { enable: true },
    transition: { enable: false, name: '' },
  },
  usePreferences: () => ({ keepAlive: state.keepAlive }),
}));
vi.mock('@vben/stores', () => ({
  useTabbarStore: () => state.tabs,
  useUserStore: () => state.user,
  useAccessStore: () => state.access,
  storeToRefs: (store: object) => toRefs(store),
}));
vi.mock('../../iframe', () => ({
  IFrameRouterView: { template: '<span class="iframe-host">iframe</span>' },
}));
const page = (name: string) =>
  defineComponent({
    name,
    setup() {
      const owner = state.user.userInfo?.userId || 'anonymous';
      state.mounts.push(`${name}:${owner}`);
      onUnmounted(() => state.unmounts.push(`${name}:${owner}`));
      return () => h('div', { class: 'private-content' }, `private-${owner}`);
    },
  });
let wrapper: VueWrapper;
beforeEach(() => {
  state.keepAlive = true;
  state.user = reactive({ userInfo: { userId: '1' } });
  state.access = reactive({ accessToken: 'credential-one', isAccessChecked: true });
  state.tabs = reactive({
    getCachedTabs: ['OwnerPageA', 'OwnerPageB'],
    getExcludeCachedTabs: [],
    renderRouteView: true,
  });
  state.mounts = [];
  state.unmounts = [];
});
afterEach(() => wrapper?.unmount());
async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/a', name: 'OwnerPageA', component: page('OwnerPageA') },
      { path: '/b', name: 'OwnerPageB', component: page('OwnerPageB') },
    ],
  });
  await router.push('/a');
  await router.isReady();
  wrapper = mount(
    defineComponent({
      components: { LayoutContent },
      template: '<LayoutContent/><div role="dialog">登录弹窗外层保持</div>',
    }),
    { global: { plugins: [router] } },
  );
  await flushPromises();
  return router;
}
describe('页面与KeepAlive账户边界', () => {
  it.each([true, false])(
    'KeepAlive=%s换UID后只显示当前账户',
    async (cached) => {
      state.keepAlive = cached;
      const router = await render();
      await router.push('/b');
      await flushPromises();
      expect(state.mounts).toContain('OwnerPageA:1');
      state.user.userInfo = { userId: '2' };
      await nextTick();
      await flushPromises();
      expect(wrapper.find('.private-content').text()).toBe('private-2');
      expect(state.unmounts).toContain('OwnerPageA:1');
      expect(state.unmounts).toContain('OwnerPageB:1');
      await router.push('/a');
      await flushPromises();
      expect(wrapper.find('.private-content').text()).toBe('private-2');
    },
  );
  it('权限尚未重建时即使新UID已到达也不显示旧路由组件', async () => {
    await render();
    state.access.isAccessChecked = false;
    state.user.userInfo = { userId: '2' };
    await nextTick(); await flushPromises();
    expect(wrapper.find('.private-content').exists()).toBe(false);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    state.access.isAccessChecked = true;
    await nextTick(); await flushPromises();
    expect(wrapper.find('.private-content').text()).toBe('private-2');
    expect(state.unmounts).toContain('OwnerPageA:1');
  });
  it('UID缺失时清空缓存和iframe，登录弹窗不被隐藏', async () => {
    await render();
    state.user.userInfo = null;
    await nextTick();
    await flushPromises();
    expect(wrapper.find('.private-content').exists()).toBe(false);
    expect(wrapper.find('.iframe-host').exists()).toBe(false);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(state.unmounts).toContain('OwnerPageA:1');
  });
  it('同一tick退出再登录也清除旧页面实例', async () => {
    await render();
    state.user.userInfo = null;
    state.user.userInfo = { userId: '1' };
    await nextTick();
    await flushPromises();
    expect(state.unmounts).toContain('OwnerPageA:1');
    expect(state.mounts).toEqual(['OwnerPageA:1', 'OwnerPageA:1']);
  });
  it('未认证不挂载业务页面，普通token刷新不会重建同UID页面', async () => {
    state.access.accessToken = '';
    await render();
    expect(state.mounts).toHaveLength(0);
    state.access.accessToken = 'credential-one';
    await nextTick();
    await flushPromises();
    expect(state.mounts).toEqual(['OwnerPageA:1']);
    state.access.accessToken = 'fresh-one';
    await nextTick();
    await flushPromises();
    expect(state.mounts).toEqual(['OwnerPageA:1']);
    expect(state.unmounts).toHaveLength(0);
  });
});
