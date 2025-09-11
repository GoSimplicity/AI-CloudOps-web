import { requestClient } from '#/api/request';

// 配置类型枚举
export enum ConfigType {
  Prometheus = 1,    // Prometheus 主配置
  AlertManager = 2,  // AlertManager 主配置
  AlertRule = 3,     // 告警规则配置
  RecordRule = 4,    // 预聚合规则配置
  WebhookFile = 5,   // webhook file
}

// 配置状态枚举
export enum ConfigStatus {
  Active = 1,     // 激活状态
  Inactive = 2,   // 非激活状态
}

// 监控配置数据模型
export interface MonitorConfigItem {
  id: number;
  name: string;
  pool_id: number;
  instance_ip: string;
  config_type: ConfigType;
  config_content: string;
  config_hash: string;
  status: ConfigStatus;
  last_generated_time: number;
  created_at: string;
  updated_at: string;
}

// 获取监控配置列表请求参数
export interface GetMonitorConfigListParams {
  page: number;
  size: number;
  search?: string;
  config_type?: ConfigType;
  status?: ConfigStatus;
}

// 获取单个监控配置请求参数
export interface GetMonitorConfigParams {
  id: number;
}

// 通过实例获取监控配置请求参数
export interface GetMonitorConfigByInstanceParams {
  instance_ip: string;
  config_type: ConfigType;
}

// 创建监控配置请求参数
export interface CreateMonitorConfigParams {
  name: string;
  pool_id: number;
  instance_ip: string;
  config_type: ConfigType;
  config_content: string;
  status?: ConfigStatus;
}

// 更新监控配置请求参数
export interface UpdateMonitorConfigParams {
  id: number;
  name: string;
  pool_id?: number;
  instance_ip?: string;
  config_type?: ConfigType;
  config_content?: string;
  status?: ConfigStatus;
}

// 删除监控配置请求参数
export interface DeleteMonitorConfigParams {
  id: number;
}

// API 接口
export async function getMonitorConfigListApi(data: GetMonitorConfigListParams) {
  return requestClient.get('/monitor/configs/list', { params: data });
}

export async function getMonitorConfigApi(data: GetMonitorConfigParams) {
  return requestClient.get(`/monitor/configs/detail/${data.id}`);
}

export async function createMonitorConfigApi(data: CreateMonitorConfigParams) {
  return requestClient.post('/monitor/configs/create', data);
}

export async function updateMonitorConfigApi(data: UpdateMonitorConfigParams) {
  return requestClient.put(`/monitor/configs/update/${data.id}`, data);
}

export async function deleteMonitorConfigApi(data: DeleteMonitorConfigParams) {
  return requestClient.delete(`/monitor/configs/delete/${data.id}`);
}
