import { requestClient } from '#/api/request';

// 时间线操作类型常量 - 包含所有操作记录
export const TimelineAction = {
  Create: 'create', // 创建工单
  Submit: 'submit', // 提交工单
  Approve: 'approve', // 审批通过
  Reject: 'reject', // 审批拒绝
  Assign: 'assign', // 指派处理人
  Cancel: 'cancel', // 取消工单
  Complete: 'complete', // 完成工单
  Return: 'return', // 退回工单
  Comment: 'comment', // 添加评论
  Update: 'update', // 更新工单信息
  View: 'view', // 查看工单
  Attach: 'attach', // 添加附件
  Notify: 'notify', // 发送通知
  Remind: 'remind', // 催办提醒
} as const;

// WorkorderInstanceTimeline 工单操作时间线 - 记录所有操作历史和审计日志
export interface WorkorderInstanceTimelineItem {
  id: number; // 时间线ID
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
  instance_id: number; // 工单实例ID
  action: string; // 操作类型
  operator_id: number; // 操作人ID
  operator_name: string; // 操作人名称
  action_detail?: string; // 操作详情（JSON格式）
  comment?: string; // 操作备注或说明
  related_id?: number; // 关联记录ID（如评论ID、附件ID等）
}

// 创建工单操作时间线请求
export interface CreateWorkorderInstanceTimelineReq {
  instance_id: number; // 工单实例ID
  action: string; // 操作类型
  action_detail?: string; // 操作详情（JSON格式）
  comment?: string; // 操作备注或说明
  related_id?: number; // 关联记录ID（如评论ID、附件ID等）
}

// 更新工单操作时间线请求
export interface UpdateWorkorderInstanceTimelineReq {
  id: number; // 时间线ID
  action_detail?: string; // 操作详情（JSON格式）
  comment?: string; // 操作备注或说明
}

// 删除工单实例时间线请求
export interface DeleteWorkorderInstanceTimelineReq {
  id: number; // 时间线ID
}

// 获取工单实例时间线详情请求
export interface DetailWorkorderInstanceTimelineReq {
  id: number; // 时间线ID
}

// 工单操作时间线列表请求
export interface ListWorkorderInstanceTimelineReq {
  page: number; // 页码
  size: number; // 每页大小
  search?: string; // 搜索关键词
  instance_id?: number; // 工单实例ID
  action?: string; // 操作类型
  start_date?: string; // 开始时间
  end_date?: string; // 结束时间
}

export async function createWorkorderInstanceTimeline(
  data: CreateWorkorderInstanceTimelineReq,
) {
  return requestClient.post('/workorder/instance/timeline/create', data);
}

export async function updateWorkorderInstanceTimeline(
  data: UpdateWorkorderInstanceTimelineReq,
) {
  return requestClient.put(`/workorder/instance/timeline/update/${data.id}`, data);
}

export async function deleteWorkorderInstanceTimeline(
  data: DeleteWorkorderInstanceTimelineReq,
) {
  return requestClient.delete(`/workorder/instance/timeline/delete/${data.id}`);
}

export async function listWorkorderInstanceTimeline(
  params: ListWorkorderInstanceTimelineReq,
) {
  return requestClient.get('/workorder/instance/timeline/list', { params });
}

export async function detailWorkorderInstanceTimeline(
  data: DetailWorkorderInstanceTimelineReq,
) {
  return requestClient.get(`/workorder/instance/timeline/detail/${data.id}`);
}
