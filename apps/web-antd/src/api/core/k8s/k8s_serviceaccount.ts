import { requestClient } from '#/api/request';

// ServiceAccount相关接口和类型定义

export interface ServiceAccountInfo {
  name: string;
  namespace: string;
  cluster_id: number;
  uid: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creation_timestamp: string;
  age: string;
  secrets_count: number;
  image_pull_secrets_count: number;
  automount_service_account_token?: boolean;
}

export interface ServiceAccountDetails extends ServiceAccountInfo {
  secrets: ServiceAccountSecret[];
  image_pull_secrets: ServiceAccountSecret[];
  token?: string;
  ca_cert?: string;
}

export interface ServiceAccountSecret {
  name: string;
  namespace: string;
  type: string;
}

export interface ServiceAccountListReq {
  cluster_id: number;
  namespace?: string;
  label_selector?: string;
  field_selector?: string;
  search?: string;
  page?: number;
  size?: number;
}

export interface ServiceAccountCreateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  automount_service_account_token?: boolean;
  image_pull_secrets?: string[];
}

export interface ServiceAccountUpdateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  automount_service_account_token?: boolean;
  image_pull_secrets?: string[];
}

export interface ServiceAccountDeleteReq {
  cluster_id: number;
  namespace: string;
  name: string;
  grace_period_seconds?: number;
  force?: boolean;
}

export interface ServiceAccountBatchDeleteReq {
  cluster_id: number;
  namespace: string;
  names: string[];
  grace_period_seconds?: number;
  force?: boolean;
}

export interface ServiceAccountStatistics {
  total_count: number;
  active_count: number;
  with_secrets_count: number;
  with_image_pull_secrets_count: number;
  auto_mount_enabled_count: number;
}

export interface ServiceAccountTokenReq {
  cluster_id: number;
  namespace: string;
  name: string;
  expiration_seconds?: number;
}

export interface ServiceAccountTokenResp {
  token: string;
  expiration_timestamp?: string;
}

// API 接口函数

/**
 * 获取ServiceAccount列表
 */
export function getServiceAccountListApi(params: ServiceAccountListReq) {
  return requestClient.get('/k8s/serviceaccount/list', {
    params,
  });
}

/**
 * 获取ServiceAccount详情
 */
export function getServiceAccountDetailsApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get<ServiceAccountDetails>('/k8s/serviceaccount/details', {
    params: { cluster_id, namespace, name },
  });
}

/**
 * 创建ServiceAccount
 */
export function createServiceAccountApi(data: ServiceAccountCreateReq) {
  return requestClient.post('/k8s/serviceaccount/create', data);
}

/**
 * 更新ServiceAccount
 */
export function updateServiceAccountApi(data: ServiceAccountUpdateReq) {
  return requestClient.put('/k8s/serviceaccount/update', data);
}

/**
 * 删除ServiceAccount
 */
export function deleteServiceAccountApi(data: ServiceAccountDeleteReq) {
  return requestClient.delete('/k8s/serviceaccount/delete', { data });
}

/**
 * 批量删除ServiceAccount
 */
export function batchDeleteServiceAccountApi(data: ServiceAccountBatchDeleteReq) {
  return requestClient.delete('/k8s/serviceaccount/batch-delete', { data });
}

/**
 * 获取ServiceAccount统计信息
 */
export function getServiceAccountStatisticsApi(cluster_id: number, namespace?: string) {
  return requestClient.get<ServiceAccountStatistics>('/k8s/serviceaccount/statistics', {
    params: { cluster_id, namespace },
  });
}

/**
 * 获取ServiceAccount令牌
 */
export function getServiceAccountTokenApi(data: ServiceAccountTokenReq) {
  return requestClient.post<ServiceAccountTokenResp>('/k8s/serviceaccount/token', data);
}

/**
 * 获取ServiceAccount YAML
 */
export function getServiceAccountYamlApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get<{ yaml: string }>('/k8s/serviceaccount/yaml', {
    params: { cluster_id, namespace, name },
  });
}

/**
 * 更新ServiceAccount YAML
 */
export function updateServiceAccountYamlApi(cluster_id: number, namespace: string, name: string, yaml: string) {
  return requestClient.put('/k8s/serviceaccount/yaml', {
    cluster_id,
    namespace, 
    name,
    yaml,
  });
}
