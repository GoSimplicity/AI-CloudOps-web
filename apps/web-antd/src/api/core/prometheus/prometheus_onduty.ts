import { requestClient } from '#/api/request';
import type { User } from '#/api/core/system/user'

// 值班组配置接口
export interface MonitorOnDutyGroup {
  id: number;
  name: string;
  user_id: number;
  shift_days: number;
  yesterday_normal_duty_user_id: number;
  create_user_name: string;
  users: User[];
  enable: 1 | 2;
  description: string;
  today_duty_user?: User;
  created_at: string;
  updated_at: string;
}

// 值班换班记录接口
export interface MonitorOnDutyChange {
  id: number;
  on_duty_group_id: number;
  user_id: number;
  date: string;
  origin_user_id: number;
  on_duty_user_id: number;
  create_user_name: string;
  reason: string;
  created_at: string;
  updated_at: string;
}

// 值班历史记录接口
export interface MonitorOnDutyHistory {
  id: number;
  on_duty_group_id: number;
  date_string: string;
  on_duty_user_id: number;
  origin_user_id: number;
  created_at: string;
  updated_at: string;
}

// 单日值班信息接口
export interface MonitorOnDutyOne {
  date: string;
  user?: User;
  origin_user: string;
}

// 获取值班组列表请求参数
export interface GetMonitorOnDutyGroupListReq {
  page: number;
  size: number;
  search?: string;
  enable?: 1 | 2;
}

// 创建值班组请求参数
export interface CreateMonitorOnDutyGroupReq {
  name: string;
  user_ids: number[];
  shift_days: number;
  description?: string;
}

// 创建值班组换班记录请求参数
export interface CreateMonitorOnDutyGroupChangeReq {
  on_duty_group_id: number;
  date: string;
  origin_user_id: number;
  on_duty_user_id: number;
  reason?: string;
}

// 更新值班组信息请求参数
export interface UpdateMonitorOnDutyGroupReq {
  id: number;
  name: string;
  shift_days: number;
  user_ids: number[];
  description?: string;
  enable?: 1 | 2;
}

// 删除值班组请求参数
export interface DeleteMonitorOnDutyGroupReq {
  id: number;
}

// 获取指定值班组信息请求参数
export interface GetMonitorOnDutyGroupReq {
  id: number;
}

// 获取值班组未来计划请求参数
export interface GetMonitorOnDutyGroupFuturePlanReq {
  id: number;
  start_time: string;
  end_time: string;
}

// 获取值班历史记录请求参数
export interface GetMonitorOnDutyHistoryReq {
  page: number;
  size: number;
  search?: string;
  on_duty_group_id: number;
  start_date?: string;
  end_date?: string;
}

// 获取值班组换班记录列表请求参数
export interface GetMonitorOnDutyGroupChangeListReq {
  page: number;
  size: number;
  search?: string;
  on_duty_group_id: number;
}


// 获取值班组列表
export async function getMonitorOnDutyGroupListApi(data: GetMonitorOnDutyGroupListReq) {
  return requestClient.get('/monitor/onduty_groups/list', { params: data });
}

// 创建值班组
export async function createMonitorOnDutyGroupApi(
  data: CreateMonitorOnDutyGroupReq,
) {
  return requestClient.post('/monitor/onduty_groups/create', data);
}

// 创建换班记录
export async function createMonitorOnDutyGroupChangeApi(
  data: CreateMonitorOnDutyGroupChangeReq,
) {
  return requestClient.post('/monitor/onduty_groups/changes', data);
}

// 更新值班组
export async function updateMonitorOnDutyGroupApi(
  data: UpdateMonitorOnDutyGroupReq,
) {
  return requestClient.put(`/monitor/onduty_groups/update/${data.id}`, data);
}

// 删除值班组
export async function deleteMonitorOnDutyGroupApi(id: number) {
  return requestClient.delete(`/monitor/onduty_groups/delete/${id}`);
}

// 获取值班组详情
export async function getMonitorOnDutyGroupDetailApi(id: number) {
  return requestClient.get(`/monitor/onduty_groups/detail/${id}`);
}

// 获取未来值班计划
export async function getMonitorOnDutyGroupFuturePlanApi(
  id: number,
  params?: { start_time: string; end_time: string },
) {
  return requestClient.get(`/monitor/onduty_groups/future_plan/${id}`, {
    params,
  });
}

// 获取值班历史
export async function getMonitorOnDutyHistoryApi(
  id: number,
  params?: { 
    start_date?: string; 
    end_date?: string;
    search?: string;
    page?: number;
    size?: number;
  }
) {
  return requestClient.get(`/monitor/onduty_groups/history/${id}`, { params });
}

export async function getMonitorOnDutyGroupChangeListApi(
  id: number,
  params?: { page?: number; size?: number },
) {
  return requestClient.get(`/monitor/onduty_groups/changes/${id}`, { params });
}
