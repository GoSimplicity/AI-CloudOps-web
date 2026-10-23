import type { FormInstance } from 'ant-design-vue';
import type { CronJob } from '#/api/core/cron/cron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCronJobPage } from './Management';

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
const notices = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
const confirm = vi.hoisted(() => vi.fn());
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('ant-design-vue', () => ({ message: notices, Modal: { confirm } }));
const job = (id: number, name = `job-${id}`) => ({ id, name, max_retry: 0, status: 1, job_type: 2, schedule: '@every 1h' }) as CronJob;
beforeEach(() => {
  vi.resetAllMocks();
  client.get.mockResolvedValue({ items: [], total: 0 });
  client.post.mockResolvedValue(undefined);
  client.put.mockResolvedValue(undefined);
  client.delete.mockResolvedValue(undefined);
});

describe('定时任务请求与操作边界', () => {
  it('服务端筛选结果与总数保持一致，迟到响应不能覆盖新查询', async () => {
    const page = useCronJobPage();
    const old = Promise.withResolvers<unknown>();
    client.get.mockReturnValueOnce(old.promise);
    const first = page.fetchCronJobs();
    page.filterStatus.value = 3;
    client.get.mockResolvedValueOnce({ items: [job(2)], total: 12 });
    await page.fetchCronJobs();
    old.resolve({ items: [job(1)], total: 30 });
    await first;
    expect(page.filteredCronJobs.value.map(row => row.id)).toEqual([2]);
    expect(page.total.value).toBe(12);
    expect(client.get.mock.calls[1]?.[1].params.status).toBe(3);
    expect(page.loading.value).toBe(false);
  });

  it('失败清除旧列表、总数与选择，重试可恢复', async () => {
    const page = useCronJobPage();
    page.cronJobs.value = [job(1)];
    page.total.value = 1;
    page.rowSelection.value.onChange([1], [job(1)]);
    client.get.mockRejectedValueOnce({ response: { status: 403 } });
    await page.fetchCronJobs();
    expect(page.cronJobs.value).toEqual([]);
    expect(page.total.value).toBe(0);
    expect(page.selectedRows.value).toEqual([]);
    expect(page.error.value).toContain('没有权限');
    client.get.mockResolvedValueOnce({ items: [job(2)], total: 1 });
    await page.fetchCronJobs();
    expect(page.error.value).toBeNull();
    expect(page.cronJobs.value[0]?.id).toBe(2);
  });

  it('关闭详情或清理账号后不能回填迟到内容', async () => {
    const page = useCronJobPage();
    const pending = Promise.withResolvers<CronJob>();
    client.get.mockReturnValueOnce(pending.promise);
    const fetch = page.showJobDetail(job(1));
    page.closeDetailModal();
    pending.resolve(job(1));
    await fetch;
    expect(page.currentJobDetail.value).toBeNull();
    expect(page.isDetailModalVisible.value).toBe(false);
    const list = Promise.withResolvers<unknown>();
    client.get.mockReturnValueOnce(list.promise);
    const query = page.fetchCronJobs();
    page.clearPage();
    list.resolve({ items: [job(1)], total: 1 });
    await query;
    expect(page.cronJobs.value).toEqual([]);
    expect(page.loading.value).toBe(false);
  });

  it('关闭编辑后迟到详情不能重新打开弹窗', async () => {
    const page = useCronJobPage();
    const pending = Promise.withResolvers<CronJob>();
    client.get.mockReturnValueOnce(pending.promise);
    const fetch = page.openEditModal(job(1));
    page.closeEditModal();
    pending.resolve(job(1));
    await fetch;
    expect(page.isEditModalVisible.value).toBe(false);
    expect(page.editFormModel.value.id).toBe(0);
  });

  it('新建默认三次重投，编辑显式零保持零', async () => {
    const page = useCronJobPage();
    page.openCreateModal();
    expect(page.createFormModel.value.max_retry).toBe(3);
    page.closeCreateModal();
    client.get.mockResolvedValueOnce(job(7));
    await page.openEditModal(job(7));
    await page.submitEditForm();
    expect(client.put).toHaveBeenCalledWith('/cron/job/7/update', expect.objectContaining({ max_retry: 0 }));
  });

  it('异步校验期间重复提交只写一次', async () => {
    const page = useCronJobPage();
    page.openCreateModal();
    const validation = Promise.withResolvers<unknown>();
    page.formRef.value = { validate: () => validation.promise } as unknown as FormInstance;
    const first = page.submitCreateForm();
    const second = page.submitCreateForm();
    validation.resolve({});
    await Promise.all([first, second]);
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it('取消后重开的表单不能被旧校验提交', async () => {
    const page = useCronJobPage();
    page.openCreateModal();
    const validation = Promise.withResolvers<unknown>();
    page.formRef.value = { validate: () => validation.promise } as unknown as FormInstance;
    const pending = page.submitCreateForm();
    page.closeCreateModal();
    page.openCreateModal();
    validation.resolve({});
    await pending;
    expect(client.post).not.toHaveBeenCalled();
    page.closeCreateModal();
  });

  it('批量确认固定打开时对象并如实报告部分失败，取消零写入', async () => {
    const page = useCronJobPage();
    page.rowSelection.value.onChange([1, 2], [job(1), job(2)]);
    page.batchOperation('删除');
    expect(client.delete).not.toHaveBeenCalled();
    page.rowSelection.value.onChange([3], [job(3)]);
    client.delete.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('fixture failure'));
    await confirm.mock.calls[0]?.[0].onOk();
    expect(client.delete.mock.calls.map(call => call[0])).toEqual(['/cron/job/1/delete', '/cron/job/2/delete']);
    expect(notices.success).not.toHaveBeenCalled();
    expect(notices.error).toHaveBeenCalledWith(expect.stringContaining('1 项成功，1 项失败'));
  });
});
