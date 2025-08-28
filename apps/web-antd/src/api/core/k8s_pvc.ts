import { requestClient } from '#/api/request';

// PersistentVolumeClaim相关接口和类型定义

export interface PVCInfo {
  name: string;
  namespace: string;
  cluster_id: number;
  uid: string;
  status: string;
  volume?: string;
  capacity?: string;
  access_modes: string[];
  storage_class?: string;
  volume_mode?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creation_timestamp: string;
  age: string;
  usage?: string;
}

export interface PVCListReq {
  cluster_id: number;
  namespace?: string;
  label_selector?: string;
  field_selector?: string;
  status?: string;
  storage_class?: string;
  volume_mode?: string;
  page?: number;
  page_size?: number;
}

export interface PVCCreateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  access_modes: string[];
  resources: {
    requests: {
      storage: string;
    };
  };
  storage_class?: string;
  volume_mode?: string;
  selector?: {
    match_labels?: Record<string, string>;
    match_expressions?: Array<{
      key: string;
      operator: string;
      values?: string[];
    }>;
  };
  volume_name?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface PVCUpdateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  resources?: {
    requests: {
      storage: string;
    };
  };
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface PVCDeleteReq {
  cluster_id: number;
  namespace: string;
  name: string;
  force?: boolean;
}

export interface PVCBatchDeleteReq {
  cluster_id: number;
  namespace: string;
  names: string[];
  force?: boolean;
}

export interface PVCUsageInfo {
  pods: string[];
  total_usage: string;
  available_space: string;
}

export interface PVCStatistics {
  total_count: number;
  bound_count: number;
  pending_count: number;
  lost_count: number;
  total_capacity: string;
  used_capacity: string;
}

// PersistentVolumeClaim相关API函数

/**
 * 获取PVC列表
 */
export async function getPVCListApi(data: PVCListReq) {
  const params = new URLSearchParams();
  if (data.namespace) params.append('namespace', data.namespace);
  if (data.label_selector) params.append('label_selector', data.label_selector);
  if (data.field_selector) params.append('field_selector', data.field_selector);
  if (data.status) params.append('status', data.status);
  if (data.storage_class) params.append('storage_class', data.storage_class);
  if (data.volume_mode) params.append('volume_mode', data.volume_mode);
  if (data.page) params.append('page', data.page.toString());
  if (data.page_size) params.append('page_size', data.page_size.toString());

  return requestClient.get<PVCInfo[]>(`/k8s/pvc/${data.cluster_id}?${params}`);
}

/**
 * 获取PVC详情
 */
export async function getPVCDetailApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get<PVCInfo>(`/k8s/pvc/${cluster_id}/${namespace}/${name}`);
}

/**
 * 创建PVC
 */
export async function createPVCApi(data: PVCCreateReq) {
  return requestClient.post('/k8s/pvc/create', data);
}

/**
 * 更新PVC
 */
export async function updatePVCApi(data: PVCUpdateReq) {
  return requestClient.post('/k8s/pvc/update', data);
}

/**
 * 删除PVC
 */
export async function deletePVCApi(data: PVCDeleteReq) {
  return requestClient.delete('/k8s/pvc/delete', { data });
}

/**
 * 批量删除PVC
 */
export async function batchDeletePVCApi(data: PVCBatchDeleteReq) {
  return requestClient.delete('/k8s/pvc/batch_delete', { data });
}

/**
 * 获取PVC使用情况
 */
export async function getPVCUsageApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get<PVCUsageInfo>(`/k8s/pvc/${cluster_id}/${namespace}/${name}/usage`);
}

/**
 * 获取PVC统计信息
 */
export async function getPVCStatisticsApi(cluster_id: number, namespace?: string) {
  const params = new URLSearchParams();
  if (namespace) params.append('namespace', namespace);

  return requestClient.get<PVCStatistics>(`/k8s/pvc/${cluster_id}/statistics?${params}`);
}

/**
 * 扩容PVC
 */
export async function expandPVCApi(cluster_id: number, namespace: string, name: string, new_size: string) {
  return requestClient.post('/k8s/pvc/expand', {
    cluster_id,
    namespace,
    name,
    new_size,
  });
}

/**
 * 获取PVC的YAML配置
 */
export async function getPVCYamlApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/pvc/${cluster_id}/${namespace}/${name}/yaml`);
}

/**
 * 克隆PVC
 */
export async function clonePVCApi(cluster_id: number, source_namespace: string, source_name: string, target_namespace: string, target_name: string) {
  return requestClient.post('/k8s/pvc/clone', {
    cluster_id,
    source_namespace,
    source_name,
    target_namespace,
    target_name,
  });
}

/**
 * 快照PVC
 */
export async function snapshotPVCApi(cluster_id: number, namespace: string, name: string, snapshot_name: string, snapshot_class?: string) {
  return requestClient.post('/k8s/pvc/snapshot', {
    cluster_id,
    namespace,
    name,
    snapshot_name,
    snapshot_class,
  });
}
