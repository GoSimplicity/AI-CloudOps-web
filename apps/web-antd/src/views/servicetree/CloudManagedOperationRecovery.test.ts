import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Recovery from './CloudManagedOperationRecovery.vue';
const api = vi.hoisted(() => ({ getManagedOperation: vi.fn(), reviewManagedOperation: vi.fn() }));
vi.mock('#/api/core/tree/tree_cloud', () => api);
let wrapper: VueWrapper;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const scope = { cloud_account_id: 7, cloud_account_region_id: 11, kind: 'rds' as const };
const marker = { version: 2 as const, owner_id: 7, operation_id: id, resource_ids: ['rm-one'] };
const known = () => ({ ...scope, owner_id: 7, operation_id: id, resource_ids: ['rm-one'], state: 'completed', result: { operation_id: id, status: 'success', history_id: 31, count: 1, new_count: 1, update_count: 0, retry_safe: true } });
const reviewed = () => ({ ...scope, owner_id: 7, operation_id: id, resource_ids: ['rm-one'], state: 'reviewed', previous_state: 'not_recorded', reviewed_at: '2026-10-30T01:00:00Z', reviewed_by: 7, review_reason: '已经核对实际云资源和本地记录的状态' });
const render = () => { wrapper = mount(Recovery, { props: { scope, marker, owner: '7', canRead: true, canReview: true, authorize: async () => true }, global: { plugins: [Antd] } }); };
const button = (name: string) => wrapper.findAll('button').find((b) => b.text().replace(/\s/g, '') === name)!;
async function click(name: string) { await button(name).trigger('click'); await flushPromises(); }
async function openReview() {
 api.getManagedOperation.mockRejectedValueOnce(new Error('private-lookup-canary'));
 await click('查询本次操作'); await click('核对并阻断旧请求');
 const textarea = document.querySelector<HTMLTextAreaElement>('#managed-operation-review-reason')!;
 textarea.value = '已经核对实际云资源和本地记录的状态'; textarea.dispatchEvent(new Event('input', { bubbles: true }));
 document.querySelector<HTMLInputElement>('.ant-modal input[type="checkbox"]')!.click();
 await flushPromises();
}
async function save() { document.querySelector<HTMLButtonElement>('.ant-modal-footer .ant-btn-primary')!.click(); await flushPromises(); }
beforeEach(() => {
 vi.resetAllMocks(); vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })));
});
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; vi.unstubAllGlobals(); });
it('挂载不重新同步，查询已保存结果后才确认同一操作', async () => {
 api.getManagedOperation.mockResolvedValue(known()); render(); expect(api.getManagedOperation).not.toHaveBeenCalled();
 await click('查询本次操作'); expect(api.getManagedOperation).toHaveBeenCalledWith(id, undefined);
 expect(wrapper.emitted('acknowledged')).toEqual([[id, 7]]); expect(api.reviewManagedOperation).not.toHaveBeenCalled();
});
it.each(['running','unknown'])('%s 不自动确认或重新执行', async (state) => {
 api.getManagedOperation.mockResolvedValue({ ...scope, owner_id: 7, operation_id: id, resource_ids: ['rm-one'], state }); render(); await click('查询本次操作');
 expect(wrapper.emitted('acknowledged')).toBeUndefined(); expect(api.reviewManagedOperation).not.toHaveBeenCalled();
});
it('拒绝其他操作或范围的结果', async () => {
 api.getManagedOperation.mockResolvedValue({ ...known(), cloud_account_region_id: 99 }); render(); await click('查询本次操作');
 expect(wrapper.emitted('acknowledged')).toBeUndefined(); expect(wrapper.text()).toContain('操作结果未确认');
});
it('人工核对先提交再读回审计，不凭POST响应清除标记', async () => {
 render(); await openReview(); api.reviewManagedOperation.mockResolvedValue(reviewed()); api.getManagedOperation.mockResolvedValue(reviewed()); await save();
 expect(api.reviewManagedOperation).toHaveBeenCalledWith(id, { ...scope, resource_ids: ['rm-one'], resources_verified: true, reason: '已经核对实际云资源和本地记录的状态' });
 expect(wrapper.emitted('acknowledged')).toEqual([[id, 7]]); expect(document.body.textContent).not.toContain('private-lookup-canary');
});
it('核对结果无法读回时不确认并阻止原对话框再次提交', async () => {
 render(); await openReview(); api.reviewManagedOperation.mockResolvedValue(reviewed()); api.getManagedOperation.mockRejectedValue(new Error('private-audit-canary')); await save();
 expect(wrapper.emitted('acknowledged')).toBeUndefined(); expect(document.body.textContent).toContain('核对结果尚未确认'); expect(document.body.textContent).not.toContain('private-audit-canary');
 expect(document.querySelector<HTMLButtonElement>('.ant-modal-footer .ant-btn-primary')!.disabled).toBe(true);
});
it('用户变化后丢弃迟到读取', async () => {
 let finish!: (value: unknown) => void; api.getManagedOperation.mockReturnValue(new Promise((resolve) => { finish = resolve; })); render(); await button('查询本次操作').trigger('click');
 await wrapper.setProps({ owner: '8' }); finish(known()); await flushPromises(); expect(wrapper.emitted('acknowledged')).toBeUndefined();
});
it('保存前权限复核拒绝时不发送核对', async () => {
 render(); await openReview(); await wrapper.setProps({ authorize: async () => false }); await save();
 expect(api.reviewManagedOperation).not.toHaveBeenCalled(); expect(wrapper.emitted('acknowledged')).toBeUndefined();
});
it('超管读取相同UUID的另一owner时不能接受本人的记录', async () => {
 api.getManagedOperation.mockResolvedValue(known()); render(); await wrapper.setProps({ operationOwner: 8, allowCrossOwner: true }); await click('查询本次操作');
 expect(api.getManagedOperation).toHaveBeenCalledWith(id, 8); expect(wrapper.emitted('acknowledged')).toBeUndefined(); expect(wrapper.text()).toContain('操作结果未确认');
});
