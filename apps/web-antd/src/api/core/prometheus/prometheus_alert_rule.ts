import { requestClient } from '#/api/request';

// 告警级别枚举
export enum AlertRuleSeverity {
  Info = 1,
  Warning = 2,
  Critical = 3
}

// 监控告警规则配置
export interface MonitorAlertRule {
  id?: number;
  name: string;
  user_id: number;
  pool_id: number;
  send_group_id: number;
  ip_address?: string;
  enable: number; // 1-启用, 2-禁用
  expr: string;
  severity: AlertRuleSeverity;
  grafana_link?: string;
  for_time: string;
  labels?: string[];
  annotations?: string[];
  create_user_name?: string;
  pool_name?: string;
  send_group_name?: string;
  created_at?: string;
  updated_at?: string;
}

// 获取告警规则列表请求参数
export interface GetMonitorAlertRuleListReq {
  page?: number;
  size?: number;
  search?: string;
  enable?: number;
  severity?: AlertRuleSeverity;
}

// 创建告警规则请求参数
export interface CreateMonitorAlertRuleReq {
  name: string;
  pool_id: number;
  send_group_id: number;
  ip_address?: string;
  enable?: number;
  expr: string;
  severity?: AlertRuleSeverity;
  grafana_link?: string;
  for_time: string;
  labels?: string[];
  annotations?: string[];
}

// 更新告警规则请求参数
export interface UpdateMonitorAlertRuleReq {
  id: number;
  name: string;
  pool_id: number;
  send_group_id: number;
  ip_address?: string;
  enable?: number;
  expr: string;
  severity?: AlertRuleSeverity;
  grafana_link?: string;
  for_time: string;
  labels?: string[];
  annotations?: string[];
}

// 删除告警规则请求参数
export interface DeleteMonitorAlertRuleReq {
  id: number;
}

// PromQL表达式检查请求参数
export interface PromqlAlertRuleExprCheckReq {
  promql_expr: string;
}

// 获取告警规则详情请求参数
export interface GetMonitorAlertRuleReq {
  id: number;
}

export async function getMonitorAlertRuleListApi(data: GetMonitorAlertRuleListReq) {
  return requestClient.get('/monitor/alert_rules/list', { params: data });
}

export async function createMonitorAlertRuleApi(data: CreateMonitorAlertRuleReq) {
  return requestClient.post('/monitor/alert_rules/create', data);
}

export async function updateMonitorAlertRuleApi(data: UpdateMonitorAlertRuleReq) {
  return requestClient.put(`/monitor/alert_rules/update/${data.id}`, data);
}

export async function deleteMonitorAlertRuleApi(id: number) {
  return requestClient.delete(`/monitor/alert_rules/delete/${id}`);
}

export async function getMonitorAlertRuleApi(id: number) {
  return requestClient.get(`/monitor/alert_rules/detail/${id}`);
}

export async function promqlExprCheckApi(data: PromqlAlertRuleExprCheckReq) {
  return requestClient.post('/monitor/alert_rules/promql_check', data);
}
