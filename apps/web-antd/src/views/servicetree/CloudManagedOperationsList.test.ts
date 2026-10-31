import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import List from './CloudManagedOperationsList.vue';

const api = vi.hoisted(() => ({
  listManagedOperations: vi.fn(),
  getManagedOperation: vi.fn(),
  reviewManagedOperation: vi.fn(),
}));
vi.mock('#/api/core/tree/tree_cloud', () => api);
const scope = {
  cloud_account_id: 1,
  cloud_account_region_id: 2,
  kind: 'rds' as const,
};
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const row = (owner = 7) => ({
  ...scope,
  owner_id: owner,
  operation_id: id,
  resource_ids: ['rm-one'],
  state: 'unknown',
});
let wrapper: VueWrapper;
function render(superAdmin = false) {
  wrapper = mount(List, {
    props: {
      scope,
      viewer: '7',
      superAdmin,
      canList: true,
      canRead: true,
      canReview: true,
      refreshToken: 0,
      authorize: async () => true,
    },
    global: { plugins: [Antd] },
  });
}
async function click(name: string) {
  await wrapper
    .findAll('button')
    .find((b) => b.text().replace(/\s/g, '') === name)!
    .trigger('click');
  await flushPromises();
}
beforeEach(() => {
  vi.resetAllMocks();
  api.listManagedOperations.mockResolvedValue({
    items: [],
    total: 0,
    scope_blocked: false,
  });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  const style = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    style(element),
  );
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('默认仅请求本人未确认操作并使用服务端范围汇总', async () => {
  api.listManagedOperations.mockResolvedValue({
    items: [],
    total: 0,
    scope_blocked: true,
  });
  render();
  await flushPromises();
  expect(api.listManagedOperations).toHaveBeenCalledWith({
    ...scope,
    page: 1,
    size: 20,
    unconfirmed_only: true,
  });
  expect(wrapper.text()).toContain('本人列表没有记录');
  expect(wrapper.emitted('blocked')?.at(-1)).toEqual([true]);
  expect(wrapper.text()).not.toContain('查看所有用户');
});
it('普通用户拒绝意外返回的其他用户记录', async () => {
  api.listManagedOperations.mockResolvedValue({
    items: [{ ...row(8), resource_ids: ['private-resource-canary'] }],
    total: 1,
    scope_blocked: true,
  });
  render();
  await flushPromises();
  expect(wrapper.text()).toContain('读取失败');
  expect(wrapper.text()).not.toContain('private-resource-canary');
  expect(wrapper.emitted('blocked')?.at(-1)).toEqual([true]);
});
it('未知记录却声称范围不阻断时拒绝响应', async () => {
  api.listManagedOperations.mockResolvedValue({
    items: [row()],
    total: 1,
    scope_blocked: false,
  });
  render();
  await flushPromises();
  expect(wrapper.text()).toContain('读取失败');
  expect(wrapper.emitted('blocked')?.at(-1)).toEqual([true]);
});
it('列表故障保留阻断并不暴露上游错误', async () => {
  api.listManagedOperations.mockRejectedValue(new Error('private-list-canary'));
  render();
  await flushPromises();
  expect(wrapper.text()).toContain('读取失败');
  expect(wrapper.text()).not.toContain('private-list-canary');
  expect(wrapper.emitted('blocked')?.at(-1)).toEqual([true]);
});
it('超管显式选择所有用户，同UUID按owner区分查询与核对', async () => {
  api.listManagedOperations.mockImplementation(async (params) => ({
    items: params.all_owners ? [row(7), row(8)] : [row(7)],
    total: params.all_owners ? 2 : 1,
    scope_blocked: true,
  }));
  render(true);
  await flushPromises();
  await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(true);
  await flushPromises();
  expect(api.listManagedOperations).toHaveBeenLastCalledWith({
    ...scope,
    page: 1,
    size: 20,
    unconfirmed_only: true,
    all_owners: true,
  });
  expect(wrapper.findAll('tbody tr.ant-table-row')).toHaveLength(2);
  await wrapper
    .findAll('button')
    .filter((b) => b.text().replace(/\s/g, '') === '查看或核对')[1]!
    .trigger('click');
  await flushPromises();
  api.getManagedOperation.mockResolvedValue(row(8));
  await click('查询本次操作');
  expect(api.getManagedOperation).toHaveBeenCalledWith(id, 8);
  await click('核对并阻断旧请求');
  const textarea = document.querySelector<HTMLTextAreaElement>(
    '#managed-operation-review-reason',
  )!;
  textarea.value = '超级管理员已经核对实际资源及本地状态';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  document
    .querySelector<HTMLInputElement>('.ant-modal input[type="checkbox"]')!
    .click();
  await flushPromises();
  const audited = {
    ...row(8),
    state: 'reviewed',
    previous_state: 'running',
    reviewed_at: '2026-10-30T01:00:00Z',
    reviewed_by: 7,
    review_reason: '超级管理员已经核对实际资源及本地状态',
  };
  api.reviewManagedOperation.mockResolvedValue(audited);
  api.getManagedOperation.mockResolvedValue(audited);
  document
    .querySelector<HTMLButtonElement>('.ant-modal-footer .ant-btn-primary')!
    .click();
  await flushPromises();
  expect(api.reviewManagedOperation).toHaveBeenCalledWith(id, {
    ...scope,
    owner_id: 8,
    resource_ids: ['rm-one'],
    resources_verified: true,
    reason: '超级管理员已经核对实际资源及本地状态',
  });
  expect(wrapper.emitted('acknowledged')).toEqual([[id, 8]]);
});
it('旧记录没有快照时明确要求输入原资源ID而不是猜测', async () => {
  api.listManagedOperations.mockResolvedValue({
    items: [{ ...row(), resource_ids: [] }],
    total: 1,
    scope_blocked: true,
  });
  render();
  await flushPromises();
  await click('查看或核对');
  expect(wrapper.text()).toContain('没有资源快照');
  await wrapper.find('textarea').setValue('rm-one,rm-one');
  await click('使用核对的资源ID');
  expect(wrapper.text()).toContain('不重复');
  await wrapper.find('textarea').setValue('rm-one');
  await click('使用核对的资源ID');
  expect(wrapper.text()).toContain('查询本次操作');
  expect(api.reviewManagedOperation).not.toHaveBeenCalled();
});
it('切换viewer后丢弃原用户的迟到列表', async () => {
  let finish!: (value: unknown) => void;
  api.listManagedOperations.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render();
  await wrapper.setProps({ viewer: '8' });
  await flushPromises();
  finish({ items: [row(7)], total: 1, scope_blocked: true });
  await flushPromises();
  expect(wrapper.findAll('tbody tr.ant-table-row')).toHaveLength(0);
  expect(wrapper.text()).not.toContain(id);
});
it('操作列表分页只请求当前页，不用截断列表推断整个范围安全', async () => {
  api.listManagedOperations.mockImplementation(async (params) => ({
    items: Array.from({ length: params.page === 1 ? 20 : 5 }, (_, i) => ({
      ...row(),
      operation_id: `aaaaaaaa-aaaa-4aaa-8aaa-${String((params.page - 1) * 20 + i + 1).padStart(12, '0')}`,
    })),
    total: 25,
    scope_blocked: true,
  }));
  render();
  await flushPromises();
  await wrapper.find('.ant-pagination-item-2').trigger('click');
  await flushPromises();
  expect(api.listManagedOperations).toHaveBeenLastCalledWith({
    ...scope,
    page: 2,
    size: 20,
    unconfirmed_only: true,
  });
  expect(wrapper.findAll('tbody tr.ant-table-row')).toHaveLength(5);
  expect(wrapper.emitted('blocked')?.at(-1)).toEqual([true]);
});
it('超管权限撤销后立即移除其他用户记录并切回本人模式', async () => {
  const otherID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  api.listManagedOperations.mockImplementation(async (params) => ({
    items: params.all_owners
      ? [{ ...row(8), operation_id: otherID }]
      : [row(7)],
    total: 1,
    scope_blocked: true,
  }));
  render(true);
  await flushPromises();
  await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(true);
  await flushPromises();
  expect(wrapper.text()).toContain(otherID);
  await wrapper.setProps({ superAdmin: false });
  await flushPromises();
  expect(wrapper.text()).not.toContain(otherID);
  expect(wrapper.text()).not.toContain('查看所有用户');
  expect(api.listManagedOperations).toHaveBeenLastCalledWith({
    ...scope,
    page: 1,
    size: 20,
    unconfirmed_only: true,
  });
});
it('已核对记录以只读方式展示原状态、核对人与理由，不再写入审计', async () => {
  const audit = {
    ...row(),
    state: 'reviewed',
    previous_state: 'not_recorded',
    reviewed_at: '2026-10-30T01:00:00Z',
    reviewed_by: 7,
    review_reason: '原操作记录缺失，已经人工核对实际资源',
  };
  api.listManagedOperations.mockImplementation(async (params) => ({
    items: params.unconfirmed_only ? [] : [audit],
    total: params.unconfirmed_only ? 0 : 1,
    scope_blocked: false,
  }));
  render();
  await flushPromises();
  await wrapper.findAll('input[type="checkbox"]')[0]!.setValue(false);
  await flushPromises();
  await click('查看或核对');
  expect(wrapper.text()).toContain('原操作记录缺失，已经人工核对实际资源');
  expect(wrapper.text()).toContain('人工核对不表示同步成功');
  expect(api.getManagedOperation).not.toHaveBeenCalled();
  expect(api.reviewManagedOperation).not.toHaveBeenCalled();
});
