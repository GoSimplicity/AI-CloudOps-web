import { requestClient } from '#/api/request';

// 集群相关接口和类型定义

export interface ClustersItem {
  restricted_name_space: string[];
  kube_config_content: string;
  id: number;
  name: string;
  name_zh: string;
  user_id: number;
  status: string;
  cpu_request: string;
  cpu_limit: string;
  memory_request: string;
  memory_limit: string;
  version: string;
  env: string;
  api_server_addr: string;
  action_timeout_seconds: number;
  created_at: string;
}

export interface CreateClusterReq {
  name: string;
  name_zh: string;
  version: string;
  env: string;
  cpu_request: string;
  cpu_limit: string;
  memory_request: string;
  memory_limit: string;
  restricted_name_space: string[];
  api_server_addr: string;
  kube_config_content: string;
  action_timeout_seconds: number;
}

export interface UpdateClusterReq {
  id: number;
  name: string;
  name_zh: string;
  version: string;
  env: string;
  cpu_request: string;
  cpu_limit: string;
  memory_request: string;
  memory_limit: string;
  restricted_name_space: string[];
  api_server_addr: string;
  kube_config_content: string;
  action_timeout_seconds: number;
}

export interface ClusterNamespaces {
  cluster_name: string;
  cluster_id: number;
  namespaces: NamespaceItem[];
}

export interface NamespaceItem {
  name: string;
  uid: string;
  status: string;
  creation_time: string;
  labels?: string[];
  annotations?: string[];
}

// 集群相关API函数

/**
 * 获取所有集群列表
 */
export async function getAllClustersApi() {
  return requestClient.get('/k8s/clusters/list');
}

/**
 * 根据ID获取单个集群信息
 */
export async function getClusterApi(id: number) {
  return requestClient.get(`/k8s/clusters/${id}`);
}

/**
 * 创建新集群
 */
export async function createClusterApi(data: CreateClusterReq) {
  return requestClient.post('/k8s/clusters/create', data);
}

/**
 * 更新集群信息
 */
export async function updateClusterApi(data: UpdateClusterReq) {
  return requestClient.post('/k8s/clusters/update', data);
}

/**
 * 删除集群
 */
export async function deleteClusterApi(id: number) {
  return requestClient.delete(`/k8s/clusters/delete/${id}`);
}

/**
 * 批量删除集群
 */
export async function batchDeleteClusterApi(data: number[]) {
  return requestClient.delete('/k8s/clusters/batch_delete', { data });
}

/**
 * 刷新集群状态
 */
export async function refreshClusterApi(id: number) {
  return requestClient.post(`/k8s/clusters/refresh/${id}`);
}
