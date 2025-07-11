import { requestClient } from '#/api/request';

export interface GetAlertRulesListParams {
  page?: number;
  size?: number;
  search?: string;
  enable?: number;
  severity?: string;
  pool_id?: number;
  send_group_id?: number;
}

export interface createAlertRuleReq {
  name: string;
  pool_id: number;
  send_group_id: number;
  ip_address?: string;
  enable?: number;
  expr: string;
  severity: string;
  grafana_link?: string;
  for_time: string;
  labels?: string[];
  annotations?: string[];
  creator_name?: string;
}

export interface updateAlertRuleReq {
  id: number;
  name: string;
  pool_id: number;
  send_group_id: number;
  ip_address?: string;
  enable?: number;
  expr: string;
  severity: string;
  grafana_link?: string;
  for_time: string;
  labels?: string[];
  annotations?: string[];
}

export interface validateExprApiReq {
  promql_expr: string;
}

export const getAlertRulesListApi = (data: GetAlertRulesListParams) => {
  return requestClient.get('/monitor/alert_rules/list', { params: data });
};

export const getAlertRuleDetailApi = (id: number) => {
  return requestClient.get(`/monitor/alert_rules/detail/${id}`);
};

export const validateExprApi = (data: validateExprApiReq) => {
  return requestClient.post('/monitor/alert_rules/promql_check', data);
};

export const createAlertRuleApi = (data: createAlertRuleReq) => {
  return requestClient.post('/monitor/alert_rules/create', data);
};

export const updateAlertRuleApi = (data: updateAlertRuleReq) => {
  return requestClient.put(`/monitor/alert_rules/update/${data.id}`, data);
};

export const deleteAlertRuleApi = (id: number) => {
  return requestClient.delete(`/monitor/alert_rules/delete/${id}`);
};
