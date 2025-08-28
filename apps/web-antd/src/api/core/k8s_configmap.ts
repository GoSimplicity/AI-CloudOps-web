import { requestClient } from '#/api/request';

// ConfigMap相关接口和类型定义

export interface ConfigMapInfo {
  name: string;
  namespace: string;
  cluster_id: number;
  uid: string;
  data?: Record<string, string>;
  binary_data?: Record<string, Uint8Array>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creation_timestamp: string;
  age: string;
  data_count: number;
  size: string;
}

export interface ConfigMapListReq {
  cluster_id: number;
  namespace?: string;
  label_selector?: string;
  field_selector?: string;
  data_key?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface ConfigMapCreateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  data?: Record<string, string>;
  binary_data?: Record<string, Uint8Array>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  configmap_yaml?: any;
}

export interface ConfigMapUpdateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  data?: Record<string, string>;
  binary_data?: Record<string, Uint8Array>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  configmap_yaml?: any;
}

export interface ConfigMapDeleteReq {
  cluster_id: number;
  namespace: string;
  name: string;
  grace_period_seconds?: number;
  force?: boolean;
}

export interface ConfigMapBatchDeleteReq {
  cluster_id: number;
  namespace: string;
  names: string[];
  grace_period_seconds?: number;
  force?: boolean;
}

export interface ConfigMapDataReq {
  cluster_id: number;
  namespace: string;
  name: string;
  key?: string;
}

export interface ConfigMapUsageInfo {
  pods: string[];
  deployments: string[];
  services: string[];
}

export interface ConfigMapBackupReq {
  cluster_id: number;
  namespace: string;
  names: string[];
  backup_name: string;
  description?: string;
}

// ConfigMap相关API函数

/**
 * 获取ConfigMap列表
 */
export async function getConfigMapListApi(id: number, namespace: string) {
  return requestClient.get<ConfigMapInfo[]>(`/k8s/configmaps/${id}?namespace=${namespace}`);
}

/**
 * 获取ConfigMap列表（支持多种过滤条件）
 */
export async function getConfigMapListWithFilterApi(data: ConfigMapListReq) {
  const params = new URLSearchParams();
  if (data.namespace) params.append('namespace', data.namespace);
  if (data.label_selector) params.append('label_selector', data.label_selector);
  if (data.field_selector) params.append('field_selector', data.field_selector);
  if (data.data_key) params.append('data_key', data.data_key);
  if (data.status) params.append('status', data.status);
  if (data.page) params.append('page', data.page.toString());
  if (data.page_size) params.append('page_size', data.page_size.toString());
  
  return requestClient.get<ConfigMapInfo[]>(`/k8s/configmaps/${data.cluster_id}/list?${params}`);
}

/**
 * 获取ConfigMap的YAML配置
 */
export async function getConfigMapYamlApi(
  id: number,
  configmap_name: string,
  namespace: string,
) {
  return requestClient.get(
    `/k8s/configmaps/${id}/yaml?namespace=${namespace}&configmap_name=${configmap_name}`,
  );
}

/**
 * 删除ConfigMap
 */
export async function deleteConfigMapApi(
  id: number,
  namespace: string,
  configmap_name: string,
) {
  return requestClient.delete(
    `/k8s/configmaps/delete/${id}?namespace=${namespace}&configmap_name=${configmap_name}`,
  );
}

/**
 * 批量删除ConfigMap
 */
export async function batchDeleteConfigMapApi(data: ConfigMapBatchDeleteReq) {
  return requestClient.delete('/k8s/configmaps/batch_delete', { data });
}

/**
 * 创建ConfigMap
 */
export async function createConfigMapApi(data: ConfigMapCreateReq) {
  return requestClient.post('/k8s/configmaps/create', data);
}

/**
 * 更新ConfigMap
 */
export async function updateConfigMapApi(data: ConfigMapUpdateReq) {
  return requestClient.post('/k8s/configmaps/update', data);
}

/**
 * 获取ConfigMap数据
 */
export async function getConfigMapDataApi(data: ConfigMapDataReq) {
  const params = new URLSearchParams();
  if (data.key) params.append('key', data.key);
  
  return requestClient.get(`/k8s/configmaps/${data.cluster_id}/${data.name}/data?namespace=${data.namespace}&${params}`);
}

/**
 * 获取ConfigMap事件
 */
export async function getConfigMapEventsApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/configmaps/${cluster_id}/${name}/events?namespace=${namespace}`);
}

/**
 * 获取ConfigMap使用情况
 */
export async function getConfigMapUsageApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get<ConfigMapUsageInfo>(`/k8s/configmaps/${cluster_id}/${name}/usage?namespace=${namespace}`);
}

/**
 * 备份ConfigMap
 */
export async function backupConfigMapApi(data: ConfigMapBackupReq) {
  return requestClient.post('/k8s/configmaps/backup', data);
}

/**
 * 从文件创建ConfigMap
 */
export async function createConfigMapFromFileApi(cluster_id: number, namespace: string, name: string, files: File[]) {
  const formData = new FormData();
  formData.append('cluster_id', cluster_id.toString());
  formData.append('namespace', namespace);
  formData.append('name', name);
  files.forEach((file, index) => {
    formData.append(`file_${index}`, file);
  });
  
  return requestClient.post('/k8s/configmaps/create_from_file', formData);
}
