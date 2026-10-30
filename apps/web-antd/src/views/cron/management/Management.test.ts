import type { FormInstance } from 'ant-design-vue';
import type { CronJob } from '#/api/core/cron/cron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markRequestLayerTrace } from '#/utils/permission/request-notice';
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
  it.each([
    ['http://127.0.0.1:9/fixture', true], ['https://example.invalid/path', true],
    ['HTTP://localhost:9', true], ['http://[::1]:9', true],
    ['ftp://example.invalid', false], ['http:///path', false], ['http:/path', false],
    ['http://localhost:0', false], ['http://localhost:65536', false], ['http://localhost:abc', false],
    ['http://local\nhost:9', false], ['http://local\thost:9', false], [' http://localhost:9', false],
    ['http://localhost/a b', false], ['http:\\localhost:9', false], ['http://localhost/%zz', false],
  ])('创建与编辑共用HTTP地址合同 %s', async (url, valid) => {
    const page = useCronJobPage();
    for (const rules of [page.createFormRules.http_url, page.editFormRules.http_url]) {
      const rule = rules.find((item) => 'validator' in item)!;
      if (!('validator' in rule) || typeof rule.validator !== 'function') throw new Error('URL validator missing');
      const result = rule.validator({}, url as string);
      if (valid) await expect(result).resolves.toBeUndefined();
      else await expect(result).rejects.toThrow('请输入有效的 HTTP 或 HTTPS URL');
    }
  });

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

describe('SEC-03A 本地执行开关与错误提示', () => {
  const disabledMsg = '本地命令/脚本任务已停用（cron.allow_local_exec=false），请改用 HTTP 或 SSH 任务';
  const passValidation = (page: ReturnType<typeof useCronJobPage>) => {
    page.formRef.value = { validate: () => Promise.resolve({}) } as unknown as FormInstance;
  };

  it('新建与编辑默认任务类型为 HTTP，创建和更新请求显式携带 job_type', async () => {
    const page = useCronJobPage();
    expect(page.editFormModel.value.job_type).toBe(3);
    page.openCreateModal();
    expect(page.createFormModel.value.job_type).toBe(3);
    passValidation(page);
    await page.submitCreateForm();
    expect(client.post).toHaveBeenCalledWith('/cron/job/create', expect.objectContaining({ job_type: 3 }));
    client.get.mockResolvedValueOnce({ ...job(8), job_type: 5 });
    await page.openEditModal({ ...job(8), job_type: 5 });
    passValidation(page);
    await page.submitEditForm();
    expect(client.put).toHaveBeenCalledWith('/cron/job/8/update', expect.objectContaining({ job_type: 5 }));
  });

  it('列表 allow_local_exec 缺省按允许处理，显式 false 时锁定命令行/脚本任务', async () => {
    const page = useCronJobPage();
    await page.fetchCronJobs();
    expect(page.allowLocalExec.value).toBe(true);
    client.get.mockResolvedValueOnce({ items: [], total: 0, allow_local_exec: false });
    await page.fetchCronJobs();
    expect(page.allowLocalExec.value).toBe(false);
    expect(page.isLocalExecLocked({ job_type: 2 })).toBe(true);
    expect(page.isLocalExecLocked({ job_type: 4 })).toBe(true);
    expect(page.isLocalExecLocked({ job_type: 3 })).toBe(false);
    expect(page.isLocalExecLocked({ job_type: 5 })).toBe(false);
    page.triggerJob(job(1));
    await page.openEditModal(job(1));
    expect(confirm).not.toHaveBeenCalled();
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(page.isEditModalVisible.value).toBe(false);
  });

  it('创建 / 更新 / 触发返回 code≠0 时原样展示后端 message', async () => {
    const page = useCronJobPage();
    page.openCreateModal();
    passValidation(page);
    // 响应解构对 HTTP 200 + code≠0 抛出 `Error 200: <message>`
    client.post.mockRejectedValueOnce(new Error(`Error 200: ${disabledMsg}`));
    await page.submitCreateForm();
    expect(notices.error).toHaveBeenLastCalledWith(disabledMsg);

    client.get.mockResolvedValueOnce({ ...job(9), job_type: 3 });
    await page.openEditModal({ ...job(9), job_type: 3 });
    passValidation(page);
    client.put.mockRejectedValueOnce(new Error('Error 200: 任务名称已存在'));
    await page.submitEditForm();
    expect(notices.error).toHaveBeenLastCalledWith('任务名称已存在');

    page.triggerJob({ ...job(10), job_type: 3 });
    client.post.mockRejectedValueOnce(new Error(`Error 200: ${disabledMsg}`));
    await confirm.mock.calls[0]?.[0].onOk();
    expect(notices.error).toHaveBeenLastCalledWith(disabledMsg);
  });

  it('带 response 的 HTTP 错误不展示响应体原文、页面不再弹（请求层已弹过一条）；无 response 时回退原提示', async () => {
    const page = useCronJobPage();
    page.triggerJob({ ...job(11), job_type: 3 });
    // incr3 P3-3：只有经过 requestClient 拦截器（带请求层痕迹）的 HTTP 错误才算请求层已提示
    const failure = markRequestLayerTrace(
      Object.assign(new Error('Request failed with status code 400'), {
        response: { status: 400, data: { code: 1, message: '绑定数据失败' } },
      }),
    );
    client.post.mockRejectedValueOnce(failure);
    await confirm.mock.calls[0]?.[0].onOk();
    expect(notices.error).not.toHaveBeenCalled();
    page.triggerJob({ ...job(12), job_type: 3 });
    client.post.mockRejectedValueOnce({});
    await confirm.mock.calls[1]?.[0].onOk();
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenLastCalledWith('定时任务触发失败');
  });
});


describe('编辑任务配置', () => {
  it('验证分别读取当前创建和编辑表达式', async () => {
    const page = useCronJobPage();
    page.createFormModel.value.schedule = '@every 1h';
    page.editFormModel.value.schedule = '0 9 * * *';
    client.post.mockResolvedValue({ valid: true, next_run_times: [] });
    await page.validateScheduleExpression('edit');
    await page.validateScheduleExpression('create');
    expect(client.post.mock.calls.map((call) => call[1])).toEqual([
      { schedule: '0 9 * * *' }, { schedule: '@every 1h' },
    ]);
  });

  it('输入变化或弹窗关闭后忽略迟到的验证提示', async () => {
    const page = useCronJobPage();
    page.openCreateModal();
    page.createFormModel.value.schedule = '@every 1h';
    const pending = Promise.withResolvers<unknown>();
    client.post.mockReturnValueOnce(pending.promise);
    const request = page.validateScheduleExpression('create');
    page.createFormModel.value.schedule = '@every 2h';
    pending.resolve({ valid: true, next_run_times: [] });
    await request;
    expect(notices.success).not.toHaveBeenCalled();
    page.closeCreateModal();
  });

  it('详情返回不再允许的命令类型时不会打开编辑', async () => {
    const page = useCronJobPage();
    client.get.mockResolvedValueOnce({ items: [], total: 0, allow_local_exec: false });
    await page.fetchCronJobs();
    client.get.mockResolvedValueOnce({ ...job(5), job_type: 2 });
    await page.openEditModal({ ...job(5), job_type: 3 });
    expect(page.isEditModalVisible.value).toBe(false);
  });

  it('编辑校验期间本地执行被关闭时不得提交', async () => {
    const page = useCronJobPage();
    client.get.mockResolvedValueOnce(job(8));
    await page.openEditModal(job(8));
    const validation = Promise.withResolvers<unknown>();
    page.formRef.value = { validate: () => validation.promise } as unknown as FormInstance;
    const request = page.submitEditForm();
    client.get.mockResolvedValueOnce({ items: [], total: 0, allow_local_exec: false });
    await page.fetchCronJobs();
    validation.resolve({});
    await request;
    expect(client.put).not.toHaveBeenCalled();
  });
});
