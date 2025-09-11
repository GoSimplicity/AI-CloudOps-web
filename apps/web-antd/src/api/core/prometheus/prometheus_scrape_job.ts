import { requestClient } from '#/api/request';

// 服务发现类型枚举
export enum ServiceDiscoveryType {
  K8s = 1,
  Http = 2,
  Static = 3
}

// 监控采集任务配置
export interface MonitorScrapeJob {
  id?: number;
  name: string;
  user_id: number;
  enable: number; // 1-启用, 2-禁用
  service_discovery_type: ServiceDiscoveryType;
  metrics_path: string;
  scheme: string;
  scrape_interval: number;
  scrape_timeout: number;
  pool_id: number;
  relabel_configs_yaml_string?: string;
  refresh_interval: number;
  port: number;
  ip_address?: string;
  kube_config_file_path?: string;
  tls_ca_file_path?: string;
  tls_ca_content?: string;
  bearer_token?: string;
  bearer_token_file?: string;
  kubernetes_sd_role?: string;
  create_user_name?: string;
  tree_node_ids?: string[];
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

// 获取监控采集任务列表请求参数
export interface GetMonitorScrapeJobListReq {
  page?: number;
  size?: number;
  search?: string;
  pool_id?: number;
  enable?: number;
}

// 创建监控采集任务请求参数
export interface CreateMonitorScrapeJobReq {
  name: string;
  enable?: number;
  service_discovery_type?: ServiceDiscoveryType;
  metrics_path?: string;
  scheme?: string;
  scrape_interval?: number;
  scrape_timeout?: number;
  pool_id: number;
  relabel_configs_yaml_string?: string;
  refresh_interval?: number;
  port?: number;
  ip_address?: string;
  kube_config_file_path?: string;
  tls_ca_file_path?: string;
  tls_ca_content?: string;
  bearer_token?: string;
  bearer_token_file?: string;
  kubernetes_sd_role?: string;
  tree_node_ids?: string[];
  tags?: string[];
}

// 更新监控采集任务请求参数
export interface UpdateMonitorScrapeJobReq {
  id: number;
  name: string;
  enable?: number;
  service_discovery_type?: ServiceDiscoveryType;
  metrics_path?: string;
  scheme?: string;
  scrape_interval?: number;
  scrape_timeout?: number;
  pool_id?: number;
  relabel_configs_yaml_string?: string;
  refresh_interval?: number;
  port?: number;
  ip_address?: string;
  kube_config_file_path?: string;
  tls_ca_file_path?: string;
  tls_ca_content?: string;
  bearer_token?: string;
  bearer_token_file?: string;
  kubernetes_sd_role?: string;
  tree_node_ids?: string[];
  tags?: string[];
}

// 删除监控采集任务请求参数
export interface DeleteMonitorScrapeJobReq {
  id: number;
}

// 获取监控采集任务详情请求参数
export interface GetMonitorScrapeJobDetailReq {
  id: number;
}

export async function getMonitorScrapeJobListApi(data: GetMonitorScrapeJobListReq) {
  return requestClient.get(`/monitor/scrape_jobs/list`, { params: data });
}

export async function createMonitorScrapeJobApi(data: CreateMonitorScrapeJobReq) {
  return requestClient.post(`/monitor/scrape_jobs/create`, data);
}

export async function updateMonitorScrapeJobApi(data: UpdateMonitorScrapeJobReq) {
  return requestClient.put(`/monitor/scrape_jobs/update/${data.id}`, data);
}

export async function deleteMonitorScrapeJobApi(id: number) {
  return requestClient.delete(`/monitor/scrape_jobs/delete/${id}`);
}

export async function getMonitorScrapeJobDetailApi(id: number) {
  return requestClient.get(`/monitor/scrape_jobs/detail/${id}`);
}
