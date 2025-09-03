import { requestClient } from '#/api/request';

// 工单状态流转动作类型常量
export const FlowAction = {
  Submit: 'submit',   // 提交工单
  Approve: 'approve', // 审批通过
  Reject: 'reject',   // 审批拒绝
  Assign: 'assign',   // 指派处理人
  Cancel: 'cancel',   // 取消工单
  Complete: 'complete', // 完成工单
  Return: 'return',   // 退回工单
} as const;

// WorkorderInstanceFlow 工单状态流转记录
export interface WorkorderInstanceFlowItem {
  id: number; // 流转记录ID
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
  instance_id: number; // 工单实例ID
  action: string; // 流转动作
  operator_id: number; // 操作人ID
  operator_name: string; // 操作人名称
  from_status: number; // 变更前状态
  to_status: number; // 变更后状态
  comment?: string; // 审批意见或处理说明
  is_system_action?: number; // 是否为系统自动操作：1-是，2-否
}

// 工单流转记录列表请求
export interface ListWorkorderInstanceFlowReq {
  page: number; // 页码
  size: number; // 每页大小
  search?: string; // 搜索关键词
  instance_id?: number; // 工单实例ID
  action?: string; // 流转动作
  is_system_action?: number; // 是否为系统自动操作
}

// 获取工单流转记录详情请求
export interface DetailWorkorderInstanceFlowReq {
  id: number; // 流转记录ID
}

export async function listWorkorderInstanceFlow(
  params: ListWorkorderInstanceFlowReq,
) {
  return requestClient.get('/workorder/instance/flow/list', { params });
}

export async function detailWorkorderInstanceFlow(
  data: DetailWorkorderInstanceFlowReq,
) {
  return requestClient.get(`/workorder/instance/flow/detail/${data.id}`);
}
