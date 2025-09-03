import { requestClient } from '#/api/request';

// 监控采集池配置
export interface MonitorScrapePool {
  id?: number;
  name: string;
  user_id: number;
  scrape_interval: number;
  scrape_timeout: number;
  remote_timeout_seconds: number;
  support_alert: number; // 1-启用, 2-禁用
  support_record: number; // 1-启用, 2-禁用
  prometheus_instances?: string[];
  tags?: string[];
  remote_write_url?: string;
  remote_read_url?: string;
  alert_manager_url?: string;
  rule_file_path?: string;
  record_file_path?: string;
  create_user_name?: string;
  created_at?: string;
  updated_at?: string;
}

// 获取监控采集池列表请求参数
export interface GetMonitorScrapePoolListReq {
  page?: number;
  size?: number;
  search?: string;
  support_alert?: number;
  support_record?: number;
}

// 创建监控采集池请求参数
export interface CreateMonitorScrapePoolReq {
  name: string;
  scrape_interval?: number;
  scrape_timeout?: number;
  remote_timeout_seconds?: number;
  support_alert?: number;
  support_record?: number;
  prometheus_instances?: string[];
  tags?: string[];
  remote_write_url?: string;
  remote_read_url?: string;
  alert_manager_url?: string;
  rule_file_path?: string;
  record_file_path?: string;
}

// 更新监控采集池请求参数
export interface UpdateMonitorScrapePoolReq {
  id: number;
  name: string;
  user_id?: number;
  scrape_interval?: number;
  scrape_timeout?: number;
  remote_timeout_seconds?: number;
  support_alert?: number;
  support_record?: number;
  prometheus_instances?: string[];
  tags?: string[];
  remote_write_url?: string;
  remote_read_url?: string;
  alert_manager_url?: string;
  rule_file_path?: string;
  record_file_path?: string;
}

// 删除监控采集池请求参数
export interface DeleteMonitorScrapePoolReq {
  id: number;
}

// 获取监控采集池详情请求参数
export interface GetMonitorScrapePoolDetailReq {
  id: number;
}

// 获取采集池列表
export async function getMonitorScrapePoolListApi(data: GetMonitorScrapePoolListReq) {
  return requestClient.get(`/monitor/scrape_pools/list`, { params: data });
}

// 创建采集池
export async function createMonitorScrapePoolApi(
  data: CreateMonitorScrapePoolReq,
) {
  return requestClient.post(`/monitor/scrape_pools/create`, data);
}

// 更新采集池
export async function updateMonitorScrapePoolApi(data: UpdateMonitorScrapePoolReq) {
  return requestClient.put(`/monitor/scrape_pools/update/${data.id}`, data);
}

// 删除采集池
export async function deleteMonitorScrapePoolApi(id: number) {
  return requestClient.delete(`/monitor/scrape_pools/delete/${id}`);
}

// 获取采集池详情
export async function getMonitorScrapePoolDetailApi(id: number) {
  return requestClient.get(`/monitor/scrape_pools/detail/${id}`);
}
