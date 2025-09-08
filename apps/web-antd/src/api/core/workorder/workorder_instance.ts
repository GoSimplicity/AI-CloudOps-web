import { requestClient } from '#/api/request';
import type { WorkorderInstanceCommentItem } from '#/api/core/workorder/workorder_instance_comment';
import type { WorkorderInstanceFlowItem } from '#/api/core/workorder/workorder_instance_flow';
import type { WorkorderInstanceTimelineItem } from '#/api/core/workorder/workorder_instance_time_line';
import type { WorkorderProcessItem } from '#/api/core/workorder/workorder_process';

// 工单状态常量
export const InstanceStatus = {
  Draft: 1,      // 草稿
  Pending: 2,    // 待处理
  Processing: 3, // 处理中
  Completed: 4,  // 已完成
  Rejected: 5,   // 已拒绝
  Cancelled: 6,  // 已取消
} as const;

// 工单优先级常量
export const Priority = {
  Low: 1,     // 低
  Normal: 2,  // 普通
  High: 3,    // 高
} as const;

// 流转记录类型常量
export const FlowRecordType = {
  User: 1,    // 用户操作
  System: 2,  // 系统操作
} as const;

// 表单字段必填状态常量
export const FieldRequired = {
  No: 1,   // 非必填
  Yes: 2,  // 必填
} as const;

// 工单实例
export interface WorkorderInstanceItem {
  id: number; // ID
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
  title: string; // 工单标题
  serial_number: string; // 工单编号
  process_id: number; // 流程ID
  current_step_id?: string; // 当前步骤ID
  form_data: Record<string, any>; // 表单数据
  status: number; // 状态
  priority: number; // 优先级
  operator_id: number; // 操作人ID
  operator_name: string; // 操作人名称
  assignee_id?: number; // 当前处理人ID
  description?: string; // 详细描述
  tags?: string[]; // 标签
  due_date?: string; // 截止时间
  completed_at?: string; // 完成时间 

  // 关联查询字段
  process?: WorkorderProcessItem; // 流程信息
  comments?: WorkorderInstanceCommentItem[]; // 评论列表
  flow_logs?: WorkorderInstanceFlowItem[]; // 流转记录
  timeline?: WorkorderInstanceTimelineItem[]; // 时间线
}

// 创建工单实例请求
export interface CreateWorkorderInstanceReq {
  title: string; // 工单标题
  process_id: number; // 流程ID
  form_data: Record<string, any>; // 表单数据
  status: number; // 状态
  priority: number; // 优先级
  assignee_id?: number; // 当前处理人ID
  description?: string; // 详细描述
  tags?: string[]; // 标签
  due_date?: string; // 截止时间
}

// 更新工单实例请求
export interface UpdateWorkorderInstanceReq {
  id: number; // ID
  title?: string; // 工单标题
  description?: string; // 详细描述
  priority?: number; // 优先级
  tags?: string[]; // 标签
  due_date?: string; // 截止时间
  status?: number; // 状态
  assignee_id?: number; // 当前处理人ID
  form_data?: Record<string, any>; // 表单数据
  completed_at?: string; // 完成时间
}

// 删除工单实例请求
export interface DeleteWorkorderInstanceReq {
  id: number; // ID
}

// 工单实例详情请求
export interface DetailWorkorderInstanceReq {
  id: number; // ID
}

// 工单实例列表请求
export interface ListWorkorderInstanceReq {
  page: number; // 页码
  size: number; // 每页大小
  search?: string; // 搜索关键词
  status?: number; // 状态
  priority?: number; // 优先级
  process_id?: number; // 流程ID
}

// 提交工单请求
export interface SubmitWorkorderInstanceReq {
  id: number; // ID
}

// 指派工单请求
export interface AssignWorkorderInstanceReq {
  id: number; // ID
  assignee_id: number; // 处理人ID
}

// 审批通过工单请求
export interface ApproveWorkorderInstanceReq {
  id: number; // ID
  comment?: string; // 审批意见
}

// 拒绝工单请求
export interface RejectWorkorderInstanceReq {
  id: number; // ID
  comment: string; // 拒绝原因
}

// 取消工单请求
export interface CancelWorkorderInstanceReq {
  id: number; // ID
  comment: string; // 取消原因
}

// 完成工单请求
export interface CompleteWorkorderInstanceReq {
  id: number; // ID
  comment: string; // 完成说明
}

// 退回工单请求
export interface ReturnWorkorderInstanceReq {
  id: number; // ID
  comment: string; // 退回原因
}

// 从模板创建工单实例请求
export interface CreateWorkorderInstanceFromTemplateReq {
  title: string; // 工单标题
  form_data?: Record<string, any>; // 表单数据
  priority: number; // 优先级
  assignee_id?: number; // 当前处理人ID
  description?: string; // 详细描述
  tags?: string[]; // 标签
  due_date?: string; // 截止时间
}

// 获取当前步骤请求
export interface GetCurrentStepReq {
  id: number; // ID
}

// 获取可执行动作请求
export interface GetAvailableActionsReq {
  id: number; // ID
}

// 创建工单实例
export async function createWorkorderInstance(
  data: CreateWorkorderInstanceReq,
) {
  return requestClient.post('/workorder/instance/create', data);
}

// 从模板创建工单实例
export async function createWorkorderInstanceFromTemplate(
  templateId: number,
  data: CreateWorkorderInstanceFromTemplateReq,
) {
  return requestClient.post(`/workorder/instance/create-from-template/${templateId}`, data);
}

// 更新工单实例
export async function updateWorkorderInstance(
  data: UpdateWorkorderInstanceReq,
) {
  return requestClient.put(`/workorder/instance/update/${data.id}`, data);
}

// 删除工单实例
export async function deleteWorkorderInstance(
  data: DeleteWorkorderInstanceReq,
) {
  return requestClient.delete(`/workorder/instance/delete/${data.id}`);
}

// 获取工单实例详情
export async function detailWorkorderInstance(
  data: DetailWorkorderInstanceReq,
) {
  return requestClient.get(`/workorder/instance/detail/${data.id}`);
}

// 获取工单实例列表
export async function listWorkorderInstance(
  params: ListWorkorderInstanceReq,
) {
  return requestClient.get('/workorder/instance/list', { params });
}

// 提交工单
export async function submitWorkorderInstance(
  data: SubmitWorkorderInstanceReq,
) {
  return requestClient.post(`/workorder/instance/submit/${data.id}`, data);
}

// 指派工单
export async function assignWorkorderInstance(
  data: AssignWorkorderInstanceReq,
) {
  return requestClient.post(`/workorder/instance/assign/${data.id}`, data);
}

// 审批通过工单
export async function approveWorkorderInstance(
  data: ApproveWorkorderInstanceReq,
) {
  return requestClient.post(`/workorder/instance/approve/${data.id}`, data);
}

// 拒绝工单
export async function rejectWorkorderInstance(
  data: RejectWorkorderInstanceReq,
) {
  return requestClient.post(`/workorder/instance/reject/${data.id}`, data);
}

// 取消工单
export async function cancelWorkorderInstance(
  data: CancelWorkorderInstanceReq,
) {
  return requestClient.post(`/workorder/instance/cancel/${data.id}`, data);
}

// 完成工单
export async function completeWorkorderInstance(
  data: CompleteWorkorderInstanceReq,
) {
  return requestClient.post(`/workorder/instance/complete/${data.id}`, data);
}

// 退回工单
export async function returnWorkorderInstance(
  data: ReturnWorkorderInstanceReq,
) {
  return requestClient.post(`/workorder/instance/return/${data.id}`, data);
}

// 获取可执行动作
export async function getAvailableActions(id: number) {
  return requestClient.get(`/workorder/instance/actions/${id}`);
}

// 获取当前步骤
export async function getCurrentStep(id: number) {
  return requestClient.get(`/workorder/instance/current-step/${id}`);
}
