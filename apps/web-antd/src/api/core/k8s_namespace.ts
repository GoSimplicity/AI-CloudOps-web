import { requestClient } from '#/api/request';

// 命名空间相关接口和类型定义

export interface NamespaceDetails {
  name: string;
  uid: string;
  status: string;
  creation_time: string;
  labels: string[];
  annotations: string[];
}

export interface CreateNamespaceReq {
  cluster_id: number;
  namespace: string;
  labels: string[];
  annotations: string[];
}

export interface UpdateNamespaceReq {
  cluster_id: number;
  namespace: string;
  labels: string[];
  annotations: string[];
}

export interface NamespaceListReq {
  cluster_id: number;
  label_selector?: string;
  field_selector?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface NamespaceDeleteReq {
  cluster_id: number;
  name: string;
  grace_period_seconds?: number;
  force?: boolean;
}

export interface NamespaceBatchDeleteReq {
  cluster_id: number;
  names: string[];
  grace_period_seconds?: number;
  force?: boolean;
}

export interface NamespaceResource {
  type: string;
  name: string;
  namespace: string;
  status: string;
  creation_time: string;
}

export interface NamespaceEvent {
  reason: string;
  message: string;
  type: string;
  first_timestamp: string;
  last_timestamp: string;
  count: number;
  source: string;
}

export interface ResourceQuota {
  cpu_request?: string;
  cpu_limit?: string;
  memory_request?: string;
  memory_limit?: string;
  storage_request?: string;
  persistent_volume_claims?: string;
  pods?: string;
  services?: string;
  secrets?: string;
  configmaps?: string;
}

// 命名空间相关API函数

/**
 * 获取所有命名空间列表
 */
export async function getAllNamespacesApi() {
  return requestClient.get<string[]>('/k8s/namespaces/list');
}

/**
 * 根据集群ID获取命名空间列表
 */
export async function getNamespacesByClusterIdApi(id: number) {
  return requestClient.get(`/k8s/namespaces/select/${id}`);
}

/**
 * 创建命名空间
 */
export async function createNamespaceApi(data: CreateNamespaceReq) {
  return requestClient.post('/k8s/namespaces/create', data);
}

/**
 * 删除命名空间
 */
export async function deleteNamespaceApi(id: number, name: string) {
  return requestClient.delete(`/k8s/namespaces/delete/${id}?name=${name}`);
}

/**
 * 批量删除命名空间
 */
export async function batchDeleteNamespaceApi(data: NamespaceBatchDeleteReq) {
  return requestClient.delete('/k8s/namespaces/batch_delete', { data });
}

/**
 * 获取命名空间详细信息
 */
export async function getNamespaceDetailsApi(id: number, name: string) {
  return requestClient.get<NamespaceDetails>(
    `/k8s/namespaces/${id}?name=${name}`,
  );
}

/**
 * 更新命名空间
 */
export async function updateNamespaceApi(data: UpdateNamespaceReq) {
  return requestClient.post('/k8s/namespaces/update', data);
}

/**
 * 获取命名空间中的资源
 */
export async function getNamespaceResourcesApi(id: number, name: string) {
  return requestClient.get<NamespaceResource[]>(
    `/k8s/namespaces/${id}/resources?name=${name}`,
  );
}

/**
 * 获取命名空间事件
 */
export async function getNamespaceEventsApi(id: number, name: string) {
  return requestClient.get<NamespaceEvent[]>(`/k8s/namespaces/${id}/events?name=${name}`);
}

/**
 * 设置命名空间资源配额
 */
export async function setNamespaceQuotaApi(cluster_id: number, name: string, quota: ResourceQuota) {
  return requestClient.post('/k8s/namespaces/quota', {
    cluster_id,
    name,
    resource_quota: quota,
  });
}

/**
 * 获取命名空间资源配额
 */
export async function getNamespaceQuotaApi(cluster_id: number, name: string) {
  return requestClient.get(`/k8s/namespaces/${cluster_id}/quota?name=${name}`);
}
