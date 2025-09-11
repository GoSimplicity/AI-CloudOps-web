import { requestClient } from '#/api/request';
import type { User } from '#/api/core/system/user'

// 发送组配置接口
export interface MonitorSendGroup {
  id: number;
  name: string;
  name_zh: string;
  enable: 1 | 2;
  user_id: number;
  pool_id: number;
  on_duty_group_id: number;
  fei_shu_qun_robot_token: string;
  repeat_interval: string;
  send_resolved: 1 | 2;
  notify_methods: string[];
  need_upgrade: 1 | 2;
  upgrade_minutes: number;
  static_receive_users: User[];
  first_upgrade_users: User[];
  second_upgrade_users: User[];
  create_user_name: string;
  static_receive_user_names: string[];
  first_user_names: string[];
  second_user_names: string[];
  created_at: string;
  updated_at: string;
}

// 获取发送组列表请求参数
export interface GetMonitorSendGroupListReq {
  page: number;
  size: number;
  search?: string;
  pool_id?: number;
  enable?: 1 | 2;
  on_duty_group_id?: number;
}

// 创建发送组请求参数
export interface CreateMonitorSendGroupReq {
  name: string;
  name_zh: string;
  enable?: 1 | 2;
  pool_id: number;
  on_duty_group_id?: number;
  static_receive_users?: User[];
  fei_shu_qun_robot_token?: string;
  repeat_interval?: string;
  send_resolved?: 1 | 2;
  notify_methods?: string[];
  need_upgrade?: 1 | 2;
  first_upgrade_users?: User[];
  upgrade_minutes?: number;
  second_upgrade_users?: User[];
}

// 更新发送组请求参数
export interface UpdateMonitorSendGroupReq {
  id: number;
  name: string;
  name_zh: string;
  enable?: 1 | 2;
  pool_id: number;
  on_duty_group_id?: number;
  static_receive_users?: User[];
  fei_shu_qun_robot_token?: string;
  repeat_interval?: string;
  send_resolved?: 1 | 2;
  notify_methods?: string[];
  need_upgrade?: 1 | 2;
  first_upgrade_users?: User[];
  upgrade_minutes?: number;
  second_upgrade_users?: User[];
}

// 删除发送组请求参数
export interface DeleteMonitorSendGroupReq {
  id: number;
}

// 获取发送组详情请求参数
export interface GetMonitorSendGroupReq {
  id: number;
}

// 获取发送组列表
export async function getMonitorSendGroupListApi(data: GetMonitorSendGroupListReq) {
  return requestClient.get('/monitor/send_groups/list', { params: data });
}

// 获取发送组详情
export async function getMonitorSendGroupDetailApi(id: number) {
  return requestClient.get(`/monitor/send_groups/detail/${id}`);
}

// 创建发送组
export async function createMonitorSendGroupApi(data: CreateMonitorSendGroupReq) {
  return requestClient.post('/monitor/send_groups/create', data);
}

// 更新发送组
export async function updateMonitorSendGroupApi(data: UpdateMonitorSendGroupReq) {
  return requestClient.put(`/monitor/send_groups/update/${data.id}`, data);
}

// 删除发送组
export async function deleteMonitorSendGroupApi(id: number) {
  return requestClient.delete(`/monitor/send_groups/delete/${id}`);
}
