import { useUserStore } from '@vben/stores';

import { flushPromises, mount } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SystemUser from './SystemUser.vue';

vi.mock('@vben/hooks', () => ({
  useAppConfig: () => ({
    aiopsURL: '/custom-aiops',
    apiURL: '/custom-api/',
  }),
}));
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({
    can: () => true,
    hasPerm: () => true,
  }),
}));
vi.mock('#/store/auth', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => 0 }),
}));

const api = vi.hoisted(() => ({
  assignRolesToUserApi: vi.fn(),
  changePassword: vi.fn(),
  deleteUser: vi.fn(),
  getUserDetailApi: vi.fn(),
  getUserList: vi.fn(),
  getUserRolesApi: vi.fn(),
  getUserStatistics: vi.fn(),
  listRolesApi: vi.fn(),
  registerApi: vi.fn(),
  revokeRolesFromUserApi: vi.fn(),
  updateUserInfo: vi.fn(),
}));
vi.mock('#/api/core/system/user', () => api);
vi.mock('#/api/core/system/system', () => api);

describe('用户头像地址与上传接口', () => {
  let wrapper: ReturnType<typeof mount>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const pinia = createPinia();
    setActivePinia(pinia);
    useUserStore().setUserInfo({
      avatar: '',
      realName: '',
      userId: '1',
      username: 'operator',
    });
    api.getUserList.mockResolvedValue({
      total: 3,
      items: [
        {
          account_type: 1,
          avatar: 'photo.png',
          enable: 1,
          id: 7,
          real_name: '相对头像',
          username: 'relative-user',
        },
        {
          account_type: 1,
          avatar: 'https://cdn.example.invalid/a.png',
          enable: 1,
          id: 8,
          real_name: '绝对头像',
          username: 'absolute-user',
        },
        {
          account_type: 1,
          avatar: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
          enable: 1,
          id: 9,
          real_name: '内联头像',
          username: 'data-user',
        },
      ],
    });
    api.getUserStatistics.mockResolvedValue({
      active_user_count: 1,
      admin_count: 0,
    });
    api.listRolesApi.mockResolvedValue({ total: 0, items: [] });
    const computedStyle = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
      computedStyle(element),
    );
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        addListener: vi.fn(),
        matches: false,
        removeListener: vi.fn(),
      })),
    );
    wrapper = mount(SystemUser, {
      attachTo: document.body,
      global: { plugins: [Antd, pinia], stubs: { Icon: true } },
    });
    await flushPromises();
  });

  afterEach(() => {
    wrapper.unmount();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('头像和上传地址跟随 useAppConfig 的 apiURL，而不是写死 /api', async () => {
    const sources = wrapper
      .findAll('img')
      .map((image) => image.attributes('src'));
    expect(sources).toContain('/custom-api/uploads/photo.png');
    expect(sources).toContain('https://cdn.example.invalid/a.png');
    expect(sources).toContain('data:image/gif;base64,R0lGODlhAQABAAAAACw=');
    expect(sources.some((source) => source?.startsWith('/api/'))).toBe(false);

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('新建用户'))
      ?.trigger('click');
    await flushPromises();
    const upload = wrapper
      .findAllComponents({ name: 'AUpload' })
      .find((component) => component.props('name') === 'avatar');
    expect(upload?.props('action')).toBe('/custom-api/upload');
  });
});
