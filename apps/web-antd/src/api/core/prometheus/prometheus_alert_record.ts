import { requestClient } from '#/api/request';

// 记录规则模型
export interface MonitorRecordRule {
  id?: number;
  name: string;
  user_id: number;
  pool_id: number;
  ip_address: string;
  enable: number;
  expr: string;
  labels: string[];
  create_user_name: string;
  pool_name?: string;
  created_at?: string;
  updated_at?: string;
}

// 获取记录规则列表请求参数
export interface GetMonitorRecordRuleListReq {
  page?: number;
  size?: number;
  search?: string;
  pool_id?: number;
  enable?: number;
}

// 创建记录规则请求
export interface CreateMonitorRecordRuleReq {
  name: string;
  pool_id: number;
  ip_address?: string;
  enable?: number;
  expr: string;
  labels?: string[];
}

// 更新记录规则请求
export interface UpdateMonitorRecordRuleReq {
  id: number;
  name: string;
  pool_id: number;
  ip_address?: string;
  enable?: number;
  expr: string;
  labels?: string[];
}

// 删除记录规则请求参数
export interface DeleteMonitorRecordRuleReq {
  id: number;
}

// PromQL表达式检查请求
export interface PromqlRecordRuleExprCheckReq {
  promql_expr: string;
}

// 获取记录规则详情请求参数
export interface GetMonitorRecordRuleReq {
  id: number;
}

// 启用/禁用记录规则请求参数
export interface EnableSwitchMonitorRecordRuleReq {
  id: number;
}

export async function getMonitorRecordRuleListApi(data: GetMonitorRecordRuleListReq) {
  return requestClient.get('/monitor/record_rules/list', { params: data });
}

export async function createMonitorRecordRuleApi(data: CreateMonitorRecordRuleReq) {
  return requestClient.post('/monitor/record_rules/create', data);
}

export async function updateMonitorRecordRuleApi(data: UpdateMonitorRecordRuleReq) {
  return requestClient.put(`/monitor/record_rules/update/${data.id}`, data);
}

export async function deleteMonitorRecordRuleApi(id: number) {
  return requestClient.delete(`/monitor/record_rules/delete/${id}`);
}

export async function getMonitorRecordRuleApi(id: number) {
  return requestClient.get(`/monitor/record_rules/detail/${id}`);
}
