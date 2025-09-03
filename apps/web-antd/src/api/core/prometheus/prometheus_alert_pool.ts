import { requestClient } from '#/api/request';

// AlertManager实例池类型定义
export interface MonitorAlertManagerPool {
  id?: number;
  name: string;
  alert_manager_instances: string[];
  user_id: number;
  resolve_timeout: string;
  group_wait: string;
  group_interval: string;
  repeat_interval: string;
  group_by: string[];
  receiver: string;
  create_user_name: string;
  created_at?: string;
  updated_at?: string;
}

// 创建AlertManager实例池请求
export interface CreateMonitorAlertManagerPoolReq {
  name: string;
  alert_manager_instances: string[];
  resolve_timeout?: string;
  group_wait?: string;
  group_interval?: string;
  repeat_interval?: string;
  group_by?: string[];
  receiver: string;
}

// 更新AlertManager实例池请求
export interface UpdateMonitorAlertManagerPoolReq {
  id: number;
  name: string;
  alert_manager_instances: string[];
  resolve_timeout?: string;
  group_wait?: string;
  group_interval?: string;
  repeat_interval?: string;
  group_by?: string[];
  receiver: string;
}

// 获取AlertManager实例池列表请求参数
export interface GetAlertManagerPoolListParams {
  page?: number;
  size?: number;
  search?: string;
}

// 获取AlertManager实例池详情请求参数
export interface GetMonitorAlertManagerPoolReq {
  id: number;
}

// 删除AlertManager实例池请求参数
export interface DeleteMonitorAlertManagerPoolReq {
  id: number;
}

export async function getMonitorAlertManagerPoolListApi(data: GetAlertManagerPoolListParams) {
  return requestClient.get('/monitor/alert_manager_pools/list', { params: data });
}

export async function createMonitorAlertManagerPoolApi(data: CreateMonitorAlertManagerPoolReq) {
  return requestClient.post('/monitor/alert_manager_pools/create', data);
}

export async function updateMonitorAlertManagerPoolApi(data: UpdateMonitorAlertManagerPoolReq) {
  return requestClient.put(`/monitor/alert_manager_pools/update/${data.id}`, data);
}

export async function deleteMonitorAlertManagerPoolApi(id: number) {
  return requestClient.delete(`/monitor/alert_manager_pools/delete/${id}`);
}

export async function getMonitorAlertManagerPoolApi(id: number) {
  return requestClient.get(`/monitor/alert_manager_pools/detail/${id}`);
}
